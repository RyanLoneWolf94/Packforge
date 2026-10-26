import { useCallback, useMemo, useState } from 'react';

/**
 * Shared sorting for every list view.
 *
 * Each page declares what it can sort by; the comparator always describes the
 * option's *natural* order (A to Z, newest first, largest first) and the hook
 * flips it for the opposite direction. That way a page never has to write a
 * comparator twice, and "Name descending" means the same thing everywhere.
 *
 * The chosen sort is remembered per view, because a sort you have to re-pick
 * on every visit is barely a feature.
 */

export type SortDir = 'asc' | 'desc';

export interface SortOption<T> {
  id: string;
  label: string;
  /** Compare in this option's natural direction. */
  compare: (a: T, b: T) => number;
  /**
   * Which direction reads as "natural" for this field. Text sorts A to Z;
   * dates and amounts almost always want the biggest first.
   */
  natural?: SortDir;
}

export interface SortState<T> {
  items: T[];
  id: string;
  dir: SortDir;
  options: SortOption<T>[];
  setId: (id: string) => void;
  setDir: (dir: SortDir) => void;
  toggleDir: () => void;
  /** The active option, for labelling the direction toggle. */
  active: SortOption<T> | undefined;
}

/* ------------------------------ comparators ----------------------------- */

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

/** Case-insensitive, and "Item 10" sorts after "Item 9" rather than before. */
export const byText = <T,>(get: (item: T) => string | undefined) =>
  (a: T, b: T) => collator.compare(get(a) ?? '', get(b) ?? '');

export const byNumber = <T,>(get: (item: T) => number | undefined) =>
  (a: T, b: T) => (get(b) ?? 0) - (get(a) ?? 0);

/** Dates are ISO strings throughout, so a string compare is the right compare. */
export const byDate = <T,>(get: (item: T) => string | undefined) =>
  (a: T, b: T) => (get(b) ?? '').localeCompare(get(a) ?? '');

/** Order by position in a list — lifecycle stages, priority bands. */
export const byRank = <T,>(order: readonly string[], get: (item: T) => string) =>
  (a: T, b: T) => {
    const rank = (v: string) => {
      const i = order.indexOf(v);
      return i === -1 ? order.length : i;
    };
    return rank(get(a)) - rank(get(b));
  };

/* --------------------------------- hook --------------------------------- */

const keyFor = (view: string) => `packforge.sort.${view}`;

/** Browser storage can be unavailable or throw; a lost preference is harmless. */
const readStored = (view: string): { id?: string; dir?: SortDir } => {
  try {
    const raw = localStorage.getItem(keyFor(view));
    return raw ? (JSON.parse(raw) as { id?: string; dir?: SortDir }) : {};
  } catch {
    return {};
  }
};

const writeStored = (view: string, value: { id: string; dir: SortDir }) => {
  try {
    localStorage.setItem(keyFor(view), JSON.stringify(value));
  } catch {
    /* private window, blocked storage — not worth surfacing */
  }
};

export function useSort<T>(
  items: T[],
  options: SortOption<T>[],
  /** Namespace for the remembered choice, e.g. "projects". */
  view: string,
): SortState<T> {
  const stored = useMemo(() => readStored(view), [view]);
  const fallback = options[0];

  const [id, setIdRaw] = useState(() =>
    options.some((o) => o.id === stored.id) ? (stored.id as string) : fallback?.id ?? '',
  );
  const [dir, setDirRaw] = useState<SortDir>(() => {
    if (stored.dir === 'asc' || stored.dir === 'desc') return stored.dir;
    const initial = options.find((o) => o.id === stored.id) ?? fallback;
    return initial?.natural ?? 'asc';
  });

  const active = options.find((o) => o.id === id) ?? fallback;

  const setId = useCallback(
    (next: string) => {
      const option = options.find((o) => o.id === next);
      // Picking a new field resets to that field's natural direction, which is
      // what people expect: choosing "Amount" should show the big ones first.
      const nextDir = option?.natural ?? 'asc';
      setIdRaw(next);
      setDirRaw(nextDir);
      writeStored(view, { id: next, dir: nextDir });
    },
    [options, view],
  );

  const setDir = useCallback(
    (next: SortDir) => {
      setDirRaw(next);
      writeStored(view, { id, dir: next });
    },
    [id, view],
  );

  const toggleDir = useCallback(() => setDir(dir === 'asc' ? 'desc' : 'asc'), [dir, setDir]);

  const sorted = useMemo(() => {
    if (!active) return items;
    const natural = active.natural ?? 'asc';
    const flip = dir === natural ? 1 : -1;
    // Copy first: the source arrays come from the store and must not be sorted
    // in place, or the store's own order mutates underneath other views.
    return [...items].sort((a, b) => active.compare(a, b) * flip);
  }, [items, active, dir]);

  return { items: sorted, id, dir, options, setId, setDir, toggleDir, active };
}
