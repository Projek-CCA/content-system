import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import defaultMatrixJson from '../data/cim-matrix.json';
import type { Matrix, Profile, Selection } from '../data/types';
import { buildBrief, hookText } from '../lib/brief';
import {
  applySelect,
  type Board,
  buildBoard,
  lockMap,
  pruneSelection,
  randomSelection,
  selectionKey,
} from '../lib/matrix';
import { applyOverlay, diffMatrix, EMPTY_OVERLAY, isEmptyOverlay, type MatrixOverlay } from '../lib/overlay';
import { validateMatrix } from '../lib/validate';
import { usePersistentState } from './usePersistentState';

export const BASE_MATRIX = defaultMatrixJson as Matrix;

export type View = 'build' | 'batch' | 'saved' | 'library' | 'customise';
export type IdeaStatus = 'idea' | 'scripted' | 'filmed' | 'posted';

export const STATUSES: { id: IdeaStatus; label: string }[] = [
  { id: 'idea', label: 'Idea' },
  { id: 'scripted', label: 'Scripted' },
  { id: 'filmed', label: 'Filmed' },
  { id: 'posted', label: 'Posted' },
];

export interface SavedPick {
  categoryId: string;
  categoryLabel: string;
  itemId: string;
  itemLabel: string;
  color?: string;
}

export interface SavedIdea {
  id: string;
  key: string;
  createdAt: number;
  selection: Selection;
  /** Snapshot of the labels, so saved ideas stay readable if the matrix changes. */
  picks: SavedPick[];
  hook: string;
  variant: number;
  status: IdeaStatus;
  notes: string;
}

export const EMPTY_PROFILE: Profile = { brand: '', product: '', audience: '', niche: '', language: 'English' };

interface AppStateValue {
  baseMatrix: Matrix;
  matrix: Matrix;
  isCustomised: boolean;
  updateMatrix: (update: (matrix: Matrix) => Matrix) => void;
  resetMatrix: () => void;

  board: Board;
  isActive: (categoryId: string) => boolean;
  setActive: (categoryId: string, active: boolean) => void;

  profile: Profile;
  setProfile: (patch: Partial<Profile>) => void;

  selection: Selection;
  /** Pick an item. `parentItemId` switches the parent column first (used when clicking inside a parent group). */
  select: (categoryId: string, itemId: string, parentItemId?: string) => void;
  clearCategory: (categoryId: string) => void;
  clearSelection: () => void;
  loadSelection: (selection: Selection, variant?: number) => void;
  randomise: () => void;
  randomiseCategory: (categoryId: string) => void;
  /** Increments on every randomise, so the board can animate. */
  rollCount: number;

  locked: string[];
  toggleLock: (categoryId: string) => void;
  locks: Selection;

  variant: number;
  nextVariant: () => void;

  saved: SavedIdea[];
  saveIdea: (selection: Selection, variant: number) => void;
  updateSaved: (id: string, patch: Partial<Pick<SavedIdea, 'status' | 'notes'>>) => void;
  removeSaved: (id: string) => void;
  isSaved: (selection: Selection) => boolean;

  view: View;
  setView: (view: View) => void;

  detail: { categoryId: string; itemId: string } | null;
  openDetail: (categoryId: string, itemId: string) => void;
  closeDetail: () => void;

  toast: string | null;
  notify: (message: string) => void;
}

const AppStateContext = createContext<AppStateValue | null>(null);

