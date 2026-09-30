import { type CSSProperties, useState } from 'react';
import { dateStamp, downloadFile, toCsv } from '../lib/export';
import { type IdeaStatus, STATUSES, useAppState } from '../state/AppState';
import { Icon } from './Icon';

/** Shortlisted ideas, with a simple idea → scripted → filmed → posted pipeline. */
export function SavedView() {
  const { saved, updateSaved, removeSaved, loadSelection, setView } = useAppState();
  const [filter, setFilter] = useState<IdeaStatus | 'all'>('all');
  const visible = filter === 'all' ? saved : saved.filter((idea) => idea.status === filter);

  const exportCsv = () => {
    const categories: string[] = [];
    for (const idea of visible) for (const p of idea.picks) if (!categories.includes(p.categoryLabel)) categories.push(p.categoryLabel);
    const header = ['Saved on', 'Status', ...categories, 'Hook starter', 'Notes'];
    const rows = visible.map((idea) => [
      new Date(idea.createdAt).toLocaleDateString(),
      STATUSES.find((s) => s.id === idea.status)?.label ?? idea.status,
      ...categories.map((label) => idea.picks.find((p) => p.categoryLabel === label)?.itemLabel ?? ''),
      idea.hook,
      idea.notes,
    ]);
    downloadFile(`saved-content-ideas-${dateStamp()}.csv`, toCsv([header, ...rows]), 'text/csv;charset=utf-8');
  };

  if (saved.length === 0) {
    return (
      <div className="empty card">
        <Icon name="bookmark" size={28} />
        <h2>No saved ideas yet</h2>
        <p className="muted">Save the ideas you like from the Build or Batch screens and track them from idea to posted.</p>
        <button className="btn btn--primary" onClick={() => setView('build')}>
          Start building
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="section-head">
        <div className="segmented" role="group" aria-label="Filter by status">
          <button className={filter === 'all' ? 'is-on' : ''} onClick={() => setFilter('all')}>
            All ({saved.length})
          </button>
          {STATUSES.map((s) => (
            <button key={s.id} className={filter === s.id ? 'is-on' : ''} onClick={() => setFilter(s.id)}>
              {s.label} ({saved.filter((i) => i.status === s.id).length})
            </button>
          ))}
        </div>
        <div className="section-head__actions">
          <button className="btn" onClick={exportCsv} disabled={visible.length === 0}>
            <Icon name="download" /> Export CSV
          </button>
        </div>
      </div>

      {visible.length === 0 && <p className="empty">Nothing here yet.</p>}

      <ul className="saved-list">
        {visible.map((idea) => (
          <li key={idea.id} className={`card saved status-${idea.status}`}>
            <div className="saved__top">
              <div className="brief__chips">
                {idea.picks.map((p) => (
                  <span key={p.categoryId} className="chip chip--static" style={{ '--c': p.color } as CSSProperties} title={p.categoryLabel}>
                    {p.itemLabel}
                  </span>
                ))}
              </div>
              <span className="muted small">{new Date(idea.createdAt).toLocaleDateString()}</span>
            </div>
            {idea.hook && <p className="saved__hook">“{idea.hook}”</p>}
            <textarea
              className="saved__notes"
              placeholder="Notes: script ideas, location, who's on camera, posting date..."
              value={idea.notes}
              rows={2}
              onChange={(e) => updateSaved(idea.id, { notes: e.target.value })}
            />
            <div className="saved__bottom">
              <label className="field field--inline">
                <span>Status</span>
                <select value={idea.status} onChange={(e) => updateSaved(idea.id, { status: e.target.value as IdeaStatus })}>
                  {STATUSES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="saved__actions">
                <button
                  className="btn btn--small"
                  onClick={() => {
                    loadSelection(idea.selection, idea.variant);
                    setView('build');
                  }}
                >
                  Open brief <Icon name="arrow" size={14} />
                </button>
                <button
                  className="icon-btn"
                  onClick={() => window.confirm('Delete this idea?') && removeSaved(idea.id)}
                  aria-label="Delete idea"
                  title="Delete idea"
                >
                  <Icon name="trash" size={16} />
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
