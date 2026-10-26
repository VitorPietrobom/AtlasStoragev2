// On device: one SQLite table of records. Everything is loaded into memory at
// start (a house is a few thousand rows at most) and changes are written back
// as they happen, each with a version and a dirty flag for sync. Deletes stay
// as tombstones (data = 'null') until the cloud has them.

import * as SQLite from 'expo-sqlite';

import type { TableName, Tables } from '../core/types';
import { remoteWins } from '../sync/engine';
import type { LocalSyncStore, SyncRecord } from '../sync/types';
import type { Change } from './diff';
import { nextVersion, rowsToTables } from './records';

const DB_NAME = 'atlas.db';
let opening: Promise<SQLite.SQLiteDatabase> | null = null;

function open(): Promise<SQLite.SQLiteDatabase> {
  opening ??= (async () => {
    const db = await SQLite.openDatabaseAsync(DB_NAME);
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
    const schema = await db.getFirstAsync<{ value: string }>("SELECT value FROM meta WHERE key = 'schema'");
    if (schema?.value === '1') {
      // v2: sync columns. Existing rows count as unsynced changes.
      await db.execAsync(`
        ALTER TABLE records ADD COLUMN version INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE records ADD COLUMN dirty INTEGER NOT NULL DEFAULT 1;
        CREATE INDEX IF NOT EXISTS records_dirty ON records (dirty);
        UPDATE meta SET value = '2' WHERE key = 'schema';
      `);
    }
    return db;
  })();
  return opening;
}

export async function load(): Promise<Tables | null> {
  const d = await open();
  const rows = await d.getAllAsync<{ kind: TableName; id: string; data: string; version: number }>(
    "SELECT kind, id, data, version FROM records WHERE data != 'null'",
  );
  // Keep the version clock ahead of anything already stored.
  for (const r of rows) nextVersion(r.version);
  return rowsToTables(rows.map((r) => ({ table: r.kind, id: r.id, data: JSON.parse(r.data) })));
}

async function upsert(d: SQLite.SQLiteDatabase, table: string, id: string, data: unknown, version: number, dirty: boolean) {
  await d.runAsync(
    'INSERT OR REPLACE INTO records (kind, id, data, updated_at, version, dirty) VALUES (?, ?, ?, ?, ?, ?)',
    table,
    id,
    JSON.stringify(data ?? null),
    new Date(version).toISOString(),
    version,
    dirty ? 1 : 0,
  );
}

export async function save(changes: Change[]): Promise<void> {
  if (changes.length === 0) return;
  const d = await open();
  await d.withTransactionAsync(async () => {
    for (const c of changes) await upsert(d, c.table, c.id, c.kind === 'upsert' ? c.data : null, nextVersion(), true);
  });
}

/** Delete everything, as tombstones so other devices delete it too. */
export async function clear(): Promise<void> {
  const d = await open();
  const rows = await d.getAllAsync<{ kind: string; id: string }>("SELECT kind, id FROM records WHERE data != 'null'");
  await d.withTransactionAsync(async () => {
    for (const r of rows) await upsert(d, r.kind, r.id, null, nextVersion(), true);
  });
}

export const syncStore: LocalSyncStore = {
  async pending() {
    const d = await open();
    const rows = await d.getAllAsync<{ kind: TableName; id: string; data: string; version: number }>(
      'SELECT kind, id, data, version FROM records WHERE dirty = 1',
    );
    return rows.map((r) => ({ table: r.kind, id: r.id, data: JSON.parse(r.data), version: r.version }));
  },

  async markSynced(records: SyncRecord[]) {
    const d = await open();
    await d.withTransactionAsync(async () => {
      for (const s of records)
        await d.runAsync('UPDATE records SET dirty = 0 WHERE kind = ? AND id = ? AND version = ?', s.table, s.id, s.version);
    });
  },

  async applyRemote(records: SyncRecord[]) {
    const d = await open();
    const accepted: SyncRecord[] = [];
    await d.withTransactionAsync(async () => {
      for (const s of records) {
        const local = await d.getFirstAsync<{ version: number; dirty: number }>(
          'SELECT version, dirty FROM records WHERE kind = ? AND id = ?',
          s.table,
          s.id,
        );
        if (!remoteWins(s, local ? { version: local.version, dirty: !!local.dirty } : undefined)) continue;
        await upsert(d, s.table, s.id, s.data, s.version, false);
        nextVersion(s.version);
        accepted.push(s);
      }
    });
    return accepted;
  },

  async getCursor(table: TableName) {
    const d = await open();
    const r = await d.getFirstAsync<{ value: string }>('SELECT value FROM meta WHERE key = ?', `cursor:${table}`);
    return r ? Number(r.value) : null;
  },

  async setCursor(table: TableName, at: number) {
    const d = await open();
    await d.runAsync(
      'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = MAX(CAST(value AS INTEGER), CAST(excluded.value AS INTEGER))',
      `cursor:${table}`,
      String(at),
    );
  },
};
