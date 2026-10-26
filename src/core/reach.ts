import { columnLabel, DEPTH_WORD, depthCodes, depthRank, overlaps, slotCode } from './grid';
import type { Bin, Depth, ID, Level, Slot, Tables } from './types';

export interface LiftStep {
  /** 'front': everything at one depth in front of the bin. 'above': bins stacked on top of it. */
  kind: 'front' | 'above';
  /** Depth of the bins lifted in a 'front' step. */
  depth?: Depth;
  /** Bins to lift in this step, top of a stack first. */
  binIds: ID[];
  /** Slot of the first bin, for "from B3 front". */
  slotId: ID;
}

export interface LiftPlan {
  /** Front first. Empty when nothing needs lifting. */
  steps: LiftStep[];
  /** Number of bins to lift. */
  cost: number;
}

const NO_LIFT: LiftPlan = { steps: [], cost: 0 };

export interface BinLocation {
  bin: Bin;
  slot: Slot;
  level: Level;
}

export function locateBin(t: Tables, binId: ID): BinLocation | undefined {
  const bin = t.bins[binId];
  if (!bin?.slotId) return undefined;
  const slot = t.slots[bin.slotId];
  if (!slot) return undefined;
  const level = t.levels[slot.levelId];
  if (!level) return undefined;
  return { bin, slot, level };
}

/**
 * What has to come out before you can reach a bin.
 * 1. Every bin in the same column in front of it, front first.
 * 2. In a stack, bins above it. A whole stack in front counts as one step.
 * Open-top levels, drawers and loose shelves never have lift steps.
 */
export function liftPlan(t: Tables, binId: ID): LiftPlan {
  const loc = locateBin(t, binId);
  if (!loc) return NO_LIFT;
  const { slot, level } = loc;
  if (level.type !== 'binGrid' || level.reach !== 'fromFront') return NO_LIFT;

  const levelSlots = Object.values(t.slots).filter((s) => s.levelId === level.id);
  const binAt = new Map<ID, ID>();
  for (const b of Object.values(t.bins)) if (b.slotId) binAt.set(b.slotId, b.id);

  const steps: LiftStep[] = [];
  const frontDepths = depthCodes(level.deep)
    .filter((d) => depthRank(d) > depthRank(slot.depth))
    .sort((a, b) => depthRank(b) - depthRank(a));
  for (const depth of frontDepths) {
    const blocking = levelSlots
      .filter((s) => s.depth === depth && overlaps(s, slot) && binAt.has(s.id))
      .sort((a, b) => a.column - b.column || b.stackIndex - a.stackIndex);
    if (blocking.length === 0) continue;
    steps.push({ kind: 'front', depth, binIds: blocking.map((s) => binAt.get(s.id)!), slotId: blocking[0].id });
  }

  const above = levelSlots
    .filter((s) => s.depth === slot.depth && s.column === slot.column && s.stackIndex > slot.stackIndex && binAt.has(s.id))
    .sort((a, b) => b.stackIndex - a.stackIndex);
  if (above.length > 0) steps.push({ kind: 'above', binIds: above.map((s) => binAt.get(s.id)!), slotId: above[0].id });

  return { steps, cost: steps.reduce((n, s) => n + s.binIds.length, 0) };
}

export function reachCost(t: Tables, binId: ID): number {
  return liftPlan(t, binId).cost;
}

/** At most two steps are shown; the rest collapse into "+N more". */
export function visibleSteps(plan: LiftPlan, max = 2): { shown: LiftStep[]; more: number } {
  return { shown: plan.steps.slice(0, max), more: Math.max(0, plan.steps.length - max) };
}

export function binNumberLabel(n: number): string {
  return `#${String(n).padStart(2, '0')}`;
}

/** "#30 and #26", "#55, #56 and #57". */
export function joinNumbers(t: Tables, binIds: ID[]): string {
  const labels = binIds
    .map((id) => t.bins[id].number)
    .sort((a, b) => a - b)
    .map(binNumberLabel);
  if (labels.length <= 1) return labels.join('');
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
}

/** "C2 front stack: #55 and #56", or for a single bin "#30 Batteries, from B3 front". */
export function describeStep(t: Tables, step: LiftStep, binName: (bin: Bin) => string): string {
  const slot = t.slots[step.slotId];
  const level = t.levels[slot.levelId];
  const where = `${level.code}${columnLabel(slot)}`;
  if (step.kind === 'above') {
    if (step.binIds.length === 1) {
      const b = t.bins[step.binIds[0]];
      return `${binNumberLabel(b.number)} ${binName(b)}, on top`;
    }
    return `Bins on top: ${joinNumbers(t, step.binIds)}`;
  }
  const word = DEPTH_WORD[step.depth!];
  if (step.binIds.length === 1) {
    const b = t.bins[step.binIds[0]];
    return `${binNumberLabel(b.number)} ${binName(b)}, from ${where} ${word}`;
  }
  return `${where} ${word} stack: ${joinNumbers(t, step.binIds)}`;
}

/** "lower bin", "upper bin", "middle bin" for stacked slots; empty otherwise. */
export function stackWord(level: Pick<Level, 'high'>, stackIndex: number): string {
  if (level.high <= 1) return '';
  if (stackIndex === 0) return 'lower bin';
  if (stackIndex === level.high - 1) return 'upper bin';
  return 'middle bin';
}

/** "Middle shelf, B3, back." / "Bottom shelf, C2, back, lower bin." / "Drawers, E3." */
export function answerFor(t: Tables, binId: ID): string | undefined {
  const loc = locateBin(t, binId);
  if (!loc) return undefined;
  const { slot, level } = loc;
  if (level.type === 'drawers') return `${level.name}, ${slotCode(level, slot)}.`;
  const parts = [level.name, `${level.code}${columnLabel(slot)}`];
  if (level.deep > 1) parts.push(DEPTH_WORD[slot.depth]);
  const sw = stackWord(level, slot.stackIndex);
  if (sw) parts.push(sw);
  return `${parts.join(', ')}.`;
}

/** "Back row · lift 2", "Front row · no lifting". */
export function reachSummary(t: Tables, binId: ID): string {
  const loc = locateBin(t, binId);
  if (!loc) return 'Unplaced';
  const { slot, level } = loc;
  const cost = reachCost(t, binId);
  const row = level.type === 'drawers' ? 'Drawer' : level.deep > 1 ? `${cap(DEPTH_WORD[slot.depth])} row` : 'Single row';
  return `${row} · ${cost === 0 ? 'no lifting' : `lift ${cost}`}`;
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
