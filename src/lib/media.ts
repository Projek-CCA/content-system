import type { Media } from '../data/types';

export function youtubeId(src: string): string | undefined {
  const trimmed = src.trim();
  if (/^[\w-]{11}$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/);
  return match?.[1];
}

/** iframe URL for youtube/embed media, undefined for anything else. */
export function embedUrl(media: Media): string | undefined {
  if (media.type === 'youtube') {
    const id = youtubeId(media.src);
    return id ? `https://www.youtube-nocookie.com/embed/${id}?rel=0&playsinline=1` : undefined;
  }
  if (media.type === 'embed') return media.src;
  return undefined;
}

/** Where to drop a file for an item, following the project convention. */
export function suggestedMediaPath(categoryId: string, itemId: string, ext = 'mp4'): string {
  return `/media/${categoryId}/${itemId}.${ext}`;
}
