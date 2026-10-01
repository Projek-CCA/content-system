import { type CSSProperties, useState } from 'react';
import { useAppState } from '../state/AppState';
import { Icon } from './Icon';
import { MediaSlot } from './MediaSlot';

/** Browse and learn every item in the matrix: what it is and what it looks like. */
export function LibraryView() {
  const { contentMatrix: matrix, openDetail, isActive } = useAppState();
  const [query, setQuery] = useState('');
  const [only, setOnly] = useState<string>('all');
  const q = query.trim().toLowerCase();

  const sections = matrix.categories
    .filter((c) => only === 'all' || c.id === only)
    .map((category) => ({
      category,
      items: category.items.filter(
        (item) => !q || [item.label, item.altLabel, item.description].some((t) => t?.toLowerCase().includes(q)),
      ),
    }))
    .filter((s) => s.items.length > 0);

  return (
    <>
      <div className="library-tools">
        <label className="search">
          <Icon name="search" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search, e.g. whip pan, quiz, POV..." aria-label="Search the library" />
        </label>
        <select value={only} onChange={(e) => setOnly(e.target.value)} aria-label="Show column">
          <option value="all">All columns</option>
          {matrix.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      {sections.length === 0 && <p className="empty">Nothing matches “{query}”.</p>}

      {sections.map(({ category, items }) => {
        const parent = category.dependsOn ? matrix.categories.find((c) => c.id === category.dependsOn) : undefined;
        return (
          <section key={category.id} className="library-section" style={{ '--c': category.color } as CSSProperties}>
            <header className="library-section__head">
              <h2>
                <span className="dot" /> {category.label}
                {!isActive(category.id) && <span className="badge">Not on board</span>}
              </h2>
              <p className="muted">
                {category.question} {category.description}
              </p>
            </header>
            <div className="library-grid">
              {items.map((item) => (
                <button key={item.id} className="library-card" onClick={() => openDetail(category.id, item.id)}>
                  <MediaSlot media={item.media} label={item.label} shape="card" thumbnail />
                  <span className="library-card__body">
                    <span className="library-card__title">
                      {item.label}
                      {item.altLabel && <span className="item__alt">{item.altLabel}</span>}
                    </span>
                    {parent && item.parents?.length ? (
                      <span className="library-card__parents">
                        {item.parents.map((id) => parent.items.find((p) => p.id === id)?.label).filter(Boolean).join(', ')}
                      </span>
                    ) : null}
                    <span className="library-card__desc">{item.description}</span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}
