// On device: one SQLite table of records. Everything is loaded into memory at
// start (a house is a few thousand rows at most) and changes are written back
// as they happen. updated_at is kept per row for a future sync.

import * as SQLite from 'expo-sqlite';

import { emptyTables, TABLE_NAMES, type Tables } from '../core/types';
import type { Change } from './diff';

const DB_NAME = 'atlas.db';
let db: SQLite.SQLiteDatabase | null = null;

async function open(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  db = await SQLite.openDatabaseAsync(DB_NAME);
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS records (
      kind TEXT NOT NULL,
      id TEXT NOT NULL,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (kind, id)
    );
    CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    INSERT OR IGNORE INTO meta (key, value) VALUES ('schema', '1');
  `);
  return db;
}

export async function load(): Promise<Tables | null> {
  const d = await open();
  const rows = await d.getAllAsync<{ kind: string; id: string; data: string }>('SELECT kind, id, data FROM records');
  if (rows.length === 0) return null;
  const t = emptyTables();
  const known = new Set<string>(TABLE_NAMES);
  for (const r of rows) {
    if (!known.has(r.kind)) continue;
    (t[r.kind as keyof Tables] as Record<string, unknown>)[r.id] = JSON.parse(r.data);
  }
  return t;
}

export async function save(changes: Change[]): Promise<void> {
  if (changes.length === 0) return;
  const d = await open();
  const now = new Date().toISOString();
  await d.withTransactionAsync(async () => {
    for (const c of changes) {
      if (c.kind === 'upsert')
        await d.runAsync(
          'INSERT OR REPLACE INTO records (kind, id, data, updated_at) VALUES (?, ?, ?, ?)',
          c.table,
          c.id,
          JSON.stringify(c.data),
          now,
        );
      else await d.runAsync('DELETE FROM records WHERE kind = ? AND id = ?', c.table, c.id);
    }
  });
}

export async function clear(): Promise<void> {
  const d = await open();
  await d.runAsync('DELETE FROM records');
}
