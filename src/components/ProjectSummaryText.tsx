import { useState } from 'react';
import { cn } from '@/src/lib/utils';

/**
 * A project summary, clamped.
 *
 * Scope paragraphs run long — one retainer's is 749 characters against another
 * project's 44 — and unclamped they swamp whatever follows. Short ones are
 * left alone entirely so nothing gains a pointless "Show more".
 */
export default function ProjectSummaryText({
  text,
  className,
  lines = 2,
}: {
  text: string;
  className?: string;
  lines?: 2 | 3;
}) {
  const [expanded, setExpanded] = useState(false);
  const long = text.length > 180;

  if (!text) return null;

  return (
    <div className={cn('text-sm text-ink-soft max-w-2xl', className)}>
      <p className={cn(!expanded && long && (lines === 3 ? 'line-clamp-3' : 'line-clamp-2'))}>
        {text}
      </p>
      {long ? (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-[12.5px] font-bold text-orange hover:text-orange-deep"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      ) : null}
    </div>
  );
}
