import { newId } from './ids';
import type { Bin, Depth, ID, Level, Slot, Tables, Zone } from './types';

export const MAX_ACROSS = 8;
export const MAX_DEEP = 3;
export const MAX_HIGH = 3;
export const MAX_DRAWERS = 10;
export const MAX_ZONES = 3;

/** Depth codes for a level, back to front. */
export function depthCodes(deep: number): Depth[] {
  if (deep <= 1) return ['F'];
  if (deep === 2) return ['B', 'F'];
  return ['B', 'M', 'F'];
}

export const DEPTH_WORD: Record<Depth, string> = { B: 'back', M: 'middle', F: 'front' };

/** 0 = back. Larger is nearer the front edge. */
export function depthRank(depth: Depth): number {
  return depth === 'B' ? 0 : depth === 'M' ? 1 : 2;
}

export function zoneCodes(count: number): string[] {
  if (count <= 1) return ['M'];
  if (count === 2) return ['L', 'R'];
  return ['L', 'M', 'R'];
}

const ZONE_NAMES: Record<string, string> = { L: 'Left', M: 'Middle', R: 'Right' };

export function columnLabel(slot: Pick<Slot, 'column' | 'span'>): string {
  return slot.span === 2 ? `${slot.column}–${slot.column + 1}` : String(slot.column);
}

/** "B3·F", a merged slot "B1–2·B", a drawer "E3". */
export function slotCode(level: Pick<Level, 'code' | 'type'>, slot: Pick<Slot, 'column' | 'span' | 'depth'>): string {
  if (level.type === 'drawers') return `${level.code}${slot.column}`;
  return `${level.code}${columnLabel(slot)}·${slot.depth}`;
}

export function zoneCode(level: Pick<Level, 'code'>, zone: Pick<Zone, 'code'>): string {
  return `${level.code}·${zone.code}`;
}

export function slotsOfLevel(t: Tables, levelId: ID): Slot[] {
  return Object.values(t.slots)
    .filter((s) => s.levelId === levelId)
    .sort((a, b) => depthRank(a.depth) - depthRank(b.depth) || a.column - b.column || a.stackIndex - b.stackIndex);
}

export function zonesOfLevel(t: Tables, levelId: ID): Zone[] {
  return Object.values(t.zones)
    .filter((z) => z.levelId === levelId)
    .sort((a, b) => a.order - b.order);
}

export function levelsOfUnit(t: Tables, unitId: ID): Level[] {
  return Object.values(t.levels)
    .filter((l) => l.unitId === unitId)
    .sort((a, b) => a.order - b.order);
}

export function binInSlot(t: Tables, slotId: ID): Bin | undefined {
  return Object.values(t.bins).find((b) => b.slotId === slotId);
}

/** Index of bins by slot id, for rendering a whole level at once. */
export function binsBySlot(t: Tables): Map<ID, Bin> {
  const m = new Map<ID, Bin>();
  for (const b of Object.values(t.bins)) if (b.slotId) m.set(b.slotId, b);
  return m;
}

export function columnsCovered(slot: Pick<Slot, 'column' | 'span'>): number[] {
  return slot.span === 2 ? [slot.column, slot.column + 1] : [slot.column];
}

export function overlaps(a: Pick<Slot, 'column' | 'span'>, b: Pick<Slot, 'column' | 'span'>): boolean {
  const ac = columnsCovered(a);
  return columnsCovered(b).some((c) => ac.includes(c));
}

/**
 * One cell of the level view: a column position at one depth, holding the
 * slots stacked there (bottom first). Merged slots make wide cells.
 */
export interface GridCell {
  column: number;
  span: 1 | 2;
  depth: Depth;
  /** Bottom first. */
  slots: Slot[];
}

