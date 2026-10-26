// Domain operations. Each takes the current tables and returns new ones; the
// inputs are never mutated, so the store can diff by reference to persist.

import { generateSlots, generateZones, slotCode, zoneCode } from './grid';
import { newId } from './ids';
import { binSlotCode, othersBin } from './naming';
import {
  OTHERS_CATEGORY_ID,
  type AtlasEvent,
  type Bin,
  type BinSize,
  type Category,
  type ID,
  type Item,
  type Level,
  type LevelType,
  type Reach,
  type Settings,
  type StorageUnit,
  type Tables,
  type UnitKind,
} from './types';

export class RuleError extends Error {}

const iso = (now: Date) => now.toISOString();

function withEvent(t: Tables, e: Omit<AtlasEvent, 'id'>): Tables {
  const id = newId();
  return { ...t, events: { ...t.events, [id]: { id, ...e } } };
}

function patchSettings(t: Tables, patch: Partial<Settings>): Tables {
  return { ...t, settings: { settings: { ...t.settings.settings, ...patch } } };
}

// ---------- Others ----------

/** Exactly one Others category and one Others bin (#00) always exist. */
export function ensureOthers(t: Tables, now = new Date()): Tables {
  let out = t;
  if (!out.categories[OTHERS_CATEGORY_ID]) {
    out = {
      ...out,
      categories: {
        ...out.categories,
        [OTHERS_CATEGORY_ID]: {
          id: OTHERS_CATEGORY_ID,
          name: 'Others',
          description: 'Anything the AI is not sure about. Sorted later.',
          binOrder: [],
          isOthers: true,
        },
      },
    };
  }
  if (!othersBin(out)) {
    const id = newId();
    const bin: Bin = {
      id,
      number: 0,
      categoryId: OTHERS_CATEGORY_ID,
      size: 'M',
      slotId: null,
      lastConfirmedAt: iso(now),
      isOthers: true,
    };
    const cat = out.categories[OTHERS_CATEGORY_ID];
    out = {
      ...out,
      bins: { ...out.bins, [id]: bin },
      categories: { ...out.categories, [OTHERS_CATEGORY_ID]: { ...cat, binOrder: [id] } },
    };
  }
  return out;
}

// ---------- Units and levels ----------

export interface LevelDefaults {
  type: LevelType;
  reach: Reach;
  frontLabel: string;
  backLabel: string;
  across: number;
  deep: number;
  high: number;
}

/** The unit type sets sensible defaults for reach and front edge. */
export function defaultsForKind(kind: UnitKind): LevelDefaults {
  switch (kind) {
    case 'shelving':
      return { type: 'binGrid', reach: 'fromFront', frontLabel: 'Front · doors', backLabel: 'Back wall', across: 4, deep: 3, high: 1 };
    case 'pullOutDrawer':
      return { type: 'binGrid', reach: 'openTop', frontLabel: 'Pull side', backLabel: 'Head of bed', across: 3, deep: 2, high: 1 };
    case 'drawerUnit':
      return { type: 'drawers', reach: 'openTop', frontLabel: 'Front', backLabel: 'Back', across: 5, deep: 1, high: 1 };
    case 'looseShelf':
      return { type: 'looseShelf', reach: 'openTop', frontLabel: 'Front', backLabel: 'Back wall', across: 3, deep: 1, high: 1 };
  }
}

const DEFAULT_LEVEL_NAME: Record<UnitKind, string> = {
  shelving: 'Shelf',
  pullOutDrawer: 'Pull-out drawer',
  drawerUnit: 'Drawers',
  looseShelf: 'Loose shelf',
};

/** First letter not used by any level in the house. */
export function nextLevelCode(t: Tables): string {
  const used = new Set(Object.values(t.levels).map((l) => l.code));
  for (let i = 0; i < 26; i++) {
    const c = String.fromCharCode(65 + i);
    if (!used.has(c)) return c;
  }
  for (let i = 0; i < 26 * 26; i++) {
    const c = String.fromCharCode(65 + Math.floor(i / 26)) + String.fromCharCode(65 + (i % 26));
    if (!used.has(c)) return c;
  }
  throw new RuleError('Out of level codes');
}

