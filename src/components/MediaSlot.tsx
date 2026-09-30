import type { Media } from '../data/types';
import { embedUrl } from '../lib/media';
import { Icon } from './Icon';

interface Props {
  media?: Media | null;
  label: string;
  /** "portrait" for the detail panel (9:16, like a short video), "card" for library thumbnails. */
  shape?: 'portrait' | 'card';
  /** Thumbnails don't autoplay embeds; they just show that a visual exists. */
  thumbnail?: boolean;
}

/**
 * Shows an item's visual example, or a placeholder until one is added.
 * Swap the placeholder by setting `media` on the item (see README → Adding visuals).
 */
export function MediaSlot({ media, label, shape = 'portrait', thumbnail = false }: Props) {
  const className = `media-slot media-slot--${shape}`;

  if (!media?.src) {
    return (
      <div className={`${className} media-slot--empty`} role="img" aria-label={`Visual example for ${label} coming soon`}>
        <Icon name="image" size={thumbnail ? 22 : 30} />
        <span className="media-slot__title">{thumbnail ? 'Visual coming soon' : 'Visual example coming soon'}</span>
        {!thumbnail && <span className="media-slot__label">{label}</span>}
      </div>
    );
  }

  if (media.type === 'image') {
    return (
      <figure className={className}>
        <img src={media.src} alt={media.caption || `${label} example`} loading="lazy" />
        {!thumbnail && <Caption media={media} />}
      </figure>
    );
  }

  if (media.type === 'video') {
    return (
      <figure className={className}>
        <video
          src={media.src}
          poster={media.poster}
          muted
          loop
          playsInline
          autoPlay={!thumbnail}
          controls={!thumbnail}
          preload={thumbnail ? 'metadata' : 'auto'}
          aria-label={media.caption || `${label} example`}
        />
        {thumbnail && (
          <span className="media-slot__badge">
            <Icon name="play" size={14} />
          </span>
        )}
        {!thumbnail && <Caption media={media} />}
      </figure>
    );
  }

  const url = embedUrl(media);
  if (!url || thumbnail) {
    return (
      <div className={`${className} media-slot--empty media-slot--has-embed`}>
        <Icon name="play" size={thumbnail ? 22 : 30} />
        <span className="media-slot__title">{url ? 'Video example' : 'Check the video link'}</span>
      </div>
    );
  }
  return (
    <figure className={className}>
      <iframe
        src={url}
        title={media.caption || `${label} example`}
        loading="lazy"
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
      />
      <Caption media={media} />
    </figure>
  );
}

function Caption({ media }: { media: Media }) {
  if (!media.caption && !media.credit) return null;
  return (
    <figcaption>
      {media.caption}
      {media.credit && <span className="media-slot__credit"> · {media.credit}</span>}
    </figcaption>
  );
}
