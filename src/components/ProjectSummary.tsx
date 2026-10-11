import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CaretDown, Receipt } from '@phosphor-icons/react';
import { Card, ProgressBar, StatusPill } from '@/src/components/ui';
import { cn, formatCurrency, formatDate, relativeDays } from '@/src/lib/utils';
import { projectBudget, projectEarned, projectProgress } from '@/src/lib/tracker';
import { isOverdue } from '@/src/lib/finance';
import { useStudio } from '@/src/store/StudioStore';
import type { InvoiceStatus, Project } from '@/src/types';

/**
 * Everything about an engagement that isn't a task: who it's for, when it runs,
 * what it's worth and what's actually been billed.
 *
 * The money here is derived, never stored — budget is the sum of phase budgets,
 * earned is the share of that covered by completed deliverables, and billing
 * comes from the invoices attached to this project.
 */

const INVOICE_TONE: Record<InvoiceStatus, 'positive' | 'danger' | 'warning' | 'neutral'> = {
  paid: 'positive',
  overdue: 'danger',
  sent: 'warning',
  'partially-paid': 'warning',
  draft: 'neutral',
  cancelled: 'neutral',
};

function Metric({
  label,
  value,
  hint,
  tone = 'ink',
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'ink' | 'purple' | 'positive' | 'gold' | 'red';
}) {
  const toneClass = {
    ink: 'text-ink',
    purple: 'text-purple',
    positive: 'text-positive',
    gold: 'text-gold-deep',
    red: 'text-red',
  }[tone];
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-bold uppercase tracking-widest text-ink-faint">{label}</div>
      <div className={cn('text-xl font-extrabold leading-tight mt-0.5 truncate', toneClass)}>
        {value}
      </div>
      {hint ? <div className="text-[11px] text-ink-soft mt-0.5 truncate">{hint}</div> : null}
    </div>
  );
}