export function createUnit(
  t: Tables,
  args: { name: string; room?: string; kind: UnitKind; level?: Partial<LevelDefaults> & { name?: string; code?: string } },
): { tables: Tables; unitId: ID; levelId: ID } {
  const unitId = newId();
  const order = Object.keys(t.units).length;
  const unit: StorageUnit = { id: unitId, name: args.name.trim() || 'Storage', room: args.room, kind: args.kind, order };
  let out: Tables = { ...t, units: { ...t.units, [unitId]: unit } };
  const { tables, levelId } = addLevel(out, unitId, {
    ...defaultsForKind(args.kind),
    ...args.level,
    name: args.level?.name ?? DEFAULT_LEVEL_NAME[args.kind],
  });
  out = tables;
  return { tables: out, unitId, levelId };
}

export function updateUnit(t: Tables, unitId: ID, patch: Partial<Pick<StorageUnit, 'name' | 'room'>>): Tables {
  return { ...t, units: { ...t.units, [unitId]: { ...t.units[unitId], ...patch } } };
}

export function addLevel(
  t: Tables,
  unitId: ID,
  args: Partial<LevelDefaults> & { name?: string; code?: string },
): { tables: Tables; levelId: ID } {
  const unit = t.units[unitId];
  const d = { ...defaultsForKind(unit.kind), ...args };
  const id = newId();
  const siblings = Object.values(t.levels).filter((l) => l.unitId === unitId);
  const level: Level = {
    id,
    unitId,
    code: args.code && !Object.values(t.levels).some((l) => l.code === args.code) ? args.code : nextLevelCode(t),
    name: args.name ?? `${DEFAULT_LEVEL_NAME[unit.kind]} ${siblings.length + 1}`,
    order: siblings.length,
    type: d.type,
    reach: d.type === 'drawers' ? 'openTop' : d.reach,
    across: d.across,
    deep: d.type === 'binGrid' ? d.deep : 1,
    high: d.type === 'binGrid' ? d.high : 1,
    frontLabel: d.frontLabel,
    backLabel: d.backLabel,
  };
  const slots = { ...t.slots };
  for (const s of generateSlots(level)) slots[s.id] = s;
  const zones = { ...t.zones };
  if (level.type === 'looseShelf') for (const z of generateZones(level)) zones[z.id] = z;
  return { tables: { ...t, levels: { ...t.levels, [id]: level }, slots, zones }, levelId: id };
}

/** Removing a level sends its bins to Unplaced and its loose items to Others. */
export function deleteLevel(t: Tables, levelId: ID): Tables {
  const level = t.levels[levelId];
  if (!level) return t;
  const others = othersBin(t);
  const slots = { ...t.slots };
  const bins = { ...t.bins };
  const zones = { ...t.zones };
  const items = { ...t.items };
  for (const s of Object.values(t.slots)) {
    if (s.levelId !== levelId) continue;
    delete slots[s.id];
    for (const b of Object.values(bins)) if (b.slotId === s.id) bins[b.id] = { ...b, slotId: null };
  }
  for (const z of Object.values(t.zones)) {
    if (z.levelId !== levelId) continue;
    delete zones[z.id];
    for (const i of Object.values(items)) if (i.zoneId === z.id) items[i.id] = { ...i, zoneId: null, binId: others?.id ?? null };
  }
  const levels = { ...t.levels };
  delete levels[levelId];
  // Keep sibling order contiguous.
  Object.values(levels)
    .filter((l) => l.unitId === level.unitId)
    .sort((a, b) => a.order - b.order)
    .forEach((l, order) => (levels[l.id] = { ...l, order }));
  return { ...t, levels, slots, bins, zones, items };
}

export function moveLevel(t: Tables, levelId: ID, direction: -1 | 1): Tables {
  const level = t.levels[levelId];
  const siblings = Object.values(t.levels)
    .filter((l) => l.unitId === level.unitId)
    .sort((a, b) => a.order - b.order);
  const i = siblings.findIndex((l) => l.id === levelId);
  const j = i + direction;
  if (j < 0 || j >= siblings.length) return t;
  [siblings[i], siblings[j]] = [siblings[j], siblings[i]];
  const levels = { ...t.levels };
  siblings.forEach((l, order) => (levels[l.id] = { ...l, order }));
  return { ...t, levels };
}

