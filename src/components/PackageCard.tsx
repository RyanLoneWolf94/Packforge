import { Check } from '@phosphor-icons/react';
import { cn, formatCurrency } from '@/src/lib/utils';
import type { PackageAccent } from '@/src/types';

/**
 * The pricing card a client actually reads.
 *
 * Shared by the admin catalogue and the client portal so what you design is
 * exactly what they see — no second implementation to drift.
 */

export interface PackageCardData {
  name: string;
  tagline?: string;
  price: number;
  period?: string;
  features: string[];
  badge?: string;
  accent: PackageAccent;
}

export default function PackageCard({
  pkg,
  cta,
  onSelect,
  disabled,
  selected,
  footer,
  className,
}: {
  pkg: PackageCardData;
  /** Button label. Omit to render the card with no action. */
  cta?: string;
  onSelect?: () => void;
  disabled?: boolean;
  selected?: boolean;
  /** Extra content under the button — admin controls, status notes. */
  footer?: React.ReactNode;
  className?: string;
}) {
  const featured = pkg.accent === 'featured';
  const outlined = pkg.accent === 'outlined';

  return (
    <div
      className={cn(
        'relative rounded-[18px] p-7 flex flex-col h-full transition-shadow',
        featured
          ? 'bg-purple text-white shadow-lg'
          : 'bg-surface border shadow-sm hover:shadow-md',
        !featured && (outlined || selected ? 'border-orange border-2' : 'border-line'),
        selected && featured && 'ring-2 ring-orange',
        className,
      )}
    >
      {pkg.badge ? (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-orange text-white text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">
          {pkg.badge}
        </span>
      ) : null}

      <h3
        className={cn(
          'disp text-sm font-extrabold uppercase tracking-wider',
          featured ? 'text-gold' : 'text-purple',
        )}
      >
        {pkg.name}
      </h3>

      <div className="mt-2 flex items-baseline gap-2">
        <span
          className={cn(
            'disp text-4xl font-extrabold tracking-tight',
            featured ? 'text-white' : 'text-ink',
          )}
        >
          {formatCurrency(pkg.price)}
        </span>
        {pkg.period ? (
          <span className={cn('text-[12px]', featured ? 'text-white/70' : 'text-ink-soft')}>
            {pkg.period}
          </span>
        ) : null}
      </div>

      {pkg.tagline ? (
        <p className={cn('text-[12.5px] mt-2', featured ? 'text-white/75' : 'text-ink-soft')}>
          {pkg.tagline}
        </p>
      ) : null}

      <ul className="mt-5 space-y-2.5 flex-1">
        {pkg.features.map((feature, i) => (
          <li key={`${feature}-${i}`} className="flex gap-2.5 items-start">
            <Check
              size={15}
              className={cn('mt-0.5 shrink-0', featured ? 'text-gold' : 'text-orange')}
            />
            <span
              className={cn(
                'text-[13.5px] leading-snug',
                featured ? 'text-white/90' : 'text-ink-soft',
              )}
            >
              {feature}
            </span>
          </li>
        ))}
      </ul>

      {cta ? (
        <button
          type="button"
          onClick={onSelect}
          disabled={disabled}
          className={cn(
            'mt-6 w-full py-3 rounded-full text-[14px] font-bold transition-colors',
            'disabled:opacity-60 disabled:cursor-not-allowed',
            selected
              ? 'bg-positive text-white'
              : 'bg-orange text-white hover:bg-orange-deep',
          )}
        >
          {cta}
        </button>
      ) : null}

      {footer ? <div className="mt-4">{footer}</div> : null}
    </div>
  );
}
