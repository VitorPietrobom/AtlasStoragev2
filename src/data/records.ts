// Local records with a version and a dirty flag, so they can sync. Deletes are
// kept as tombstones until the cloud has them.

import { emptyTables, TABLE_NAMES, type TableName, type Tables } from '../core/types';
import { remoteWins } from '../sync/engine';
import type { LocalSyncStore, SyncRecord } from '../sync/types';
import type { Change } from './diff';

export interface Row {
  table: TableName;
  id: string;
  data: unknown | null;
  version: number;
  dirty: boolean;
}

let lastVersion = 0;

/** Milliseconds, strictly increasing on this device even if the clock repeats. */
export function nextVersion(now = Date.now()): number {
  lastVersion = Math.max(now, lastVersion + 1);
  return lastVersion;
}

export function rowsToTables(rows: Iterable<Pick<Row, 'table' | 'id' | 'data'>>): Tables | null {
  const t = emptyTables();
  const known = new Set<string>(TABLE_NAMES);
  let any = false;
  for (const r of rows) {
    if (r.data === null || !known.has(r.table)) continue;
    (t[r.table] as Record<string, unknown>)[r.id] = r.data;
    any = true;
  }
  return any ? t : null;
}

export function changeToRow(c: Change, version: number): Row {
  return { table: c.table, id: c.id, data: c.kind === 'upsert' ? c.data : null, version, dirty: true };
}

/** Fold synced records into tables, copying only the tables they touch. */
export function mergeRecords(prev: Tables, records: Pick<SyncRecord, 'table' | 'id' | 'data'>[]): Tables {
  const next: Tables = { ...prev };
  const touched = new Set<TableName>();
  for (const r of records) {
    if (!touched.has(r.table)) {
      (next[r.table] as Record<string, unknown>) = { ...(prev[r.table] as Record<string, unknown>) };
      touched.add(r.table);
    }
    const table = next[r.table] as Record<string, unknown>;
    if (r.data === null) delete table[r.id];
    else table[r.id] = r.data;
  }
  return next;
}

const key = (table: string, id: string) => `${table}/${id}`;

/**
 * Records held in memory. The web build persists them to localStorage through
 * `onWrite`; tests use them as they are.
 */
export class MemoryRecords implements LocalSyncStore {
  rows = new Map<string, Row>();
  cursors: Partial<Record<TableName, number>> = {};

  constructor(private onWrite: () => void = () => {}) {}

  load(): Tables | null {
    return rowsToTables(this.rows.values());
  }

  save(changes: Change[]): void {
    for (const c of changes) {
      const row = changeToRow(c, nextVersion());
      this.rows.set(key(row.table, row.id), row);
    }
    this.onWrite();
  }

  /** Delete everything, as tombstones so other devices delete it too. */
  clear(): void {
    for (const [k, r] of this.rows) if (r.data !== null) this.rows.set(k, { ...r, data: null, version: nextVersion(), dirty: true });
    this.onWrite();
  }

  async pending(): Promise<SyncRecord[]> {
    return [...this.rows.values()].filter((r) => r.dirty).map(({ table, id, data, version }) => ({ table, id, data, version }));
  }

  async markSynced(records: SyncRecord[]): Promise<void> {
    for (const s of records) {
      const r = this.rows.get(key(s.table, s.id));
      if (r && r.version === s.version) this.rows.set(key(s.table, s.id), { ...r, dirty: false });
    }
    this.onWrite();
  }

  async applyRemote(records: SyncRecord[]): Promise<SyncRecord[]> {
    const accepted: SyncRecord[] = [];
    for (const s of records) {
      const r = this.rows.get(key(s.table, s.id));
      if (!remoteWins(s, r)) continue;
      this.rows.set(key(s.table, s.id), { ...s, dirty: false });
      lastVersion = Math.max(lastVersion, s.version);
      accepted.push(s);
    }
    if (accepted.length) this.onWrite();
    return accepted;
  }

  async getCursor(table: TableName): Promise<number | null> {
    return this.cursors[table] ?? null;
  }

  async setCursor(table: TableName, at: number): Promise<void> {
    this.cursors[table] = Math.max(at, this.cursors[table] ?? 0);
    this.onWrite();
  }
}
