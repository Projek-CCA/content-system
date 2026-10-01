import type { Matrix, Profile } from '../data/types';

export type Language = Profile['language'];

/**
 * The matrix as it should read in the chosen output language.
 *
 * - English: as written.
 * - Bahasa Melayu: every `ms` field replaces its English one.
 * - Mixed (BM + English): only the spoken lines switch to BM (hooks and the
 *   subjects that fill them); the instructions stay in English.
 *
 * Anything without a translation falls back to English, so new items never break.
 */
export function localizeMatrix(matrix: Matrix, language: Language): Matrix {
  if (language === 'English') return matrix;
  const full = language === 'Bahasa Melayu';
  return {
    ...matrix,
    categories: matrix.categories.map((category) => ({
      ...category,
      ...(full ? category.ms : {}),
      items: category.items.map((item) => {
        if (!item.ms) return item;
        if (full) return { ...item, ...item.ms };
        return {
          ...item,
          ...(item.ms.hooks ? { hooks: item.ms.hooks } : {}),
          ...(item.ms.subjects ? { subjects: item.ms.subjects } : {}),
        };
      }),
    })),
  };
}

const EN = {
  yourIdea: 'Your content idea',
  about: 'About',
  stillToPick: 'Still to pick',
  fillRest: 'Fill the rest',
  hookStarter: 'Hook starter',
  anotherHook: 'Another hook',
  hookHint: 'A starting point. Tweak the words so they sound like you.',
  mustInclude: 'Must include',
  structure: 'Structure',
  tips: 'Tips',
  styleRefs: 'Style references',
  howToDoIt: 'How to do it',
  example: 'Example',
  worksWith: 'Works with',
  contentIdea: 'CONTENT IDEA',
};

const MS: typeof EN = {
  yourIdea: 'Idea content anda',
  about: 'Tentang',
  stillToPick: 'Belum dipilih',
  fillRest: 'Isi selebihnya',
  hookStarter: 'Hook pembuka',
  anotherHook: 'Hook lain',
  hookHint: 'Sekadar permulaan. Ubah ayatnya supaya bunyi macam anda.',
  mustInclude: 'Wajib ada',
  structure: 'Struktur',
  tips: 'Tips',
  styleRefs: 'Rujukan gaya',
  howToDoIt: 'Cara buat',
  example: 'Contoh',
  worksWith: 'Sesuai dengan',
  contentIdea: 'IDEA CONTENT',
};

export type Strings = typeof EN;

/** Fixed wording in the brief and info panel. Mixed keeps English instructions. */
export function strings(language: Language | undefined): Strings {
  return language === 'Bahasa Melayu' ? MS : EN;
}