export function deleteUnit(t: Tables, unitId: ID): Tables {
  let out = t;
  for (const l of Object.values(t.levels)) if (l.unitId === unitId) out = deleteLevel(out, l.id);
  const units = { ...out.units };
  delete units[unitId];
  Object.values(units)
    .sort((a, b) => a.order - b.order)
    .forEach((u, order) => (units[u.id] = { ...u, order }));
  return { ...out, units };
}

// ---------- Categories ----------

export function createCategory(t: Tables, args: { name: string; description?: string }): { tables: Tables; categoryId: ID } {
  const name = args.name.trim();
  const existing = Object.values(t.categories).find((c) => c.name.toLowerCase() === name.toLowerCase());
  if (existing) return { tables: t, categoryId: existing.id };
  const id = newId();
  const cat: Category = { id, name, description: args.description?.trim() ?? '', binOrder: [] };
  return { tables: { ...t, categories: { ...t.categories, [id]: cat } }, categoryId: id };
}

export function updateCategory(t: Tables, id: ID, patch: Partial<Pick<Category, 'name' | 'description' | 'binOrder'>>): Tables {
  return { ...t, categories: { ...t.categories, [id]: { ...t.categories[id], ...patch } } };
}

/** Deleting a category requires a new category for each of its bins. */
export function deleteCategory(t: Tables, categoryId: ID, newCategoryForBin: Record<ID, ID>): Tables {
  const cat = t.categories[categoryId];
  if (!cat) return t;
  if (cat.isOthers) throw new RuleError('Others cannot be deleted');
  let out = t;
  // Walk the bins in fill order so they keep it in their new category.
  const bins = Object.values(t.bins)
    .filter((b) => b.categoryId === categoryId)
    .sort((a, b) => cat.binOrder.indexOf(a.id) - cat.binOrder.indexOf(b.id));
  for (const bin of bins) {
    const target = newCategoryForBin[bin.id];
    if (!target || target === categoryId || !t.categories[target]) throw new RuleError(`Bin #${bin.number} needs a new category`);
    out = setBinCategory(out, bin.id, target);
  }
  const categories = { ...out.categories };
  delete categories[categoryId];
  return { ...out, categories };
}

/** Merge one category into another: its bins keep their numbers and join the end of the fill order. */
export function mergeCategory(t: Tables, fromId: ID, intoId: ID): Tables {
  const map: Record<ID, ID> = {};
  for (const b of Object.values(t.bins)) if (b.categoryId === fromId) map[b.id] = intoId;
  return deleteCategory(t, fromId, map);
}

function setBinCategory(t: Tables, binId: ID, categoryId: ID): Tables {
  const bin = t.bins[binId];
  if (bin.categoryId === categoryId) return t;
  const from = t.categories[bin.categoryId];
  const to = t.categories[categoryId];
  const categories = { ...t.categories };
  if (from) categories[from.id] = { ...from, binOrder: from.binOrder.filter((id) => id !== binId) };
  categories[to.id] = { ...to, binOrder: [...to.binOrder.filter((id) => id !== binId), binId] };
  return { ...t, categories, bins: { ...t.bins, [binId]: { ...bin, categoryId } } };
}

// ---------- Bins ----------

export function createBin(
  t: Tables,
  args: { categoryId: ID; slotId?: ID | null; nickname?: string; size?: BinSize; photoUri?: string; fillEstimate?: number },
  now = new Date(),
): { tables: Tables; binId: ID } {
  if (args.slotId && Object.values(t.bins).some((b) => b.slotId === args.slotId)) throw new RuleError('That slot already has a bin');
  const cat = t.categories[args.categoryId];
  if (!cat) throw new RuleError('Unknown category');
  const number = t.settings.settings.lastBinNumber + 1;
  const id = newId();
  const bin: Bin = {
    id,
    number,
    categoryId: args.categoryId,
    nickname: args.nickname?.trim() || undefined,
    size: args.size ?? 'M',
    fillEstimate: args.fillEstimate,
    slotId: args.slotId ?? null,
    lastConfirmedAt: iso(now),
    isOthers: false,
    photoUri: args.photoUri,
  };
  let out = patchSettings(t, { lastBinNumber: number });
  out = {
    ...out,
    bins: { ...out.bins, [id]: bin },
    categories: { ...out.categories, [cat.id]: { ...cat, binOrder: [...cat.binOrder, id] } },
  };
  return { tables: out, binId: id };
}

