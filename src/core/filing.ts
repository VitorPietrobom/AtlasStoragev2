import { binsOfCategory, daysBetween, othersBin } from './naming';
import { liftPlan, locateBin } from './reach';
import type { Bin, ID, Settings, Tables, UseFrequency } from './types';

/** A bin at or above this fill is treated as having no room. */
export const FULL_AT = 90;

export function hasRoom(bin: Bin): boolean {
  return bin.fillEstimate === undefined || bin.fillEstimate < FULL_AT;
}

export interface BinChoice {
  binId: ID;
  reachCost: number;
  reason: 'match' | 'secondGuess' | 'others';
}

/**
 * Best bins in a category: room first, then reach by how often the item is
 * used (weekly → easiest to reach, rarely → happy at the back), then fill order.
 */
export function rankBins(t: Tables, categoryId: ID, frequency: UseFrequency): BinChoice[] {
  const bins = binsOfCategory(t, categoryId).filter((b) => !b.isOthers);
  const scored = bins.map((b, fillOrder) => ({
    b,
    fillOrder,
    cost: liftPlan(t, b.id).cost,
    room: hasRoom(b),
    placed: !!locateBin(t, b.id),
  }));
  scored.sort((x, y) => {
    if (x.room !== y.room) return x.room ? -1 : 1;
    if (x.placed !== y.placed) return x.placed ? -1 : 1;
    if (frequency === 'weekly' && x.cost !== y.cost) return x.cost - y.cost;
    if (frequency === 'rarely' && x.cost !== y.cost) return y.cost - x.cost;
    return x.fillOrder - y.fillOrder;
  });
  return scored.map(({ b, cost }) => ({ binId: b.id, reachCost: cost, reason: 'match' }));
}

export interface AiGuess {
  categoryId: ID;
  confidence: number;
}

export interface FilingDecision {
  /** True when the best guess clears the cutoff. */
  confident: boolean;
  primary: BinChoice;
  /** Up to two more options, ending with Others when it isn't the primary. */
  alternatives: BinChoice[];
}

/**
 * At or above the cutoff: the best bin in the guessed category. Below it:
 * Others, with the best guess as an alternative. The user can always override.
 */
export function decideFiling(t: Tables, guesses: AiGuess[], frequency: UseFrequency, settings: Settings): FilingDecision {
  const others = othersBin(t);
  const othersChoice: BinChoice | undefined = others && { binId: others.id, reachCost: liftPlan(t, others.id).cost, reason: 'others' };
  const sorted = [...guesses].sort((a, b) => b.confidence - a.confidence);
  const best = sorted[0];
  const bestBins = best ? rankBins(t, best.categoryId, frequency) : [];
  const second = sorted[1] ? rankBins(t, sorted[1].categoryId, frequency)[0] : undefined;

  if (best && best.confidence >= settings.aiCutoff && bestBins.length > 0) {
    const alts: BinChoice[] = [];
    if (second) alts.push({ ...second, reason: 'secondGuess' });
    else if (bestBins[1]) alts.push(bestBins[1]);
    if (othersChoice) alts.push(othersChoice);
    return { confident: true, primary: bestBins[0], alternatives: alts.slice(0, 2) };
  }
  if (!othersChoice) throw new Error('Others bin missing');
  const alts: BinChoice[] = bestBins[0] ? [{ ...bestBins[0], reason: 'secondGuess' }] : [];
  return { confident: false, primary: othersChoice, alternatives: alts };
}

// ---------- Front-row nudge ----------

export interface Nudge {
  itemId: ID;
  binId: ID;
  takeOuts: number;
  /** The front bin that blocks this one: move the item into it (recommended)… */
  moveItemTo: ID;
  /** …or swap the two bins. */
  swapWith: ID;
}

export function takeOutsWithin(t: Tables, itemId: ID, days: number, now = new Date()): number {
  return Object.values(t.events).filter((e) => e.type === 'tookOut' && e.itemId === itemId && daysBetween(e.at, now) < days).length;
}

/** An item taken out 4+ times in 30 days from a bin that needs lifting. */
export function frontRowNudge(t: Tables, itemId: ID, settings: Settings, now = new Date()): Nudge | undefined {
  const item = t.items[itemId];
  if (!item?.binId) return undefined;
  const plan = liftPlan(t, item.binId);
  if (plan.cost === 0) return undefined;
  const takeOuts = takeOutsWithin(t, itemId, settings.nudgeDays, now);
  if (takeOuts < settings.nudgeTakeouts) return undefined;
  const front = plan.steps.find((s) => s.kind === 'front') ?? plan.steps[0];
  // The bin nearest the front edge: last in its stack list is the bottom; take the top one.
  const target = front.binIds[0];
  return { itemId, binId: item.binId, takeOuts, moveItemTo: target, swapWith: target };
}

/** True when Others has grown past the threshold and should be sorted. */
export function othersNeedsSorting(t: Tables, settings: Settings): boolean {
  const others = othersBin(t);
  if (!others) return false;
  return Object.values(t.items).filter((i) => i.binId === others.id).length > settings.othersSortAt;
}
