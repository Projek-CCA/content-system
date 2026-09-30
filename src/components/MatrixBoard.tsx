import { type CSSProperties, useState } from 'react';
import type { MatrixCategory, MatrixItem } from '../data/types';
import { useAppState } from '../state/AppState';
import { Icon } from './Icon';

/** The matrix itself: one column per active category, like the lecturer's marking sheet. */
export function MatrixBoard() {
  const { board } = useAppState();
  if (board.categories.length === 0) {
    return <p className="empty">All columns are switched off. Turn some on above to start building ideas.</p>;
  }
  return (
    <div className="board">
      {board.categories.map((category, index) => (
        <CategoryColumn key={category.id} category={category} index={index} />
      ))}
    </div>
  );
}

function CategoryColumn({ category, index }: { category: MatrixCategory; index: number }) {
  const { board, selection, locked, toggleLock, randomiseCategory } = useAppState();
  const parent = board.parentOf.get(category.id);
  const selected = selection[category.id];
  const isLocked = locked.includes(category.id) && Boolean(selected);

  return (
    <section className={`column ${selected ? 'has-pick' : ''}`} style={{ '--c': category.color } as CSSProperties} aria-labelledby={`col-${category.id}`}>
      <header className="column__head">
        <span className="column__num">{index + 1}</span>
        <div className="column__titles">
          <h2 id={`col-${category.id}`}>{category.label}</h2>
          <p>{category.question}</p>
        </div>
        <div className="column__tools">
          <button
            className={`icon-btn ${isLocked ? 'is-on' : ''}`}
            onClick={() => toggleLock(category.id)}
            disabled={!selected}
            aria-pressed={isLocked}
            title={selected ? (isLocked ? 'Unlock: this column will change when you randomise' : 'Lock: keep this pick when you randomise') : 'Pick something to lock it'}
            aria-label={`${isLocked ? 'Unlock' : 'Lock'} ${category.label}`}
          >
            <Icon name={isLocked ? 'lock' : 'unlock'} size={16} />
          </button>
          <button
            className="icon-btn"
            onClick={() => randomiseCategory(category.id)}
            title={`Randomise ${category.label} only`}
            aria-label={`Randomise ${category.label} only`}
          >
            <Icon name="dice" size={16} />
          </button>
        </div>
      </header>
      {parent ? <GroupedItems category={category} parent={parent} /> : <ItemList category={category} items={category.items} />}
    </section>
  );
}

/** A dependent column (e.g. Present Style) grouped under each parent item (e.g. Content Type). */
function GroupedItems({ category, parent }: { category: MatrixCategory; parent: MatrixCategory }) {
  const { selection } = useAppState();
  const [expanded, setExpanded] = useState<string[]>([]);
  const activeParent = selection[parent.id];

  const groups = parent.items
    .map((p) => ({ parent: p, items: category.items.filter((i) => i.parents?.includes(p.id)) }))
    .filter((g) => g.items.length > 0);
  const anyGroup = category.items.filter((i) => !i.parents?.length);

  return (
    <div className="column__body">
      {groups.map(({ parent: p, items }) => {
        const matches = !activeParent || activeParent === p.id;
        const open = matches || expanded.includes(p.id);
        return (
          <div key={p.id} className={`group ${matches ? '' : 'is-dim'}`}>
            {open ? (
              <>
                <div className="group__label">{p.label}</div>
                <ItemList category={category} items={items} parentItemId={p.id} />
              </>
            ) : (
              <button className="group__collapsed" onClick={() => setExpanded((prev) => [...prev, p.id])}>
                <span>{p.label}</span>
                <span className="muted">
                  {items.length} style{items.length === 1 ? '' : 's'} +
                </span>
              </button>
            )}
          </div>
        );
      })}
      {anyGroup.length > 0 && (
        <div className="group">
          <div className="group__label">Works with any {parent.label.toLowerCase()}</div>
          <ItemList category={category} items={anyGroup} />
        </div>
      )}
    </div>
  );
}

function ItemList({ category, items, parentItemId }: { category: MatrixCategory; items: MatrixItem[]; parentItemId?: string }) {
  const { selection, select, clearCategory, openDetail, rollCount, board } = useAppState();
  const parent = board.parentOf.get(category.id);
  const activeParent = parent ? selection[parent.id] : undefined;

  const list = (
    <ul className="items">
      {items.map((item) => {
        const isSelected = selection[category.id] === item.id && (!parentItemId || !activeParent || activeParent === parentItemId);
        return (
          <li key={isSelected ? `${item.id}:${rollCount}` : item.id} className={`item ${isSelected ? 'is-selected' : ''}`}>
            <button
              className="item__pick"
              aria-pressed={isSelected}
              onClick={() => (isSelected ? clearCategory(category.id) : select(category.id, item.id, parentItemId))}
            >
              <span className="item__check" aria-hidden="true">
                {isSelected && <Icon name="check" size={14} />}
              </span>
              <span className="item__label">
                {item.label}
                {item.altLabel && <span className="item__alt">{item.altLabel}</span>}
              </span>
            </button>
            <button className="item__info" onClick={() => openDetail(category.id, item.id)} aria-label={`What is ${item.label}?`} title={`What is ${item.label}?`}>
              <Icon name="info" size={16} />
            </button>
          </li>
        );
      })}
    </ul>
  );
  return parentItemId ? list : <div className="column__body">{list}</div>;
}
