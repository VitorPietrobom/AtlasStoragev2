import type { TableName } from '../core/types';

/** One record as it travels between this device and the cloud. */
export interface SyncRecord {
  table: TableName;
  id: string;
  /** The record itself, or null when it was deleted (a tombstone). */
  data: unknown | null;
  /** Last-writer-wins clock: milliseconds when the change was made on its device. */
  version: number;
}

/** What the sync engine needs from local storage (SQLite on device, localStorage on web). */
export interface LocalSyncStore {
  /** Records changed here and not yet confirmed by the cloud. */
  pending(): Promise<SyncRecord[]>;
  /** The cloud has these; clear their dirty flag unless they changed again meanwhile. */
  markSynced(records: SyncRecord[]): Promise<void>;
  /** Store cloud records that are newer than ours. Returns the ones accepted. */
  applyRemote(records: SyncRecord[]): Promise<SyncRecord[]>;
  getCursor(table: TableName): Promise<number | null>;
  setCursor(table: TableName, at: number): Promise<void>;
}

export interface RemoteBatch {
  table: TableName;
  records: SyncRecord[];
  /** Server time of the newest record in the batch, to resume from next time. */
  cursor: number | null;
}

export interface Remote {
  push(records: SyncRecord[]): Promise<void>;
  /** Listen for changes newer than each table's cursor. Returns an unsubscribe function. */
  subscribe(
    cursors: Partial<Record<TableName, number | null>>,
    onBatch: (batch: RemoteBatch) => void,
    onError: (e: unknown) => void,
  ): () => void;
}
