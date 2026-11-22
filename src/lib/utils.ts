import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { toast } from 'sonner';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency: string = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    // Whole-dollar figures dominate the studio's pricing; cents only show when real.
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date));
}

/** "Aug 23" — for dense tables where the year is implied. */
export function formatShortDate(date: string | Date) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(
    new Date(date),
  );
}

/** Up to two uppercase initials for avatar chips. */
export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

/**
 * Open a file record at the link it lives behind. Callers only render the
 * control when a link exists, so the guard is a backstop, not a feature.
 */
export function downloadFile(file: { name: string; url?: string }) {
  if (file.url) {
    window.open(file.url, '_blank', 'noopener,noreferrer');
    return;
  }
  toast.error(`“${file.name}” has no link attached.`);
}

/** "in 6 days" / "3 days ago" / "today", relative to now. */
export function relativeDays(date: string | Date, now: Date = new Date()) {
  const days = Math.round(
    (new Date(date).getTime() - now.getTime()) / 86_400_000,
  );
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days === -1) return 'yesterday';
  return days > 0 ? `in ${days} days` : `${Math.abs(days)} days ago`;
}

/**
 * The path to a client's portal: `/portal/{name-slug}/{token}`.
 *
 * The slug is decoration — it makes a link recognisable as that client's
 * without being what grants access. Only the token is checked, server-side,
 * so the slug can be stale or wrong and the link still works. Never derive a
 * token from the name: that was the bug this shape replaced.
 */
export function portalPath(client: { name: string; portalToken: string }): string {
  const slug =
    client.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'client';
  return `/portal/${slug}/${client.portalToken}`;
}
