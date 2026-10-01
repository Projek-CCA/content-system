import type { MatrixCategory, MatrixItem, Profile, Reference, Selection } from '../data/types';
import { type Board, findItem, hashString, selectionKey } from './matrix';
import { capitalise, capitaliseParts, fill, fillParts, type TextPart } from './template';

export interface Pick {
  category: MatrixCategory;
  item: MatrixItem;
}

export interface BriefLine {
  category: MatrixCategory;
  item: MatrixItem;
  /** e.g. "Shoot it" */
  label: string;
  /** Template text, may contain profile placeholders. */
  text: string;
}

export interface IdeaBrief {
  key: string;
  /** Selected items in board order. */
  picks: Pick[];
  /** Active categories still waiting for a pick. */
  missing: MatrixCategory[];
  complete: boolean;
  /** Hook template with {subject} already substituted. Profile placeholders remain. */
  hook?: string;
  /** How many hook × subject variations exist for this combination. */
  hookVariations: number;
  lines: BriefLine[];
  structure: { item: MatrixItem; steps: string[] }[];
  tips: { category: MatrixCategory; item: MatrixItem; tips: string[] }[];
  references: { item: MatrixItem; references: Reference[] }[];
}

const DEFAULT_SUBJECT = '{product}';

/**
 * Turn a selection into a content brief.
 *
 * The hook comes from the right-most selected item that has `hooks` (so an
 * active Hook column overrides the Present Style hooks). {subject} is filled
 * with the user's own content focus when they gave one, otherwise from the
 * `subjects` of the selected items. `variant` cycles through every
 * hook × subject pairing.
 */
export function buildBrief(board: Board, selection: Selection, variant = 0, focus = ''): IdeaBrief {
  const picks: Pick[] = [];
  const missing: MatrixCategory[] = [];
  for (const category of board.categories) {
    const item = findItem(category, selection[category.id]);
    if (item) picks.push({ category, item });
    else if (category.items.length > 0) missing.push(category);
  }

  const hookSource = [...picks].reverse().find((p) => p.item.hooks?.length);
  const hooks = hookSource?.item.hooks ?? [];
  const subjects = focus.trim() ? [focus.trim()] : picks.flatMap((p) => p.item.subjects ?? []);
  const subjectPool = subjects.length ? subjects : [DEFAULT_SUBJECT];
  const key = selectionKey(board, selection);

  let hook: string | undefined;
  if (hooks.length) {
    const n = (hashString(key) + variant) % (hooks.length * subjectPool.length);
    const template = hooks[n % hooks.length];
    const subject = subjectPool[Math.floor(n / hooks.length) % subjectPool.length];
    hook = template.replaceAll('{subject}', subject);
  }
  const usesSubject = hooks.some((h) => h.includes('{subject}'));

  return {
    key,
    picks,
    missing,
    complete: picks.length > 0 && missing.length === 0,
    hook,
    hookVariations: hooks.length * (usesSubject ? subjectPool.length : 1),
    lines: picks.map(({ category, item }) => ({
      category,
      item,
      label: category.briefLabel || category.label,
      text: item.brief || item.description,
    })),
    structure: picks.filter((p) => p.item.structure?.length).map((p) => ({ item: p.item, steps: p.item.structure! })),
    tips: picks
      .filter((p) => p.item.howTo?.length)
      .map((p) => ({ category: p.category, item: p.item, tips: p.item.howTo! })),
    references: picks
      .filter((p) => p.item.references?.length)
      .map((p) => ({ item: p.item, references: p.item.references! })),
  };
}

export function hookParts(brief: IdeaBrief, profile: Partial<Profile>): TextPart[] {
  return brief.hook ? capitaliseParts(fillParts(brief.hook, profile)) : [];
}

export function hookText(brief: IdeaBrief, profile: Partial<Profile>): string {
  return brief.hook ? capitalise(fill(brief.hook, profile)) : '';
}

/** Key points typed one per line; bullets and blank lines are ignored. */
export function parsePoints(text: string | undefined): string[] {
  return (text ?? '')
    .split('\n')
    .map((line) => line.replace(/^\s*(?:[-*•·]|\d+[.)])\s*/, '').trim())
    .filter(Boolean);
}

export function briefTitle(brief: IdeaBrief): string {
  return brief.picks.map((p) => p.item.label).join(' × ');
}

