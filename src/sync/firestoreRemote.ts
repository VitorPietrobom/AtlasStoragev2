// Cloud layout (Firestore), one collection per entity under the user:
//
//   users/{uid}/units/{id}   levels, slots, zones, bins, categories, items,
//   users/{uid}/events/{id}  corrections, settings (one doc: "settings")
//
// Each document holds the record's own fields as plain Firestore fields, so
// any other app can read it, plus three sync fields:
//   _v        last-writer-wins version (ms on the writing device)
//   _deleted  true for a tombstone (the record's fields are dropped)
//   _at       server time of the write, used to fetch only what's new

import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore';

import { TABLE_NAMES, type TableName } from '../core/types';
import type { Remote, RemoteBatch, SyncRecord } from './types';

const SYNC_FIELDS = ['_v', '_deleted', '_at'] as const;

export function toDoc(r: SyncRecord): DocumentData {
  if (r.data === null) return { _v: r.version, _deleted: true, _at: serverTimestamp() };
  return { ...(r.data as object), _v: r.version, _deleted: false, _at: serverTimestamp() };
}

export function fromDoc(table: TableName, id: string, d: DocumentData): SyncRecord {
  const version = typeof d._v === 'number' ? d._v : 0;
  if (d._deleted) return { table, id, data: null, version };
  const data: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(d)) if (!(SYNC_FIELDS as readonly string[]).includes(k)) data[k] = v;
  return { table, id, data, version };
}

export class FirestoreRemote implements Remote {
  constructor(
    private db: Firestore,
    private uid: string,
  ) {}

  private col(table: TableName) {
    return collection(this.db, 'users', this.uid, table);
  }

  async push(records: SyncRecord[]): Promise<void> {
    const batch = writeBatch(this.db);
    for (const r of records) batch.set(doc(this.col(r.table), r.id), toDoc(r));
    await batch.commit();
  }

  subscribe(
    cursors: Partial<Record<TableName, number | null>>,
    onBatch: (b: RemoteBatch) => void,
    onError: (e: unknown) => void,
  ): () => void {
    const stops = TABLE_NAMES.map((table) => {
      const since = cursors[table];
      const q = since ? query(this.col(table), where('_at', '>', Timestamp.fromMillis(since))) : this.col(table);
      return onSnapshot(
        q,
        (snap) => {
          const records: SyncRecord[] = [];
          let cursor: number | null = null;
          for (const change of snap.docChanges()) {
            if (change.type === 'removed') continue;
            // Our own write, not yet confirmed by the server: we already have it.
            if (change.doc.metadata.hasPendingWrites) continue;
            const d = change.doc.data();
            records.push(fromDoc(table, change.doc.id, d));
            const at = d._at instanceof Timestamp ? d._at.toMillis() : null;
            if (at !== null && (cursor === null || at > cursor)) cursor = at;
          }
          if (records.length) onBatch({ table, records, cursor });
        },
        onError,
      );
    });
    return () => stops.forEach((s) => s());
  }
}
