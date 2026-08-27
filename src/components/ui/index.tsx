import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import { useEffect, type ComponentType, type ReactNode } from 'react';
import { cn } from '@/src/lib/utils';

/**
 * Shared primitives. Every page previously hand-rolled its own modal shell,
 * stat card and orange button; these consolidate those so a brand change lands
 * in one place instead of twenty.
 */

/* ------------------------------- Button ------------------------------- */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'purple';
type ButtonSize = 'sm' | 'md';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-orange text-white hover:bg-orange-deep shadow-sm',
  purple: 'bg-purple text-white hover:bg-purple-deep shadow-sm',
  secondary: 'bg-surface text-ink border border-line hover:bg-surface-2',
  ghost: 'text-ink-soft hover:text-ink hover:bg-surface-2',
  danger: 'bg-red text-white hover:opacity-90 shadow-sm',
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs gap-1.5',
  md: 'px-4 py-2.5 text-sm gap-2',
};

export function Button({
  variant = 'primary',
  size = 'md',
  icon: Icon,
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ComponentType<{ size?: number | string }>;
}) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-lg font-bold transition-colors',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className,
      )}
      {...props}
    >
      {Icon ? <Icon size={size === 'sm' ? 14 : 16} /> : null}
      {children}
    </button>
  );
}

/* -------------------------------- Card -------------------------------- */

export function Card({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'bg-surface border border-line rounded-[14px] shadow-sm',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/* ----------------------------- PageHeader ----------------------------- */

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4 flex-wrap mb-6">
      <div>
        <h1 className="disp text-2xl font-extrabold text-ink">{title}</h1>
        {subtitle ? <p className="text-sm text-ink-soft mt-1">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/* ------------------------------ StatCard ------------------------------ */

const STAT_TONES = {
  orange: 'bg-orange-dim text-orange',
  purple: 'bg-purple-dim text-purple',
  gold: 'bg-gold-dim text-gold-deep',
  red: 'bg-red-dim text-red',
  positive: 'bg-positive-dim text-positive',
  neutral: 'bg-surface-2 text-ink-soft',
} as const;

export function StatCard({
  icon: Icon,
  value,
  label,
  tone = 'neutral',
  hint,
}: {
  icon: ComponentType<{ size?: number | string; strokeWidth?: number }>;
  value: ReactNode;
  label: string;
  tone?: keyof typeof STAT_TONES;
  hint?: string;
}) {
  return (
    <Card className="p-6 flex items-center gap-5">
      <div
        className={cn(
          'w-12 h-12 rounded-xl flex items-center justify-center shrink-0',
          STAT_TONES[tone],
        )}
      >
        <Icon size={22} strokeWidth={2.5} />
      </div>
      <div className="min-w-0">
        <h3 className="text-3xl font-extrabold text-ink tracking-tight leading-none mb-1">
          {value}
        </h3>
        <p className="text-[10px] font-bold text-ink-faint uppercase tracking-widest whitespace-nowrap">
          {label}
        </p>
        {hint ? <p className="text-[11px] text-ink-soft mt-1">{hint}</p> : null}
      </div>
    </Card>
  );
}

/* ----------------------------- StatusPill ----------------------------- */

const PILL_TONES = {
  active: 'bg-purple text-white',
  done: 'bg-gold-dim text-gold-deep',
  upcoming: 'bg-surface-2 text-ink-soft',
  positive: 'bg-positive-dim text-positive',
  warning: 'bg-gold-dim text-gold-deep',
  danger: 'bg-red-dim text-red',
  neutral: 'bg-surface-2 text-ink-soft',
  brand: 'bg-orange text-white',
} as const;

export function StatusPill({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: keyof typeof PILL_TONES;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1 rounded-full',
        'text-[10.5px] font-bold uppercase tracking-wider',
        PILL_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ------------------------------- Meta pill ---------------------------- */

export function MetaPill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-surface-2 text-ink-soft border border-line">
      {children}
    </span>
  );
}

/* ----------------------------- ProgressBar ---------------------------- */

export function ProgressBar({
  value,
  tone = 'orange',
  className,
}: {
  value: number;
  tone?: 'orange' | 'purple' | 'gold';
  className?: string;
}) {
  const fill = { orange: 'bg-orange', purple: 'bg-purple', gold: 'bg-gold' }[tone];
  return (
    <div className={cn('h-2 w-full bg-surface-2 rounded-full overflow-hidden', className)}>
      <div
        className={cn('h-full rounded-full transition-[width] duration-700 ease-out', fill)}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

/* ---------------------------- ProgressRing ---------------------------- */

export function ProgressRing({
  value,
  size = 84,
  stroke = 9,
  color = 'var(--color-purple)',
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(100, Math.max(0, value)) / 100);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-surface-2)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <div
        className="absolute inset-0 flex items-center justify-center font-extrabold text-ink"
        style={{ fontSize: size * 0.24 }}
      >
        {Math.round(value)}%
      </div>
    </div>
  );
}

/* ------------------------------- Modal -------------------------------- */

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = 'max-w-md',
  /** Blocks backdrop + escape dismissal while a submit is mid-flight. */
  busy = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
  busy?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !busy && onClose()}
            className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            className={cn(
              'relative bg-surface rounded-[14px] shadow-xl border border-line',
              'w-full flex flex-col max-h-[85vh] overflow-hidden',
              width,
            )}
          >
            <div className="px-6 py-4 border-b border-line flex items-start justify-between gap-4">
              <div>
                <h3 className="disp font-extrabold text-lg text-ink">{title}</h3>
                {subtitle ? <p className="text-xs text-ink-soft mt-0.5">{subtitle}</p> : null}
              </div>
              <button
                onClick={onClose}
                disabled={busy}
                aria-label="Close"
                className="p-2 -mr-2 -mt-1 text-ink-faint hover:text-ink hover:bg-surface-2 rounded-full transition-colors disabled:opacity-40"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">{children}</div>

            {footer ? (
              <div className="px-6 py-4 bg-surface-2 border-t border-line flex justify-end gap-3">
                {footer}
              </div>
            ) : null}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

/* ----------------------------- Form fields ---------------------------- */

const FIELD_CLASS =
  'w-full px-4 py-2 bg-surface border border-line rounded-lg text-sm text-ink ' +
  'outline-none transition-shadow focus:border-orange focus:ring-2 focus:ring-orange/20 ' +
  'placeholder:text-ink-faint';

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-bold text-ink mb-1">{label}</span>
      {children}
      {hint ? <span className="block text-[11px] text-ink-soft mt-1">{hint}</span> : null}
    </label>
  );
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(FIELD_CLASS, className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(FIELD_CLASS, 'resize-none', className)} {...props} />;
}

export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(FIELD_CLASS, className)} {...props}>
      {children}
    </select>
  );
}

/* ----------------------------- EmptyState ----------------------------- */

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: ComponentType<{ size?: number | string }>;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      <div className="w-16 h-16 rounded-full bg-surface-2 text-ink-faint flex items-center justify-center mb-4">
        <Icon size={30} />
      </div>
      <p className="font-bold text-ink">{title}</p>
      {description ? (
        <p className="text-sm text-ink-soft mt-1 max-w-sm">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