/** Plain-text version of the brief, for copying into notes or WhatsApp. */
export function briefToText(brief: IdeaBrief, profile: Partial<Profile>): string {
  const out: string[] = [];
  out.push(`CONTENT IDEA: ${briefTitle(brief)}`);
  out.push('');
  if (profile.focus?.trim()) {
    out.push(`About: ${profile.focus.trim()}`);
    out.push('');
  }
  const hook = hookText(brief, profile);
  if (hook) {
    out.push(`Hook starter: "${hook}"`);
    out.push('');
  }
  for (const line of brief.lines) {
    out.push(`${line.label} (${line.item.label}): ${fill(line.text, profile)}`);
  }
  const points = parsePoints(profile.points);
  if (points.length) {
    out.push('');
    out.push('Must include:');
    points.forEach((point) => out.push(`- ${point}`));
  }
  for (const block of brief.structure) {
    out.push('');
    out.push(`Structure (${block.item.label}):`);
    block.steps.forEach((step, i) => out.push(`${i + 1}. ${fill(step, profile)}`));
  }
  if (brief.tips.length) {
    out.push('');
    out.push('Tips:');
    for (const block of brief.tips) {
      for (const tip of block.tips) out.push(`- ${block.item.label}: ${fill(tip, profile)}`);
    }
  }
  if (brief.references.length) {
    out.push('');
    out.push(`Style references: ${brief.references.flatMap((r) => r.references.map((ref) => ref.label)).join(', ')}`);
  }
  return out.join('\n');
}

const LANGUAGE_NOTES: Record<Profile['language'], string> = {
  English: 'Write in natural, conversational English.',
  'Bahasa Melayu': 'Write in natural, conversational Bahasa Melayu.',
  'Mixed (BM + English)':
    'Write in a natural mix of Bahasa Melayu and English, the way Malaysians talk casually on social media.',
};

/** A ready-to-paste prompt for Claude, ChatGPT or any AI assistant. */
export function briefToAiPrompt(brief: IdeaBrief, profile: Profile): string {
  const out: string[] = [];
  out.push('You are an expert short-form video strategist and scriptwriter.');
  out.push('');
  out.push('Write a ready-to-shoot short video script for this business:');
  out.push(`- Brand: ${profile.brand.trim() || '(not specified)'}`);
  out.push(`- What they sell: ${profile.product.trim() || '(not specified)'}`);
  out.push(`- Target audience: ${profile.audience.trim() || '(not specified)'}`);
  out.push(`- Industry / niche: ${profile.niche.trim() || '(not specified)'}`);
  if (profile.focus?.trim()) {
    out.push('');
    out.push(`This video is about: ${profile.focus.trim()}`);
  }
  const points = parsePoints(profile.points);
  if (points.length) {
    out.push('');
    out.push('Key points / USPs the script must include:');
    points.forEach((point) => out.push(`- ${point}`));
  }
  out.push('');
  out.push('Follow this content formula from our Content Idea Matrix:');
  for (const { category, item } of brief.picks) {
    const name = item.altLabel ? `${item.label} (${item.altLabel})` : item.label;
    out.push(`- ${category.label}: ${name}. ${item.description} ${fill(item.brief ?? '', profile)}`.trim());
  }
  for (const block of brief.structure) {
    out.push('');
    out.push(`Suggested structure (${block.item.label}):`);
    block.steps.forEach((step, i) => out.push(`${i + 1}. ${fill(step, profile)}`));
  }
  const hook = hookText(brief, profile);
  if (hook) {
    out.push('');
    out.push(`Hook starter to build on: "${hook}"`);
  }
  out.push('');
  out.push('Deliver:');
  out.push('1. Three hook options for the first 3 seconds (spoken line + on-screen text).');
  out.push('2. The full script, split into scenes with timestamps.');
  out.push('3. A shot list: what the camera sees in each scene, following the shooting style above.');
  out.push('4. On-screen text for each scene.');
  out.push('5. A post caption with a clear call to action and 5 relevant hashtags.');
  if (points.length) out.push('6. Work every key point listed above into the script naturally.');
  out.push('');
  out.push(LANGUAGE_NOTES[profile.language] ?? LANGUAGE_NOTES.English);
  return out.join('\n');
}
