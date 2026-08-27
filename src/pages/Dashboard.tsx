import {
  AlertTriangle,
  ArrowUpRight,
  CalendarClock,
  DollarSign,
  FolderKanban,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  Card,
  EmptyState,
  PageHeader,
  ProgressBar,
  StatCard,
  StatusPill,
} from '@/src/components/ui';
import { cn, formatCurrency, formatDate, relativeDays } from '@/src/lib/utils';
import {
  daysUntil,
  openActionItems,
  projectBudget,
  projectEarned,
  projectHealth,
  projectProgress,
} from '@/src/lib/tracker';
import { useStudio } from '@/src/store/StudioStore';

const HEALTH_TONE = {
  'on-track': 'positive',
  'at-risk': 'warning',
  overdue: 'danger',
  complete: 'done',
} as const;

const HEALTH_LABEL = {
  'on-track': 'On Track',
  'at-risk': 'At Risk',
  overdue: 'Overdue',
  complete: 'Complete',
} as const;

export default function Dashboard() {
  const { projects, clients, invoices, clientFor } = useStudio();

  const live = projects.filter((p) => p.status !== 'completed' && p.status !== 'archived');

  // Every figure below is derived from tracker state rather than stored, so the
  // dashboard can't drift from what the client sees in their portal.
  const pipelineValue = live.reduce((sum, p) => sum + projectBudget(p), 0);
  const earned = live.reduce((sum, p) => sum + projectEarned(p), 0);
  const outstanding = invoices
    .filter((i) => i.status === 'sent' || i.status === 'overdue')
    .reduce((sum, i) => sum + i.amount, 0);
  const overdueCount = invoices.filter((i) => i.status === 'overdue').length;

  const blockers = openActionItems(live);
  const atRisk = live.filter((p) => projectHealth(p) !== 'on-track');

  const upcoming = [...live]
    .sort(
      (a, b) =>
        new Date(a.targetDelivery).getTime() - new Date(b.targetDelivery).getTime(),
    )
    .slice(0, 4);

  return (
    <div className="max-w-[1400px] space-y-6">
      <PageHeader
        title="Studio Dashboard"
        subtitle="Live rollup across every active engagement."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
        <StatCard
          icon={FolderKanban}
          tone="purple"
          value={live.length}
          label="Active Projects"
          hint={`${projects.length} total in the studio`}
        />
        <StatCard
          icon={DollarSign}
          tone="orange"
          value={formatCurrency(pipelineValue)}
          label="Committed Pipeline"
          hint={`${formatCurrency(Math.round(earned))} earned to date`}
        />
        <StatCard
          icon={CalendarClock}
          tone={overdueCount > 0 ? 'red' : 'gold'}
          value={formatCurrency(outstanding)}
          label="Outstanding Invoices"
          hint={overdueCount > 0 ? `${overdueCount} overdue` : 'Nothing overdue'}
        />
        <StatCard
          icon={Users}
          tone="neutral"
          value={clients.length}
          label="Active Clients"
          hint={`${blockers.length} waiting on client input`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Operational status */}
        <Card className="lg:col-span-2 p-7">
          <div className="flex items-baseline justify-between gap-3 mb-6">
            <h2 className="disp text-lg font-extrabold text-ink">Operational Status</h2>
            <Link
              to="/admin/tracker"
              className="text-xs font-bold text-orange hover:text-orange-deep inline-flex items-center gap-1"
            >
              Open tracker <ArrowUpRight size={13} />
            </Link>
          </div>

          {live.length === 0 ? (
            <EmptyState
              icon={FolderKanban}
              title="No active projects"
              description="Create a project to start tracking phases and deliverables."
            />
          ) : (
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-left min-w-[560px]">
                <thead>
                  <tr className="text-[10px] text-ink-faint font-bold uppercase tracking-widest">
                    <th className="pb-4 font-bold">Project</th>
                    <th className="pb-4 font-bold">Client</th>
                    <th className="pb-4 font-bold w-44">Progress</th>
                    <th className="pb-4 font-bold text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {live.map((project) => {
                    const { pct, done, total } = projectProgress(project);
                    const health = projectHealth(project);
                    return (
                      <tr key={project.id} className="group border-t border-line">
                        <td className="py-4 pr-4">
                          <Link
                            to={`/admin/tracker/${project.id}`}
                            className="text-[13px] font-bold text-ink group-hover:text-orange transition-colors"
                          >
                            {project.name}
                          </Link>
                          <div className="text-[11px] text-ink-faint mt-0.5">
                            {project.packageName} · due {relativeDays(project.targetDelivery)}
                          </div>
                        </td>
                        <td className="py-4 pr-4 text-[13px] text-ink-soft">
                          {clientFor(project)?.name ?? '—'}
                        </td>
                        <td className="py-4 pr-4">
                          <div className="flex items-center gap-3">
                            <ProgressBar value={pct} className="flex-1" />
                            <span className="text-[11px] font-bold text-ink-faint w-14 shrink-0">
                              {done}/{total}
                            </span>
                          </div>
                        </td>
                        <td className="py-4 text-right">
                          <StatusPill tone={HEALTH_TONE[health]}>
                            {HEALTH_LABEL[health]}
                          </StatusPill>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Needs attention */}
        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="disp text-base font-extrabold text-ink mb-4">Needs Attention</h2>

            {atRisk.length === 0 && blockers.length === 0 ? (
              <p className="text-sm text-ink-soft py-4">
                Everything is on track. No slipping projects and nothing waiting on a client.
              </p>
            ) : (
              <div className="space-y-3">
                {atRisk.map((project) => (
                  <Link
                    key={project.id}
                    to={`/admin/tracker/${project.id}`}
                    className="flex gap-3 items-start p-3 rounded-lg bg-surface-2 hover:bg-orange-dim transition-colors"
                  >
                    <AlertTriangle
                      size={15}
                      className={cn(
                        'shrink-0 mt-0.5',
                        projectHealth(project) === 'overdue' ? 'text-red' : 'text-gold-deep',
                      )}
                    />
                    <div className="min-w-0">
                      <div className="text-[13px] font-bold text-ink">{project.name}</div>
                      <div className="text-[11.5px] text-ink-soft">
                        {HEALTH_LABEL[projectHealth(project)]} · target{' '}
                        {formatDate(project.targetDelivery)}
                      </div>
                    </div>
                  </Link>
                ))}

                {blockers.slice(0, 4).map((item) => (
                  <Link
                    key={item.id}
                    to={`/admin/tracker/${item.project.id}`}
                    className="flex gap-3 items-start p-3 rounded-lg bg-surface-2 hover:bg-orange-dim transition-colors"
                  >
                    <span className="w-2 h-2 rounded-full bg-red shrink-0 mt-1.5" />
                    <div className="min-w-0">
                      <div className="text-[13px] font-bold text-ink">{item.title}</div>
                      <div className="text-[11.5px] text-ink-soft">
                        Waiting on {item.project.name}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-6">
            <h2 className="disp text-base font-extrabold text-ink mb-4">Next Deadlines</h2>
            <div className="space-y-3">
              {upcoming.map((project) => {
                const days = daysUntil(project.targetDelivery);
                return (
                  <div key={project.id} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[13px] font-bold text-ink truncate">
                        {project.name}
                      </div>
                      <div className="text-[11.5px] text-ink-soft">
                        {formatDate(project.targetDelivery)}
                      </div>
                    </div>
                    <span
                      className={cn(
                        'text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0',
                        days < 0
                          ? 'bg-red-dim text-red'
                          : days <= 7
                            ? 'bg-gold-dim text-gold-deep'
                            : 'bg-surface-2 text-ink-soft',
                      )}
                    >
                      {days < 0 ? `${Math.abs(days)}d over` : `${days}d`}
                    </span>
                  </div>
                );
              })}
              {upcoming.length === 0 ? (
                <p className="text-sm text-ink-soft">No scheduled deliveries.</p>
              ) : null}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
