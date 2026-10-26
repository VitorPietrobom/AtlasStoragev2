import { beforeEach, describe, expect, it } from 'vitest';
import {
  addItem,
  answerFor,
  binName,
  binSlotCode,
  createBin,
  createCategory,
  createUnit,
  decideFiling,
  deleteBin,
  deleteCategory,
  describeStep,
  emptyTables,
  ensureOthers,
  frontRowNudge,
  isStale,
  itemsInBin,
  liftPlan,
  markMissing,
  mergeSlots,
  moveItem,
  outItems,
  placeBin,
  rankBins,
  reachCost,
  reshapeLevel,
  returnItem,
  sampleHouse,
  search,
  setIdGenerator,
  slotCode,
  slotsOfLevel,
  splitSlot,
  takeOut,
  visibleSteps,
  type Tables,
} from '..';

const NOW = new Date('2026-10-26T12:00:00Z');

let n = 0;
beforeEach(() => {
  n = 0;
  setIdGenerator(() => `id${++n}`);
});

const bin = (t: Tables, number: number) => Object.values(t.bins).find((b) => b.number === number)!;
const item = (t: Tables, name: string) => Object.values(t.items).find((i) => i.name === name)!;
const level = (t: Tables, code: string) => Object.values(t.levels).find((l) => l.code === code)!;
const nums = (t: Tables, ids: string[]) => ids.map((id) => t.bins[id].number);

describe('addresses', () => {
  it('codes a slot as level, column, depth', () => {
    const t = sampleHouse(NOW);
    expect(binSlotCode(t, bin(t, 30))).toBe('B3·F');
    expect(binSlotCode(t, bin(t, 21))).toBe('B1–2·B');
    expect(binSlotCode(t, bin(t, 73))).toBe('E3');
    expect(binSlotCode(t, bin(t, 62))).toBe('U2·B');
  });

  it('answers with level, column, row and stack position', () => {
    const t = sampleHouse(NOW);
    expect(answerFor(t, bin(t, 22).id)).toBe('Middle shelf, B3, back.');
    expect(answerFor(t, bin(t, 44).id)).toBe('Bottom shelf, C2, back, lower bin.');
    expect(answerFor(t, bin(t, 43).id)).toBe('Bottom shelf, C2, back, upper bin.');
  });
});

describe('reach and lift steps', () => {
  it('lifts front first: usb-c hub in #22 needs #30 then #26', () => {
    const t = sampleHouse(NOW);
    const plan = liftPlan(t, bin(t, 22).id);
    expect(plan.cost).toBe(2);
    expect(plan.steps.map((s) => nums(t, s.binIds))).toEqual([[30], [26]]);
    const name = (b: { id: string }) => binName(t, t.bins[b.id]);
    expect(plan.steps.map((s) => describeStep(t, s, name))).toEqual(['#30 Batteries, from B3 front', '#26 Kitchen extras, from B3 middle']);
  });

  it('counts a whole stack in front as one step, then bins on top', () => {
    const t = sampleHouse(NOW);
    const plan = liftPlan(t, bin(t, 44).id);
    expect(plan.cost).toBe(5);
    expect(plan.steps).toHaveLength(3);
    expect(plan.steps.map((s) => nums(t, s.binIds).sort())).toEqual([[55, 56], [50, 51], [43]]);
    const name = (b: { id: string }) => binName(t, t.bins[b.id]);
    expect(describeStep(t, plan.steps[0], name)).toBe('C2 front stack: #55 and #56');
    expect(visibleSteps(plan)).toMatchObject({ more: 1 });
  });

  it('a wide bin is blocked by every column it spans', () => {
    const t = sampleHouse(NOW);
    const plan = liftPlan(t, bin(t, 21).id);
    expect(plan.steps.map((s) => nums(t, s.binIds))).toEqual([
      [28, 29],
      [24, 25],
    ]);
  });

  it('front row and open-top levels need no lifting', () => {
    const t = sampleHouse(NOW);
    expect(reachCost(t, bin(t, 30).id)).toBe(0);
    expect(reachCost(t, bin(t, 62).id)).toBe(0);
    expect(reachCost(t, bin(t, 73).id)).toBe(0);
  });

  it('an empty slot in front costs nothing', () => {
    const t = sampleHouse(NOW);
    // C4·M is free, so only Others (#00) at C4·F stands in front of #47 at C4·B.
    const plan = liftPlan(t, bin(t, 47).id);
    expect(plan.steps.map((s) => nums(t, s.binIds))).toEqual([[0]]);
  });
});

