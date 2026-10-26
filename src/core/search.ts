// Local search over names, nicknames, category names and their descriptions.
// No network: this runs on every keystroke.

import { binsOfCategory, itemCategory } from './naming';
import { reachCost } from './reach';
import type { Bin, Category, ID, Item, Tables } from './types';

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tokens(s: string): string[] {
  return normalize(s).split(' ').filter(Boolean);
}

/** Collapse spaces too, so "usbc" finds "USB-C". */
function squash(s: string): string {
  return normalize(s).replace(/ /g, '');
}

function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      best = Math.min(best, cur[j]);
    }
    if (best > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

/** Light stemming so "cables" matches "cable" and "batteries" matches "battery". */
function stem(w: string): string {
  if (w.length > 4 && w.endsWith('ies')) return w.slice(0, -3) + 'y';
  if (w.length > 3 && w.endsWith('es') && /(ch|sh|x|ss)es$/.test(w)) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
}

/**
 * 0 = no match. 1 = exact text match. Lower scores are fuzzier.
 * Every query word must match some word of the text.
 */
export function matchScore(query: string, text: string): number {
  const q = tokens(query).map(stem);
  if (q.length === 0) return 0;
  const words = tokens(text).map(stem);
  if (words.length === 0) return 0;
  if (squash(text) === squash(query)) return 1;
  if (squash(text).includes(squash(query)) && squash(query).length >= 3) return 0.9;
  let total = 0;
  for (const qw of q) {
    let best = 0;
    for (const w of words) {
      if (w === qw) best = Math.max(best, 1);
      else if (w.startsWith(qw)) best = Math.max(best, 0.85);
      else if (qw.length >= 4 && w.includes(qw)) best = Math.max(best, 0.7);
      else if (qw.length >= 4 && editDistance(qw, w, qw.length >= 7 ? 2 : 1) <= (qw.length >= 7 ? 2 : 1)) best = Math.max(best, 0.6);
    }
    if (best === 0) return 0;
    total += best;
  }
  return (total / q.length) * 0.85;
}

export interface CategoryHit {
  category: Category;
  bins: Bin[];
}

export interface ItemHit {
  item: Item;
  score: number;
  reachCost: number;
}

export interface SearchResult {
  /** A query that names a category shows its bins first. */
  categories: CategoryHit[];
  /** Easiest to reach first among similar matches. */
  items: ItemHit[];
  /** Bins found by nickname. */
  bins: Bin[];
}

export function search(t: Tables, query: string): SearchResult {
  const q = query.trim();
  if (!q) return { categories: [], items: [], bins: [] };

  const categories: CategoryHit[] = [];
  const categoryScore = new Map<ID, number>();
  for (const c of Object.values(t.categories)) {
    const s = Math.max(matchScore(q, c.name), matchScore(q, c.description) * 0.6);
    if (s > 0) categoryScore.set(c.id, s);
    if (matchScore(q, c.name) >= 0.6) categories.push({ category: c, bins: binsOfCategory(t, c.id) });
  }
  categories.sort((a, b) => (categoryScore.get(b.category.id) ?? 0) - (categoryScore.get(a.category.id) ?? 0));

  const items: ItemHit[] = [];
  for (const item of Object.values(t.items)) {
    const cat = itemCategory(t, item);
    const nameScore = matchScore(q, item.name);
    const viaCategory = cat ? (categoryScore.get(cat.id) ?? 0) * 0.5 : 0;
    const score = Math.max(nameScore, viaCategory);
    if (score <= 0) continue;
    items.push({ item, score, reachCost: item.binId ? reachCost(t, item.binId) : 0 });
  }
  // Group into confidence bands, then easiest reach first within a band.
  const band = (s: number) => (s >= 0.85 ? 0 : s >= 0.6 ? 1 : 2);
  items.sort((a, b) => band(a.score) - band(b.score) || a.reachCost - b.reachCost || b.score - a.score);

  const shown = new Set(categories.slice(0, 1).flatMap((c) => c.bins.map((b) => b.id)));
  const bins = Object.values(t.bins).filter((b) => !shown.has(b.id) && b.nickname && matchScore(q, b.nickname) >= 0.6);
  return { categories, items, bins };
}

/** For "Not in any bin": loosely related items to offer instead. */
export function closeMatches(t: Tables, query: string, limit = 3): Item[] {
  const qs = tokens(query);
  const scored: { item: Item; s: number }[] = [];
  for (const item of Object.values(t.items)) {
    let s = 0;
    for (const w of qs) {
      const word = w.slice(0, Math.max(3, Math.ceil(w.length * 0.6)));
      if (normalize(item.name).includes(word)) s += 1;
      const cat = itemCategory(t, item);
      if (cat && normalize(`${cat.name} ${cat.description}`).includes(word)) s += 0.5;
    }
    if (s > 0) scored.push({ item, s });
  }
  return scored
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.item);
}
