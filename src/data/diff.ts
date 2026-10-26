import { TABLE_NAMES, type TableName, type Tables } from '../core/types';

export type Change = { kind: 'upsert'; table: TableName; id: string; data: unknown } | { kind: 'delete'; table: TableName; id: string };

/**
 * Operations never mutate, so a changed record is a new object: compare by
 * reference and only write what actually changed.
 */
export function diffTables(prev: Tables, next: Tables): Change[] {
  const changes: Change[] = [];
  for (const table of TABLE_NAMES) {
    const a = prev[table] as Record<string, unknown>;
    const b = next[table] as Record<string, unknown>;
    if (a === b) continue;
    for (const id of Object.keys(b)) if (a[id] !== b[id]) changes.push({ kind: 'upsert', table, id, data: b[id] });
    for (const id of Object.keys(a)) if (!(id in b)) changes.push({ kind: 'delete', table, id });
  }
  return changes;
}
