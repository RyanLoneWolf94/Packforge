import type { Expense, Invoice, Quote, TimeEntry } from '../types';

/**
 * Money derivations. Totals are computed from their line items rather than
 * stored, so a quote can't disagree with the milestones printed beneath it.
 */

export function quoteTotal(quote: Quote): number {
  return quote.milestones.reduce(
    (sum, milestone) => sum + milestone.tasks.reduce((s, task) => s + task.price, 0),
    0,
  );
}

/** Invoiced but not yet settled. Drafts and cancellations don't count. */
export function outstandingTotal(invoices: Invoice[]): number {
  return invoices
    .filter((i) => i.status === 'sent' || i.status === 'overdue' || i.status === 'partially-paid')
    .reduce((sum, i) => sum + i.amount, 0);
}

export function paidTotal(invoices: Invoice[]): number {
  return invoices.filter((i) => i.status === 'paid').reduce((sum, i) => sum + i.amount, 0);
}

export function expenseTotal(expenses: Expense[]): number {
  return expenses.reduce((sum, e) => sum + e.amount, 0);
}

/**
 * An invoice is overdue whenever its due date has passed and it hasn't been
 * settled — regardless of the status someone last typed in. Used to reconcile
 * stored status against the calendar.
 */
export function isOverdue(invoice: Invoice, now: Date = new Date()): boolean {
  if (invoice.status === 'paid' || invoice.status === 'cancelled' || invoice.status === 'draft') {
    return false;
  }
  return new Date(invoice.dueDate).getTime() < now.getTime();
}

export function trackedHours(entries: TimeEntry[]): number {
  return entries.reduce((sum, e) => sum + e.seconds, 0) / 3600;
}

/** "2h 45m" — compact enough for table cells. */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  if (hours === 0) return `${minutes}m`;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}
