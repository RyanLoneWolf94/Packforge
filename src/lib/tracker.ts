import type { PhaseStatus, Project, TrackerPhase } from '../types';

/**
 * Pure derivations over tracker state. Progress is never stored — admin tables,
 * the client portal and dashboard rollups all call through here, so they cannot
 * drift out of sync with the underlying deliverable ticks.
 */

export function phaseProgress(phase: TrackerPhase) {
  const total = phase.deliverables.length;
  const done = phase.deliverables.filter((d) => d.done).length;
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

export function phaseStatus(phase: TrackerPhase): PhaseStatus {
  const { done, total } = phaseProgress(phase);
  if (total > 0 && done === total) return 'done';
  if (done > 0) return 'active';
  return 'upcoming';
}

export function projectProgress(project: Project) {
  let done = 0;
  let total = 0;
  for (const phase of project.phases) {
    for (const d of phase.deliverables) {
      total += 1;
      if (d.done) done += 1;
    }
  }
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

/** The first phase that isn't finished — what the client is waiting on. */
export function currentPhase(project: Project): TrackerPhase | undefined {
  return (
    project.phases.find((p) => phaseStatus(p) !== 'done') ??
    project.phases[project.phases.length - 1]
  );
}

export function projectBudget(project: Project): number {
  return project.phases.reduce((sum, p) => sum + p.budget, 0);
}

/**
 * Budget earned to date, apportioned within each phase by deliverables
 * completed. Gives a more honest revenue-recognition figure than counting a
 * phase only once it fully closes.
 */
export function projectEarned(project: Project): number {
  return project.phases.reduce((sum, phase) => {
    const { pct } = phaseProgress(phase);
    return sum + (phase.budget * pct) / 100;
  }, 0);
}

export type ProjectHealth = 'on-track' | 'at-risk' | 'overdue' | 'complete';

/**
 * Health compares elapsed calendar time against completed work. A project is
 * at risk when it has burned meaningfully more of its schedule than its
 * deliverables, which surfaces slippage before the deadline actually passes.
 */
export function projectHealth(project: Project, now: Date = new Date()): ProjectHealth {
  const { pct } = projectProgress(project);
  if (pct === 100) return 'complete';

  const start = new Date(project.startDate).getTime();
  const end = new Date(project.targetDelivery).getTime();
  const today = now.getTime();

  if (today > end) return 'overdue';
  if (end <= start) return 'on-track';

  const elapsedPct = ((today - start) / (end - start)) * 100;
  // 15 points of slack absorbs normal front-loaded discovery work.
  return elapsedPct - pct > 15 ? 'at-risk' : 'on-track';
}

export function daysUntil(date: string, now: Date = new Date()): number {
  const ms = new Date(date).getTime() - now.getTime();
  return Math.ceil(ms / 86_400_000);
}

/** Unresolved items the client still owes the studio, across all projects. */
export function openActionItems(projects: Project[]) {
  return projects.flatMap((project) =>
    project.actionItems
      .filter((item) => !item.resolved)
      .map((item) => ({ ...item, project })),
  );
}
