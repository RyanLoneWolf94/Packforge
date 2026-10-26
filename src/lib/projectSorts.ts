import { byDate, byNumber, byRank, byText, type SortOption } from '@/src/lib/useSort';
import { projectBudget, projectProgress } from '@/src/lib/tracker';
import { PROJECT_STATUSES, type Project } from '@/src/types';

/**
 * Sort options for a project list, shared by the Projects board and the
 * tracker rail so the two orderings cannot disagree.
 *
 * Value and progress are derived rather than stored, exactly as they are
 * everywhere else, so sorting by them can never fall out of step with what the
 * card displays.
 */
export const projectSortOptions = (
  clientFor: (item: { clientId?: string }) => { name: string } | undefined,
): SortOption<Project>[] => [
  { id: 'targetDelivery', label: 'Delivery date', compare: byDate((p) => p.targetDelivery), natural: 'desc' },
  { id: 'startDate', label: 'Start date', compare: byDate((p) => p.startDate), natural: 'desc' },
  { id: 'name', label: 'Name', compare: byText((p) => p.name) },
  { id: 'client', label: 'Client', compare: byText((p) => clientFor(p)?.name) },
  { id: 'status', label: 'Status', compare: byRank(PROJECT_STATUSES, (p) => p.status) },
  { id: 'value', label: 'Value', compare: byNumber((p) => projectBudget(p)), natural: 'desc' },
  {
    id: 'progress',
    label: 'Progress',
    compare: byNumber((p) => projectProgress(p).pct),
    natural: 'desc',
  },
];
