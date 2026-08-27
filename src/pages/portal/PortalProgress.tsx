import { Briefcase, CalendarDays } from 'lucide-react';
import {
  ActionItems,
  BrandSnapshotPanel,
  DeliveryTimeline,
  PhaseTracker,
  TrackerSummary,
} from '@/src/components/tracker/PhaseTracker';
import { Card, EmptyState, MetaPill } from '@/src/components/ui';
import { formatCurrency, formatDate } from '@/src/lib/utils';
import { projectBudget } from '@/src/lib/tracker';
import { useStudio } from '@/src/store/StudioStore';
import type { Project } from '@/src/types';
import { usePortalClient } from './usePortalClient';

/**
 * The full phase tracker, read-only. Renders the same components the studio
 * edits in `/admin/tracker`, passed `mode="client"`.
 */
export default function PortalProgress() {
  const client = usePortalClient();
  const { projectsForClient } = useStudio();
  const projects = projectsForClient(client.id).filter((p) => !p.archived);

  if (projects.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={Briefcase}
          title="No active projects"
          description="Once your engagement kicks off, your phases and deliverables will appear here."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-14">
      {projects.map((project) => (
        <ProjectProgress key={project.id} project={project} />
      ))}
    </div>
  );
}

function ProjectProgress({ project }: { project: Project }) {
  return (
    <div className="space-y-9">
      <section className="space-y-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="disp text-2xl font-extrabold text-ink">{project.name}</h1>
            <p className="text-ink-soft mt-1 max-w-2xl">{project.summary}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <MetaPill>
              <CalendarDays size={13} /> Target {formatDate(project.targetDelivery)}
            </MetaPill>
            <MetaPill>
              Value <b className="text-ink">{formatCurrency(projectBudget(project))}</b>
            </MetaPill>
          </div>
        </div>
        <TrackerSummary project={project} />
      </section>

      <ActionItems project={project} mode="client" />

      <section>
        <SectionHead title="Phases & Deliverables" sub="Updated live as each phase progresses" />
        <PhaseTracker project={project} mode="client" />
      </section>

      <section>
        <SectionHead
          title="Delivery Timeline"
          sub="May complete sooner depending on revision turnaround"
        />
        <DeliveryTimeline project={project} mode="client" />
      </section>

      <section>
        <SectionHead title="Brand Snapshot" sub="Each piece appears as it's approved" />
        <BrandSnapshotPanel project={project} />
      </section>
    </div>
  );
}

function SectionHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 flex-wrap mb-5">
      <h2 className="disp text-[22px] font-extrabold text-ink">{title}</h2>
      {sub ? <p className="text-sm text-ink-soft">{sub}</p> : null}
    </div>
  );
}
