import { type CSSProperties, useState } from 'react';
import type { Selection } from '../data/types';
import { briefTitle, buildBrief, hookParts, hookText } from '../lib/brief';
import { copyText, dateStamp, downloadFile, toCsv } from '../lib/export';
import { countCombinations, generateBatch, randomSelection, selectionKey } from '../lib/matrix';
import { useAppState } from '../state/AppState';
import { usePersistentState } from '../state/usePersistentState';
import { Parts } from './Filled';
import { Icon } from './Icon';

interface BatchIdea {
  selection: Selection;
  variant: number;
}

const COUNTS = [10, 30, 50, 100];
const MAX = 500;

/** Generate many unique ideas at once, e.g. a 30-day content plan. */
export function BatchView() {
  const { board, locks, matrix, profile, saveIdea, isSaved, loadSelection, setView, notify } = useAppState();
  const [count, setCount] = usePersistentState('batch.count', 30);
  const [asDays, setAsDays] = usePersistentState('batch.days', true);
  const [ideas, setIdeas] = usePersistentState<BatchIdea[]>('batch.ideas', [], Array.isArray);
  const [justSaved, setJustSaved] = useState(false);

  const total = countCombinations(board, locks);
  const lockedLabels = Object.entries(locks).map(([catId, itemId]) => {
    const cat = matrix.categories.find((c) => c.id === catId);
    return `${cat?.label}: ${cat?.items.find((i) => i.id === itemId)?.label}`;
  });

  const rows = ideas.map((idea) => ({ ...idea, brief: buildBrief(board, idea.selection, idea.variant) }));

  const generate = () => {
    const batch = generateBatch(board, { count: Math.min(Math.max(1, count), MAX), locks });
    setIdeas(batch.map((selection) => ({ selection, variant: Math.floor(Math.random() * 1000) })));
    setJustSaved(false);
  };

  const reroll = (index: number) => {
    const taken = new Set(ideas.map((i) => selectionKey(board, i.selection)));
    let selection = randomSelection(board, locks);
    for (let n = 0; n < 30 && taken.has(selectionKey(board, selection)); n++) selection = randomSelection(board, locks);
    setIdeas(ideas.map((idea, i) => (i === index ? { selection, variant: Math.floor(Math.random() * 1000) } : idea)));
  };

  const label = (i: number) => (asDays ? `Day ${i + 1}` : `#${i + 1}`);

  const exportCsv = () => {
    const header = [asDays ? 'Day' : '#', ...board.categories.map((c) => c.label), 'Hook starter'];
    const body = rows.map((row, i) => [
      i + 1,
      ...board.categories.map((c) => c.items.find((it) => it.id === row.selection[c.id])?.label ?? ''),
      hookText(row.brief, profile),
    ]);
    downloadFile(`content-ideas-${dateStamp()}.csv`, toCsv([header, ...body]), 'text/csv;charset=utf-8');
  };

  const copyAll = async () => {
    const text = rows.map((row, i) => `${label(i)}: ${briefTitle(row.brief)}\nHook: ${hookText(row.brief, profile)}`).join('\n\n');
    notify((await copyText(text)) ? `${rows.length} ideas copied` : 'Could not copy');
  };

  const saveAll = () => {
    let added = 0;
    for (const row of rows) {
      if (isSaved(row.selection)) continue;
      saveIdea(row.selection, row.variant);
      added++;
    }
    setJustSaved(true);
    notify(added ? `${added} ideas saved` : 'All of these are already saved');
  };

  return (
    <>
      <section className="card batch-controls">
        <div>
          <h2>Generate a batch of ideas</h2>
          <p className="muted">
            Plan a week or a month in one click. Every idea is a unique combination from the columns on your board
            {lockedLabels.length ? ', and your locked picks stay fixed.' : '.'}
          </p>
          {lockedLabels.length > 0 && (
            <p className="small">
              <Icon name="lock" size={14} /> Locked: {lockedLabels.join(' · ')}
            </p>
          )}
        </div>
        <div className="batch-controls__row">
          <div className="segmented" role="group" aria-label="How many ideas">
            {COUNTS.map((n) => (
              <button key={n} className={count === n ? 'is-on' : ''} onClick={() => setCount(n)} aria-pressed={count === n}>
                {n}
              </button>
            ))}
            <input
              type="number"
              min={1}
              max={MAX}
              value={count}
              onChange={(e) => setCount(Math.min(MAX, Math.max(1, Number(e.target.value) || 1)))}
              aria-label="Custom number of ideas"
            />
          </div>
          <label className="check">
            <input type="checkbox" checked={asDays} onChange={(e) => setAsDays(e.target.checked)} /> Number as days
          </label>
          <button className="btn btn--primary btn--lg" onClick={generate} disabled={total === 0}>
            <Icon name="sparkle" /> Generate {Math.min(count, total).toLocaleString()} ideas
          </button>
        </div>
        <p className="small muted">
          {total.toLocaleString()} unique ideas possible with the current board
          {count > total ? `, so you'll get all ${total.toLocaleString()} of them.` : '.'} Add more columns or items to get more.
        </p>
      </section>

      {rows.length > 0 && (
        <section className="batch-results">
          <div className="section-head">
            <h2>{rows.length} ideas</h2>
            <div className="section-head__actions">
              <button className="btn" onClick={saveAll} disabled={justSaved}>
                <Icon name="bookmark" /> Save all
              </button>
              <button className="btn" onClick={exportCsv}>
                <Icon name="download" /> Export CSV
              </button>
              <button className="btn" onClick={copyAll}>
                <Icon name="copy" /> Copy all
              </button>
            </div>
          </div>
          <ol className="idea-list">
            {rows.map((row, i) => {
              const saved = isSaved(row.selection);
              return (
                <li key={`${i}-${row.brief.key}`} className="idea-row">
                  <span className="idea-row__num">{label(i)}</span>
                  <div className="idea-row__main">
                    <div className="brief__chips">
                      {row.brief.picks.map(({ category, item }) => (
                        <span key={category.id} className="chip chip--static" style={{ '--c': category.color } as CSSProperties}>
                          {item.label}
                        </span>
                      ))}
                    </div>
                    {row.brief.hook && (
                      <p className="idea-row__hook">
                        “<Parts parts={hookParts(row.brief, profile)} />”
                      </p>
                    )}
                  </div>
                  <div className="idea-row__actions">
                    <button
                      className={`icon-btn ${saved ? 'is-on' : ''}`}
                      onClick={() => !saved && saveIdea(row.selection, row.variant)}
                      aria-label={saved ? 'Saved' : 'Save idea'}
                      title={saved ? 'Saved' : 'Save idea'}
                    >
                      <Icon name={saved ? 'bookmarkFilled' : 'bookmark'} size={16} />
                    </button>
                    <button className="icon-btn" onClick={() => reroll(i)} aria-label="Swap for another idea" title="Swap for another idea">
                      <Icon name="refresh" size={16} />
                    </button>
                    <button
                      className="icon-btn"
                      onClick={() => {
                        loadSelection(row.selection, row.variant);
                        setView('build');
                      }}
                      aria-label="Open full brief"
                      title="Open full brief"
                    >
                      <Icon name="arrow" size={16} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      )}
    </>
  );
}
