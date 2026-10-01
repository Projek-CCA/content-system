/**
 * Data model for the Content Idea Matrix.
 *
 * A matrix is a list of categories (the columns). Each category holds items
 * (the options in that column). A content idea is one item picked from each
 * active category.
 *
 * Text fields that end up in a brief may use these placeholders, which are
 * filled from the user's business profile:
 *   {brand} {product} {audience} {niche}
 * Hook templates may also use {subject}, which is filled from a `subjects`
 * entry of another selected item (usually the Topic).
 */

export type MediaType = 'image' | 'video' | 'youtube' | 'embed';

/** A visual example for an item. Leave it out (or null) to show the placeholder. */
export interface Media {
  type: MediaType;
  /**
   * image/video: a URL or a path under /public, e.g. "/media/shooting/whip-pan.mp4".
   * youtube: any YouTube URL or the video id.
   * embed: an iframe-able URL (TikTok, Instagram, Vimeo embed links).
   */
  src: string;
  /** Poster frame for videos. */
  poster?: string;
  caption?: string;
  credit?: string;
}

/** A creator or video to study for this style. */
export interface Reference {
  label: string;
  note?: string;
  url?: string;
}

export interface MatrixItem {
  /** Unique within its category. Lowercase kebab-case. Never change it once ideas are saved. */
  id: string;
  label: string;
  /** Original/alternative wording, e.g. the Malay term. */
  altLabel?: string;
  /** What it is, in one or two sentences. Shown in the info panel and library. */
  description: string;
  /** One-line direction used in the content brief. Placeholders allowed. */
  brief?: string;
  /** Practical tips on how to execute it. */
  howTo?: string[];
  /** Beat-by-beat outline of the video. Placeholders allowed. */
  structure?: string[];
  /** A short example of it in action. */
  example?: string;
  /** Opening-line templates. Use {subject} and profile placeholders. */
  hooks?: string[];
  /** Noun phrases that fill {subject} in hooks, e.g. "choosing the right {product}". */
  subjects?: string[];
  /** For items in a dependent category: ids of the parent-category items this belongs under. */
  parents?: string[];
  /** Visual example. Missing or null shows a placeholder you can swap later. */
  media?: Media | null;
  references?: Reference[];
}

export interface MatrixCategory {
  /** Unique id. Lowercase kebab-case. */
  id: string;
  label: string;
  /** The question this column answers, e.g. "How will you shoot it?". */
  question: string;
  description?: string;
  /** Label used for this category's line in the content brief, e.g. "Shoot it". */
  briefLabel?: string;
  /** If set, items in this category are filtered by the selected item of that category. */
  dependsOn?: string;
  /** Optional columns are switched off until the user adds them to the board. */
  optional?: boolean;
  /** Accent colour for the column (any CSS colour). */
  color?: string;
  items: MatrixItem[];
}

export interface Matrix {
  version: 1;
  categories: MatrixCategory[];
}

/** categoryId -> itemId */
export type Selection = Record<string, string>;

export interface Profile {
  brand: string;
  product: string;
  audience: string;
  niche: string;
  /** What this piece of content is about, e.g. "cooking rendang with Adabi paste". Fills {subject} in hooks. */
  focus: string;
  /** Key points or USPs that must appear in the content, one per line. */
  points: string;
  language: 'English' | 'Bahasa Melayu' | 'Mixed (BM + English)';
}
