// Web: records in localStorage, synced the same way as on the phone.

import type { Tables } from '../core/types';
import type { Change } from './diff';
import { MemoryRecords, type Row } from './records';

const KEY = 'atlas.records.v2';

let saveTimer: ReturnType<typeof setTimeout> | null = null;
function writeSoon() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      globalThis.localStorage?.setItem(KEY, JSON.stringify({ rows: [...store.rows.values()], cursors: store.cursors }));
    } catch {
      // Storage full or blocked: keep working in memory.
    }
  }, 50);
}

const store = new MemoryRecords(writeSoon);

function read() {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as { rows: Row[]; cursors: MemoryRecords['cursors'] };
    for (const r of parsed.rows) store.rows.set(`${r.table}/${r.id}`, r);
    store.cursors = parsed.cursors ?? {};
  } catch {}
}

export async function load(): Promise<Tables | null> {
  read();
  return store.load();
}

export async function save(changes: Change[]): Promise<void> {
  store.save(changes);
}

export async function clear(): Promise<void> {
  store.clear();
}

export const syncStore = store;
