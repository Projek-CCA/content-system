import type { Matrix, MatrixCategory, MatrixItem } from '../data/types';

/**
 * Local customisations are stored as a diff against the built-in matrix
 * rather than a full copy. That way, when the built-in matrix is updated
 * (new items, new media), users who customised something still get the
 * updates for everything they didn't touch.
 */
export interface MatrixOverlay {
  version: 1;
  /** Category order, when it differs from the default. */
  order?: string[];
  /** Built-in categories that were removed. */
  removed?: string[];
  /** New categories, in full. */
  added?: MatrixCategory[];
  /** Changes to built-in categories. */
  patches?: Record<string, CategoryPatch>;
}

export interface CategoryPatch {
  /** Changed category fields. null means the field was cleared. */
  fields?: Record<string, unknown>;
  /** Changed item fields, by item id. null means the field was cleared. */
  items?: Record<string, Record<string, unknown>>;
  addedItems?: MatrixItem[];
  removedItems?: string[];
  itemOrder?: string[];
}

export const EMPTY_OVERLAY: MatrixOverlay = { version: 1 };

export function isEmptyOverlay(overlay: MatrixOverlay): boolean {
  return !overlay.order && !overlay.removed?.length && !overlay.added?.length && !Object.keys(overlay.patches ?? {}).length;
}

export function applyOverlay(base: Matrix, overlay: MatrixOverlay): Matrix {
  const removed = new Set(overlay.removed ?? []);
  let categories = base.categories
    .filter((c) => !removed.has(c.id))
    .map((c) => applyCategoryPatch(c, overlay.patches?.[c.id]));
  const existing = new Set(categories.map((c) => c.id));
  categories.push(...(overlay.added ?? []).filter((c) => !existing.has(c.id)));
  if (overlay.order) categories = sortBy(categories, overlay.order);
  return { version: 1, categories };
}

export function diffMatrix(base: Matrix, current: Matrix): MatrixOverlay {
  const overlay: MatrixOverlay = { version: 1 };
  const baseById = new Map(base.categories.map((c) => [c.id, c]));
  const currentIds = new Set(current.categories.map((c) => c.id));

  const removed = base.categories.filter((c) => !currentIds.has(c.id)).map((c) => c.id);
  if (removed.length) overlay.removed = removed;

  const added = current.categories.filter((c) => !baseById.has(c.id));
  if (added.length) overlay.added = clone(added);

  const patches: Record<string, CategoryPatch> = {};
  for (const cat of current.categories) {
    const original = baseById.get(cat.id);
    if (!original) continue;
    const patch = diffCategory(original, cat);
    if (patch) patches[cat.id] = patch;
  }
  if (Object.keys(patches).length) overlay.patches = patches;

  const naturalOrder = [...base.categories.filter((c) => currentIds.has(c.id)).map((c) => c.id), ...added.map((c) => c.id)];
  const order = current.categories.map((c) => c.id);
  if (order.join('|') !== naturalOrder.join('|')) overlay.order = order;

  return overlay;
}

function applyCategoryPatch(cat: MatrixCategory, patch: CategoryPatch | undefined): MatrixCategory {
  if (!patch) return cat;
  const next = applyFields({ ...cat }, patch.fields);
  const removed = new Set(patch.removedItems ?? []);
  let items = cat.items
    .filter((i) => !removed.has(i.id))
    .map((i) => (patch.items?.[i.id] ? applyFields({ ...i }, patch.items[i.id]) : i));
  const existing = new Set(items.map((i) => i.id));
  items.push(...(patch.addedItems ?? []).filter((i) => !existing.has(i.id)));
  if (patch.itemOrder) items = sortBy(items, patch.itemOrder);
  next.items = items;
  return next;
}

function diffCategory(base: MatrixCategory, current: MatrixCategory): CategoryPatch | undefined {
  const patch: CategoryPatch = {};
  const { items: baseItems, ...baseFields } = base;
  const { items: currentItems, ...currentFields } = current;

  const fields = diffFields(baseFields, currentFields);
  if (fields) patch.fields = fields;

  const baseById = new Map(baseItems.map((i) => [i.id, i]));
  const currentIds = new Set(currentItems.map((i) => i.id));

  const removedItems = baseItems.filter((i) => !currentIds.has(i.id)).map((i) => i.id);
  if (removedItems.length) patch.removedItems = removedItems;

  const addedItems = currentItems.filter((i) => !baseById.has(i.id));
  if (addedItems.length) patch.addedItems = clone(addedItems);

  const items: Record<string, Record<string, unknown>> = {};
  for (const item of currentItems) {
    const original = baseById.get(item.id);
    if (!original) continue;
    const changed = diffFields(original, item);
    if (changed) items[item.id] = changed;
  }
  if (Object.keys(items).length) patch.items = items;

  const naturalOrder = [...baseItems.filter((i) => currentIds.has(i.id)).map((i) => i.id), ...addedItems.map((i) => i.id)];
  const order = currentItems.map((i) => i.id);
  if (order.join('|') !== naturalOrder.join('|')) patch.itemOrder = order;

  return Object.keys(patch).length ? patch : undefined;
}

function diffFields(base: object, current: object): Record<string, unknown> | undefined {
  const a = base as Record<string, unknown>;
  const b = current as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    const before = a[key];
    const after = b[key];
    if (after === undefined && before === undefined) continue;
    if (JSON.stringify(before) === JSON.stringify(after)) continue;
    out[key] = after === undefined ? null : clone(after);
  }
  return Object.keys(out).length ? out : undefined;
}

function applyFields<T extends object>(target: T, fields: Record<string, unknown> | undefined): T {
  const record = target as Record<string, unknown>;
  for (const [key, value] of Object.entries(fields ?? {})) {
    if (value === null) delete record[key];
    else record[key] = value;
  }
  return target;
}

function sortBy<T extends { id: string }>(list: T[], order: string[]): T[] {
  const rank = new Map(order.map((id, i) => [id, i]));
  return list
    .map((entry, i) => ({ entry, i }))
    .sort((x, y) => (rank.get(x.entry.id) ?? order.length + x.i) - (rank.get(y.entry.id) ?? order.length + y.i))
    .map((x) => x.entry);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