export default function ProjectSummary({ project }: { project: Project }) {
  const { invoices, clientFor, projectTasks } = useStudio();
  const [open, setOpen] = useState(true);

  const client = clientFor(project);
  const budget = projectBudget(project);
  const earned = projectEarned(project);
  const progress = projectProgress(project);

  const projectInvoices = invoices
    .filter((i) => i.projectId === project.id)
    .sort((a, b) => b.issueDate.localeCompare(a.issueDate));

  const billed = projectInvoices
    .filter((i) => i.status !== 'draft' && i.status !== 'cancelled')
    .reduce((s, i) => s + i.amount, 0);
  const collected = projectInvoices
    .filter((i) => i.status === 'paid')
    .reduce((s, i) => s + i.amount, 0);
  const outstanding = billed - collected;

  const tasks = projectTasks.filter((t) => t.projectId === project.id);
  const tasksDone = tasks.filter((t) => t.lane === 'Done').length;

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-5 py-3 hover:bg-surface-2 transition-colors text-left"
      >
        <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-ink-faint">
          <CaretDown
            size={14}
            className={cn('transition-transform', !open && '-rotate-90')}
          />
          Engagement overview
        </span>
        <span className="text-[11px] text-ink-soft">
          {formatCurrency(budget)} · {progress.pct}% complete
        </span>
      </button>

      {open ? (
        <div className="border-t border-line">
          {/* Money and progress at a glance. */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 p-5">
            <Metric
              label="Engagement value"
              value={formatCurrency(budget)}
              hint={`${project.phases.length} phase${project.phases.length === 1 ? '' : 's'}`}
              tone="purple"
            />
            <Metric
              label="Earned to date"
              value={formatCurrency(earned)}
              hint={`${progress.done} of ${progress.total} deliverables`}
              tone="positive"
            />
            <Metric
              label="Invoiced"
              value={formatCurrency(billed)}
              hint={
                billed < budget
                  ? `${formatCurrency(budget - billed)} not yet billed`
                  : 'Fully invoiced'
              }
            />
            <Metric
              label="Outstanding"
              value={formatCurrency(outstanding)}
              hint={outstanding > 0 ? `${formatCurrency(collected)} collected` : 'All settled'}
              tone={outstanding > 0 ? 'gold' : 'positive'}
            />
          </div>

          <div className="px-5 pb-5">
            <ProgressBar value={progress.pct} tone="orange" className="h-2" />
          </div>

          <div className="grid md:grid-cols-2 gap-5 px-5 pb-5 border-t border-line pt-5">
            {/* Who, when, what. */}
            <div className="space-y-2.5 text-[13px]">
              <div className="flex gap-3">
                <span className="w-28 shrink-0 text-ink-faint">Client</span>
                {client ? (
                  <Link
                    to="/admin/clients"
                    className="font-bold text-ink hover:text-orange transition-colors"
                  >
                    {client.name}
                  </Link>
                ) : (
                  <span className="text-ink-soft">Unassigned</span>
                )}
              </div>
              <div className="flex gap-3">
                <span className="w-28 shrink-0 text-ink-faint">Reference</span>
                <span className="font-mono text-ink-soft">{project.ref || '—'}</span>
              </div>
              <div className="flex gap-3">
                <span className="w-28 shrink-0 text-ink-faint">Engagement</span>
                <span className="text-ink-soft">{project.packageName || '—'}</span>
              </div>
              <div className="flex gap-3">
                <span className="w-28 shrink-0 text-ink-faint">Started</span>
                <span className="text-ink-soft">
                  {project.startDate ? formatDate(project.startDate) : '—'}
                </span>
              </div>
              <div className="flex gap-3">
                <span className="w-28 shrink-0 text-ink-faint">Target</span>
                <span className="text-ink-soft">
                  {project.targetDelivery ? (
                    <>
                      {formatDate(project.targetDelivery)}
                      <span
                        className={cn(
                          'ml-2 text-[11px] font-bold',
                          project.status !== 'completed' &&
                            new Date(project.targetDelivery) < new Date()
                            ? 'text-red'
                            : 'text-ink-faint',
                        )}
                      >
                        {relativeDays(project.targetDelivery)}
                      </span>
                    </>
                  ) : (
                    '—'
                  )}
                </span>
              </div>
              <div className="flex gap-3">
                <span className="w-28 shrink-0 text-ink-faint">Board</span>
                <span className="text-ink-soft">
                  {tasks.length === 0
                    ? 'No tasks yet'
                    : `${tasksDone} of ${tasks.length} tasks done`}
                </span>
              </div>
            </div>

            {/* Scope + billing. */}
            <div className="space-y-4">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-ink-faint mb-1.5">
                  Scope
                </div>
                <p className="text-[13px] text-ink-soft leading-relaxed">
                  {project.summary || 'No summary yet — add one when you edit the project.'}
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-ink-faint">
                    Invoices
                  </span>
                  <Link
                    to="/admin/invoices"
                    className="text-[11px] font-bold text-orange hover:text-orange-deep"
                  >
                    Manage →
                  </Link>
                </div>
                {projectInvoices.length === 0 ? (
                  <p className="text-[13px] text-ink-soft flex items-center gap-1.5">
                    <Receipt size={14} className="text-ink-faint" /> Nothing invoiced yet.
                  </p>
                ) : (
                  <div className="space-y-1">
                    {projectInvoices.slice(0, 4).map((invoice) => (
                      <div
                        key={invoice.id}
                        className="flex items-center justify-between gap-3 text-[12.5px]"
                      >
                        <span className="font-mono text-ink-soft truncate">{invoice.number}</span>
                        <span className="flex items-center gap-2 shrink-0">
                          <span className="font-bold text-ink">
                            {formatCurrency(invoice.amount)}
                          </span>
                          <StatusPill
                            tone={
                              isOverdue(invoice) ? 'danger' : INVOICE_TONE[invoice.status]
                            }
                          >
                            {invoice.status.replace('-', ' ')}
                          </StatusPill>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
