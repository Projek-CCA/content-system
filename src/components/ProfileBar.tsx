import { useState } from 'react';
import type { Profile } from '../data/types';
import { useAppState } from '../state/AppState';
import { Icon } from './Icon';

const FIELDS: { key: keyof Omit<Profile, 'language'>; label: string; placeholder: string }[] = [
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
