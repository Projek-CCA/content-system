import type { MatrixCategory, MatrixItem, Profile, Reference, Selection } from '../data/types';
import { type Board, findItem, hashString, selectionKey } from './matrix';
import { type FocusReading, readFocus } from './angles';
import { strings } from './localize';
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
  /** How many distinct hooks exist for this combination. */
  hookVariations: number;
  /** How "What is this content about?" was read, when an intent was recognised. */
  angle?: FocusReading['angle'];
  lines: BriefLine[];
  structure: { item: MatrixItem; steps: string[] }[];
  tips: { category: MatrixCategory; item: MatrixItem; tips: string[] }[];
  references: { item: MatrixItem; references: Reference[] }[];
}

const DEFAULT_SUBJECT = '{product}';

/**
 * Turn a selection into a content brief.
 *
 * Hook templates are pooled from every selected item (content type, present
 * style, topic...), unless a picked item's column has `hooksOverride` (the
 * Hook column), whose hooks then decide the opening alone. When the user said
 * what the content is about, `reading` (see readFocus) supplies the subjects
 * and adds hooks for the recognised intent; otherwise {subject} comes from the
 * `subjects` of the selected items. `variant` cycles through every distinct hook.
 */
export function buildBrief(board: Board, selection: Selection, variant = 0, reading?: FocusReading): IdeaBrief {
  const picks: Pick[] = [];
  const missing: MatrixCategory[] = [];
  for (const category of board.categories) {
    const item = findItem(category, selection[category.id]);
    if (item) picks.push({ category, item });
    else if (category.items.length > 0) missing.push(category);
  }

  const override = [...picks].reverse().find((p) => p.category.hooksOverride && p.item.hooks?.length);
  const angleHooks = override ? [] : (reading?.hooks ?? []);
  const templates = override ? override.item.hooks! : picks.flatMap((p) => p.item.hooks ?? []);
  const subjects = reading?.subjects.length ? reading.subjects : picks.flatMap((p) => p.item.subjects ?? []);
  const subjectPool = subjects.length ? subjects : [DEFAULT_SUBJECT];
  const key = selectionKey(board, selection);

  // Every distinct hook: templates cycle fastest, then subjects. A template
  // without {subject} appears once. Hooks written for the recognised intent
  // come first, and the first hook shown is always one of them.
  const expand = (list: string[]) => {
    const out: string[] = [];
    subjectPool.forEach((subject, i) => {
      for (const template of list) {
        if (template.includes('{subject}')) out.push(withSubject(template, subject));
        else if (i === 0) out.push(template);
      }
    });
    return out;
  };
  const intentFirst = [...new Set(expand(angleHooks))];
  const unique = [...new Set([...intentFirst, ...expand(templates)])];
  const start = hashString(key) % (intentFirst.length || unique.length || 1);
  const hook = unique.length ? unique[(start + variant) % unique.length] : undefined;

  return {
    key,
    picks,
    missing,
    complete: picks.length > 0 && missing.length === 0,
    hook,
    hookVariations: unique.length,
    angle: reading?.angle,
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

/** Fill {subject}, capitalising it where it starts a sentence ("One mission. Resipi ..."). */
function withSubject(template: string, subject: string): string {
  return template.replace(/(^|[.!?]\s+)?\{subject\}/g, (_, start: string | undefined) =>
    start !== undefined ? start + capitalise(subject) : subject,
  );
}

/** How the profile's "What is this content about?" and key points shape the hooks. */
export function focusReading(profile: { focus?: string; points?: string; language: Profile['language'] }): FocusReading | undefined {
  return readFocus(profile.focus ?? '', parsePoints(profile.points), profile.language);
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
  const t = strings(profile.language);
  out.push(`${t.contentIdea}: ${briefTitle(brief)}`);
  out.push('');
  if (profile.focus?.trim()) {
    out.push(`${t.about}: ${profile.focus.trim()}`);
    out.push('');
  }
  const hook = hookText(brief, profile);
  if (hook) {
    out.push(`${t.hookStarter}: "${hook}"`);
    out.push('');
  }
  for (const line of brief.lines) {
    out.push(`${line.label} (${line.item.label}): ${fill(line.text, profile)}`);
  }
  const points = parsePoints(profile.points);
  if (points.length) {
    out.push('');
    out.push(`${t.mustInclude}:`);
    points.forEach((point) => out.push(`- ${point}`));
  }
  for (const block of brief.structure) {
    out.push('');
    out.push(`${t.structure} (${block.item.label}):`);
    block.steps.forEach((step, i) => out.push(`${i + 1}. ${fill(step, profile)}`));
  }
  if (brief.tips.length) {
    out.push('');
    out.push(`${t.tips}:`);
    for (const block of brief.tips) {
      for (const tip of block.tips) out.push(`- ${block.item.label}: ${fill(tip, profile)}`);
    }
  }
  if (brief.references.length) {
    out.push('');
    out.push(`${t.styleRefs}: ${brief.references.flatMap((r) => r.references.map((ref) => ref.label)).join(', ')}`);
  }
  return out.join('\n');
}

const LANGUAGE_NOTES: Record<Profile['language'], string> = {
  English: 'Write in natural, conversational English.',
  'Bahasa Melayu':
    'Write in natural, conversational Bahasa Melayu (korang, takde, dia), not formal written BM (avoid ia, tiada, adalah, tersebut).',
  'Mixed (BM + English)':
    'Write in a natural mix of Bahasa Melayu and English, the way Malaysians talk casually on social media: BM carries the story, English carries the emphasis.',
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
    const angle = focusReading(profile)?.angle;
    out.push(`This video is about: ${profile.focus.trim()}${angle ? ` (type of content: ${angle.label})` : ''}`);
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
  out.push('Rules:');
  out.push('- Each spoken hook is 16 words or fewer, and conflict, a paradox or the stakes land in the first sentence.');
  out.push('- The hook opens the story. Never state the moral, lesson or call to action in the hook.');
  out.push('- Never invent statistics, prices or facts. Use the key points given; mark anything you are unsure of as [VERIFY: ...].');
  out.push('- Write for the ear: short spoken sentences, the way a creator actually talks on camera.');
  out.push('');
  out.push(LANGUAGE_NOTES[profile.language] ?? LANGUAGE_NOTES.English);
  return out.join('\n');
}

/** Output instructions for in-app generation, so the script renders cleanly. */
export const AI_SYSTEM_PROMPT =
  'You write ready-to-shoot short-form video scripts for small businesses. Reply with the deliverables only, no preamble. ' +
  'Use "## " headings for each deliverable, numbered or "- " lists, and **bold** sparingly. No tables.';
