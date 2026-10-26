// Offline-first sync: the device is the source of truth for the UI; every
// change is queued locally and pushed when possible; cloud changes are merged
// per record, last writer wins.

import { TABLE_NAMES } from '../core/types';
import type { LocalSyncStore, Remote, RemoteBatch, SyncRecord } from './types';

export type SyncStatus =
  | { state: 'idle'; pending: number; lastSyncedAt?: number }
  | { state: 'syncing'; pending: number; lastSyncedAt?: number }
  | { state: 'error'; pending: number; message: string; lastSyncedAt?: number };

/** Firestore batches take at most 500 writes. */
const CHUNK = 400;

export class SyncEngine {
  private unsubscribe: (() => void) | null = null;
  private pushing: Promise<void> | null = null;
  private again = false;
  private lastSyncedAt?: number;
  private stopped = true;

  constructor(
    private local: LocalSyncStore,
    private remote: Remote,
    /** Records from the cloud that won; the app folds them into its state. */
    private onRemote: (records: SyncRecord[]) => void,
    private onStatus: (s: SyncStatus) => void = () => {},
  ) {}

  async start(): Promise<void> {
    this.stopped = false;
    const cursors: Partial<Record<(typeof TABLE_NAMES)[number], number | null>> = {};
    for (const t of TABLE_NAMES) cursors[t] = await this.local.getCursor(t);
    // Push first so a brand-new account gets this device's data before anything else.
    await this.push();
    if (this.stopped) return;
    this.unsubscribe = this.remote.subscribe(
      cursors,
      (b) => void this.receive(b),
      (e) => this.report(e),
    );
  }

  stop(): void {
    this.stopped = true;
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  /** Push everything pending. Calls made while a push runs coalesce into one more round. */
  push(): Promise<void> {
    if (this.pushing) {
      this.again = true;
      return this.pushing;
    }
    this.pushing = (async () => {
      try {
        do {
          this.again = false;
          const pending = await this.local.pending();
          this.onStatus({ state: 'syncing', pending: pending.length, lastSyncedAt: this.lastSyncedAt });
          for (let i = 0; i < pending.length; i += CHUNK) {
            const chunk = pending.slice(i, i + CHUNK);
            await this.remote.push(chunk);
            await this.local.markSynced(chunk);
          }
        } while (this.again && !this.stopped);
        this.lastSyncedAt = Date.now();
        this.onStatus({ state: 'idle', pending: (await this.local.pending()).length, lastSyncedAt: this.lastSyncedAt });
      } catch (e) {
        this.report(e);
      } finally {
        this.pushing = null;
      }
    })();
    return this.pushing;
  }

  private async receive(batch: RemoteBatch): Promise<void> {
    try {
      const accepted = await this.local.applyRemote(batch.records);
      if (accepted.length) this.onRemote(accepted);
      if (batch.cursor !== null) await this.local.setCursor(batch.table, batch.cursor);
      this.lastSyncedAt = Date.now();
    } catch (e) {
      this.report(e);
    }
  }

  private async report(e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    let pending = 0;
    try {
      pending = (await this.local.pending()).length;
    } catch {}
    this.onStatus({ state: 'error', pending, message, lastSyncedAt: this.lastSyncedAt });
  }
}

/** Last writer wins; on a tie the local copy stays (it will be pushed). */
export function remoteWins(remote: SyncRecord, local: { version: number; dirty: boolean } | undefined): boolean {
  if (!local) return true;
  if (remote.version > local.version) return true;
  return false;
}
