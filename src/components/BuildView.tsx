import { type CSSProperties, useEffect } from 'react';
import { countCombinations } from '../lib/matrix';
import { useAppState } from '../state/AppState';
import { Icon } from './Icon';
import { IdeaBrief } from './IdeaBrief';
import { MatrixBoard } from './MatrixBoard';

export function BuildView() {
  const { board, locks, randomise, clearSelection, selection, detail } = useAppState();
  const total = countCombinations(board);
  const lockedTotal = Object.keys(locks).length ? countCombinations(board, locks) : total;

  // Press R to roll a new idea (ignored while typing or with the info panel open).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (detail || e.metaKey || e.ctrlKey || e.altKey || e.key.toLowerCase() !== 'r') return;
      const target = e.target as HTMLElement;
      if (target.closest('input, textarea, select, [contenteditable]')) return;
      e.preventDefault();
      randomise();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [randomise, detail]);

  return (
    <>
      <div className="toolbar">
        <div className="toolbar__actions">
          <button className="btn btn--primary btn--lg" onClick={randomise}>
            <Icon name="dice" /> Randomise
          </button>
          <button className="btn btn--ghost" onClick={clearSelection} disabled={Object.keys(selection).length === 0}>
            Clear
          </button>
        </div>
        <p className="toolbar__count">
          <strong>{total.toLocaleString()}</strong> possible ideas
          {lockedTotal !== total && (
            <>
              {' '}
              · <strong>{lockedTotal.toLocaleString()}</strong> with your locks
            </>
          )}
        </p>
      </div>
      <ColumnPicker />
      <div className="build">
        <div className="build__board">
          <MatrixBoard />
        </div>
        <div className="build__brief">
          <IdeaBrief />
        </div>
      </div>
      <MobileBar />
    </>
  );
}

/** Switch columns on and off. Optional columns start switched off. */
export function ColumnPicker() {
  const { matrix, isActive, setActive } = useAppState();
  return (
    <div className="column-picker" role="group" aria-label="Columns on the board">
      <span className="column-picker__label">Columns</span>
      {matrix.categories.map((cat) => {
        const on = isActive(cat.id);
        return (
          <button
            key={cat.id}
            className={`toggle-chip ${on ? 'is-on' : ''}`}
            style={{ '--c': cat.color } as CSSProperties}
            aria-pressed={on}
            onClick={() => setActive(cat.id, !on)}
            title={on ? `Remove ${cat.label} from the board` : `Add ${cat.label}: ${cat.question}`}
          >
            <Icon name={on ? 'check' : 'plus'} size={14} />
            {cat.label}
          </button>
        );
      })}
    </div>
  );
}

/** On small screens the brief sits below a long board, so keep the main actions in reach. */
function MobileBar() {
  const { randomise, selection } = useAppState();
  return (
    <div className="mobile-bar">
      <button className="btn btn--primary" onClick={randomise}>
        <Icon name="dice" /> Randomise
      </button>
      <a className="btn" href="#idea" aria-disabled={Object.keys(selection).length === 0}>
        See idea <Icon name="down" size={16} />
      </a>
    </div>
  );
}