describe('naming', () => {
  it('shows nickname, else category with "1 of 2" only when it spans bins', () => {
    const t = sampleHouse(NOW);
    expect(binName(t, bin(t, 28))).toBe('Cables · 1 of 2');
    expect(binName(t, bin(t, 1))).toBe('Spare cables');
    expect(binName(t, bin(t, 30))).toBe('Batteries');
    expect(binName(t, bin(t, 0))).toBe('Others');
  });
});

describe('storage editor rules', () => {
  it('merging two slots makes one wide slot', () => {
    let t = sampleHouse(NOW);
    const a = level(t, 'A');
    // A4·B is free, A3·B has #03: merge A3 and A4 at the back.
    t = mergeSlots(t, a.id, 'B', 3).tables;
    expect(binSlotCode(t, bin(t, 3))).toBe('A3–4·B');
    expect(slotsOfLevel(t, a.id).filter((s) => s.depth === 'B')).toHaveLength(3);
    const wide = t.slots[bin(t, 3).slotId!];
    t = splitSlot(t, wide.id);
    expect(binSlotCode(t, bin(t, 3))).toBe('A3·B');
    expect(slotsOfLevel(t, a.id)).toHaveLength(12);
  });

  it('merging two full slots sends the right bin to Unplaced', () => {
    let t = sampleHouse(NOW);
    const r = mergeSlots(t, level(t, 'A').id, 'F', 1);
    t = r.tables;
    expect(nums(t, r.unplacedBinIds)).toEqual([12]);
    expect(bin(t, 12).slotId).toBeNull();
  });

  it('resizing sends removed slots to Unplaced with numbers unchanged', () => {
    let t = sampleHouse(NOW);
    const b = level(t, 'B');
    const before = Object.values(t.bins)
      .map((x) => x.number)
      .sort();
    const r = reshapeLevel(t, b.id, { across: 3 });
    t = r.tables;
    expect(nums(t, r.unplacedBinIds).sort()).toEqual([23, 27, 31]);
    expect(
      Object.values(t.bins)
        .map((x) => x.number)
        .sort(),
    ).toEqual(before);
    expect(binSlotCode(t, bin(t, 21))).toBe('B1–2·B');
    expect(slotsOfLevel(t, b.id)).toHaveLength(8);
  });

  it('shrinking across splits a merge that no longer fits', () => {
    let t = sampleHouse(NOW);
    const b = level(t, 'B');
    t = reshapeLevel(t, b.id, { across: 1 }).tables;
    expect(binSlotCode(t, bin(t, 21))).toBe('B1·B');
  });

  it('removing depth keeps front and back rows', () => {
    let t = sampleHouse(NOW);
    const r = reshapeLevel(t, level(t, 'B').id, { deep: 2 });
    t = r.tables;
    expect(nums(t, r.unplacedBinIds).sort()).toEqual([24, 25, 26, 27]);
    expect(answerFor(t, bin(t, 22).id)).toBe('Middle shelf, B3, back.');
    expect(liftPlan(t, bin(t, 22).id).steps.map((s) => nums(t, s.binIds))).toEqual([[30]]);
  });

  it('growing a level adds free slots', () => {
    let t = sampleHouse(NOW);
    const r = reshapeLevel(t, level(t, 'A').id, { across: 5, high: 2 });
    t = r.tables;
    expect(r.unplacedBinIds).toEqual([]);
    expect(slotsOfLevel(t, level(t, 'A').id)).toHaveLength(30);
  });

  it('turning a loose shelf into fewer zones sends items to Others', () => {
    let t = sampleHouse(NOW);
    const r = reshapeLevel(t, level(t, 'D').id, { across: 1 });
    t = r.tables;
    expect(r.rehomedItemIds.length).toBe(3); // left and right zones go; middle stays
    expect(itemsInBin(t, bin(t, 0).id).map((i) => i.name)).toEqual(expect.arrayContaining(['Notebooks', 'Board games', 'Novels']));
  });

  it('placing a bin on a taken slot swaps them', () => {
    let t = sampleHouse(NOW);
    t = placeBin(t, bin(t, 22).id, bin(t, 30).slotId, NOW);
    expect(binSlotCode(t, bin(t, 22))).toBe('B3·F');
    expect(binSlotCode(t, bin(t, 30))).toBe('B3·B');
    expect(reachCost(t, bin(t, 22).id)).toBe(0);
  });

  it('level codes are unique across the house', () => {
    let t = ensureOthers(emptyTables(), NOW);
    t = createUnit(t, { name: 'Wardrobe', kind: 'shelving' }).tables;
    t = createUnit(t, { name: 'Under bed', kind: 'pullOutDrawer' }).tables;
    expect(
      Object.values(t.levels)
        .map((l) => l.code)
        .sort(),
    ).toEqual(['A', 'B']);
  });
});

