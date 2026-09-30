import type { Matrix, MatrixCategory, MatrixItem, Selection } from '../data/types';

export type Rng = () => number;

/**
 * The active categories of a matrix and how they depend on each other.
 * A category only depends on its parent while that parent is active; when the
 * parent is switched off the category behaves like an independent column.
 */
export interface Board {
  /** Active categories in board (display) order. */
  categories: MatrixCategory[];
  /** Active categories ordered so every parent comes before its children. */
  ordered: MatrixCategory[];
  parentOf: Map<string, MatrixCategory>;
  childrenOf: Map<string, MatrixCategory[]>;
  roots: MatrixCategory[];
}

export function buildBoard(matrix: Matrix, activeIds: Iterable<string>): Board {
  const active = new Set(activeIds);
  const categories = matrix.categories.filter((c) => active.has(c.id));
  const byId = new Map(categories.map((c) => [c.id, c]));

  const parentOf = new Map<string, MatrixCategory>();
  for (const cat of categories) {
    const parent = cat.dependsOn ? byId.get(cat.dependsOn) : undefined;
    if (parent && parent.id !== cat.id) parentOf.set(cat.id, parent);
  }

  // Break any dependency cycle: a category not reachable from a real root is
  // promoted to a root so it still gets picked.
  const reachable = new Set<string>();
  const visit = (id: string) => {
    if (reachable.has(id)) return;
    reachable.add(id);
    for (const cat of categories) if (parentOf.get(cat.id)?.id === id) visit(cat.id);
  };
  for (const cat of categories) if (!parentOf.has(cat.id)) visit(cat.id);
  for (const cat of categories) {
    if (!reachable.has(cat.id)) {
      parentOf.delete(cat.id);
      visit(cat.id);
    }
  }

  const childrenOf = new Map<string, MatrixCategory[]>();
  for (const cat of categories) {
    const parent = parentOf.get(cat.id);
    if (!parent) continue;
    const list = childrenOf.get(parent.id) ?? [];
    list.push(cat);
    childrenOf.set(parent.id, list);
  }

  const roots = categories.filter((c) => !parentOf.has(c.id));
  const ordered: MatrixCategory[] = [];
  const walk = (cat: MatrixCategory) => {
    ordered.push(cat);
    for (const child of childrenOf.get(cat.id) ?? []) walk(child);
  };
  roots.forEach(walk);

  return { categories, ordered, parentOf, childrenOf, roots };
}

export function findItem(category: MatrixCategory | undefined, itemId: string | undefined): MatrixItem | undefined {
  if (!category || !itemId) return undefined;
  return category.items.find((i) => i.id === itemId);
}

/** Items of a category that fit under the given parent item (all items when there is no parent). */
export function itemsFor(category: MatrixCategory, parentItemId: string | undefined): MatrixItem[] {
  if (!parentItemId) return category.items;
  return category.items.filter((i) => fitsParent(i, parentItemId));
}

export function fitsParent(item: MatrixItem, parentItemId: string): boolean {
  return !item.parents || item.parents.length === 0 || item.parents.includes(parentItemId);
}

/** Locked categories whose value is the current selection. */
export function lockMap(selection: Selection, locked: Iterable<string>): Selection {
  const map: Selection = {};
  for (const id of locked) if (selection[id]) map[id] = selection[id];
  return map;
}

/**
 * Number of possible ideas for the category subtree under a parent item.
 * A category with no items for that parent is left blank and counts as 1.
 */
function countSubtree(board: Board, cat: MatrixCategory, parentItemId: string | undefined, locks: Selection): number {
  const candidates = candidatesFor(cat, parentItemId, locks);
  if (candidates === 'blank') return 1;
  let total = 0;
  for (const item of candidates) {
    let product = 1;
    for (const child of board.childrenOf.get(cat.id) ?? []) {
      product *= countSubtree(board, child, item.id, locks);
      if (product === 0) break;
    }
    total += product;
  }
  return total;
}

function candidatesFor(cat: MatrixCategory, parentItemId: string | undefined, locks: Selection): MatrixItem[] | 'blank' {
  const valid = itemsFor(cat, parentItemId);
  const lockId = locks[cat.id];
  if (lockId) return valid.filter((i) => i.id === lockId);
  return valid.length === 0 ? 'blank' : valid;
}

/** How many unique ideas the active board can produce (respecting locks). */
export function countCombinations(board: Board, locks: Selection = {}): number {
  if (board.categories.length === 0) return 0;
  let total = 1;
  for (const root of board.roots) total *= countSubtree(board, root, undefined, locks);
  return total;
}

