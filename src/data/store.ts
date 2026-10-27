import { create } from 'zustand';

import { setIdGenerator } from '../core/ids';
import { levelsOfUnit } from '../core/grid';
import { ensureOthers } from '../core/ops';
import { sampleHouse } from '../core/sample';
import { emptyTables, type ID, type Tables } from '../core/types';
import type { SyncRecord } from '../sync/types';
import { diffTables } from './diff';
import { mergeRecords } from './records';
import { newUuid } from './uuid';
import * as persistence from './persistence';

setIdGenerator(newUuid);

interface AtlasState {
  ready: boolean;
  tables: Tables;
  /** What the level view shows. */
  unitId: ID | null;
  levelId: ID | null;
  init(): Promise<void>;
  /** Run a domain operation. Throws (RuleError) without changing anything if the rules say no. */
  apply(op: (t: Tables) => Tables): Tables;
  show(unitId: ID, levelId?: ID): void;
  loadSample(): void;
  eraseEverything(): Promise<void>;
  /** Fold in records that arrived from the cloud (already stored locally). */
  applyRemote(records: SyncRecord[]): void;
}

let writes: Promise<void> = Promise.resolve();
const writeListeners = new Set<() => void>();

/** Called after local changes reach storage (sync pushes them). */
export function onLocalWrite(fn: () => void): () => void {
  writeListeners.add(fn);
  return () => writeListeners.delete(fn);
}

function persist(prev: Tables, next: Tables) {
  const changes = diffTables(prev, next);
  if (changes.length === 0) return;
  queue(() => persistence.save(changes));
}

function queue(write: () => Promise<void>) {
  writes = writes
    .then(write)
    .then(() => writeListeners.forEach((fn) => fn()))
    .catch((e) => console.warn('Atlas: save failed', e));
}

function firstView(t: Tables): { unitId: ID | null; levelId: ID | null } {
  const unit = Object.values(t.units).sort((a, b) => a.order - b.order)[0];
  if (!unit) return { unitId: null, levelId: null };
  return { unitId: unit.id, levelId: levelsOfUnit(t, unit.id)[0]?.id ?? null };
}

export const useAtlas = create<AtlasState>((set, get) => ({
  ready: false,
  tables: emptyTables(),
  unitId: null,
  levelId: null,

  async init() {
    if (get().ready) return;
    let loaded: Tables | null = null;
    try {
      loaded = await persistence.load();
    } catch (e) {
      console.warn('Atlas: load failed', e);
    }
    const base = loaded ?? emptyTables();
    const tables = ensureOthers(base);
    persist(base, tables);
    set({ ready: true, tables, ...firstView(tables) });
  },

  apply(op) {
    const prev = get().tables;
    const next = op(prev);
    if (next === prev) return prev;
    set({ tables: next });
    // Keep the view pointing at something that still exists.
    const { unitId, levelId } = get();
    if (!unitId || !next.units[unitId] || !levelId || !next.levels[levelId]) {
      const unitStill = unitId && next.units[unitId];
      set(unitStill ? { levelId: levelsOfUnit(next, unitId!)[0]?.id ?? null } : firstView(next));
    }
    persist(prev, next);
    return next;
  },

  show(unitId, levelId) {
    const t = get().tables;
    set({ unitId, levelId: levelId ?? levelsOfUnit(t, unitId)[0]?.id ?? null });
  },

  loadSample() {
    const next = sampleHouse();
    set({ tables: next, ...firstView(next) });
    queue(() => persistence.clear());
    persist(emptyTables(), next);
  },

  async eraseEverything() {
    queue(() => persistence.clear());
    const next = ensureOthers(emptyTables());
    persist(emptyTables(), next);
    await writes;
    set({ tables: next, unitId: null, levelId: null });
  },

  applyRemote(records) {
    const next = mergeRecords(get().tables, records);
    set({ tables: next });
    const { unitId, levelId } = get();
    if (!unitId || !next.units[unitId] || !levelId || !next.levels[levelId]) set(firstView(next));
  },
}));

/** Settle pending writes (export, tests). */
export function flushWrites(): Promise<void> {
  return writes;
}