/** Rows back to front, each row's cells left to right. */
export function gridRows(level: Level, slots: Slot[]): GridCell[][] {
  return depthCodes(level.deep).map((depth) => {
    const byColumn = new Map<number, GridCell>();
    for (const s of slots) {
      if (s.depth !== depth) continue;
      const cell = byColumn.get(s.column) ?? { column: s.column, span: s.span, depth, slots: [] };
      cell.slots.push(s);
      if (s.span === 2) cell.span = 2;
      byColumn.set(s.column, cell);
    }
    const cells = [...byColumn.values()].sort((a, b) => a.column - b.column);
    for (const c of cells) c.slots.sort((a, b) => a.stackIndex - b.stackIndex);
    return cells;
  });
}

interface Position {
  column: number;
  depth: Depth;
  stackIndex: number;
}

function wantedPositions(level: Pick<Level, 'type' | 'across' | 'deep' | 'high'>): Position[] {
  if (level.type === 'looseShelf') return [];
  if (level.type === 'drawers') {
    return Array.from({ length: level.across }, (_, i) => ({ column: i + 1, depth: 'F' as Depth, stackIndex: 0 }));
  }
  const out: Position[] = [];
  for (const depth of depthCodes(level.deep))
    for (let column = 1; column <= level.across; column++)
      for (let stackIndex = 0; stackIndex < level.high; stackIndex++) out.push({ column, depth, stackIndex });
  return out;
}

export function generateSlots(level: Level): Slot[] {
  return wantedPositions(level).map((p) => ({ id: newId(), levelId: level.id, span: 1, ...p }));
}

export function generateZones(level: Level): Zone[] {
  return zoneCodes(level.across).map((code, order) => ({
    id: newId(),
    levelId: level.id,
    code,
    name: ZONE_NAMES[code],
    order,
  }));
}

export interface ReshapeResult {
  tables: Tables;
  /** Bins whose slot no longer exists; their numbers never change. */
  unplacedBinIds: ID[];
  /** Items whose zone no longer exists; moved to Others. */
  rehomedItemIds: ID[];
}

/**
 * Change a level's type, reach or dimensions. Slots that still fit are kept
 * with their bins; removed slots send their bins to Unplaced. Merged slots that
 * no longer fit across are split back to one column.
 */
export function reshapeLevel(
  t: Tables,
  levelId: ID,
  patch: Partial<Pick<Level, 'type' | 'reach' | 'across' | 'deep' | 'high' | 'name' | 'frontLabel' | 'backLabel'>>,
): ReshapeResult {
  const old = t.levels[levelId];
  const level: Level = { ...old, ...patch };
  level.across = clamp(level.across, 1, level.type === 'drawers' ? MAX_DRAWERS : level.type === 'looseShelf' ? MAX_ZONES : MAX_ACROSS);
  level.deep = level.type === 'binGrid' ? clamp(level.deep, 1, MAX_DEEP) : 1;
  level.high = level.type === 'binGrid' ? clamp(level.high, 1, MAX_HIGH) : 1;
  if (level.type === 'drawers') level.reach = 'openTop';

  const slots = { ...t.slots };
  const bins = { ...t.bins };
  const zones = { ...t.zones };
  const items = { ...t.items };
  const unplacedBinIds: ID[] = [];
  const rehomedItemIds: ID[] = [];

  const unplace = (slotId: ID) => {
    for (const b of Object.values(bins)) {
      if (b.slotId === slotId) {
        bins[b.id] = { ...b, slotId: null };
        unplacedBinIds.push(b.id);
      }
    }
  };

  const wanted = wantedPositions(level);
  const key = (p: Position) => `${p.column}|${p.depth}|${p.stackIndex}`;
  const wantedKeys = new Set(wanted.map(key));
  // Switching between a grid and drawers changes what a slot means, so start over.
  const sameKind = (old.type === 'drawers') === (level.type === 'drawers');

  const covered = new Set<string>();
  for (const s of Object.values(t.slots)) {
    if (s.levelId !== levelId) continue;
    if (!sameKind || !wantedKeys.has(key(s))) {
      unplace(s.id);
      delete slots[s.id];
      continue;
    }
    let kept = s;
    if (s.span === 2 && !wantedKeys.has(key({ ...s, column: s.column + 1 }))) kept = { ...s, span: 1 };
    slots[s.id] = kept;
    for (const c of columnsCovered(kept)) covered.add(key({ ...kept, column: c }));
  }
  for (const p of wanted) {
    if (covered.has(key(p))) continue;
    const id = newId();
    slots[id] = { id, levelId, span: 1, ...p };
  }

  // Zones: kept by code; a removed zone's items go to Others.
  const othersBin = Object.values(bins).find((b) => b.isOthers);
  const wantedZones = level.type === 'looseShelf' ? zoneCodes(level.across) : [];
  const haveZones = Object.values(t.zones).filter((z) => z.levelId === levelId);
  for (const z of haveZones) {
    if (wantedZones.includes(z.code)) {
      zones[z.id] = { ...z, order: wantedZones.indexOf(z.code) };
      continue;
    }
    delete zones[z.id];
    for (const it of Object.values(items)) {
      if (it.zoneId === z.id) {
        items[it.id] = { ...it, zoneId: null, binId: othersBin?.id ?? null };
        rehomedItemIds.push(it.id);
      }
    }
  }
  for (const code of wantedZones) {
    if (haveZones.some((z) => z.code === code)) continue;
    const id = newId();
    zones[id] = { id, levelId, code, name: ZONE_NAMES[code], order: wantedZones.indexOf(code) };
  }

  return {
    tables: { ...t, levels: { ...t.levels, [levelId]: level }, slots, bins, zones, items },
    unplacedBinIds,
    rehomedItemIds,
  };
}

