import { cn } from '@/src/lib/utils';

/**
 * The LoneWolf icon set.
 *
 * Drawn to the house rule rather than pulled from a library: a solid brand
 * circle with a white glyph inside, flat, geometric, heavy even strokes and
 * square terminals. Generic icon packs are what make a site read as
 * template-built, which is the whole reason these exist.
 *
 * Everything is white-on-brand — strokes and solid shapes only, never a
 * knocked-out hole, since a hole would have to know the badge colour and
 * would vanish the moment the glyph were used bare. Every glyph sits on a
 * 24×24 grid with a 2.4 stroke and square ends, so the set stays coherent at
 * any size. `badge={false}` gives the bare glyph in currentColor.
 */

export type BrandIconName =
  | 'overview'
  | 'progress'
  | 'invoice'
  | 'quote'
  | 'files'
  | 'contract'
  | 'package'
  | 'download'
  | 'calendar'
  | 'check'
  | 'briefcase'
  | 'arrow-right';

export type BrandIconTone = 'orange' | 'purple' | 'night' | 'muted';

const TONE_FILL: Record<BrandIconTone, string> = {
  orange: 'bg-orange text-white',
  purple: 'bg-purple text-white',
  night: 'bg-night text-white',
  muted: 'bg-surface-2 text-ink-soft',
};

/* --------------------------------- glyphs -------------------------------- */

/** The geometry that makes these a set rather than twelve drawings. */
const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.4,
  strokeLinecap: 'butt',
  strokeLinejoin: 'miter',
} as const;

const solid = { fill: 'currentColor' } as const;

const GLYPHS: Record<BrandIconName, React.ReactNode> = {
  /* Four blocks — a dashboard, legible at 16px. */
  overview: (
    <>
      <rect x="3.5" y="3.5" width="7.2" height="7.2" {...solid} />
      <rect x="13.3" y="3.5" width="7.2" height="7.2" {...solid} />
      <rect x="3.5" y="13.3" width="7.2" height="7.2" {...solid} />
      <rect x="13.3" y="13.3" width="7.2" height="7.2" {...solid} />
    </>
  ),

  /* Ascending bars: work moving, not a speedometer. */
  progress: (
    <>
      <rect x="3.4" y="14" width="4.6" height="7" {...solid} />
      <rect x="9.7" y="9" width="4.6" height="12" {...solid} />
      <rect x="16" y="3.4" width="4.6" height="17.6" {...solid} />
    </>
  ),

  /* A bill: sheet with a torn foot and two rules. */
  invoice: (
    <>
      <path d="M5.2 3.4h13.6v17.2l-3.4-2-3.4 2-3.4-2-3.4 2z" {...stroke} />
      <path d="M8.8 8.6h6.4M8.8 12.4h6.4" {...stroke} />
    </>
  ),

  /* A quote: sheet with a folded corner. */
  quote: (
    <>
      <path d="M4.8 3.4h8.6l5.8 5.8v11.4H4.8z" {...stroke} />
      <path d="M13.4 3.4v5.8h5.8" {...stroke} />
      <path d="M8.2 13.6h7.6M8.2 17.2h4.8" {...stroke} />
    </>
  ),

  /* A folder, squared off rather than rounded. */
  files: <path d="M3.2 5.2h6.8l2.2 3.2h8.6v12.4H3.2z" {...solid} />,

  /* An agreement: sheet, rules, and a signed line. */
  contract: (
    <>
      <path d="M4.8 3.4h14.4v17.2H4.8z" {...stroke} />
      <path d="M8.2 8.4h7.6M8.2 12h7.6" {...stroke} />
      <path d="M8.2 16.4c1.5-1.8 3 1.8 4.5 0s3.1-1.2 3.1-1.2" {...stroke} />
    </>
  ),

  /* A box, seen straight on with its seams. */
  package: (
    <>
      <path d="M3.4 7.3 12 3.1l8.6 4.2v9.4L12 20.9l-8.6-4.2z" {...stroke} />
      <path d="M3.6 7.4 12 11.6l8.4-4.2M12 11.6v9.1" {...stroke} />
    </>
  ),

  /* The reference glyph: shaft, solid head, open tray. */
  download: (
    <>
      <rect x="10.7" y="3.2" width="2.6" height="8.4" {...solid} />
      <path d="M7.1 10.2h9.8L12 16.6z" {...solid} />
      <path d="M5.3 12.8v7h13.4v-7" {...stroke} />
    </>
  ),

  calendar: (
    <>
      <path d="M3.5 5.6h17v15.1h-17z" {...stroke} />
      <path d="M3.5 10.4h17" {...stroke} />
      <rect x="7" y="2.8" width="2.6" height="4.2" {...solid} />
      <rect x="14.4" y="2.8" width="2.6" height="4.2" {...solid} />
    </>
  ),

  check: <path d="M4 12.4 9.6 18 20 6.8" {...stroke} strokeWidth="3.2" />,

  briefcase: (
    <>
      <path d="M3 7.6h18v13H3z" {...stroke} />
      <path d="M8.6 7.6V4.4h6.8v3.2" {...stroke} />
      <path d="M3 13.2h18" {...stroke} />
    </>
  ),

  'arrow-right': (
    <>
      <rect x="3.2" y="10.7" width="11.4" height="2.6" {...solid} />
      <path d="M13.2 6.6 20.6 12l-7.4 5.4z" {...solid} />
    </>
  ),
};

/* --------------------------------- render -------------------------------- */

export default function BrandIcon({
  name,
  tone = 'orange',
  size = 40,
  badge = true,
  className,
}: {
  name: BrandIconName;
  tone?: BrandIconTone;
  /** Diameter of the badge, or the glyph's box when `badge` is false. */
  size?: number;
  badge?: boolean;
  className?: string;
}) {
  const glyph = (
    <svg
      viewBox="0 0 24 24"
      width={badge ? Math.round(size * 0.52) : size}
      height={badge ? Math.round(size * 0.52) : size}
      aria-hidden="true"
      focusable="false"
      shapeRendering="geometricPrecision"
    >
      {GLYPHS[name]}
    </svg>
  );

  if (!badge) return <span className={cn('inline-flex', className)}>{glyph}</span>;

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full shrink-0',
        TONE_FILL[tone],
        className,
      )}
      style={{ width: size, height: size }}
    >
      {glyph}
    </span>
  );
}
