import { beforeEach, describe, expect, it } from 'vitest';

import { setIdGenerator } from '../../core/ids';
import { addItem, createBin, createCategory, createUnit, deleteItem, ensureOthers, takeOut, updateItem } from '../../core/ops';
import { slotsOfLevel } from '../../core/grid';
import { emptyTables, TABLE_NAMES, type TableName, type Tables } from '../../core/types';
import { diffTables } from '../../data/diff';
import { MemoryRecords, mergeRecords } from '../../data/records';
import { SyncEngine } from '../engine';
import type { Remote, RemoteBatch, SyncRecord } from '../types';

/** A cloud in memory, behaving like the Firestore remote: per-record docs, server time, listeners. */
class FakeCloud {
  docs = new Map<string, { rec: SyncRecord; at: number }>();
  clock = 1000;
  offline = false;
  private listeners: ((b: RemoteBatch) => void)[] = [];

  remote(): Remote {
    return {
      push: async (records) => {
        if (this.offline) throw new Error('offline');
        const batches = new Map<TableName, SyncRecord[]>();
        for (const r of records) {
          const at = ++this.clock;
          this.docs.set(`${r.table}/${r.id}`, { rec: structuredClone(r), at });
          batches.set(r.table, [...(batches.get(r.table) ?? []), structuredClone(r)]);
        }
        // Like Firestore, listeners hear about writes (including the writer's own).
        for (const [table, recs] of batches) for (const l of this.listeners) l({ table, records: recs, cursor: this.clock });
      },
      subscribe: (cursors, onBatch) => {
        for (const table of TABLE_NAMES) {
          const since = cursors[table] ?? 0;
          const recs = [...this.docs.values()].filter((d) => d.rec.table === table && d.at > since);
          if (recs.length) onBatch({ table, records: recs.map((d) => structuredClone(d.rec)), cursor: Math.max(...recs.map((d) => d.at)) });
        }
        this.listeners.push(onBatch);
        return () => (this.listeners = this.listeners.filter((l) => l !== onBatch));
      },
    };
  }
}

/** One phone: its tables (what the UI shows), its local records, its sync engine. */
class Device {
  tables: Tables;
  records = new MemoryRecords();
  engine: SyncEngine;

  constructor(cloud: FakeCloud) {
    this.tables = emptyTables();
    this.engine = new SyncEngine(this.records, cloud.remote(), (recs) => (this.tables = mergeRecords(this.tables, recs)));
    this.change((t) => ensureOthers(t));
  }

  change(op: (t: Tables) => Tables) {
    const next = op(this.tables);
    this.records.save(diffTables(this.tables, next));
    this.tables = next;
  }

  /** What the device would show after a restart: rebuilt from its records. */
  reloaded(): Tables {
    return this.records.load() ?? emptyTables();
  }
}

const settle = () => new Promise((r) => setTimeout(r, 0));
let n = 0;
beforeEach(() => {
  n = 0;
  setIdGenerator(() => `id${++n}`);
});

function setUpHouse(d: Device) {
  d.change((t) => {
    let x = createUnit(t, { name: 'Wardrobe', kind: 'shelving' }).tables;
    const level = Object.values(x.levels)[0];
    const cat = createCategory(x, { name: 'Cables' });
    x = cat.tables;
    const bin = createBin(x, { categoryId: cat.categoryId, slotId: slotsOfLevel(x, level.id)[0].id });
    return addItem(bin.tables, { name: 'USB-C cable', home: { binId: bin.binId }, quantity: 3 }).tables;
  });
}

const comparable = (t: Tables) => JSON.parse(JSON.stringify(t));

describe('sync', () => {
  it('a second phone receives everything the first one has', async () => {
    const cloud = new FakeCloud();
    const a = new Device(cloud);
    setUpHouse(a);
    await a.engine.start();
    const b = new Device(cloud);
    await b.engine.start();
    await settle();
    expect(comparable(b.tables)).toEqual(comparable(a.tables));
    expect(Object.values(b.tables.bins).filter((x) => x.isOthers)).toHaveLength(1);
    expect(await a.records.pending()).toEqual([]);
  });

  it('later changes flow both ways while both are running', async () => {
    const cloud = new FakeCloud();
    const a = new Device(cloud);
    const b = new Device(cloud);
    await a.engine.start();
    await b.engine.start();
    setUpHouse(a);
    await a.engine.push();
    await settle();
    const cable = Object.values(b.tables.items)[0];
    expect(cable.name).toBe('USB-C cable');
    b.change((t) => takeOut(t, cable.id, 2));
    await b.engine.push();
    await settle();
    expect(a.tables.items[cable.id].quantityOut).toBe(2);
    expect(Object.values(a.tables.events).filter((e) => e.type === 'tookOut')).toHaveLength(1);
  });

  it('when both edit the same record, the later edit wins everywhere', async () => {
    const cloud = new FakeCloud();
    const a = new Device(cloud);
    setUpHouse(a);
    await a.engine.start();
    const b = new Device(cloud);
    await b.engine.start();
    await settle();
    const id = Object.keys(a.tables.items)[0];
    a.change((t) => updateItem(t, id, { name: 'USB-C cable (old)' }));
    await new Promise((r) => setTimeout(r, 5));
    b.change((t) => updateItem(t, id, { name: 'USB-C cable, braided' }));
    await b.engine.push();
    await a.engine.push();
    await settle();
    expect(a.tables.items[id].name).toBe('USB-C cable, braided');
    expect(b.tables.items[id].name).toBe('USB-C cable, braided');
  });

  it('deletes reach the other phone and survive a restart', async () => {
    const cloud = new FakeCloud();
    const a = new Device(cloud);
    setUpHouse(a);
    await a.engine.start();
    const b = new Device(cloud);
    await b.engine.start();
    await settle();
    const id = Object.keys(a.tables.items)[0];
    a.change((t) => deleteItem(t, id));
    await a.engine.push();
    await settle();
    expect(b.tables.items[id]).toBeUndefined();
    expect(b.reloaded().items[id]).toBeUndefined();
  });

  it('offline changes wait and go up when back online', async () => {
    const cloud = new FakeCloud();
    const a = new Device(cloud);
    await a.engine.start();
    cloud.offline = true;
    setUpHouse(a);
    await a.engine.push();
    expect((await a.records.pending()).length).toBeGreaterThan(0);
    cloud.offline = false;
    await a.engine.push();
    expect(await a.records.pending()).toEqual([]);
    const b = new Device(cloud);
    await b.engine.start();
    await settle();
    expect(Object.values(b.tables.items).map((i) => i.name)).toEqual(['USB-C cable']);
  });

  it('a restarted phone only fetches what changed since it last synced', async () => {
    const cloud = new FakeCloud();
    const a = new Device(cloud);
    setUpHouse(a);
    await a.engine.start();
    const cursor = await a.records.getCursor('items');
    expect(cursor).not.toBeNull();
    a.engine.stop();
    const seen: SyncRecord[] = [];
    const engine = new SyncEngine(a.records, cloud.remote(), (r) => seen.push(...r));
    await engine.start();
    await settle();
    expect(seen).toEqual([]);
  });
});