export function updateBin(
  t: Tables,
  binId: ID,
  patch: Partial<Pick<Bin, 'nickname' | 'size' | 'fillEstimate' | 'photoUri' | 'categoryId'>>,
): Tables {
  let out = t;
  const { categoryId, ...rest } = patch;
  if (categoryId && categoryId !== t.bins[binId].categoryId) {
    if (t.bins[binId].isOthers) throw new RuleError('Others keeps its category');
    out = setBinCategory(out, binId, categoryId);
  }
  const bin = { ...out.bins[binId], ...rest };
  if (rest.nickname !== undefined) bin.nickname = rest.nickname?.trim() || undefined;
  return { ...out, bins: { ...out.bins, [binId]: bin } };
}

/** Deleting a bin moves its items to Others. The number is never reissued. */
export function deleteBin(t: Tables, binId: ID): Tables {
  const bin = t.bins[binId];
  if (!bin) return t;
  if (bin.isOthers) throw new RuleError('Others cannot be deleted');
  const others = othersBin(t)!;
  const items = { ...t.items };
  for (const i of Object.values(items)) if (i.binId === binId) items[i.id] = { ...i, binId: others.id };
  const bins = { ...t.bins };
  delete bins[binId];
  const cat = t.categories[bin.categoryId];
  const categories = cat ? { ...t.categories, [cat.id]: { ...cat, binOrder: cat.binOrder.filter((id) => id !== binId) } } : t.categories;
  return { ...t, items, bins, categories };
}

/** Put a bin in a slot (or Unplaced). If the slot is taken, the two bins swap. */
export function placeBin(t: Tables, binId: ID, slotId: ID | null, now = new Date()): Tables {
  const bin = t.bins[binId];
  if (bin.slotId === slotId) return t;
  const fromCode = binSlotCode(t, bin);
  const bins = { ...t.bins, [binId]: { ...bin, slotId } };
  let out: Tables = { ...t, bins };
  const occupant = slotId ? Object.values(t.bins).find((b) => b.slotId === slotId && b.id !== binId) : undefined;
  if (occupant) {
    bins[occupant.id] = { ...occupant, slotId: bin.slotId };
    out = withEvent(out, {
      type: 'binMoved',
      binId: occupant.id,
      fromSlot: binSlotCode(t, occupant),
      toSlot: fromCode,
      at: iso(now),
    });
  }
  return withEvent(out, { type: 'binMoved', binId, fromSlot: fromCode, toSlot: binSlotCode(out, out.bins[binId]), at: iso(now) });
}

export function swapBins(t: Tables, a: ID, b: ID, now = new Date()): Tables {
  const target = t.bins[b].slotId;
  if (!target) return placeBin(t, b, t.bins[a].slotId, now);
  return placeBin(t, a, target, now);
}

/** Mark a bin's contents as checked (audit), clearing the stale state. */
export function confirmBin(t: Tables, binId: ID, now = new Date()): Tables {
  const out = { ...t, bins: { ...t.bins, [binId]: { ...t.bins[binId], lastConfirmedAt: iso(now) } } };
  return withEvent(out, { type: 'audited', binId, at: iso(now) });
}

// ---------- Items ----------

export type Home = { binId: ID } | { zoneId: ID };

function homeFields(h: Home): Pick<Item, 'binId' | 'zoneId'> {
  return 'binId' in h ? { binId: h.binId, zoneId: null } : { binId: null, zoneId: h.zoneId };
}

export function homeCode(t: Tables, item: Pick<Item, 'binId' | 'zoneId'>): string | undefined {
  if (item.zoneId) {
    const z = t.zones[item.zoneId];
    return z ? zoneCode(t.levels[z.levelId], z) : undefined;
  }
  if (item.binId) {
    const b = t.bins[item.binId];
    if (!b?.slotId) return undefined;
    const s = t.slots[b.slotId];
    return slotCode(t.levels[s.levelId], s);
  }
  return undefined;
}

