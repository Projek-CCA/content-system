import type { Profile } from '../data/types';
import { fillParts, type TextPart } from '../lib/template';

/** Renders template text with profile values filled in and blanks highlighted. */
export function Filled({ text, profile }: { text: string; profile: Partial<Profile> }) {
  return <Parts parts={fillParts(text, profile)} />;
}

export function Parts({ parts }: { parts: TextPart[] }) {
  return (
    <>
      {parts.map((part, i) =>
        part.blank ? (
          <span key={i} className="blank" title="Fill this in under 'Your business'">
            {part.text}
          </span>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </>
  );
}
