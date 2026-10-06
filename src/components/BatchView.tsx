import { type CSSProperties, useMemo, useState } from 'react';
import type { Selection } from '../data/types';
import { briefTitle, buildBrief, focusReading, hookParts, hookText } from '../lib/brief';
import { copyText, dateStamp, downloadFile, toCsv } from '../lib/export';
import { buildBoard, countCombinations, generateBatch, randomSelection, restrictMatrix, selectionKey } from '../lib/matrix';
import { useAppState } from '../state/AppState';
import { usePersistentState } from '../state/usePersistentState';
import { ColumnPicker } from './BuildView';
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
  const { board, contentMatrix, profile, saveIdea, isSaved, loadSelection, setView, notify } = useAppState();
  const [count, setCount] = usePersistentState('batch.count', 30);
  const [asDays, setAsDays] = usePersistentState('batch.days', true);
  const [ideas, setIdeas] = usePersistentState<BatchIdea[]>('batch.ideas', [], Array.isArray);
  const [justSaved, setJustSaved] = useState(false);
  /** Per column, the options a batch may use. Empty means any option. Independent of the Build tab. */
  const [filters, setFilters] = usePersistentState<Record<string, string[]>>('batch.filters', {}, (v) => typeof v === 'object' && v !== null);

  const activeIds = board.categories.map((c) => c.id);
  const mixBoard = useMemo(() => buildBoard(restrictMatrix(contentMatrix, filters), activeIds), [contentMatrix, filters, activeIds.join('|')]);
  const total = countCombinations(mixBoard);

  const reading = focusReading(profile);
  const rows = ideas.map((idea) => ({ ...idea, brief: buildBrief(board, idea.selection, idea.variant, reading) }));

  const generate = () => {
    const batch = generateBatch(mixBoard, { count: Math.min(Math.max(1, count), MAX) });
    setIdeas(batch.map((selection) => ({ selection, variant: Math.floor(Math.random() * 1000) })));
    setJustSaved(false);
  };

  const reroll = (index: number) => {
    const taken = new Set(ideas.map((i) => selectionKey(board, i.selection)));
    let selection = randomSelection(mixBoard, {});
    for (let n = 0; n < 30 && taken.has(selectionKey(board, selection)); n++) selection = randomSelection(mixBoard, {});
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
            Plan a week or a month in one click. Choose the mix below, then generate. Every idea is a unique combination.
          </p>
        </div>
        <BatchMix filters={filters} setFilters={setFilters} />
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
          {total.toLocaleString()} unique ideas possible with this mix
          {count > total ? `, so you'll get all ${total.toLocaleString()} of them.` : '.'}{' '}
          {count > total ? 'Allow more options or switch on more columns to get more.' : ''}
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

/** Choose the mix for a batch: which columns to use and which options each may draw from. */
function BatchMix({ filters, setFilters }: { filters: Record<string, string[]>; setFilters: (f: Record<string, string[]>) => void }) {
  const { board } = useAppState();
  const toggle = (catId: string, itemId: string) => {
    const current = filters[catId] ?? [];
    const next = current.includes(itemId) ? current.filter((id) => id !== itemId) : [...current, itemId];
    setFilters({ ...filters, [catId]: next });
  };
  const picked = board.categories.filter((c) => (filters[c.id] ?? []).some((id) => c.items.some((i) => i.id === id)));

  return (
    <div className="batch-mix">
      <div className="batch-mix__head">
        <h3>Choose the mix</h3>
        {picked.length > 0 && (
          <button className="link-btn" onClick={() => setFilters({})}>
            Reset to any
          </button>
        )}
      </div>
      <ColumnPicker />
      <div className="batch-mix__columns">
        {board.categories.map((category) => {
          const allowed = (filters[category.id] ?? []).filter((id) => category.items.some((i) => i.id === id));
          const summary = allowed.length
            ? allowed.map((id) => category.items.find((i) => i.id === id)!.label).join(', ')
            : `Any of ${category.items.length}`;
          return (
            <details key={category.id} className="batch-mix__column" style={{ '--c': category.color } as CSSProperties}>
              <summary>
                <span className="dot" />
                <strong>{category.label}</strong>
                <span className={`batch-mix__summary ${allowed.length ? 'is-limited' : ''}`}>{summary}</span>
              </summary>
              <div className="batch-mix__chips">
                <button className={`toggle-chip ${allowed.length === 0 ? 'is-on' : ''}`} onClick={() => setFilters({ ...filters, [category.id]: [] })}>
                  Any
                </button>
                {category.items.map((item) => {
                  const on = allowed.includes(item.id);
                  return (
                    <button key={item.id} className={`toggle-chip ${on ? 'is-on' : ''}`} aria-pressed={on} onClick={() => toggle(category.id, item.id)}>
                      {on && <Icon name="check" size={14} />}
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}
