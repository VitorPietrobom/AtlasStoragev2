// Atlas domain model. A bin's identity (its number) is separate from where it
// sits (its slot), so moving bins or resizing a shelf never breaks labels or history.

export type ID = string;
/** ISO-8601 timestamp. */
export type Timestamp = string;

export type UnitKind = 'shelving' | 'pullOutDrawer' | 'drawerUnit' | 'looseShelf';
export type LevelType = 'binGrid' | 'looseShelf' | 'drawers';
export type Reach = 'fromFront' | 'openTop';
/** Back, middle, front. Order matters: index 0 is furthest from the front edge. */
export type Depth = 'B' | 'M' | 'F';
export type BinSize = 'S' | 'M' | 'L';
export type UseFrequency = 'weekly' | 'monthly' | 'rarely';

export interface StorageUnit {
  id: ID;
  name: string;
  room?: string;
  kind: UnitKind;
  order: number;
}

export interface Level {
  id: ID;
  unitId: ID;
  /** Letter, unique across the whole house: A, B, C… never reused in another unit. */
  code: string;
  name: string;
  order: number;
  type: LevelType;
  reach: Reach;
  /** Columns (binGrid), drawers (drawers) or zones (looseShelf, 1–3). */
  across: number;
  /** Rows front to back, 1–3. Only binGrid. */
  deep: number;
  /** Bins per stack, 1–3. Only binGrid. */
  high: number;
  frontLabel: string;
  backLabel: string;
}

export interface Slot {
  id: ID;
  levelId: ID;
  /** 1-based, left to right as you face the unit. */
  column: number;
  depth: Depth;
  /** 2 when two columns are merged for a wide bin. */
  span: 1 | 2;
  /** 0 = bottom of the stack. */
  stackIndex: number;
}

export interface Zone {
  id: ID;
  levelId: ID;
  /** L, M or R. */
  code: string;
  name: string;
  order: number;
}

export interface Bin {
  id: ID;
  /** Permanent; printed on the label. Others is #00. */
  number: number;
  categoryId: ID;
  nickname?: string;
  size: BinSize;
  /** 0–100, from the last setup/audit photo. */
  fillEstimate?: number;
  /** null = Unplaced. */
  slotId: ID | null;
  lastConfirmedAt: Timestamp;
  isOthers: boolean;
  photoUri?: string;
}

export interface Category {
  id: ID;
  name: string;
  /** "What belongs here", sent to the AI. */
  description: string;
  /** Bins of this category, in fill order. */
  binOrder: ID[];
  isOthers?: boolean;
}

export interface Item {
  id: ID;
  name: string;
  binId: ID | null;
  zoneId: ID | null;
  quantityTotal: number;
  quantityOut: number;
  /** When quantityOut last went from 0 to more. */
  outSince?: Timestamp;
  /** Not where Atlas said and not found yet; asked about at the next audit. */
  missing?: boolean;
  photoUri?: string;
  stickerUri?: string;
  createdAt: Timestamp;
}

export type EventType =
  'registered' | 'tookOut' | 'returned' | 'moved' | 'binMoved' | 'audited' | 'aiFiled' | 'corrected' | 'missing' | 'labelPrinted';

export interface AtlasEvent {
  id: ID;
  type: EventType;
  itemId?: ID;
  binId?: ID;
  quantity?: number;
  /** Slot codes at the time of the event, so history reads correctly after resizes. */
  fromSlot?: string;
  toSlot?: string;
  /** Bin numbers for item moves. */
  fromBin?: number;
  toBin?: number;
  aiConfidence?: number;
  at: Timestamp;
}

export interface Correction {
  id: ID;
  itemName: string;
  aiCategoryId: ID;
  userCategoryId: ID;
  at: Timestamp;
}

export interface Settings {
  /** File in a category at or above this confidence, else Others. */
  aiCutoff: number;
  /** Suggest sorting Others when it passes this many items. */
  othersSortAt: number;
  nudgeTakeouts: number;
  nudgeDays: number;
  staleMonths: number;
  learnFromCorrections: boolean;
  /** Highest bin number ever issued, so numbers are never reused. */
  lastBinNumber: number;
}

export const DEFAULT_SETTINGS: Settings = {
  aiCutoff: 0.7,
  othersSortAt: 8,
  nudgeTakeouts: 4,
  nudgeDays: 30,
  staleMonths: 3,
  learnFromCorrections: true,
  lastBinNumber: 0,
};

export interface Tables {
  units: Record<ID, StorageUnit>;
  levels: Record<ID, Level>;
  slots: Record<ID, Slot>;
  zones: Record<ID, Zone>;
  bins: Record<ID, Bin>;
  categories: Record<ID, Category>;
  items: Record<ID, Item>;
  events: Record<ID, AtlasEvent>;
  corrections: Record<ID, Correction>;
  settings: Record<'settings', Settings>;
}

export type TableName = keyof Tables;

export const TABLE_NAMES: TableName[] = [
  'units',
  'levels',
  'slots',
  'zones',
  'bins',
  'categories',
  'items',
  'events',
  'corrections',
  'settings',
];

export const OTHERS_CATEGORY_ID = 'others';

export function emptyTables(): Tables {
  return {
    units: {},
    levels: {},
    slots: {},
    zones: {},
    bins: {},
    categories: {},
    items: {},
    events: {},
    corrections: {},
    settings: { settings: { ...DEFAULT_SETTINGS } },
  };
}