export class GridError extends Error {}

/**
 * Merge the slot at `column` with the one to its right, at one depth, through
 * the whole stack. If both hold a bin, the right one goes to Unplaced.
 */
export function mergeSlots(t: Tables, levelId: ID, depth: Depth, column: number): ReshapeResult {
  const level = t.levels[levelId];
  if (level.type !== 'binGrid') throw new GridError('Only bin grids can merge slots');
  if (column + 1 > level.across) throw new GridError('No slot to the right');
  const all = Object.values(t.slots).filter((s) => s.levelId === levelId && s.depth === depth);
  const left = all.filter((s) => s.column === column);
  const right = all.filter((s) => s.column === column + 1);
  if (left.some((s) => s.span !== 1) || right.some((s) => s.span !== 1) || right.length === 0)
    throw new GridError('Those slots are already merged');

  const slots = { ...t.slots };
  const bins = { ...t.bins };
  const unplacedBinIds: ID[] = [];
  for (const l of left) {
    const r = right.find((s) => s.stackIndex === l.stackIndex);
    slots[l.id] = { ...l, span: 2 };
    if (!r) continue;
    delete slots[r.id];
    const rBin = Object.values(bins).find((b) => b.slotId === r.id);
    if (!rBin) continue;
    const lBin = Object.values(bins).find((b) => b.slotId === l.id);
    if (lBin) {
      bins[rBin.id] = { ...rBin, slotId: null };
      unplacedBinIds.push(rBin.id);
    } else {
      bins[rBin.id] = { ...rBin, slotId: l.id };
    }
  }
  return { tables: { ...t, slots, bins }, unplacedBinIds, rehomedItemIds: [] };
}

/** Split a merged slot back into two; its bin stays on the left. */
export function splitSlot(t: Tables, slotId: ID): Tables {
  const s = t.slots[slotId];
  if (s.span !== 2) return t;
  const slots = { ...t.slots };
  for (const sib of Object.values(t.slots)) {
    if (sib.levelId !== s.levelId || sib.depth !== s.depth || sib.column !== s.column) continue;
    slots[sib.id] = { ...sib, span: 1 };
    const id = newId();
    slots[id] = { ...sib, id, column: sib.column + 1, span: 1 };
  }
  return { ...t, slots };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}