const isObject = (v: unknown) => typeof v === 'object' && v !== null && !Array.isArray(v);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [overlay, setOverlay] = usePersistentState<MatrixOverlay>('overlay', EMPTY_OVERLAY, (v) => isObject(v) && (v as MatrixOverlay).version === 1);
  const [toggles, setToggles] = usePersistentState<Record<string, boolean>>('columns', {}, isObject);
  const [storedProfile, setStoredProfile] = usePersistentState<Profile>('profile', EMPTY_PROFILE, isObject);
  const [rawSelection, setRawSelection] = usePersistentState<Selection>('selection', {}, isObject);
  const [locked, setLocked] = usePersistentState<string[]>('locked', [], Array.isArray);
  const [saved, setSaved] = usePersistentState<SavedIdea[]>('saved', [], Array.isArray);
  const [variant, setVariant] = useState(0);
  const [rollCount, setRollCount] = useState(0);
  const [view, setView] = useState<View>('build');
  const [detail, setDetail] = useState<AppStateValue['detail']>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  const matrix = useMemo(() => {
    if (isEmptyOverlay(overlay)) return BASE_MATRIX;
    try {
      return validateMatrix(applyOverlay(BASE_MATRIX, overlay)).matrix ?? BASE_MATRIX;
    } catch {
      return BASE_MATRIX;
    }
  }, [overlay]);

  const isActive = useCallback(
    (id: string) => {
      const cat = matrix.categories.find((c) => c.id === id);
      return toggles[id] ?? !cat?.optional;
    },
    [matrix, toggles],
  );

  const board = useMemo(
    () => buildBoard(matrix, matrix.categories.filter((c) => toggles[c.id] ?? !c.optional).map((c) => c.id)),
    [matrix, toggles],
  );

  const selection = useMemo(() => pruneSelection(board, rawSelection), [board, rawSelection]);
  const locks = useMemo(() => lockMap(selection, locked), [selection, locked]);
  const profile = useMemo(() => ({ ...EMPTY_PROFILE, ...storedProfile }), [storedProfile]);

  /** Keep choices for columns that are switched off, so they come back when re-enabled. */
  const commitSelection = useCallback(
    (next: Selection) => {
      setRawSelection((prev) => {
        const kept: Selection = {};
        for (const [catId, itemId] of Object.entries(prev)) {
          if (!board.categories.some((c) => c.id === catId)) kept[catId] = itemId;
        }
        return { ...kept, ...next };
      });
      setVariant(0);
    },
    [board, setRawSelection],
  );

  const notify = useCallback((message: string) => {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2200);
  }, []);

  const value: AppStateValue = {
    baseMatrix: BASE_MATRIX,
    matrix,
    isCustomised: !isEmptyOverlay(overlay),
    updateMatrix: (update) => setOverlay(diffMatrix(BASE_MATRIX, update(structuredClone(matrix)))),
    resetMatrix: () => setOverlay(EMPTY_OVERLAY),

    board,
    isActive,
    setActive: (id, active) => setToggles((prev) => ({ ...prev, [id]: active })),

    profile,
    setProfile: (patch) => setStoredProfile((prev) => ({ ...EMPTY_PROFILE, ...prev, ...patch })),

    selection,
    select: (categoryId, itemId, parentItemId) => {
      const parent = board.parentOf.get(categoryId);
      const base =
        parent && parentItemId && selection[parent.id] !== parentItemId
          ? applySelect(board, selection, parent.id, parentItemId)
          : selection;
      commitSelection(applySelect(board, base, categoryId, itemId));
    },
    clearCategory: (categoryId) => {
      const next = { ...selection };
      delete next[categoryId];
      commitSelection(next);
      setLocked((prev) => prev.filter((id) => id !== categoryId));
    },
    clearSelection: () => {
      setRawSelection({});
      setVariant(0);
      setLocked([]);
    },
    loadSelection: (next, v = 0) => {
      commitSelection(pruneSelection(board, next));
      setVariant(v);
    },
    randomise: () => {
      commitSelection(randomSelection(board, locks));
      setRollCount((n) => n + 1);
    },
    randomiseCategory: (categoryId) => {
      // Keep everything except this column and its (unlocked) descendants.
      const descendants = new Set<string>();
      const collect = (id: string) => {
        for (const child of board.childrenOf.get(id) ?? []) {
          descendants.add(child.id);
          collect(child.id);
        }
      };
      collect(categoryId);
      const keep = board.categories
        .map((c) => c.id)
        .filter((id) => id !== categoryId && (!descendants.has(id) || locked.includes(id)));
      const fixed = lockMap(selection, keep);
      let next = randomSelection(board, fixed);
      for (let i = 0; i < 6 && next[categoryId] === selection[categoryId]; i++) next = randomSelection(board, fixed);
      commitSelection(next);
      setRollCount((n) => n + 1);
    },
    rollCount,

    locked,
    toggleLock: (id) => setLocked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])),
    locks,

    variant,
    nextVariant: () => setVariant((v) => v + 1),

    saved,
    saveIdea: (sel, v) => {
      const brief = buildBrief(board, sel, v);
      const idea: SavedIdea = {
        id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        key: brief.key,
        createdAt: Date.now(),
        selection: sel,
        picks: brief.picks.map(({ category, item }) => ({
          categoryId: category.id,
          categoryLabel: category.label,
          itemId: item.id,
          itemLabel: item.label,
          color: category.color,
        })),
        hook: hookText(brief, profile),
        variant: v,
        status: 'idea',
        notes: '',
      };
      setSaved((prev) => [idea, ...prev]);
    },
    updateSaved: (id, patch) => setSaved((prev) => prev.map((idea) => (idea.id === id ? { ...idea, ...patch } : idea))),
    removeSaved: (id) => setSaved((prev) => prev.filter((idea) => idea.id !== id)),
    isSaved: (sel) => {
      const key = selectionKey(board, sel);
      return saved.some((idea) => idea.key === key);
    },

    view,
    setView: (next) => {
      setView(next);
      window.scrollTo({ top: 0 });
    },

    detail,
    openDetail: (categoryId, itemId) => setDetail({ categoryId, itemId }),
    closeDetail: () => setDetail(null),

    toast,
    notify,
  };

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppStateValue {
  const value = useContext(AppStateContext);
  if (!value) throw new Error('useAppState must be used inside <AppStateProvider>');
  return value;
}
