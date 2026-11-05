import { MagnifyingGlass, X } from '@phosphor-icons/react';
import { Card, Input, Select } from '@/src/components/ui';
import SortControl from '@/src/components/SortControl';
import { cn } from '@/src/lib/utils';
import type { SortState } from '@/src/lib/useSort';

/**
 * The search / filter / sort bar every list view sits under.
 *
 * One component so the controls land in the same order and read the same way
 * on every page: search first, then the narrowing filters, then sort. Pages
 * own their state; this only arranges it.
 */

export interface FilterSpec {
  id: string;
  /** Shown as the "all" option, e.g. "All statuses". */
  allLabel: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}

export default function ListToolbar<T>({
  query,
  onQuery,
  placeholder = 'Search…',
  filters = [],
  sort,
  /** Shown on the right, e.g. a result count or an extra toggle. */
  trailing,
  className,
}: {
  query?: string;
  onQuery?: (value: string) => void;
  placeholder?: string;
  filters?: FilterSpec[];
  sort?: SortState<T>;
  trailing?: React.ReactNode;
  className?: string;
}) {
  const active = filters.filter((f) => f.value !== 'all').length + (query?.trim() ? 1 : 0);

  const clearAll = () => {
    onQuery?.('');
    filters.forEach((f) => f.onChange('all'));
  };

  return (
    <Card className={cn('p-4 flex gap-3 flex-wrap items-center', className)}>
      {onQuery ? (
        <div className="relative flex-1 min-w-[220px]">
          <MagnifyingGlass
            size={15}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none"
          />
          <Input
            value={query ?? ''}
            onChange={(e) => onQuery(e.target.value)}
            placeholder={placeholder}
            className="pl-10"
          />
        </div>
      ) : null}

      {filters.map((filter) => (
        <Select
          key={filter.id}
          value={filter.value}
          onChange={(e) => filter.onChange(e.target.value)}
          aria-label={filter.allLabel}
          className="w-auto"
        >
          <option value="all">{filter.allLabel}</option>
          {filter.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      ))}

      {sort ? <SortControl sort={sort} /> : null}

      {/* Only offered once something is actually narrowed, so it isn't a
          permanently dead control. */}
      {active > 0 ? (
        <button
          onClick={clearAll}
          className="inline-flex items-center gap-1 text-[12px] font-bold text-ink-faint hover:text-ink transition-colors"
        >
          <X size={12} /> Clear
        </button>
      ) : null}

      {trailing ? <div className="ml-auto flex items-center gap-3">{trailing}</div> : null}
    </Card>
  );
}
