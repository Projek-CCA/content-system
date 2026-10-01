import { describe, expect, it } from 'vitest';
import defaultMatrix from '../data/cim-matrix.json';
import type { Matrix, Profile } from '../data/types';
import { briefToAiPrompt, briefToText, buildBrief, hookText, parsePoints } from './brief';
import { buildBoard, generateBatch, seededRng } from './matrix';
import { applyOverlay, diffMatrix, isEmptyOverlay } from './overlay';
import { fill, fillParts } from './template';
import { localizeMatrix } from './localize';
import { validateMatrix } from './validate';

const matrix = defaultMatrix as Matrix;
const allIds = matrix.categories.map((c) => c.id);
const profile: Profile = {
  brand: 'Kek Mama',
  product: 'kek lapis',
  audience: 'working mums',
  niche: 'home baking',
  focus: '',
  points: '',
  language: 'English',
};

describe('built-in matrix data', () => {
  it('is valid with no warnings', () => {
    const result = validateMatrix(matrix);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('only uses known placeholders', () => {
    const allowed = /\{(brand|product|audience|niche|subject)\}/g;
    for (const cat of matrix.categories) {
      for (const item of cat.items) {
        const texts = [item.brief, ...(item.structure ?? []), ...(item.hooks ?? []), ...(item.subjects ?? [])];
        for (const text of texts) {
          if (!text) continue;
          expect(text.replace(allowed, ''), `${cat.id}/${item.id}: ${text}`).not.toMatch(/[{}]/);
        }
      }
    }
  });

  it('keeps {subject} to hooks only', () => {
    for (const cat of matrix.categories) {
      for (const item of cat.items) {
        for (const text of [item.brief, ...(item.structure ?? []), ...(item.subjects ?? [])]) {
          expect(text ?? '', `${cat.id}/${item.id}`).not.toContain('{subject}');
        }
      }
    }
  });

  it('gives every item a description and brief line', () => {
    for (const cat of matrix.categories) {
      for (const item of cat.items) {
        expect(item.description.length, `${cat.id}/${item.id}`).toBeGreaterThan(10);
        expect(item.brief?.length ?? 0, `${cat.id}/${item.id}`).toBeGreaterThan(5);
      }
    }
  });
});

describe('buildBrief', () => {
  const board = buildBoard(matrix, allIds);

  it('builds a complete brief with a filled hook for every generated idea', () => {
    const batch = generateBatch(board, { count: 300, rng: seededRng(9) });
    for (const selection of batch) {
      const brief = buildBrief(board, selection);
      expect(brief.complete).toBe(true);
      expect(brief.lines).toHaveLength(allIds.length);
      const hook = hookText(brief, profile);
      expect(hook).not.toMatch(/[{}[\]]/);
      expect(hook.charAt(0)).toBe(hook.charAt(0).toUpperCase());
    }
  });

  it('takes the hook from the Hook column when it is active', () => {
    const selection = { type: 'educate', present: 'top-list', topic: 'product-service', hook: 'question' };
    const brief = buildBrief(buildBoard(matrix, ['type', 'present', 'topic', 'hook']), selection);
    const questionHooks = matrix.categories.find((c) => c.id === 'hook')!.items.find((i) => i.id === 'question')!.hooks!;
    expect(questionHooks.some((h) => brief.hook!.startsWith(h.split('{subject}')[0]))).toBe(true);
  });

  it('cycles through every hook × subject pairing', () => {
    const core = buildBoard(matrix, ['type', 'present', 'shooting', 'topic']);
    const selection = { type: 'educate', present: 'top-list', shooting: 'whip-pan', topic: 'product-service' };
    const first = buildBrief(core, selection, 0);
    // Hooks pooled from the type, present style and topic (3 each) × 4 topic subjects.
    expect(first.hookVariations).toBe(9 * 4);
    const hooks = new Set(Array.from({ length: first.hookVariations }, (_, v) => buildBrief(core, selection, v).hook));
    expect(hooks.size).toBe(first.hookVariations);
  });

  it('uses the content focus as the hook subject', () => {
    const core = buildBoard(matrix, ['type', 'present', 'shooting', 'topic']);
    const selection = { type: 'educate', present: 'top-list', shooting: 'whip-pan', topic: 'product-service' };
    const focus = 'cooking rendang with Adabi rendang paste';
    const brief = buildBrief(core, selection, 0, focus);
    expect(brief.hook).toContain(focus);
    expect(brief.hookVariations).toBe(9);
  });

  it('puts the focus and key points in the text and AI prompt', () => {
    const core = buildBoard(matrix, ['type', 'present', 'shooting', 'topic']);
    const selection = { type: 'business-ads', present: 'hard-sell', shooting: 'foodie', topic: 'product-service' };
    const withInput = { ...profile, focus: 'our new sambal tumis paste', points: '- Halal certified\n\n• Ready in 15 minutes\n2) No MSG' };
    const brief = buildBrief(core, selection, 0, withInput.focus);
    expect(parsePoints(withInput.points)).toEqual(['Halal certified', 'Ready in 15 minutes', 'No MSG']);
    const text = briefToText(brief, withInput);
    expect(text).toContain('About: our new sambal tumis paste');
    expect(text).toContain('- Ready in 15 minutes');
    const prompt = briefToAiPrompt(brief, withInput);
    expect(prompt).toContain('This video is about: our new sambal tumis paste');
    expect(prompt).toContain('- No MSG');
    expect(prompt).toContain('Work every key point');
  });

  it('lists what is still missing', () => {
    const brief = buildBrief(board, { type: 'educate' });
    expect(brief.complete).toBe(false);
    expect(brief.missing.map((c) => c.id)).toContain('present');
  });

  it('exports text and an AI prompt', () => {
    const selection = { type: 'educate', present: 'top-list', shooting: 'whip-pan', topic: 'product-service' };
    const brief = buildBrief(buildBoard(matrix, ['type', 'present', 'shooting', 'topic']), selection);
    const text = briefToText(brief, profile);
    expect(text).toContain('Educate × Top 3/5 × Whip Pan × Product & Service');
    expect(text).toContain('kek lapis');
    const prompt = briefToAiPrompt(brief, profile);
    expect(prompt).toContain('Brand: Kek Mama');
    expect(prompt).toContain('Shooting Style: Whip Pan');
  });
});

describe('Bahasa Melayu output', () => {
  const ms = localizeMatrix(matrix, 'Bahasa Melayu');
  const mixed = localizeMatrix(matrix, 'Mixed (BM + English)');

  it('translates every column and item, with the same hooks and subjects coverage', () => {
    for (const cat of matrix.categories) {
      expect(cat.ms?.question, cat.id).toBeTruthy();
      for (const item of cat.items) {
        const where = `${cat.id}/${item.id}`;
        expect(item.ms?.description, where).toBeTruthy();
        expect(item.ms?.brief, where).toBeTruthy();
        if (item.hooks) expect(item.ms?.hooks?.length, where).toBe(item.hooks.length);
        if (item.subjects) expect(item.ms?.subjects?.length, where).toBe(item.subjects.length);
        if (item.structure) expect(item.ms?.structure?.length, where).toBe(item.structure.length);
        const texts = [item.ms?.brief, ...(item.ms?.structure ?? []), ...(item.ms?.hooks ?? []), ...(item.ms?.subjects ?? [])];
        for (const text of texts) {
          if (text) expect(text.replace(/\{(brand|product|audience|niche|subject)\}/g, ''), where).not.toMatch(/[{}]/);
        }
      }
    }
  });

  it('writes the whole brief in BM, and only the hooks in Mixed', () => {
    const selection = { type: 'business-ads', present: 'lakonan', shooting: 'foodie', topic: 'product-service' };
    const ids = ['type', 'present', 'shooting', 'topic'];
    const bm = buildBrief(buildBoard(ms, ids), selection, 0, 'masak rendang dengan pes rendang Adabi');
    expect(bm.hook).toMatch(/masak rendang/);
    expect(bm.lines[0].label).toBe('Matlamat');
    expect(bm.lines[0].text).toContain('Tukar penonton');

    const mix = buildBrief(buildBoard(mixed, ids), selection, 0);
    const bmHooks = new Set(ms.categories.flatMap((c) => c.items.flatMap((i) => i.hooks ?? [])));
    expect([...bmHooks].some((h) => mix.hook!.startsWith(h.split('{')[0]))).toBe(true);
    expect(mix.lines[0].label).toBe('Goal');

    const text = briefToText(bm, { ...profile, language: 'Bahasa Melayu', points: 'Halal' });
    expect(text).toContain('IDEA CONTENT');
    expect(text).toContain('Wajib ada:');
  });
});

describe('templates', () => {
  it('fills placeholders and marks the blanks', () => {
    expect(fill('Teach {audience} about {product}', { audience: 'students' })).toBe('Teach students about [product]');
    expect(fillParts('{brand} rocks', {})).toEqual([{ text: '[brand]', blank: true }, { text: ' rocks' }]);
  });
});

describe('overlay (local customisations)', () => {
  const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

  it('is empty when nothing changed', () => {
    expect(isEmptyOverlay(diffMatrix(matrix, clone(matrix)))).toBe(true);
  });

  it('round-trips edits, additions, removals and reordering', () => {
    const edited = clone(matrix);
    const shooting = edited.categories.find((c) => c.id === 'shooting')!;
    shooting.items[0].media = { type: 'video', src: '/media/shooting/whip-pan.mp4' };
    shooting.items[0].label = 'Whip Pan!';
    delete shooting.items[1].example;
    shooting.items.splice(2, 1);
    shooting.items.push({ id: 'drone', label: 'Drone', description: 'From above.' });
    edited.categories = edited.categories.filter((c) => c.id !== 'length');
    edited.categories.push({ id: 'platform', label: 'Platform', question: 'Where?', items: [] });
    edited.categories.reverse();

    const overlay = diffMatrix(matrix, edited);
    expect(applyOverlay(matrix, JSON.parse(JSON.stringify(overlay)))).toEqual(edited);
  });

  it('lets built-in updates flow through to items the user did not touch', () => {
    const edited = clone(matrix);
    edited.categories[0].items[0].label = 'Teach';
    const overlay = diffMatrix(matrix, edited);

    const updatedBase = clone(matrix);
    updatedBase.categories[2].items[0].media = { type: 'image', src: '/media/new.jpg' };
    const merged = applyOverlay(updatedBase, overlay);
    expect(merged.categories[0].items[0].label).toBe('Teach');
    expect(merged.categories[2].items[0].media).toEqual({ type: 'image', src: '/media/new.jpg' });
  });
});

describe('validateMatrix', () => {
  it('rejects broken files with readable errors', () => {
    expect(validateMatrix(null).errors).toHaveLength(1);
    const result = validateMatrix({
      version: 1,
      categories: [
        { id: 'a', label: 'A', question: '', items: [{ id: 'x', label: 'X', description: '' }, { id: 'x', label: 'Y', description: '' }] },
        { id: 'b', label: 'B', question: '', dependsOn: 'missing', items: [] },
      ],
    });
    expect(result.matrix).toBeUndefined();
    expect(result.errors.join('\n')).toContain('duplicate item id "x"');
  });

  it('reports dependency problems', () => {
    const result = validateMatrix({
      version: 1,
      categories: [
        { id: 'a', label: 'A', question: '', dependsOn: 'b', items: [{ id: 'a1', label: 'A1', description: '' }] },
        { id: 'b', label: 'B', question: '', dependsOn: 'a', items: [{ id: 'b1', label: 'B1', description: '' }] },
      ],
    });
    expect(result.errors.join('\n')).toContain('dependency loop');
  });
});