describe('deleting never loses things', () => {
  it('deleting a bin moves its items to Others', () => {
    let t = sampleHouse(NOW);
    t = deleteBin(t, bin(t, 22).id);
    expect(itemsInBin(t, bin(t, 0).id).map((i) => i.name)).toEqual(
      expect.arrayContaining(['USB-C hub', 'Travel plug adapter', 'HDMI adapter']),
    );
    expect(() => deleteBin(t, bin(t, 0).id)).toThrow();
  });

  it('bin numbers are never reissued', () => {
    let t = sampleHouse(NOW);
    t = deleteBin(t, bin(t, 63).id);
    const r = createBin(t, { categoryId: bin(t, 30).categoryId }, NOW);
    expect(r.tables.bins[r.binId].number).toBe(76);
  });

  it('deleting a category needs a new category for each bin', () => {
    let t = sampleHouse(NOW);
    const cables = bin(t, 28).categoryId;
    expect(() => deleteCategory(t, cables, {})).toThrow(/needs a new category/);
    const misc = createCategory(t, { name: 'Leads' });
    t = deleteCategory(misc.tables, cables, { [bin(t, 28).id]: misc.categoryId, [bin(t, 1).id]: misc.categoryId });
    expect(t.categories[cables]).toBeUndefined();
    expect(binName(t, bin(t, 28))).toBe('Leads · 1 of 2');
  });
});

describe('take out and return', () => {
  it('take 1 of 5: only that one goes to the Out list', () => {
    let t = sampleHouse(NOW);
    const esp = item(t, 'ESP32 boards');
    expect(esp.quantityOut).toBe(1);
    t = takeOut(t, esp.id, 1, NOW);
    expect(t.items[esp.id].quantityOut).toBe(2);
    t = returnItem(t, esp.id, 1, NOW);
    expect(t.items[esp.id].quantityOut).toBe(1);
    t = returnItem(t, esp.id, undefined, NOW);
    expect(t.items[esp.id].quantityOut).toBe(0);
    expect(t.items[esp.id].outSince).toBeUndefined();
  });

  it('cannot take more than is in the bin', () => {
    let t = sampleHouse(NOW);
    const esp = item(t, 'ESP32 boards');
    t = takeOut(t, esp.id, 99, NOW);
    expect(t.items[esp.id].quantityOut).toBe(5);
    expect(() => takeOut(t, esp.id, 1, NOW)).toThrow();
  });

  it('the Out list is oldest first, and missing items are flagged', () => {
    let t = sampleHouse(NOW);
    t = markMissing(t, item(t, 'TSA padlock').id, NOW);
    expect(outItems(t).map((i) => i.name)).toEqual(['HDMI adapter', 'Umbrella', 'ESP32 boards', 'TSA padlock']);
    expect(item(t, 'TSA padlock').missing).toBe(true);
  });

  it('moving an item changes its category', () => {
    let t = sampleHouse(NOW);
    const hub = item(t, 'USB-C hub');
    t = moveItem(t, hub.id, { binId: bin(t, 30).id }, NOW);
    expect(itemsInBin(t, bin(t, 30).id).map((i) => i.name)).toContain('USB-C hub');
    const ev = Object.values(t.events).find((e) => e.type === 'moved')!;
    expect(ev).toMatchObject({ fromBin: 22, toBin: 30, fromSlot: 'B3·B', toSlot: 'B3·F' });
  });
});

describe('nudges and states', () => {
  it('front-row nudge after 4+ take-outs in 30 days from a bin that needs lifting', () => {
    let t = sampleHouse(NOW);
    const settings = t.settings.settings;
    const nudge = frontRowNudge(t, item(t, 'USB-C hub').id, settings, NOW);
    expect(nudge && t.bins[nudge.moveItemTo].number).toBe(30);
    // Same item in a front bin: no nudge.
    t = placeBin(t, bin(t, 22).id, bin(t, 30).slotId, NOW);
    expect(frontRowNudge(t, item(t, 'USB-C hub').id, settings, NOW)).toBeUndefined();
    // Not enough take-outs: no nudge.
    const t2 = sampleHouse(NOW);
    expect(frontRowNudge(t2, item(t2, 'Travel plug adapter').id, settings, NOW)).toBeUndefined();
  });

  it('a bin goes stale after 3 months unconfirmed', () => {
    const t = sampleHouse(NOW);
    expect(isStale(bin(t, 21), t.settings.settings, NOW)).toBe(true);
    expect(isStale(bin(t, 22), t.settings.settings, NOW)).toBe(false);
  });
});

