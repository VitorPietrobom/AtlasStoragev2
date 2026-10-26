import { slotCode, zoneCode } from './grid';
import { binNumberLabel } from './reach';
import type { Bin, Category, ID, Item, Settings, Tables } from './types';

export function categoryOf(t: Tables, bin: Bin): Category | undefined {
  return t.categories[bin.categoryId];
}

/** Bins of a category in fill order (binOrder first, then any stragglers by number). */
export function binsOfCategory(t: Tables, categoryId: ID): Bin[] {
  const cat = t.categories[categoryId];
  const all = Object.values(t.bins).filter((b) => b.categoryId === categoryId);
  const order = cat?.binOrder ?? [];
  return all.sort((a, b) => {
    const ia = order.indexOf(a.id);
    const ib = order.indexOf(b.id);
    if (ia !== ib) return (ia < 0 ? Infinity : ia) - (ib < 0 ? Infinity : ib);
    return a.number - b.number;
  });
}

/** "1 of 2" when the category spans more than one bin, else empty. */
export function binOrdinal(t: Tables, bin: Bin): string {
  const siblings = binsOfCategory(t, bin.categoryId);
  if (siblings.length <= 1) return '';
  return `${siblings.findIndex((b) => b.id === bin.id) + 1} of ${siblings.length}`;
}

/** The bin's nickname if set, otherwise "Category · 1 of 2". */
export function binName(t: Tables, bin: Bin): string {
  if (bin.nickname?.trim()) return bin.nickname.trim();
  const cat = categoryOf(t, bin);
  if (!cat) return 'Uncategorised';
  const ord = binOrdinal(t, bin);
  return ord ? `${cat.name} · ${ord}` : cat.name;
}

/** "#22 Adapters" */
export function binTitle(t: Tables, bin: Bin): string {
  return `${binNumberLabel(bin.number)} ${binName(t, bin)}`;
}

export function binSlotCode(t: Tables, bin: Bin): string | undefined {
  if (!bin.slotId) return undefined;
  const slot = t.slots[bin.slotId];
  const level = slot && t.levels[slot.levelId];
  return slot && level ? slotCode(level, slot) : undefined;
}

/** An item's category is always its bin's. */
export function itemCategory(t: Tables, item: Item): Category | undefined {
  if (!item.binId) return undefined;
  const bin = t.bins[item.binId];
  return bin ? categoryOf(t, bin) : undefined;
}

/** Where an item lives: "#22 · B3·B", "D·L", or "Unfiled". */
export function itemPlaceCode(t: Tables, item: Item): string {
  if (item.binId) {
    const bin = t.bins[item.binId];
    if (!bin) return 'Unfiled';
    const code = binSlotCode(t, bin);
    return code ? `${binNumberLabel(bin.number)} · ${code}` : `${binNumberLabel(bin.number)} · unplaced`;
  }
  if (item.zoneId) {
    const zone = t.zones[item.zoneId];
    const level = zone && t.levels[zone.levelId];
    return zone && level ? zoneCode(level, zone) : 'Unfiled';
  }
  return 'Unfiled';
}

export function itemsInBin(t: Tables, binId: ID): Item[] {
  return Object.values(t.items)
    .filter((i) => i.binId === binId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function itemsInZone(t: Tables, zoneId: ID): Item[] {
  return Object.values(t.items)
    .filter((i) => i.zoneId === zoneId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function isOut(item: Item): boolean {
  return item.quantityOut > 0;
}

/** Everything not in a bin, oldest first. */
export function outItems(t: Tables): Item[] {
  return Object.values(t.items)
    .filter(isOut)
    .sort((a, b) => (a.outSince ?? a.createdAt).localeCompare(b.outSince ?? b.createdAt));
}

export function monthsBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24 * 30.4375);
}

export function isStale(bin: Bin, settings: Settings, now = new Date()): boolean {
  return monthsBetween(new Date(bin.lastConfirmedAt), now) >= settings.staleMonths;
}

export function othersBin(t: Tables): Bin | undefined {
  return Object.values(t.bins).find((b) => b.isOthers);
}

export function settingsOf(t: Tables): Settings {
  return t.settings.settings;
}

/** Display name for an item with a count: "ESP32 boards ×5". */
export function itemLabel(item: Item): string {
  return item.quantityTotal > 1 ? `${item.name} ×${item.quantityTotal}` : item.name;
}

export function daysBetween(fromIso: string, now = new Date()): number {
  return Math.floor((now.getTime() - new Date(fromIso).getTime()) / 86_400_000);
}
