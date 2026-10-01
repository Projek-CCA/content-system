import { describe, expect, it } from 'vitest';
import defaultMatrix from '../data/cim-matrix.json';
import type { Matrix, MatrixCategory } from '../data/types';
import {
  applySelect,
  buildBoard,
  countCombinations,
  enumerateSelections,
  generateBatch,
  pruneSelection,
  randomSelection,
  seededRng,
  selectionKey,
  uniqueId,
} from './matrix';

const cat = (id: string, items: string[] | [string, string[]][], extra: Partial<MatrixCategory> = {}): MatrixCategory => ({
  id,
  label: id,
  question: '',
  items: items.map((entry) =>
    typeof entry === 'string'
      ? { id: entry, label: entry, description: '' }
      : { id: entry[0], label: entry[0], description: '', parents: entry[1] },
  ),
  ...extra,
});

// Mirrors the hand-drawn draft: present style depends on type.
const draft: Matrix = {
  version: 1,
  categories: [
    cat('type', ['educate', 'social', 'bizness', 'trend']),
    cat(
      'present',
      [
        ['storytelling', ['educate', 'bizness']],
        ['facts', ['educate']],
        ['top', ['educate']],
        ['quiz-reward', ['social']],
        ['a-or-b', ['social']],
        ['a-or-b-opinion', ['social']],
        ['quiz', ['social']],
        ['hard-sell', ['bizness']],
        ['feedback', ['bizness']],
        ['lakonan', ['trend']],
        ['dance', ['trend']],
      ],
      { dependsOn: 'type' },
    ),
    cat('shooting', ['whip-pan', 'reaction', 'outdoor', 'indoor', 'moving', 'highlight', 'foodie']),
    cat('topic', ['product', 'market', 'leads', 'demographic', 'issues', 'knowledge']),
  ],
};
const allIds = draft.categories.map((c) => c.id);

describe('countCombinations', () => {
  it('counts dependent columns per parent, like the draft matrix', () => {
    const board = buildBoard(draft, allIds);
    // 12 type×present pairs (storytelling sits under two types) × 7 shooting × 6 topics
    expect(countCombinations(board)).toBe(12 * 7 * 6);
  });

  it('treats a dependent column as independent when its parent is switched off', () => {
    const board = buildBoard(draft, ['present', 'shooting']);
    expect(countCombinations(board)).toBe(11 * 7);
  });

  it('respects locks', () => {
    const board = buildBoard(draft, allIds);
    expect(countCombinations(board, { type: 'trend' })).toBe(2 * 7 * 6);
    expect(countCombinations(board, { present: 'storytelling' })).toBe(2 * 7 * 6);
    expect(countCombinations(board, { type: 'trend', present: 'facts' })).toBe(0);
  });

  it('matches full enumeration', () => {
    const board = buildBoard(draft, allIds);
    const all = enumerateSelections(board);
    expect(all).toHaveLength(countCombinations(board));
    expect(new Set(all.map((s) => selectionKey(board, s))).size).toBe(all.length);
  });

  it('leaves a dependent column blank when a parent has no options yet', () => {
    const matrix: Matrix = {
      version: 1,
      categories: [cat('type', ['a', 'b']), cat('present', [['x', ['a']]], { dependsOn: 'type' })],
    };
    const board = buildBoard(matrix, ['type', 'present']);
    expect(countCombinations(board)).toBe(2);
    expect(enumerateSelections(board)).toContainEqual({ type: 'b' });
  });

  it('survives a dependency loop', () => {
    const matrix: Matrix = {
      version: 1,
      categories: [cat('a', ['a1'], { dependsOn: 'b' }), cat('b', ['b1'], { dependsOn: 'a' })],
    };
    const board = buildBoard(matrix, ['a', 'b']);
    expect(countCombinations(board)).toBe(1);
    expect(randomSelection(board, {}, seededRng(1))).toEqual({ a: 'a1', b: 'b1' });
  });
});