/** One random idea. Locked categories keep their value; parents are chosen so locked children stay valid. */
export function randomSelection(board: Board, locks: Selection, rng: Rng = Math.random): Selection {
  const effectiveLocks = countCombinations(board, locks) > 0 ? locks : {};
  const selection: Selection = {};

  const pick = (cat: MatrixCategory, parentItemId: string | undefined) => {
    const candidates = candidatesFor(cat, parentItemId, effectiveLocks);
    if (candidates === 'blank') return;
    const children = board.childrenOf.get(cat.id) ?? [];
    const feasible = candidates.filter((item) =>
      children.every((child) => countSubtree(board, child, item.id, effectiveLocks) > 0),
    );
    if (feasible.length === 0) return;
    const item = feasible[Math.floor(rng() * feasible.length)];
    selection[cat.id] = item.id;
    for (const child of children) pick(child, item.id);
  };

  board.roots.forEach((root) => pick(root, undefined));
  return selection;
}

/** Every possible idea. Only call this when countCombinations is small. */
export function enumerateSelections(board: Board, locks: Selection = {}): Selection[] {
  let results: Selection[] = [{}];

  const expand = (partials: Selection[], cat: MatrixCategory): Selection[] => {
    const out: Selection[] = [];
    for (const partial of partials) {
      const parent = board.parentOf.get(cat.id);
      const candidates = candidatesFor(cat, parent ? partial[parent.id] : undefined, locks);
      if (candidates === 'blank') {
        out.push(partial);
        continue;
      }
      for (const item of candidates) out.push({ ...partial, [cat.id]: item.id });
    }
    return out;
  };

  for (const cat of board.ordered) results = expand(results, cat);
  return results;
}

export function selectionKey(board: Board, selection: Selection): string {
  return board.categories.map((c) => `${c.id}=${selection[c.id] ?? ''}`).join('|');
}

export interface BatchOptions {
  count: number;
  locks?: Selection;
  rng?: Rng;
  /** Selections to skip, e.g. ideas already in the list. */
  exclude?: Iterable<string>;
}

/**
 * Up to `count` unique ideas. Categories are sampled one column at a time, so
 * every content type gets a fair share instead of types with more present
 * styles dominating. Falls back to full enumeration to fill any gap.
 */
export function generateBatch(board: Board, { count, locks = {}, rng = Math.random, exclude = [] }: BatchOptions): Selection[] {
  const total = countCombinations(board, locks);
  const seen = new Set(exclude);
  const results: Selection[] = [];
  const target = Math.max(0, Math.min(count, total));

  let attempts = 0;
  while (results.length < target && attempts < target * 40 + 100) {
    attempts++;
    const selection = randomSelection(board, locks, rng);
    const key = selectionKey(board, selection);
    if (seen.has(key)) continue;
    seen.add(key);
    results.push(selection);
  }

  if (results.length < target && total <= 50_000) {
    const rest = shuffle(enumerateSelections(board, locks), rng);
    for (const selection of rest) {
      if (results.length >= target) break;
      const key = selectionKey(board, selection);
      if (seen.has(key)) continue;
      seen.add(key);
      results.push(selection);
    }
  }
  return results;
}

/**
 * Select an item by hand. Parents are switched to match the item (clicking
 * "Dance" selects "Trend"), and children that no longer fit are cleared.
 */
export function applySelect(board: Board, selection: Selection, categoryId: string, itemId: string): Selection {
  const next: Selection = { ...selection, [categoryId]: itemId };

  let cat = board.categories.find((c) => c.id === categoryId);
  let item = findItem(cat, itemId);
  while (cat && item) {
    const parent = board.parentOf.get(cat.id);
    if (!parent) break;
    const current = next[parent.id];
    if (item.parents?.length && !(current && item.parents.includes(current))) {
      const replacement = item.parents.find((id) => parent.items.some((p) => p.id === id));
      if (!replacement) break;
      next[parent.id] = replacement;
    }
    cat = parent;
    item = findItem(parent, next[parent.id]);
  }

  return pruneSelection(board, next);
}

/** Drop selections for inactive categories, unknown items and children that don't fit their parent. */
export function pruneSelection(board: Board, selection: Selection): Selection {
  const next: Selection = {};
  for (const cat of board.ordered) {
    const item = findItem(cat, selection[cat.id]);
    if (!item) continue;
    const parent = board.parentOf.get(cat.id);
    const parentItemId = parent ? next[parent.id] : undefined;
    if (parentItemId && !fitsParent(item, parentItemId)) continue;
    next[cat.id] = item.id;
  }
  return next;
}

export function shuffle<T>(list: T[], rng: Rng = Math.random): T[] {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Small deterministic PRNG for tests and reproducible batches. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'item'
  );
}

export function uniqueId(base: string, taken: Iterable<string>): string {
  const set = new Set(taken);
  const slug = slugify(base);
  if (!set.has(slug)) return slug;
  let n = 2;
  while (set.has(`${slug}-${n}`)) n++;
  return `${slug}-${n}`;
}
