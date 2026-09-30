import { type CSSProperties, type FormEvent, useRef, useState } from 'react';
import type { Matrix, MatrixCategory, MatrixItem, MediaType } from '../data/types';
import { dateStamp, downloadFile } from '../lib/export';
import { slugify, uniqueId } from '../lib/matrix';
import { suggestedMediaPath } from '../lib/media';
import { validateMatrix } from '../lib/validate';
import { useAppState } from '../state/AppState';
import { Icon } from './Icon';
import { Modal } from './Modal';

const PALETTE = ['#2563eb', '#7c3aed', '#ea580c', '#16a34a', '#db2777', '#0d9488', '#d97706', '#4f46e5', '#64748b', '#dc2626', '#0891b2', '#65a30d'];

type Editing =
  | { kind: 'category'; categoryId?: string }
  | { kind: 'item'; categoryId: string; itemId?: string }
  | null;

/** Add and edit columns and items. Changes are saved in this browser and can be exported as JSON. */
export function CustomiseView() {
  const { matrix, updateMatrix, resetMatrix, isCustomised, isActive, setActive, notify } = useAppState();
  const [currentId, setCurrentId] = useState<string | undefined>(matrix.categories[0]?.id);
  const [editing, setEditing] = useState<Editing>(null);
  const [importReport, setImportReport] = useState<{ errors: string[]; warnings: string[] } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const current = matrix.categories.find((c) => c.id === currentId) ?? matrix.categories[0];
  const parent = current?.dependsOn ? matrix.categories.find((c) => c.id === current.dependsOn) : undefined;
  const children = current ? matrix.categories.filter((c) => c.dependsOn === current.id) : [];

  const moveCategory = (id: string, delta: number) =>
    updateMatrix((m) => {
      const i = m.categories.findIndex((c) => c.id === id);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= m.categories.length) return m;
      [m.categories[i], m.categories[j]] = [m.categories[j], m.categories[i]];
      return m;
    });

  const moveItem = (catId: string, itemId: string, delta: number) =>
    updateMatrix((m) => {
      const cat = m.categories.find((c) => c.id === catId)!;
      const i = cat.items.findIndex((it) => it.id === itemId);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= cat.items.length) return m;
      [cat.items[i], cat.items[j]] = [cat.items[j], cat.items[i]];
      return m;
    });

  const deleteCategory = (cat: MatrixCategory) => {
    const dependents = matrix.categories.filter((c) => c.dependsOn === cat.id);
    const extra = dependents.length ? `\n\n${dependents.map((d) => d.label).join(', ')} will stop depending on it.` : '';
    if (!window.confirm(`Delete the "${cat.label}" column and its ${cat.items.length} items?${extra}`)) return;
    updateMatrix((m) => {
      m.categories = m.categories.filter((c) => c.id !== cat.id);
      for (const c of m.categories) if (c.dependsOn === cat.id) delete c.dependsOn;
      return m;
    });
    setCurrentId(matrix.categories.find((c) => c.id !== cat.id)?.id);
  };

  const deleteItem = (cat: MatrixCategory, item: MatrixItem) => {
    const orphans = children.flatMap((child) =>
      child.items.filter((i) => i.parents?.length === 1 && i.parents[0] === item.id).map((i) => `${i.label} (${child.label})`),
    );
    const extra = orphans.length ? `\n\nThese only belong under it and will be deleted too: ${orphans.join(', ')}.` : '';
    if (!window.confirm(`Delete "${item.label}"?${extra}`)) return;
    updateMatrix((m) => {
      const target = m.categories.find((c) => c.id === cat.id)!;
      target.items = target.items.filter((i) => i.id !== item.id);
      for (const child of m.categories.filter((c) => c.dependsOn === cat.id)) {
        child.items = child.items
          .filter((i) => !(i.parents?.length === 1 && i.parents[0] === item.id))
          .map((i) => (i.parents?.includes(item.id) ? { ...i, parents: i.parents.filter((p) => p !== item.id) } : i));
      }
      return m;
    });
  };

  const exportJson = () => {
    downloadFile(`cim-matrix-${dateStamp()}.json`, `${JSON.stringify(matrix, null, 2)}\n`, 'application/json');
  };

  const importJson = async (file: File) => {
    let data: unknown;
    try {
      data = JSON.parse(await file.text());
    } catch {
      setImportReport({ errors: ['This file is not valid JSON.'], warnings: [] });
      return;
    }
    const result = validateMatrix(data);
    if (!result.matrix) {
      setImportReport({ errors: result.errors, warnings: result.warnings });
      return;
    }
    const items = result.matrix.categories.reduce((n, c) => n + c.items.length, 0);
    if (!window.confirm(`Replace your matrix with this file (${result.matrix.categories.length} columns, ${items} items)?`)) return;
    const imported = result.matrix;
    updateMatrix(() => imported);
    setCurrentId(imported.categories[0]?.id);
    setImportReport(result.warnings.length ? { errors: [], warnings: result.warnings } : null);
    notify('Matrix imported');
  };

  return (
    <>
      <section className="card customise-intro">
        <div>
          <h2>Customise the matrix</h2>
          <p className="muted">
            Add your own columns and items, rewrite descriptions and plug in visual examples. Changes are saved in this browser.
            To make them the default for everyone, export the JSON and replace <code>src/data/cim-matrix.json</code> in the project.
          </p>
        </div>
        <div className="customise-intro__actions">
          <button className="btn" onClick={exportJson}>
            <Icon name="download" /> Export JSON
          </button>
          <button className="btn" onClick={() => fileInput.current?.click()}>
            <Icon name="upload" /> Import JSON
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) importJson(file);
              e.target.value = '';
            }}
          />
          <button
            className="btn btn--ghost"
            disabled={!isCustomised}
            onClick={() => window.confirm('Undo all your changes and go back to the built-in matrix?') && resetMatrix()}
          >
            Reset to default
          </button>
        </div>
        {importReport && (
          <div className={`report ${importReport.errors.length ? 'report--error' : ''}`}>
            <strong>{importReport.errors.length ? 'Could not import this file:' : 'Imported, with a few things to check:'}</strong>
            <ul>
              {[...importReport.errors, ...importReport.warnings].slice(0, 12).map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
            <button className="link-btn" onClick={() => setImportReport(null)}>
              Dismiss
            </button>
          </div>
        )}
      </section>

      <div className="customise">
        <nav className="customise__cats card" aria-label="Columns">
          <div className="customise__cats-head">
            <h3>Columns</h3>
            <button className="btn btn--small" onClick={() => setEditing({ kind: 'category' })}>
              <Icon name="plus" size={14} /> Add column
            </button>
          </div>
          <ul>
            {matrix.categories.map((cat, i) => (
              <li key={cat.id} className={cat.id === current?.id ? 'is-current' : ''} style={{ '--c': cat.color } as CSSProperties}>
                <button className="customise__cat" onClick={() => setCurrentId(cat.id)}>
                  <span className="dot" />
                  <span className="customise__cat-label">{cat.label}</span>
                  <span className="muted small">{cat.items.length}</span>
                </button>
                <span className="customise__cat-tools">
                  <button className="icon-btn icon-btn--sm" disabled={i === 0} onClick={() => moveCategory(cat.id, -1)} aria-label={`Move ${cat.label} up`}>
                    <Icon name="up" size={14} />
                  </button>
                  <button
                    className="icon-btn icon-btn--sm"
                    disabled={i === matrix.categories.length - 1}
                    onClick={() => moveCategory(cat.id, 1)}
                    aria-label={`Move ${cat.label} down`}
                  >
                    <Icon name="down" size={14} />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </nav>

        {current && (
          <section className="customise__detail card" style={{ '--c': current.color } as CSSProperties}>
            <header className="customise__detail-head">
              <div>
                <span className="eyebrow eyebrow--color">Column</span>
                <h2>{current.label}</h2>
                <p className="muted">{current.question}</p>
                <p className="small">
                  {parent ? (
                    <>
                      Options depend on <strong>{parent.label}</strong>.{' '}
                    </>
                  ) : null}
                  {current.optional ? 'Optional column (off by default). ' : 'Shown on the board by default. '}
                  <label className="check check--inline">
                    <input type="checkbox" checked={isActive(current.id)} onChange={(e) => setActive(current.id, e.target.checked)} /> On my board
                  </label>
                </p>
              </div>
              <div className="customise__detail-actions">
                <button className="btn btn--small" onClick={() => setEditing({ kind: 'category', categoryId: current.id })}>
                  <Icon name="edit" size={14} /> Edit column
                </button>
                <button className="icon-btn" onClick={() => deleteCategory(current)} aria-label={`Delete ${current.label}`} title="Delete column">
                  <Icon name="trash" size={16} />
                </button>
              </div>
            </header>

            <div className="section-head">
              <h3>
                {current.items.length} item{current.items.length === 1 ? '' : 's'}
              </h3>
              <button className="btn btn--small btn--primary" onClick={() => setEditing({ kind: 'item', categoryId: current.id })}>
                <Icon name="plus" size={14} /> Add item
              </button>
            </div>
            <ul className="customise__items">
              {current.items.map((item, i) => (
                <li key={item.id}>
                  <div className="customise__item-main">
                    <strong>
                      {item.label}
                      {item.altLabel && <span className="item__alt">{item.altLabel}</span>}
                    </strong>
                    <span className="muted small">
                      {parent && item.parents?.length
                        ? `Under ${item.parents.map((id) => parent.items.find((p) => p.id === id)?.label ?? id).join(', ')} · `
                        : ''}
                      {item.media?.src ? 'Has visual' : 'Visual placeholder'}
                    </span>
                  </div>
                  <span className="customise__item-tools">
                    <button className="icon-btn icon-btn--sm" disabled={i === 0} onClick={() => moveItem(current.id, item.id, -1)} aria-label={`Move ${item.label} up`}>
                      <Icon name="up" size={14} />
                    </button>
                    <button
                      className="icon-btn icon-btn--sm"
                      disabled={i === current.items.length - 1}
                      onClick={() => moveItem(current.id, item.id, 1)}
                      aria-label={`Move ${item.label} down`}
                    >
                      <Icon name="down" size={14} />
                    </button>
                    <button className="icon-btn icon-btn--sm" onClick={() => setEditing({ kind: 'item', categoryId: current.id, itemId: item.id })} aria-label={`Edit ${item.label}`}>
                      <Icon name="edit" size={14} />
                    </button>
                    <button className="icon-btn icon-btn--sm" onClick={() => deleteItem(current, item)} aria-label={`Delete ${item.label}`}>
                      <Icon name="trash" size={14} />
                    </button>
                  </span>
                </li>
              ))}
              {current.items.length === 0 && <li className="muted">No items yet. Add the first one.</li>}
            </ul>
          </section>
        )}
      </div>

      {editing?.kind === 'category' && (
        <CategoryForm
          matrix={matrix}
          category={matrix.categories.find((c) => c.id === editing.categoryId)}
          onClose={() => setEditing(null)}
          onSave={(cat, isNew) => {
            updateMatrix((m) => {
              if (isNew) m.categories.push(cat);
              else m.categories = m.categories.map((c) => (c.id === cat.id ? cat : c));
              return m;
            });
            if (isNew) {
              setActive(cat.id, true);
              setCurrentId(cat.id);
            }
            setEditing(null);
            notify(isNew ? `Added the ${cat.label} column` : 'Column saved');
          }}
        />
      )}

      {editing?.kind === 'item' && (
        <ItemForm
          matrix={matrix}
          categoryId={editing.categoryId}
          item={matrix.categories.find((c) => c.id === editing.categoryId)?.items.find((i) => i.id === editing.itemId)}
          onClose={() => setEditing(null)}
          onSave={(item, isNew) => {
            updateMatrix((m) => {
              const cat = m.categories.find((c) => c.id === editing.categoryId)!;
              if (isNew) cat.items.push(item);
              else cat.items = cat.items.map((i) => (i.id === item.id ? item : i));
              return m;
            });
            setEditing(null);
            notify(isNew ? `Added ${item.label}` : 'Item saved');
          }}
        />
      )}
    </>
  );
}

function CategoryForm({
  matrix,
  category,
  onClose,
  onSave,
}: {
  matrix: Matrix;
  category?: MatrixCategory;
  onClose: () => void;
  onSave: (category: MatrixCategory, isNew: boolean) => void;
}) {
  const isNew = !category;
  const [draft, setDraft] = useState({
    label: category?.label ?? '',
    question: category?.question ?? '',
    description: category?.description ?? '',
    briefLabel: category?.briefLabel ?? '',
    dependsOn: category?.dependsOn ?? '',
    optional: category?.optional ?? false,
    color: category?.color ?? PALETTE[matrix.categories.length % PALETTE.length],
  });
  const set = (patch: Partial<typeof draft>) => setDraft((d) => ({ ...d, ...patch }));
  // A column can't depend on itself or on one of its own dependents.
  const parentOptions = matrix.categories.filter((c) => {
    if (c.id === category?.id) return false;
    let cursor: MatrixCategory | undefined = c;
    for (let n = 0; cursor && n < 20; n++) {
      if (cursor.dependsOn === category?.id && category) return false;
      cursor = matrix.categories.find((x) => x.id === cursor?.dependsOn);
    }
    return true;
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: MatrixCategory = {
      id: category?.id ?? uniqueId(draft.label, matrix.categories.map((c) => c.id)),
      label: draft.label.trim(),
      question: draft.question.trim(),
      items: category?.items ?? [],
    };
    if (draft.description.trim()) next.description = draft.description.trim();
    if (draft.briefLabel.trim()) next.briefLabel = draft.briefLabel.trim();
    if (draft.dependsOn) next.dependsOn = draft.dependsOn;
    if (draft.optional) next.optional = true;
    if (draft.color) next.color = draft.color;
    onSave(next, isNew);
  };

  return (
    <Modal title={isNew ? 'Add a column' : `Edit ${category.label}`} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label className="field">
          <span>Column name *</span>
          <input required value={draft.label} onChange={(e) => set({ label: e.target.value })} placeholder="e.g. Platform" />
        </label>
        <label className="field">
          <span>Question it answers *</span>
          <input required value={draft.question} onChange={(e) => set({ question: e.target.value })} placeholder="e.g. Where will you post it?" />
        </label>
        <label className="field">
          <span>Description</span>
          <textarea rows={2} value={draft.description} onChange={(e) => set({ description: e.target.value })} />
        </label>
        <div className="form__row">
          <label className="field">
            <span>Label in the brief</span>
            <input value={draft.briefLabel} onChange={(e) => set({ briefLabel: e.target.value })} placeholder={draft.label || 'e.g. Post on'} />
          </label>
          <label className="field field--color">
            <span>Colour</span>
            <input type="color" value={draft.color} onChange={(e) => set({ color: e.target.value })} />
          </label>
        </div>
        <label className="field">
          <span>Options depend on another column?</span>
          <select value={draft.dependsOn} onChange={(e) => set({ dependsOn: e.target.value })}>
            <option value="">No, every option always applies</option>
            {parentOptions.map((c) => (
              <option key={c.id} value={c.id}>
                Yes, on {c.label}
              </option>
            ))}
          </select>
          <small className="muted">Like Present Style, which changes with the Content Type you pick.</small>
        </label>
        <label className="check">
          <input type="checkbox" checked={draft.optional} onChange={(e) => set({ optional: e.target.checked })} /> Optional column: hidden from the board until
          someone adds it
        </label>
        <div className="form__actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary">
            {isNew ? 'Add column' : 'Save column'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

const lines = (text: string) =>
  text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

function ItemForm({
  matrix,
  categoryId,
  item,
  onClose,
  onSave,
}: {
  matrix: Matrix;
  categoryId: string;
  item?: MatrixItem;
  onClose: () => void;
  onSave: (item: MatrixItem, isNew: boolean) => void;
}) {
  const category = matrix.categories.find((c) => c.id === categoryId)!;
  const parent = category.dependsOn ? matrix.categories.find((c) => c.id === category.dependsOn) : undefined;
  const isNew = !item;
  const [draft, setDraft] = useState({
    label: item?.label ?? '',
    altLabel: item?.altLabel ?? '',
    description: item?.description ?? '',
    brief: item?.brief ?? '',
    howTo: (item?.howTo ?? []).join('\n'),
    structure: (item?.structure ?? []).join('\n'),
    example: item?.example ?? '',
    hooks: (item?.hooks ?? []).join('\n'),
    subjects: (item?.subjects ?? []).join('\n'),
    parents: item?.parents ?? [],
    mediaType: (item?.media?.type ?? '') as MediaType | '',
    mediaSrc: item?.media?.src ?? '',
    mediaPoster: item?.media?.poster ?? '',
    mediaCaption: item?.media?.caption ?? '',
    references: (item?.references ?? []).map((r) => [r.label, r.note, r.url].filter(Boolean).join(' | ')).join('\n'),
  });
  const set = (patch: Partial<typeof draft>) => setDraft((d) => ({ ...d, ...patch }));
  const idPreview = item?.id ?? (draft.label ? slugify(draft.label) : 'item');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: MatrixItem = {
      id: item?.id ?? uniqueId(draft.label, category.items.map((i) => i.id)),
      label: draft.label.trim(),
      description: draft.description.trim(),
    };
    if (draft.altLabel.trim()) next.altLabel = draft.altLabel.trim();
    if (draft.brief.trim()) next.brief = draft.brief.trim();
    const listFields = ['howTo', 'structure', 'hooks', 'subjects'] as const;
    for (const key of listFields) {
      const list = lines(draft[key]);
      if (list.length) next[key] = list;
    }
    if (draft.example.trim()) next.example = draft.example.trim();
    if (parent && draft.parents.length) next.parents = draft.parents;
    if (draft.mediaType && draft.mediaSrc.trim()) {
      next.media = { type: draft.mediaType, src: draft.mediaSrc.trim() };
      if (draft.mediaPoster.trim()) next.media.poster = draft.mediaPoster.trim();
      if (draft.mediaCaption.trim()) next.media.caption = draft.mediaCaption.trim();
      if (item?.media?.credit) next.media.credit = item.media.credit;
    }
    const refs = lines(draft.references).map((line) => {
      const [label, note, url] = line.split('|').map((s) => s.trim());
      return { label, ...(note ? { note } : {}), ...(url ? { url } : {}) };
    });
    if (refs.length) next.references = refs;
    onSave(next, isNew);
  };

  return (
    <Modal title={isNew ? `Add to ${category.label}` : `Edit ${item.label}`} onClose={onClose} wide>
      <form className="form" onSubmit={submit}>
        <div className="form__row">
          <label className="field">
            <span>Name *</span>
            <input required value={draft.label} onChange={(e) => set({ label: e.target.value })} placeholder="e.g. Time-lapse" />
          </label>
          <label className="field">
            <span>Other name</span>
            <input value={draft.altLabel} onChange={(e) => set({ altLabel: e.target.value })} placeholder="e.g. the Malay term" />
          </label>
        </div>

        {parent && (
          <fieldset className="field">
            <legend>Shows under which {parent.label}?</legend>
            <div className="check-grid">
              {parent.items.map((p) => (
                <label key={p.id} className="check">
                  <input
                    type="checkbox"
                    checked={draft.parents.includes(p.id)}
                    onChange={(e) => set({ parents: e.target.checked ? [...draft.parents, p.id] : draft.parents.filter((x) => x !== p.id) })}
                  />{' '}
                  {p.label}
                </label>
              ))}
            </div>
            <small className="muted">Leave all unticked to show it under every {parent.label.toLowerCase()}.</small>
          </fieldset>
        )}

        <label className="field">
          <span>What is it? *</span>
          <textarea required rows={2} value={draft.description} onChange={(e) => set({ description: e.target.value })} placeholder="One or two sentences a beginner understands." />
        </label>
        <label className="field">
          <span>Direction for the brief</span>
          <input value={draft.brief} onChange={(e) => set({ brief: e.target.value })} placeholder="e.g. Speed up the process with a time-lapse so it feels satisfying." />
          <small className="muted">
            One line telling the creator what to do. You can use {'{brand}'}, {'{product}'}, {'{audience}'} and {'{niche}'}.
          </small>
        </label>
        <div className="form__row">
          <label className="field">
            <span>How to do it (one tip per line)</span>
            <textarea rows={4} value={draft.howTo} onChange={(e) => set({ howTo: e.target.value })} />
          </label>
          <label className="field">
            <span>Structure (one step per line)</span>
            <textarea rows={4} value={draft.structure} onChange={(e) => set({ structure: e.target.value })} />
          </label>
        </div>
        <label className="field">
          <span>Example</span>
          <input value={draft.example} onChange={(e) => set({ example: e.target.value })} placeholder="A short example of it in action." />
        </label>
        <div className="form__row">
          <label className="field">
            <span>Hook starters (one per line)</span>
            <textarea rows={3} value={draft.hooks} onChange={(e) => set({ hooks: e.target.value })} placeholder="Top 3 things to know about {subject}" />
            <small className="muted">{'{subject}'} is filled from the Topic you pick.</small>
          </label>
          <label className="field">
            <span>Subjects for hooks (one per line)</span>
            <textarea rows={3} value={draft.subjects} onChange={(e) => set({ subjects: e.target.value })} placeholder="choosing the right {product}" />
            <small className="muted">Used by Topic-style items. Write them so they fit after “about”.</small>
          </label>
        </div>

        <fieldset className="field media-fields">
          <legend>Visual example</legend>
          <div className="form__row">
            <label className="field">
              <span>Type</span>
              <select value={draft.mediaType} onChange={(e) => set({ mediaType: e.target.value as MediaType | '' })}>
                <option value="">None yet (show placeholder)</option>
                <option value="video">Video file (mp4/webm)</option>
                <option value="image">Image or GIF</option>
                <option value="youtube">YouTube link</option>
                <option value="embed">Other embed link (TikTok, Instagram, Vimeo)</option>
              </select>
            </label>
            <label className="field">
              <span>Link or file path</span>
              <input
                value={draft.mediaSrc}
                onChange={(e) => set({ mediaSrc: e.target.value })}
                placeholder={draft.mediaType === 'youtube' ? 'https://youtube.com/shorts/...' : suggestedMediaPath(categoryId, idPreview)}
                disabled={!draft.mediaType}
              />
            </label>
          </div>
          {draft.mediaType && (
            <div className="form__row">
              {draft.mediaType === 'video' && (
                <label className="field">
                  <span>Poster image (optional)</span>
                  <input value={draft.mediaPoster} onChange={(e) => set({ mediaPoster: e.target.value })} placeholder={suggestedMediaPath(categoryId, idPreview, 'jpg')} />
                </label>
              )}
              <label className="field">
                <span>Caption (optional)</span>
                <input value={draft.mediaCaption} onChange={(e) => set({ mediaCaption: e.target.value })} />
              </label>
            </div>
          )}
          <small className="muted">
            Put files in <code>public/media/</code>, e.g. <code>{suggestedMediaPath(categoryId, idPreview)}</code>, or paste any public link.
          </small>
        </fieldset>

        <label className="field">
          <span>Style references (one per line: name | note | link)</span>
          <textarea rows={2} value={draft.references} onChange={(e) => set({ references: e.target.value })} placeholder="KL Foodie | Study how they frame the first bite | https://..." />
        </label>

        <div className="form__actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary">
            {isNew ? 'Add item' : 'Save item'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
