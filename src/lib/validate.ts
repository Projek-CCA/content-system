import type { Matrix, MatrixCategory, MatrixItem, MediaType } from '../data/types';

export interface ValidationResult {
  matrix?: Matrix;
  errors: string[];
  warnings: string[];
}

const MEDIA_TYPES: MediaType[] = ['image', 'video', 'youtube', 'embed'];
const ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isString = (v: unknown): v is string => typeof v === 'string';
const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every(isString);

/**
 * Check a matrix (e.g. an imported JSON file) before using it.
 * Errors make the matrix unusable; warnings are things that will quietly not work.
 */
export function validateMatrix(data: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isObject(data)) return { errors: ['The file is not a matrix object.'], warnings };
  if (data.version !== 1) errors.push('Unsupported matrix version (expected "version": 1).');
  if (!Array.isArray(data.categories)) {
    errors.push('"categories" must be a list.');
    return { errors, warnings };
  }

  const categoryIds = new Set<string>();
  data.categories.forEach((cat, ci) => {
    const where = `Category #${ci + 1}`;
    if (!isObject(cat)) {
      errors.push(`${where} is not an object.`);
      return;
    }
    const name = isString(cat.label) ? `"${cat.label}"` : where;
    if (!isString(cat.id) || !ID_PATTERN.test(cat.id)) errors.push(`${name}: "id" must be lowercase letters, numbers and dashes.`);
    else if (categoryIds.has(cat.id)) errors.push(`${name}: duplicate category id "${cat.id}".`);
    else categoryIds.add(cat.id);
    if (!isString(cat.label) || !cat.label.trim()) errors.push(`${where}: "label" is required.`);
    if (!isString(cat.question)) errors.push(`${name}: "question" is required.`);
    for (const key of ['description', 'briefLabel', 'dependsOn', 'color'] as const) {
      if (cat[key] !== undefined && !isString(cat[key])) errors.push(`${name}: "${key}" must be text.`);
    }
    for (const key of ['optional', 'hooksOverride'] as const) {
      if (cat[key] !== undefined && typeof cat[key] !== 'boolean') errors.push(`${name}: "${key}" must be true or false.`);
    }
    if (cat.ms !== undefined && !isObject(cat.ms)) errors.push(`${name}: "ms" must be an object of translated text.`);
    if (!Array.isArray(cat.items)) {
      errors.push(`${name}: "items" must be a list.`);
      return;
    }

    const itemIds = new Set<string>();
    cat.items.forEach((item, ii) => {
      const at = `${name} item #${ii + 1}`;
      if (!isObject(item)) {
        errors.push(`${at} is not an object.`);
        return;
      }
      const itemName = isString(item.label) ? `${name} → "${item.label}"` : at;
      if (!isString(item.id) || !ID_PATTERN.test(item.id)) errors.push(`${itemName}: "id" must be lowercase letters, numbers and dashes.`);
      else if (itemIds.has(item.id)) errors.push(`${itemName}: duplicate item id "${item.id}".`);
      else itemIds.add(item.id);
      if (!isString(item.label) || !item.label.trim()) errors.push(`${at}: "label" is required.`);
      if (!isString(item.description)) errors.push(`${itemName}: "description" is required.`);
      for (const key of ['altLabel', 'brief', 'example'] as const) {
        if (item[key] !== undefined && !isString(item[key])) errors.push(`${itemName}: "${key}" must be text.`);
      }
      for (const key of ['howTo', 'structure', 'hooks', 'subjects', 'parents'] as const) {
        if (item[key] !== undefined && !isStringArray(item[key])) errors.push(`${itemName}: "${key}" must be a list of text.`);
      }
      if (item.media !== undefined && item.media !== null) {
        const media = item.media;
        if (!isObject(media) || !MEDIA_TYPES.includes(media.type as MediaType) || !isString(media.src)) {
          errors.push(`${itemName}: "media" needs a "type" (${MEDIA_TYPES.join(', ')}) and a "src".`);
        }
      }
      if (item.ms !== undefined) {
        const ms = item.ms;
        if (!isObject(ms)) errors.push(`${itemName}: "ms" must be an object of translated text.`);
        else {
          for (const key of ['label', 'altLabel', 'description', 'brief', 'example'] as const) {
            if (ms[key] !== undefined && !isString(ms[key])) errors.push(`${itemName}: "ms.${key}" must be text.`);
          }
          for (const key of ['howTo', 'structure', 'hooks', 'subjects'] as const) {
            if (ms[key] !== undefined && !isStringArray(ms[key])) errors.push(`${itemName}: "ms.${key}" must be a list of text.`);
          }
        }
      }
      if (item.references !== undefined) {
        if (!Array.isArray(item.references) || !item.references.every((r) => isObject(r) && isString(r.label))) {
          errors.push(`${itemName}: every reference needs a "label".`);
        }
      }
    });
  });

  if (errors.length) return { errors, warnings };

  const matrix = data as unknown as Matrix;
  const byId = new Map(matrix.categories.map((c) => [c.id, c]));
  for (const cat of matrix.categories) {
    if (!cat.dependsOn) {
      if (cat.items.some((i) => i.parents?.length)) {
        warnings.push(`"${cat.label}" has items with parents but the column doesn't depend on another column.`);
      }
      continue;
    }
    const parent = byId.get(cat.dependsOn);
    if (!parent || parent.id === cat.id) {
      errors.push(`"${cat.label}" depends on unknown column "${cat.dependsOn}".`);
      continue;
    }
    if (dependsOnItself(cat, byId)) errors.push(`"${cat.label}" is part of a dependency loop.`);
    const parentIds = new Set(parent.items.map((i) => i.id));
    for (const item of cat.items) {
      const unknown = (item.parents ?? []).filter((id) => !parentIds.has(id));
      if (unknown.length) warnings.push(`"${cat.label}" → "${item.label}" lists unknown ${parent.label} item(s): ${unknown.join(', ')}.`);
    }
    for (const parentItem of parent.items) {
      if (!cat.items.some((i) => fits(i, parentItem))) {
        warnings.push(`${parent.label} "${parentItem.label}" has no ${cat.label} options yet.`);
      }
    }
  }

  return errors.length ? { errors, warnings } : { matrix, errors, warnings };
}

function fits(item: MatrixItem, parent: MatrixItem) {
  return !item.parents?.length || item.parents.includes(parent.id);
}

function dependsOnItself(cat: MatrixCategory, byId: Map<string, MatrixCategory>): boolean {
  const seen = new Set<string>([cat.id]);
  let current = cat.dependsOn ? byId.get(cat.dependsOn) : undefined;
  while (current) {
    if (seen.has(current.id)) return current.id === cat.id;
    seen.add(current.id);
    current = current.dependsOn ? byId.get(current.dependsOn) : undefined;
  }
  return false;
}
