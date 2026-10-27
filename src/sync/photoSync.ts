// Photos ride along with sync, inside Firestore so the free plan is enough:
// each photo becomes users/{uid}/photos/{file name} holding a small copy
// (longest side 640 px; stickers stay PNG for their transparent edges) as
// base64. The full-size original stays on the phone that took it; other
// devices download the small copy the first time they show it.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { doc, getDoc, serverTimestamp, setDoc, type Firestore } from 'firebase/firestore';

import type { Tables } from '../core/types';
import { photoFile, photoName } from '../data/photos';

const UPLOADED_KEY = 'atlas.photos.uploaded';
/** Firestore documents max out at 1 MiB; stay well under it. */
const MAX_BASE64 = 700_000;

function refsIn(t: Tables): string[] {
  const out: string[] = [];
  for (const i of Object.values(t.items)) out.push(i.photoUri ?? '', i.stickerUri ?? '');
  for (const b of Object.values(t.bins)) out.push(b.photoUri ?? '');
  return out.map(photoName).filter((n): n is string => !!n);
}

/** A small copy of the image as base64, shrinking until it fits in a document. */
async function smallCopy(uri: string, png: boolean): Promise<{ base64: string; width: number; height: number } | null> {
  const original = await ImageManipulator.manipulate(uri).renderAsync();
  for (const side of [640, 480, 320]) {
    const ctx = ImageManipulator.manipulate(original);
    if (Math.max(original.width, original.height) > side)
      ctx.resize(original.width >= original.height ? { width: side } : { height: side });
    const img = await ctx.renderAsync();
    const saved = await img.saveAsync({ format: png ? SaveFormat.PNG : SaveFormat.JPEG, compress: 0.7, base64: true });
    if (saved.base64 && saved.base64.length <= MAX_BASE64) return { base64: saved.base64, width: saved.width, height: saved.height };
  }
  return null;
}

const photoDoc = (db: Firestore, uid: string, name: string) => doc(db, 'users', uid, 'photos', name);

let running: Promise<void> | null = null;

/** Upload every local photo the cloud doesn't have yet. */
export function uploadPhotos(db: Firestore, uid: string, t: Tables): Promise<void> {
  running ??= (async () => {
    try {
      const done = new Set<string>(JSON.parse((await AsyncStorage.getItem(UPLOADED_KEY)) ?? '[]'));
      for (const name of refsIn(t)) {
        if (done.has(name)) continue;
        const f = photoFile(name);
        if (!f.exists) continue;
        const png = name.endsWith('.png');
        const copy = await smallCopy(f.uri, png);
        if (!copy) continue;
        await setDoc(photoDoc(db, uid, name), {
          data: copy.base64,
          contentType: png ? 'image/png' : 'image/jpeg',
          width: copy.width,
          height: copy.height,
          _at: serverTimestamp(),
        });
        done.add(name);
        await AsyncStorage.setItem(UPLOADED_KEY, JSON.stringify([...done]));
      }
    } finally {
      running = null;
    }
  })();
  return running;
}

const downloading = new Map<string, Promise<string | undefined>>();

/** Fetch a photo this device doesn't have; resolves to its local URI. */
export function downloadPhoto(db: Firestore, uid: string, name: string): Promise<string | undefined> {
  let p = downloading.get(name);
  if (!p) {
    p = (async () => {
      try {
        const snap = await getDoc(photoDoc(db, uid, name));
        const data = snap.data()?.data;
        if (typeof data !== 'string') throw new Error('not uploaded yet');
        const dest = photoFile(name);
        if (!dest.exists) await dest.write(data, { encoding: 'base64' });
        return dest.uri;
      } catch {
        downloading.delete(name);
        return undefined;
      }
    })();
    downloading.set(name, p);
  }
  return p;
}
