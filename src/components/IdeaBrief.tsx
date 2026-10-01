import type { CSSProperties } from 'react';
import { briefToAiPrompt, briefToText, buildBrief, hookParts, parsePoints } from '../lib/brief';
import { copyText } from '../lib/export';
import { strings } from '../lib/localize';
import { lockMap, randomSelection } from '../lib/matrix';
import { useAppState } from '../state/AppState';
import { Filled, Parts } from './Filled';
import { Icon } from './Icon';

/** The output: a ready-to-shoot content brief for the current combination. */
export function IdeaBrief() {
  const { board, selection, variant, nextVariant, profile, randomise, loadSelection, saveIdea, isSaved, notify, openDetail } = useAppState();
  const brief = buildBrief(board, selection, variant, profile.focus);
  const t = strings(profile.language);

  if (brief.picks.length === 0) {
    return (
      <aside className="brief brief--empty" id="idea">
        <span className="eyebrow">Your content idea</span>
        <h2>Pick one from each column, or let the matrix pick for you.</h2>
        <p className="muted">Every combination turns into a brief: a hook to open with, what to say, how to shoot it and the steps to follow.</p>
        <button className="btn btn--primary btn--lg" onClick={randomise}>
          <Icon name="dice" /> Randomise an idea
        </button>
        <p className="muted small">
          Tip: press <kbd>R</kbd> anywhere to roll again.
        </p>
      </aside>
    );
  }

  const saved = isSaved(selection);
  const focus = profile.focus.trim();
  const points = parsePoints(profile.points);
  const parts = hookParts(brief, profile);
  const completeRest = () => {
    // Keep everything picked so far and randomise only the empty columns.
    loadSelection(randomSelection(board, lockMap(selection, Object.keys(selection))), variant);
  };

  return (
    <aside className="brief" id="idea" aria-live="polite">
      <div className="brief__head">
        <span className="eyebrow">{t.yourIdea}</span>
        <div className="brief__chips">
          {brief.picks.map(({ category, item }) => (
            <button
              key={category.id}
              className="chip"
              style={{ '--c': category.color } as CSSProperties}
              onClick={() => openDetail(category.id, item.id)}
              title={`${category.label}: what is ${item.label}?`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {brief.missing.length > 0 && (
        <div className="notice">
          <span>
            {t.stillToPick}: <strong>{brief.missing.map((c) => c.label).join(', ')}</strong>
          </span>
          <button className="btn btn--small" onClick={completeRest}>
            <Icon name="dice" size={14} /> {t.fillRest}
          </button>
        </div>
      )}

      {focus && (
        <p className="brief__focus">
          <span className="eyebrow">{t.about}</span> {focus}
        </p>
      )}

      {parts.length > 0 && (
        <div className="hook">
          <div className="hook__label">
            <span>{t.hookStarter}</span>
            {brief.hookVariations > 1 && (
              <button className="link-btn" onClick={nextVariant} title="Try another hook for this combination">
                <Icon name="refresh" size={14} /> {t.anotherHook}
                <span className="muted"> ({(variant % brief.hookVariations) + 1}/{brief.hookVariations})</span>
              </button>
            )}
          </div>
          <p className="hook__text">
            “<Parts parts={parts} />”
          </p>
          <p className="muted small">{t.hookHint}</p>
        </div>
      )}

      <dl className="plan">
        {brief.lines.map((line) => (
          <div key={line.category.id} className="plan__row" style={{ '--c': line.category.color } as CSSProperties}>
            <dt>{line.label}</dt>
            <dd>
              <strong>{line.item.label}.</strong> <Filled text={line.text} profile={profile} />
            </dd>
          </div>
        ))}
      </dl>

      {points.length > 0 && (
        <section className="brief__section">
          <h3>{t.mustInclude}</h3>
          <ul className="ticks">
            {points.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </section>
      )}

      {brief.structure.map((block) => (
        <section key={block.item.id} className="brief__section">
          <h3>
            {t.structure} · {block.item.label}
          </h3>
          <ol className="steps">
            {block.steps.map((step) => (
              <li key={step}>
                <Filled text={step} profile={profile} />
              </li>
            ))}
          </ol>
        </section>
      ))}

      {brief.tips.length > 0 && (
        <section className="brief__section">
          <h3>{t.tips}</h3>
          {brief.tips.map((block) => (
            <details key={block.category.id} className="tips">
              <summary>
                <span className="dot" style={{ '--c': block.category.color } as CSSProperties} /> {block.item.label}
              </summary>
              <ul className="ticks">
                {block.tips.map((tip) => (
                  <li key={tip}>
                    <Filled text={tip} profile={profile} />
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </section>
      )}

      {brief.references.length > 0 && (
        <p className="small refs-line">
          <strong>{t.styleRefs}:</strong> {brief.references.flatMap((r) => r.references.map((ref) => ref.label)).join(' · ')}
        </p>
      )}

      <div className="brief__actions">
        <button className="btn btn--primary" disabled={saved} onClick={() => {
            saveIdea(selection, variant);
            notify('Saved to your ideas');
          }}
        >
          <Icon name={saved ? 'bookmarkFilled' : 'bookmark'} /> {saved ? 'Saved' : 'Save idea'}
        </button>
        <button className="btn" onClick={async () => notify((await copyText(briefToText(brief, profile))) ? 'Brief copied' : 'Could not copy')}>
          <Icon name="copy" /> Copy brief
        </button>
        <button
          className="btn"
          onClick={async () => notify((await copyText(briefToAiPrompt(brief, profile))) ? 'AI prompt copied. Paste it into Claude or ChatGPT' : 'Could not copy')}
          title="Copy a prompt that turns this idea into a full script with any AI assistant"
        >
          <Icon name="sparkle" /> Copy AI script prompt
        </button>
      </div>
    </aside>
  );
}
