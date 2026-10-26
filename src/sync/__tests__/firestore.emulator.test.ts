// Runs against the Firebase emulators with the real security rules:
//   npm run test:emulator
// Skipped in a plain `npm test`.

import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth, signOut } from 'firebase/auth';
import { collection, connectFirestoreEmulator, getDoc, getDocs, initializeFirestore, doc, type Firestore } from 'firebase/firestore';
import { connectStorageEmulator, getStorage, ref, uploadBytes } from 'firebase/storage';
import { afterAll, describe, expect, it } from 'vitest';

import { slotsOfLevel } from '../../core/grid';
import { addItem, createBin, createCategory, createUnit, ensureOthers, takeOut } from '../../core/ops';
import { emptyTables, type Tables } from '../../core/types';
import { diffTables } from '../../data/diff';
import { MemoryRecords, mergeRecords } from '../../data/records';
import { SyncEngine } from '../engine';
import { FirestoreRemote } from '../firestoreRemote';

const HOST = process.env.FIRESTORE_EMULATOR_HOST;
const run = HOST ? describe : describe.skip;
const apps: FirebaseApp[] = [];

function connect(name: string) {
  const app = initializeApp(
    { apiKey: 'demo', projectId: process.env.GCLOUD_PROJECT ?? 'demo-atlas', storageBucket: 'demo-atlas.appspot.com', appId: 'demo' },
    name,
  );
  apps.push(app);
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const db = initializeFirestore(app, { ignoreUndefinedProperties: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  const storage = getStorage(app);
  connectStorageEmulator(storage, '127.0.0.1', 9199);
  return { auth, db, storage };
}

class Phone {
  tables: Tables = emptyTables();
  records = new MemoryRecords();
  engine: SyncEngine;
  constructor(db: Firestore, uid: string) {
    this.engine = new SyncEngine(this.records, new FirestoreRemote(db, uid), (r) => (this.tables = mergeRecords(this.tables, r)));
    this.change(ensureOthers);
  }
  change(op: (t: Tables) => Tables) {
    const next = op(this.tables);
    this.records.save(diffTables(this.tables, next));
    this.tables = next;
  }
}

async function until(check: () => boolean, ms = 8000) {
  const end = Date.now() + ms;
  while (!check()) {
    if (Date.now() > end) throw new Error('timed out waiting for sync');
    await new Promise((r) => setTimeout(r, 50));
  }
}

afterAll(async () => {
  await Promise.all(apps.map((a) => deleteApp(a)));
});

run('Firestore sync (emulator)', () => {
  const email = `vitor+${Date.now()}@example.com`;
  let uid = '';
  let phoneA: Phone;
  let phoneB: Phone;
  let fbA: ReturnType<typeof connect>;

  it('pushes a house as one document per record, with readable fields', async () => {
    fbA = connect('a');
    uid = (await createUserWithEmailAndPassword(fbA.auth, email, 'secret123')).user.uid;
    phoneA = new Phone(fbA.db, uid);
    phoneA.change((t) => {
      let x = createUnit(t, { name: 'Wardrobe', kind: 'shelving' }).tables;
      const level = Object.values(x.levels)[0];
      const c = createCategory(x, { name: 'Cables' });
      const b = createBin(c.tables, { categoryId: c.categoryId, slotId: slotsOfLevel(c.tables, level.id)[0].id });
      x = addItem(b.tables, { name: 'USB-C cable', home: { binId: b.binId }, quantity: 3 }).tables;
      return x;
    });
    await phoneA.engine.start();
    expect(await phoneA.records.pending()).toEqual([]);

    const items = await getDocs(collection(fbA.db, 'users', uid, 'items'));
    expect(items.size).toBe(1);
    const item = items.docs[0].data();
    expect(item).toMatchObject({ name: 'USB-C cable', quantityTotal: 3, quantityOut: 0, _deleted: false });
    expect(typeof item._v).toBe('number');
    const others = await getDoc(doc(fbA.db, 'users', uid, 'bins', 'others-bin'));
    expect(others.data()).toMatchObject({ number: 0, isOthers: true });
  });

  it('a second phone signed in to the same account receives it, and changes flow back', async () => {
    const fbB = connect('b');
    const { signInWithEmailAndPassword } = await import('firebase/auth');
    await signInWithEmailAndPassword(fbB.auth, email, 'secret123');
    phoneB = new Phone(fbB.db, uid);
    await phoneB.engine.start();
    await until(() => Object.keys(phoneB.tables.items).length === 1);
    expect(Object.values(phoneB.tables.bins).filter((b) => b.isOthers)).toHaveLength(1);

    const id = Object.keys(phoneB.tables.items)[0];
    phoneB.change((t) => takeOut(t, id, 2));
    await phoneB.engine.push();
    await until(() => phoneA.tables.items[id]?.quantityOut === 2);
  });

  it('the rules keep another account out', async () => {
    const intruder = connect('c');
    await createUserWithEmailAndPassword(intruder.auth, `other+${Date.now()}@example.com`, 'secret123');
    await expect(getDocs(collection(intruder.db, 'users', uid, 'items'))).rejects.toMatchObject({ code: 'permission-denied' });
    await signOut(intruder.auth);
    await expect(getDocs(collection(intruder.db, 'users', uid, 'items'))).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('photos upload to the owner’s folder only', async () => {
    const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    await uploadBytes(ref(fbA.storage, `users/${uid}/photos/test.png`), png, { contentType: 'image/png' });
    await expect(uploadBytes(ref(fbA.storage, `users/someone-else/photos/test.png`), png, { contentType: 'image/png' })).rejects.toThrow();
    await expect(uploadBytes(ref(fbA.storage, `users/${uid}/photos/notes.txt`), png, { contentType: 'text/plain' })).rejects.toThrow();
    phoneA.engine.stop();
    phoneB.engine.stop();
  });
});
