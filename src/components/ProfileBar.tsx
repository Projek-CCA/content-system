import { useState } from 'react';
import type { Profile } from '../data/types';
import { useAppState } from '../state/AppState';
import { Icon } from './Icon';

const FIELDS: { key: 'brand' | 'product' | 'audience' | 'niche'; label: string; placeholder: string }[] = [
  { key: 'brand', label: 'Brand', placeholder: 'e.g. Kek Mama' },
  { key: 'product', label: 'What you sell', placeholder: 'e.g. kek lapis' },
  { key: 'audience', label: 'Who you sell to', placeholder: 'e.g. working mums' },
  { key: 'niche', label: 'Industry / niche', placeholder: 'e.g. home baking' },
];

const LANGUAGES: Profile['language'][] = ['English', 'Bahasa Melayu', 'Mixed (BM + English)'];

/** The "small input": four fields that personalise every idea the matrix generates. */
export function ProfileBar() {
  const { profile, setProfile } = useAppState();
  const filled = FIELDS.filter((f) => profile[f.key].trim()).length;
  const [open, setOpen] = useState(filled === 0);

  return (
    <section className={`profile ${open ? 'is-open' : ''}`} aria-label="Your business">
      <button className="profile__toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
        <Icon name="user" />
        <span className="profile__title">Your business</span>
        <span className="profile__summary">
          {filled === 0
            ? 'Add 4 quick details and every idea gets written for your business'
            : FIELDS.map((f) => profile[f.key].trim()).filter(Boolean).join(' · ')}
        </span>
        <span className="profile__chevron" aria-hidden="true">
          {open ? '−' : '+'}
        </span>
      </button>
      {open && (
        <div className="profile__fields">
          {FIELDS.map((f) => (
            <label key={f.key} className="field">
              <span>{f.label}</span>
              <input value={profile[f.key]} placeholder={f.placeholder} onChange={(e) => setProfile({ [f.key]: e.target.value })} />
            </label>
          ))}
          <label className="field">
            <span>Script language</span>
            <select value={profile.language} onChange={(e) => setProfile({ language: e.target.value as Profile['language'] })}>
              {LANGUAGES.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </label>
        </div>
      )}
    </section>
  );
}

/** Per-video input: what this piece is about and the points it has to land. */
export function ContentFocus() {
  const { profile, setProfile } = useAppState();
  return (
    <section className="focus-card" aria-label="This content">
      <div className="focus-card__head">
        <Icon name="edit" />
        <span className="profile__title">This content</span>
        <span className="muted small">Optional. Changes from video to video.</span>
      </div>
      <div className="focus-card__fields">
        <label className="field">
          <span>What is this content about?</span>
          <input
            id="profile-focus"
            value={profile.focus}
            placeholder="e.g. cooking rendang with Adabi rendang paste"
            onChange={(e) => setProfile({ focus: e.target.value })}
          />
          <small className="muted">A recipe, a new product, a promo, an event. It becomes the subject of your hook.</small>
        </label>
        <label className="field">
          <span>Key points or USPs to include (one per line)</span>
          <textarea
            id="profile-points"
            rows={3}
            value={profile.points}
            placeholder={'e.g. Halal certified\nReady in 15 minutes\nNo MSG'}
            onChange={(e) => setProfile({ points: e.target.value })}
          />
        </label>
      </div>
    </section>
  );
}
