// Web preview only (used to check screens in a browser): the whole house as
// one JSON blob in localStorage.

import { emptyTables, TABLE_NAMES, type Tables } from '../core/types';
import type { Change } from './diff';

const KEY = 'atlas.tables.v1';
let cache: Tables | null = null;

function read(): Tables | null {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Tables>;
    const t = emptyTables();
    for (const name of TABLE_NAMES) if (parsed[name]) (t[name] as unknown) = parsed[name];
    return t;
  } catch {
    return null;
  }
}

export async function load(): Promise<Tables | null> {
  cache = read();
  return cache;
}

export async function save(changes: Change[]): Promise<void> {
  if (changes.length === 0) return;
  const t = cache ?? emptyTables();
  for (const c of changes) {
    const table = { ...(t[c.table] as Record<string, unknown>) };
    if (c.kind === 'upsert') table[c.id] = c.data;
    else delete table[c.id];
    (t[c.table] as unknown) = table;
  }
  cache = t;
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(t));
  } catch {
    // Storage full or blocked: the preview keeps working in memory.
  }
}

export async function clear(): Promise<void> {
  cache = null;
  try {
    globalThis.localStorage?.removeItem(KEY);
  } catch {}
}