describe('search', () => {
  it('"usb-c hub" finds the hub in #22', () => {
    const t = sampleHouse(NOW);
    const r = search(t, 'usb-c hub');
    expect(r.items[0].item.name).toBe('USB-C hub');
    expect(answerFor(t, r.items[0].item.binId!)).toBe('Middle shelf, B3, back.');
  });

  it('tolerates spelling and spacing', () => {
    const t = sampleHouse(NOW);
    expect(search(t, 'usbc hub').items[0].item.name).toBe('USB-C hub');
    expect(search(t, 'multimeter').items[0].item.name).toBe('Multimeter');
    expect(search(t, 'multimetr').items[0].item.name).toBe('Multimeter');
  });

  it('"cables" lists both Cables bins first, then items easiest to reach', () => {
    const t = sampleHouse(NOW);
    const r = search(t, 'cables');
    expect(r.categories[0].category.name).toBe('Cables');
    expect(r.categories[0].bins.map((b) => b.number).sort()).toEqual([1, 28]);
    const costs = r.items.filter((h) => h.score >= 0.85).map((h) => h.reachCost);
    expect(costs).toEqual([...costs].sort((a, b) => a - b));
    expect(r.items[0].item.name).toBe('USB-C cables');
  });

  it('no results for something not registered', () => {
    const t = sampleHouse(NOW);
    expect(search(t, 'soldering wick').items).toEqual([]);
  });
});

describe('filing', () => {
  it('weekly items go to the easiest bin with room, rarely to the back', () => {
    let t = sampleHouse(NOW);
    t = { ...t, bins: { ...t.bins, [bin(t, 12).id]: { ...bin(t, 12), fillEstimate: 50 } } };
    const electronics = bin(t, 12).categoryId;
    expect(rankBins(t, electronics, 'weekly').map((c) => t.bins[c.binId].number)[0]).toBe(12);
    expect(rankBins(t, electronics, 'rarely').map((c) => t.bins[c.binId].number)[0]).toBe(5);
  });

  it('below the cutoff the item is offered to Others', () => {
    const t = sampleHouse(NOW);
    const settings = t.settings.settings;
    const tools = bin(t, 31).categoryId;
    const lights = bin(t, 9).categoryId;
    const sure = decideFiling(t, [{ categoryId: tools, confidence: 0.94 }], 'weekly', settings);
    expect(sure.confident).toBe(true);
    expect(t.bins[sure.primary.binId].number).toBe(31);
    const unsure = decideFiling(t, [{ categoryId: lights, confidence: 0.61 }], 'weekly', settings);
    expect(unsure.confident).toBe(false);
    expect(t.bins[unsure.primary.binId].isOthers).toBe(true);
    expect(t.bins[unsure.alternatives[0].binId].categoryId).toBe(lights);
  });

  it('a full bin loses to one with room', () => {
    let t = sampleHouse(NOW);
    const electronics = bin(t, 12).categoryId;
    t = { ...t, bins: { ...t.bins, [bin(t, 12).id]: { ...bin(t, 12), fillEstimate: 95 } } };
    expect(t.bins[rankBins(t, electronics, 'weekly')[0].binId].number).not.toBe(12);
  });
});

describe('setup from scratch', () => {
  it('builds a unit, files a bin and an item', () => {
    let t = ensureOthers(emptyTables(), NOW);
    const u = createUnit(t, { name: 'Under bed', kind: 'pullOutDrawer' });
    t = u.tables;
    const slots = slotsOfLevel(t, u.levelId);
    expect(slots.map((s) => slotCode(t.levels[u.levelId], s))).toEqual(['A1·B', 'A2·B', 'A3·B', 'A1·F', 'A2·F', 'A3·F']);
    const c = createCategory(t, { name: 'Winter' });
    t = c.tables;
    const b = createBin(t, { categoryId: c.categoryId, slotId: slots[0].id }, NOW);
    t = b.tables;
    expect(t.bins[b.binId].number).toBe(1);
    t = addItem(t, { name: 'Scarf', home: { binId: b.binId } }, NOW).tables;
    expect(itemsInBin(t, b.binId)).toHaveLength(1);
    expect(reachCost(t, b.binId)).toBe(0);
    expect(() => createBin(t, { categoryId: c.categoryId, slotId: slots[0].id }, NOW)).toThrow();
  });
});
