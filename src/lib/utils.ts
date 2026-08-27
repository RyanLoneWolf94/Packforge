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
 * Trigger a download for a file record. Opens its URL in a new tab when one is
 * set; otherwise tells the user storage isn't connected yet — no dead `#` link.
 */
export function downloadFile(file: { name: string; url?: string }) {
  if (file.url) {
    window.open(file.url, '_blank', 'noopener,noreferrer');
    return;
  }
  toast.info(`“${file.name}” will download once file storage is connected.`);
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
