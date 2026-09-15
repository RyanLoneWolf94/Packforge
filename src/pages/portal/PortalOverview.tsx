import {
  ArrowRight,
  Briefcase,
  CalendarDays,
  Download,
  FileSignature,
  Receipt,
  ScrollText,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { ActionItems, TrackerSummary } from '@/src/components/tracker/PhaseTracker';
import { Card, EmptyState, MetaPill, StatCard, StatusPill } from '@/src/components/ui';
import { formatCurrency, formatDate, relativeDays } from '@/src/lib/utils';
import { currentPhase, projectBudget } from '@/src/lib/tracker';
import { useStudio } from '@/src/store/StudioStore';
import { usePortalClient } from './usePortalClient';

/**
 * The portal's landing page: a real dashboard. Progress is summarised here and
 * links through to the full tracker, alongside billing, paperwork and files —
 * so the tracker is one part of the client's view, not the whole of it.
 */
export default function PortalOverview() {
  const client = usePortalClient();
  const { projectsForClient, invoices, quotes, contracts, files } = useStudio();

  const projects = projectsForClient(client.id).filter((p) => p.status !== 'archived');
  const base = `/portal/${client.portalToken}`;

  const myInvoices = invoices.filter((i) => i.clientId === client.id && i.status !== 'draft');
  const outstanding = myInvoices
    .filter((i) => i.status === 'sent' || i.status === 'overdue' || i.status === 'partially-paid')
    .reduce((sum, i) => sum + i.amount, 0);
  const openQuotes = quotes.filter((q) => q.clientId === client.id && q.status === 'sent');
  const sharedFiles = files.filter((f) => f.clientId === client.id && f.sharedWithClient);
  const myContracts = contracts.filter((c) => c.clientId === client.id);

  const engagementValue = projects.reduce((sum, p) => sum + projectBudget(p), 0);

  return (
    <div className="space-y-9">
      {/* Welcome */}
      <section>
        <div className="flex items-center gap-2 text-[12.5px] font-bold uppercase tracking-wider text-purple mb-2.5">
          <span className="w-4 h-0.5 bg-orange inline-block" />
          Client Dashboard · Live
        </div>
        <h1 className="disp text-3xl lg:text-4xl font-extrabold text-ink leading-tight">
          {client.name}
        </h1>
        <p className="text-ink-soft font-medium mt-2">
          {client.location} — {client.industry} · Prepared for {client.contactName}
        </p>
      </section>

      {/* At a glance */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <StatCard
          icon={Briefcase}
          tone="purple"
          value={projects.length}
          label="Active Projects"
          hint={projects[0]?.packageName}
        />
        <StatCard
          icon={CalendarDays}
          tone="orange"
          value={formatCurrency(engagementValue)}
          label="Engagement Value"
        />
        <StatCard
          icon={Receipt}
          tone={outstanding > 0 ? 'gold' : 'neutral'}
          value={formatCurrency(outstanding)}
          label="Outstanding"
          hint={outstanding > 0 ? 'See Invoices' : 'Nothing due'}
        />
        <StatCard
          icon={Download}
          tone="neutral"
          value={sharedFiles.length}
          label="Files Shared"
        />
      </section>

      {/* Per-project progress summary */}
      {projects.length === 0 ? (
        <Card>
          <EmptyState
            icon={Briefcase}
            title="No active projects"
            description="Once your engagement kicks off, your phases and deliverables will appear here."
          />
        </Card>
      ) : (
        <section className="space-y-6">
          <SectionHead
            title="Where Things Stand"
            action={
              <Link
                to={`${base}/progress`}
                className="text-xs font-bold text-orange hover:text-orange-deep inline-flex items-center gap-1"
              >
                Full breakdown <ArrowRight size={13} />
              </Link>
            }
          />
          {projects.map((project) => {
            const phase = currentPhase(project);
            return (
              <div key={project.id} className="space-y-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <h3 className="disp text-xl font-extrabold text-ink">{project.name}</h3>
                    <p className="text-sm text-ink-soft mt-0.5 max-w-2xl">{project.summary}</p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <MetaPill>
                      <CalendarDays size={13} /> Target {formatDate(project.targetDelivery)}
                    </MetaPill>
                    <MetaPill>
                      Next up: <b className="text-ink">{phase?.name ?? 'Handover'}</b>
                    </MetaPill>
                  </div>
                </div>
                <TrackerSummary project={project} />
                <ActionItems project={project} mode="client" />
              </div>
            );
          })}
        </section>
      )}

      {/* Quick links into the rest of the portal */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <QuickCard
          to={`${base}/invoices`}
          icon={Receipt}
          title="Invoices"
          line={
            myInvoices.length === 0
              ? 'Nothing raised yet'
              : `${myInvoices.length} issued · ${formatCurrency(outstanding)} outstanding`
          }
        />
        <QuickCard
          to={`${base}/quotes`}
          icon={ScrollText}
          title="Quotes"
          line={
            openQuotes.length > 0
              ? `${openQuotes.length} awaiting your decision`
              : 'No open quotes'
          }
          highlight={openQuotes.length > 0}
        />
        <QuickCard
          to={`${base}/contracts`}
          icon={FileSignature}
          title="Contracts"
          line={
            myContracts.length === 0
              ? 'None on file'
              : `${myContracts.filter((c) => c.status === 'signed').length} signed of ${myContracts.length}`
          }
        />
      </section>

      {/* Recent files */}
      {sharedFiles.length > 0 ? (
        <section>
          <SectionHead
            title="Latest Files"
            action={
              <Link
                to={`${base}/files`}
                className="text-xs font-bold text-orange hover:text-orange-deep inline-flex items-center gap-1"
              >
                View all <ArrowRight size={13} />
              </Link>
            }
          />
          <Card className="divide-y divide-line">
            {[...sharedFiles]
              .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))
              .slice(0, 3)
              .map((file) => (
                <div key={file.id} className="flex items-center justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-ink truncate">{file.name}</p>
                    <p className="text-xs text-ink-soft">
                      {file.folder} · {file.size} · added {relativeDays(file.uploadedAt)}
                    </p>
                  </div>
                  <StatusPill tone="neutral">{file.kind}</StatusPill>
                </div>
              ))}
          </Card>
        </section>
      ) : null}
    </div>
  );
}

function SectionHead({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 flex-wrap mb-4">
      <h2 className="disp text-[22px] font-extrabold text-ink">{title}</h2>
      {action}
    </div>
  );
}

function QuickCard({
  to,
  icon: Icon,
  title,
  line,
  highlight,
}: {
  to: string;
  icon: React.ComponentType<{ size?: number }>;
  title: string;
  line: string;
  highlight?: boolean;
}) {
  return (
    <Link to={to}>
      <Card
        className={`p-5 h-full hover:shadow-md transition-shadow ${
          highlight ? 'border-orange ring-1 ring-orange' : ''
        }`}
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-lg bg-surface-2 text-ink-soft flex items-center justify-center">
            <Icon size={17} />
          </div>
          <h3 className="disp font-extrabold text-ink">{title}</h3>
        </div>
        <p className="text-[13px] text-ink-soft">{line}</p>
      </Card>
    </Link>
  );
}
