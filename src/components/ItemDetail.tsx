import { type CSSProperties, useEffect, useRef } from 'react';
import { useAppState } from '../state/AppState';
import { strings } from '../lib/localize';
import { Filled } from './Filled';
import { Icon } from './Icon';
import { MediaSlot } from './MediaSlot';

/** Info panel for one matrix item: what it is, how it looks, how to do it. */
export function ItemDetail() {
  const { detail, closeDetail, contentMatrix: matrix, board, selection, select, setView, profile } = useAppState();
  const t = strings(profile.language);
  const closeRef = useRef<HTMLButtonElement>(null);

  const category = detail ? matrix.categories.find((c) => c.id === detail.categoryId) : undefined;
  const item = category?.items.find((i) => i.id === detail?.itemId);

  useEffect(() => {
    if (!detail) return;
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeDetail();
    document.addEventListener('keydown', onKey);
    document.body.classList.add('no-scroll');
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('no-scroll');
      previous?.focus?.();
    };
  }, [detail, closeDetail]);

  if (!detail || !category || !item) return null;

  const parentCategory = category.dependsOn ? matrix.categories.find((c) => c.id === category.dependsOn) : undefined;
  const parentLabels = (item.parents ?? [])
    .map((id) => parentCategory?.items.find((p) => p.id === id)?.label)
    .filter(Boolean);
  const onBoard = board.categories.some((c) => c.id === category.id);
  const chosen = selection[category.id] === item.id;

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && closeDetail()}>
      <div className="modal detail" role="dialog" aria-modal="true" aria-labelledby="detail-title" style={{ '--c': category.color } as CSSProperties}>
        <button ref={closeRef} className="icon-btn modal__close" onClick={closeDetail} aria-label="Close">
          <Icon name="close" />
        </button>
        <div className="detail__media">
          <MediaSlot media={item.media} label={item.label} />
        </div>
        <div className="detail__body">
          <span className="eyebrow eyebrow--color">{category.label}</span>
          <h2 id="detail-title">
            {item.label}
            {item.altLabel && <span className="detail__alt"> · {item.altLabel}</span>}
          </h2>
          {parentLabels.length > 0 && (
            <p className="detail__parents">
              {t.worksWith} {parentCategory?.label}: <strong>{parentLabels.join(', ')}</strong>
            </p>
          )}
          <p className="detail__description">{item.description}</p>

          {item.howTo?.length ? (
            <section>
              <h3>{t.howToDoIt}</h3>
              <ul className="ticks">
                {item.howTo.map((tip) => (
                  <li key={tip}>
                    <Filled text={tip} profile={profile} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {item.structure?.length ? (
            <section>
              <h3>{t.structure}</h3>
              <ol className="steps">
                {item.structure.map((step) => (
                  <li key={step}>
                    <Filled text={step} profile={profile} />
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          {item.example && (
            <section>
              <h3>{t.example}</h3>
              <p className="detail__example">{item.example}</p>
            </section>
          )}

          {item.references?.length ? (
            <section>
              <h3>{t.styleRefs}</h3>
              <ul className="refs">
                {item.references.map((ref) => (
                  <li key={ref.label}>
                    {ref.url ? (
                      <a href={ref.url} target="_blank" rel="noreferrer">
                        {ref.label}
                      </a>
                    ) : (
                      <strong>{ref.label}</strong>
                    )}
                    {ref.note && <span> · {ref.note}</span>}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <div className="detail__actions">
            {onBoard ? (
              <button
                className="btn btn--primary"
                disabled={chosen}
                onClick={() => {
                  select(category.id, item.id);
                  closeDetail();
                  setView('build');
                }}
              >
                <Icon name={chosen ? 'check' : 'arrow'} />
                {chosen ? 'In your idea' : 'Use in my idea'}
              </button>
            ) : (
              <p className="muted small">Add the {category.label} column to the board to use this.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
