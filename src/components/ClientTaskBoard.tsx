import { Check, Circle, CircleNotch } from '@phosphor-icons/react';
import { Card, ProgressBar } from '@/src/components/ui';
import { cn, formatDate } from '@/src/lib/utils';
import { useStudio } from '@/src/store/StudioStore';
import type { TaskLane } from '@/src/types';

/**
 * The work the studio is actually doing, shown to the client.
 *
 * Phases are the promise — what the engagement covers. This is the live
 * detail underneath them: the individual jobs, and which are finished. Only
 * tasks the studio marked visible reach here (the portal snapshot filters
 * them server-side), so internal scratch work stays internal.
 */

const LANE_META: Record<TaskLane, { label: string; blurb: string }> = {
  'In Progress': { label: 'Underway', blurb: 'Being worked on right now' },
  Todo: { label: 'Up Next', blurb: 'Queued to start' },
  Done: { label: 'Completed', blurb: 'Finished and signed off' },
};

// Most useful order for a client reading top to bottom.
const ORDER: TaskLane[] = ['In Progress', 'Todo', 'Done'];

export default function ClientTaskBoard({ projectId }: { projectId: string }) {
  const { projectTasks, projects } = useStudio();

  const project = projects.find((p) => p.id === projectId);
  const tasks = projectTasks.filter((t) => t.projectId === projectId);
  if (tasks.length === 0) return null;

  // Once work is organised into phases, show it that way — it matches the
  // phase plan the client already sees above. Otherwise fall back to status.
  const phasesWithTasks = (project?.phases ?? []).filter((ph) =>
    tasks.some((t) => t.phaseId === ph.id),
  );
  const unphased = tasks.filter((t) => !t.phaseId || !phasesWithTasks.some((ph) => ph.id === t.phaseId));
  const groupByPhase = phasesWithTasks.length > 0;

  const done = tasks.filter((t) => t.lane === 'Done').length;
  const pct = Math.round((done / tasks.length) * 100);

  return (
    <section>
      <div className="flex items-baseline justify-between gap-3 flex-wrap mb-5">
        <h2 className="disp text-[22px] font-extrabold text-ink">Work Breakdown</h2>
        <p className="text-sm text-ink-soft">
          {done} of {tasks.length} tasks complete
        </p>
      </div>

      <Card className="p-6 space-y-6">
        <ProgressBar value={pct} tone="orange" className="h-2" />

        {(groupByPhase
          ? [
              ...phasesWithTasks.map((ph) => ({
                key: ph.id,
                heading: ph.name,
                blurb: '',
                rows: tasks.filter((t) => t.phaseId === ph.id),
              })),
              ...(unphased.length
                ? [{ key: 'other', heading: 'Other work', blurb: '', rows: unphased }]
                : []),
            ]
          : ORDER.map((lane) => ({
              key: lane,
              heading: LANE_META[lane].label,
              blurb: LANE_META[lane].blurb,
              rows: tasks.filter((t) => t.lane === lane),
            }))
        ).map((group) => {
          const rows = [...group.rows].sort((a, b) => a.sortOrder - b.sortOrder);
          if (rows.length === 0) return null;

          return (
            <div key={group.key}>
              <div className="flex items-baseline gap-2 mb-2.5">
                <h3 className="text-[11px] font-bold uppercase tracking-widest text-ink-faint">
                  {group.heading}
                </h3>
                {group.blurb ? (
                  <span className="text-[11px] text-ink-faint">· {group.blurb}</span>
                ) : (
                  <span className="text-[11px] text-ink-faint">
                    · {rows.filter((t) => t.lane === 'Done').length} of {rows.length} done
                  </span>
                )}
              </div>

              <ul className="space-y-2">
                {rows.map((task) => {
                  const isDone = task.lane === 'Done';
                  const isActive = task.lane === 'In Progress';
                  return (
                    <li
                      key={task.id}
                      className={cn(
                        'flex items-start gap-3 rounded-[10px] px-4 py-3',
                        isActive ? 'bg-orange-dim' : 'bg-surface-2',
                      )}
                    >
                      <span
                        className={cn(
                          'w-[18px] h-[18px] rounded-full flex items-center justify-center shrink-0 mt-px',
                          isDone && 'bg-positive text-white',
                          isActive && 'text-orange',
                          !isDone && !isActive && 'text-ink-faint',
                        )}
                      >
                        {isDone ? (
                          <Check size={11} />
                        ) : isActive ? (
                          <CircleNotch size={14} />
                        ) : (
                          <Circle size={12} />
                        )}
                      </span>

                      <span className="min-w-0 flex-1">
                        <span
                          className={cn(
                            'block text-[13.5px] font-bold',
                            isDone ? 'text-ink-faint line-through' : 'text-ink',
                          )}
                        >
                          {task.title}
                        </span>
                        {task.subtasks.length > 0 ? (
                          <span className="block text-[12px] text-ink-soft mt-0.5">
                            {task.subtasks.filter((st) => st.completed).length} of{' '}
                            {task.subtasks.length} steps done
                          </span>
                        ) : null}
                      </span>

                      {task.dueDate && !isDone ? (
                        <span className="text-[11.5px] text-ink-soft shrink-0">
                          {formatDate(task.dueDate)}
                        </span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </Card>
    </section>
  );
}
