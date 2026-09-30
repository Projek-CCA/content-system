import type { Profile } from '../data/types';

export type ProfileKey = 'brand' | 'product' | 'audience' | 'niche';

export const PROFILE_KEYS: ProfileKey[] = ['brand', 'product', 'audience', 'niche'];

/** What an unfilled placeholder shows as, e.g. "[product]". */
export const BLANK_LABELS: Record<ProfileKey, string> = {
  brand: 'brand',
  product: 'product',
  audience: 'audience',
  niche: 'niche',
};

export interface TextPart {
  text: string;
  /** True when this part is a placeholder the user hasn't filled in yet. */
  blank?: boolean;
}

const PLACEHOLDER = /\{(brand|product|audience|niche)\}/g;

/** Split a template into plain text and filled / blank placeholder parts. */
export function fillParts(template: string, profile: Partial<Profile>): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  for (const match of template.matchAll(PLACEHOLDER)) {
    const index = match.index ?? 0;
    if (index > last) parts.push({ text: template.slice(last, index) });
    const key = match[1] as ProfileKey;
    const value = profile[key]?.trim();
    parts.push(value ? { text: value } : { text: `[${BLANK_LABELS[key]}]`, blank: true });
    last = index + match[0].length;
  }
  if (last < template.length) parts.push({ text: template.slice(last) });
  return mergePlain(parts);
}

export function fill(template: string, profile: Partial<Profile>): string {
  return fillParts(template, profile)
    .map((p) => p.text)
    .join('');
}

/** Capitalise the first letter of a sentence built from parts. */
export function capitaliseParts(parts: TextPart[]): TextPart[] {
  if (parts.length === 0 || parts[0].blank) return parts;
  const [first, ...rest] = parts;
  return [{ ...first, text: capitalise(first.text) }, ...rest];
}

export function capitalise(text: string): string {
  const i = text.search(/\S/);
  if (i < 0) return text;
  return text.slice(0, i) + text.charAt(i).toUpperCase() + text.slice(i + 1);
}

function mergePlain(parts: TextPart[]): TextPart[] {
  const out: TextPart[] = [];
  for (const part of parts) {
    const prev = out[out.length - 1];
    if (prev && !prev.blank && !part.blank) prev.text += part.text;
    else out.push({ ...part });
  }
  return out;
}