describe('randomSelection', () => {
  const board = buildBoard(draft, allIds);

  it('always returns a valid, complete idea', () => {
    const rng = seededRng(42);
    for (let i = 0; i < 200; i++) {
      const selection = randomSelection(board, {}, rng);
      expect(Object.keys(selection).sort()).toEqual([...allIds].sort());
      expect(pruneSelection(board, selection)).toEqual(selection);
    }
  });

  it('keeps locked columns and picks a parent that fits a locked child', () => {
    const rng = seededRng(7);
    for (let i = 0; i < 50; i++) {
      const selection = randomSelection(board, { present: 'dance', topic: 'leads' }, rng);
      expect(selection.present).toBe('dance');
      expect(selection.topic).toBe('leads');
      expect(selection.type).toBe('trend');
    }
  });

  it('ignores impossible locks instead of failing', () => {
    const selection = randomSelection(board, { type: 'trend', present: 'facts' }, seededRng(3));
    expect(pruneSelection(board, selection)).toEqual(selection);
    expect(Object.keys(selection)).toHaveLength(4);
  });
});

describe('generateBatch', () => {
  const board = buildBoard(draft, allIds);

  it('returns unique ideas', () => {
    const batch = generateBatch(board, { count: 100, rng: seededRng(1) });
    expect(batch).toHaveLength(100);
    expect(new Set(batch.map((s) => selectionKey(board, s))).size).toBe(100);
  });

  it('caps at the number of possible ideas', () => {
    const batch = generateBatch(board, { count: 1000, locks: { type: 'trend', shooting: 'foodie' }, rng: seededRng(2) });
    expect(batch).toHaveLength(2 * 6);
  });

  it('skips excluded ideas', () => {
    const locks = { type: 'trend', shooting: 'foodie', topic: 'leads' };
    const first = generateBatch(board, { count: 1, locks, rng: seededRng(5) });
    const second = generateBatch(board, { count: 5, locks, rng: seededRng(5), exclude: first.map((s) => selectionKey(board, s)) });
    expect(second).toHaveLength(1);
    expect(second[0].present).not.toBe(first[0].present);
  });
});

describe('applySelect', () => {
  const board = buildBoard(draft, allIds);

  it('selects the parent when picking a child', () => {
    expect(applySelect(board, {}, 'present', 'dance')).toEqual({ type: 'trend', present: 'dance' });
  });

  it('keeps the parent when the child already fits it', () => {
    expect(applySelect(board, { type: 'bizness' }, 'present', 'storytelling')).toEqual({
      type: 'bizness',
      present: 'storytelling',
    });
  });

  it('clears children that no longer fit a new parent', () => {
    const start = { type: 'educate', present: 'facts', topic: 'leads' };
    expect(applySelect(board, start, 'type', 'social')).toEqual({ type: 'social', topic: 'leads' });
    expect(applySelect(board, { type: 'educate', present: 'storytelling' }, 'type', 'bizness')).toEqual({
      type: 'bizness',
      present: 'storytelling',
    });
  });
});

describe('uniqueId', () => {
  it('slugifies and avoids collisions', () => {
    expect(uniqueId('Top 3/5', [])).toBe('top-3-5');
    expect(uniqueId('Quiz', ['quiz', 'quiz-2'])).toBe('quiz-3');
  });
});

describe('default matrix', () => {
  const matrix = defaultMatrix as Matrix;

  it('produces hundreds of ideas from the core columns alone', () => {
    const core = matrix.categories.filter((c) => !c.optional).map((c) => c.id);
    expect(core).toEqual(['type', 'present', 'shooting', 'topic']);
    expect(countCombinations(buildBoard(matrix, core))).toBeGreaterThan(500);
  });

  it('lets any content type pair with any present style', () => {
    const board = buildBoard(matrix, ['type', 'present']);
    const size = (id: string) => matrix.categories.find((c) => c.id === id)!.items.length;
    expect(countCombinations(board)).toBe(size('type') * size('present'));
    expect(applySelect(board, { type: 'business-ads' }, 'present', 'lakonan')).toEqual({ type: 'business-ads', present: 'lakonan' });
  });
});