export function addItem(
  t: Tables,
  args: { name: string; home: Home | null; quantity?: number; photoUri?: string; stickerUri?: string },
  now = new Date(),
): { tables: Tables; itemId: ID } {
  const name = args.name.trim();
  if (!name) throw new RuleError('An item needs a name');
  const id = newId();
  const item: Item = {
    id,
    name,
    ...(args.home ? homeFields(args.home) : { binId: null, zoneId: null }),
    quantityTotal: Math.max(1, Math.round(args.quantity ?? 1)),
    quantityOut: 0,
    photoUri: args.photoUri,
    stickerUri: args.stickerUri,
    createdAt: iso(now),
  };
  let out: Tables = { ...t, items: { ...t.items, [id]: item } };
  out = withEvent(out, {
    type: 'registered',
    itemId: id,
    binId: item.binId ?? undefined,
    toBin: item.binId ? t.bins[item.binId]?.number : undefined,
    toSlot: homeCode(t, item),
    at: iso(now),
  });
  return { tables: out, itemId: id };
}

export function updateItem(
  t: Tables,
  itemId: ID,
  patch: Partial<Pick<Item, 'name' | 'quantityTotal' | 'photoUri' | 'stickerUri'>>,
): Tables {
  const item = { ...t.items[itemId], ...patch };
  if (patch.name !== undefined) {
    item.name = patch.name.trim();
    if (!item.name) throw new RuleError('An item needs a name');
  }
  item.quantityTotal = Math.max(1, Math.round(item.quantityTotal));
  item.quantityOut = Math.min(item.quantityOut, item.quantityTotal);
  return { ...t, items: { ...t.items, [itemId]: item } };
}

/** Changing an item's category means moving it to a bin of that category. */
export function moveItem(t: Tables, itemId: ID, home: Home, now = new Date()): Tables {
  const item = t.items[itemId];
  const next = { ...item, ...homeFields(home) };
  if (next.binId === item.binId && next.zoneId === item.zoneId) return t;
  const out = { ...t, items: { ...t.items, [itemId]: next } };
  return withEvent(out, {
    type: 'moved',
    itemId,
    binId: next.binId ?? undefined,
    fromBin: item.binId ? t.bins[item.binId]?.number : undefined,
    toBin: next.binId ? t.bins[next.binId]?.number : undefined,
    fromSlot: homeCode(t, item),
    toSlot: homeCode(t, next),
    at: iso(now),
  });
}

export function deleteItem(t: Tables, itemId: ID): Tables {
  const items = { ...t.items };
  delete items[itemId];
  return { ...t, items };
}

/** Taking from a count: only that many go to the Out list. */
export function takeOut(t: Tables, itemId: ID, quantity = 1, now = new Date()): Tables {
  const item = t.items[itemId];
  const available = item.quantityTotal - item.quantityOut;
  if (available <= 0) throw new RuleError('Nothing left in the bin');
  const q = Math.max(1, Math.min(available, Math.round(quantity)));
  const next: Item = {
    ...item,
    quantityOut: item.quantityOut + q,
    outSince: item.quantityOut === 0 ? iso(now) : item.outSince,
  };
  const out = { ...t, items: { ...t.items, [itemId]: next } };
  return withEvent(out, { type: 'tookOut', itemId, binId: item.binId ?? undefined, quantity: q, at: iso(now) });
}

export function returnItem(t: Tables, itemId: ID, quantity?: number, now = new Date()): Tables {
  const item = t.items[itemId];
  if (item.quantityOut <= 0) return t;
  const q = Math.max(1, Math.min(item.quantityOut, Math.round(quantity ?? item.quantityOut)));
  const left = item.quantityOut - q;
  const next: Item = {
    ...item,
    quantityOut: left,
    outSince: left > 0 ? item.outSince : undefined,
    missing: left > 0 ? item.missing : undefined,
  };
  const out = { ...t, items: { ...t.items, [itemId]: next } };
  return withEvent(out, { type: 'returned', itemId, binId: item.binId ?? undefined, quantity: q, at: iso(now) });
}

/** "It wasn't there" → mark missing: the item goes to the Out list until found. */
export function markMissing(t: Tables, itemId: ID, now = new Date()): Tables {
  const item = t.items[itemId];
  const next: Item = { ...item, quantityOut: item.quantityTotal, outSince: item.outSince ?? iso(now), missing: true };
  const out = { ...t, items: { ...t.items, [itemId]: next } };
  return withEvent(out, { type: 'missing', itemId, binId: item.binId ?? undefined, at: iso(now) });
}

export function updateSettings(t: Tables, patch: Partial<Settings>): Tables {
  return patchSettings(t, patch);
}
