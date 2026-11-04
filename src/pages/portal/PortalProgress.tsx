import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Briefcase, CalendarBlank, CaretDown } from '@phosphor-icons/react';
import {
  ActionItems,
  BrandSnapshotPanel,
  DeliveryTimeline,
  PhaseTracker,
  TrackerSummary,
  hasBrandSnapshot,
} from '@/src/components/tracker/PhaseTracker';
import ClientTaskBoard from '@/src/components/ClientTaskBoard';
import ProjectSummaryText from '@/src/components/ProjectSummaryText';
import { Card, EmptyState, MetaPill, ProgressRing, StatusPill } from '@/src/components/ui';
import { cn, formatCurrency, formatDate } from '@/src/lib/utils';
import { projectBudget, projectProgress } from '@/src/lib/tracker';
import { useStudio } from '@/src/store/StudioStore';
import type { Project } from '@/src/types';
import { usePortalClient } from './usePortalClient';

/**
 * The full phase tracker, read-only. Renders the same components the studio
 * edits in `/admin/tracker`, passed `mode="client"`.
 *
 * Each project is a collapsible card, and they all start closed: a client
 * with three engagements was reading one unbroken column of phases, timelines
 * and task boards with no way to tell where one project ended and the next
 * began. Closed, the page is a short list of projects you open one at a time.
 *
 * `?p=<projectId>` opens one and scrolls to it, which is what the overview's
 * per-project button links to. With only one project there is nothing to
 * choose between, so it opens on its own.
 */
export default function PortalProgress() {
  const client = usePortalClient();
  const { projectsForClient } = useStudio();
  const [params] = useSearchParams();
  const focused = params.get('p');
  const projects = projectsForClient(client.id).filter((p) => p.status !== 'archived');

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
    <div className="space-y-4">
      {projects.map((project) => (
        <ProjectCard
          key={project.id}
          project={project}
          defaultOpen={project.id === focused || projects.length === 1}
          scrollTo={project.id === focused}
        />
      ))}
    </div>
  );
}

function ProjectCard({
  project,
  defaultOpen,
  scrollTo,
}: {
  project: Project;
  defaultOpen: boolean;
  scrollTo: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const ref = useRef<HTMLDivElement>(null);

  // Arriving from the overview, put the project they asked for on screen.
  useEffect(() => {
    if (scrollTo) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [scrollTo]);
  const { pct } = projectProgress(project);
  const value = projectBudget(project);

  return (
    <Card ref={ref} className="overflow-hidden scroll-mt-28">
      {/* The whole header is the toggle: a small chevron alone is too easy to
          miss, and there is nothing else to click up here. */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          'w-full text-left p-6 flex items-center gap-5 transition-colors',
          'hover:bg-surface-2/60',
        )}
      >
        <ProgressRing value={pct} size={54} />

        <div className="flex-1 min-w-0">
          <h2 className="disp text-xl font-extrabold text-ink truncate">{project.name}</h2>
          <div className="flex items-center gap-2 flex-wrap mt-1.5">
            <MetaPill>
              <CalendarBlank size={13} /> Target {formatDate(project.targetDelivery)}
            </MetaPill>
            {value > 0 ? (
              <MetaPill>
                Value <b className="text-ink">{formatCurrency(value)}</b>
              </MetaPill>
            ) : null}
            <StatusPill tone={pct === 100 ? 'positive' : pct > 0 ? 'active' : 'upcoming'}>
              {pct}% complete
            </StatusPill>
          </div>
        </div>

        <span
          className={cn(
            'shrink-0 flex items-center gap-1.5 text-[12px] font-bold',
            'text-ink-soft',
          )}
        >
          {open ? 'Hide details' : 'View details'}
          <CaretDown
            size={14}
            className={cn('transition-transform', open && 'rotate-180')}
          />
        </span>
      </button>

      {open ? (
        <div className="px-6 pb-6 pt-1 space-y-9 border-t border-line">
          {project.summary ? (
            <ProjectSummaryText text={project.summary} className="pt-5" lines={3} />
          ) : null}

          <TrackerSummary project={project} />

          <ActionItems project={project} mode="client" />

          <section>
            <SectionHead
              title="Phases & Deliverables"
              sub="Updated live as each phase progresses"
            />
            <PhaseTracker project={project} mode="client" />
          </section>

          {/* An empty timeline is a heading over nothing. */}
          {project.timeline.length > 0 ? (
            <section>
              <SectionHead
                title="Delivery Timeline"
                sub="May complete sooner depending on revision turnaround"
              />
              <DeliveryTimeline project={project} mode="client" />
            </section>
          ) : null}

          <ClientTaskBoard projectId={project.id} />

          {/* Only for work that actually has a brand identity to reveal. */}
          {hasBrandSnapshot(project) ? (
            <section>
              <SectionHead title="Brand Snapshot" sub="Each piece appears as it's approved" />
              <BrandSnapshotPanel project={project} />
            </section>
          ) : null}
        </div>
      ) : null}
    </Card>
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
