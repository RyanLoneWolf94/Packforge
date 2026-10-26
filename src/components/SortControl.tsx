import { ArrowDown, ArrowUp } from '@phosphor-icons/react';
import { cn } from '@/src/lib/utils';
import type { SortState } from '@/src/lib/useSort';

/**
 * The sort picker used by every list view: a field selector plus a direction
 * toggle. Compact by default so it sits in a toolbar next to search and
 * filters without taking the eye.
 */

export default function SortControl<T>({
  sort,
  className,
  label = 'Sort',
}: {
  sort: SortState<T>;
  className?: string;
  /** Hide with an empty string where the toolbar is already crowded. */
  label?: string;
}) {
  if (sort.options.length === 0) return null;

  const natural = sort.active?.natural ?? 'asc';
  // "Ascending" is meaningless to read at a glance; say what it does to this
  // particular field instead.
  const directionHint =
    sort.dir === natural ? naturalHint(sort.active?.id) : reversedHint(sort.active?.id);

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      {label ? (
        <span className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">
          {label}
        </span>
      ) : null}

      <select
        value={sort.id}
        onChange={(e) => sort.setId(e.target.value)}
        aria-label="Sort by"
        className={cn(
          'px-3 py-1.5 rounded-lg border border-line bg-surface',
          'text-[12.5px] font-semibold text-ink outline-none cursor-pointer',
          'focus:border-orange transition-colors',
        )}
      >
        {sort.options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={sort.toggleDir}
        aria-label={`Sort direction: ${directionHint}`}
        title={directionHint}
        className={cn(
          'p-1.5 rounded-lg border border-line bg-surface text-ink-soft',
          'hover:text-ink hover:border-ink-faint transition-colors',
        )}
      >
        {sort.dir === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
      </button>
    </div>
  );
}

const naturalHint = (id?: string) => hintFor(id, true);
const reversedHint = (id?: string) => hintFor(id, false);

function hintFor(id: string | undefined, natural: boolean): string {
  const kind = (id ?? '').toLowerCase();
  if (kind.includes('date') || kind.includes('due') || kind.includes('created')) {
    return natural ? 'Newest first' : 'Oldest first';
  }
  if (
    kind.includes('amount') ||
    kind.includes('value') ||
    kind.includes('total') ||
    kind.includes('price') ||
    kind.includes('budget') ||
    kind.includes('size') ||
    kind.includes('progress')
  ) {
    return natural ? 'Highest first' : 'Lowest first';
  }
  return natural ? 'A to Z' : 'Z to A';
}
