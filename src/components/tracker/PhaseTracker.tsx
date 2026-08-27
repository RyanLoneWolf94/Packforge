import { Check, ExternalLink, Link2, Lock, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button, Card, Input, ProgressRing, StatusPill } from '@/src/components/ui';
import { cn, formatCurrency } from '@/src/lib/utils';
import { currentPhase, phaseStatus, projectBudget, projectProgress } from '@/src/lib/tracker';
import { useStudio } from '@/src/store/StudioStore';
import type { Project } from '@/src/types';

/**
 * The phase-and-deliverables tracker, consolidated from the standalone
 * Cakes & Bakes client dashboard.
 *
 * One component serves both audiences: `mode="admin"` renders editable ticks,
 * budgets and file links; `mode="client"` renders the same data read-only. That
 * keeps the two views structurally identical by construction, which is the
 * property the original two-file setup had to maintain by hand.
 */

const STATUS_LABEL = { done: 'Complete', active: 'In Progress', upcoming: 'Upcoming' } as const;

export function TrackerSummary({ project }: { project: Project }) {
  const { pct, done, total } = projectProgress(project);
  const phase = currentPhase(project);
  const complete = pct === 100;

  return (
    <Card className="p-6 flex items-center gap-7 flex-wrap">
      <ProgressRing value={pct} />
      <div className="flex-1 min-w-[200px]">
        <div className="text-[11.5px] font-bold uppercase tracking-wider text-ink-faint">
          Current Status
        </div>
        <div className="disp text-xl font-extrabold text-purple mt-0.5">
          {complete
            ? 'All phases complete'
            : `Phase ${project.phases.indexOf(phase!) + 1} · ${phase?.name}`}
        </div>
        <div className="text-[13.5px] text-ink-soft mt-1">
          {complete
            ? 'Ready for final handover.'
            : `${done} of ${total} deliverables signed off.`}
        </div>
      </div>
      <div className="flex gap-1.5">
        {project.phases.map((p) => {
          const status = phaseStatus(p);
          return (
            <div
              key={p.id}
              title={p.name}
              className={cn(
                'w-[34px] h-2 rounded-full',
                status === 'done' && 'bg-gold',
                status === 'active' && 'bg-purple',
                status === 'upcoming' && 'bg-surface-2',
              )}
            />
          );
        })}
      </div>
    </Card>
  );
}

export function PhaseTracker({
  project,
  mode,
}: {
  project: Project;
  mode: 'admin' | 'client';
}) {
  const { toggleDeliverable, setPhaseLink, addDeliverable, removeDeliverable } = useStudio();
  const isAdmin = mode === 'admin';

  // Link inputs are locally buffered so a save is explicit rather than firing
  // a store write on every keystroke.
  const [linkDrafts, setLinkDrafts] = useState<Record<string, string>>({});
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');

  return (
    <div className="space-y-4">
      {project.phases.map((phase, idx) => {
        const status = phaseStatus(phase);
        const draft = linkDrafts[phase.id] ?? phase.link;

        return (
          <Card
            key={phase.id}
            className={cn('p-6', status === 'active' && 'border-purple ring-1 ring-purple')}
          >
            <div className="flex items-center gap-3 flex-wrap mb-4">
              <div
                className={cn(
                  'w-9 h-9 rounded-full border-2 flex items-center justify-center shrink-0',
                  'font-extrabold text-sm',
                  status === 'done' && 'bg-gold border-gold text-white',
                  status === 'active' && 'bg-purple-dim border-purple text-purple',
                  status === 'upcoming' && 'bg-surface-2 border-line text-ink-faint',
                )}
              >
                {String(idx + 1).padStart(2, '0')}
              </div>
              <h3 className="font-bold text-base text-ink flex-1 min-w-[160px]">
                Phase {idx + 1} — {phase.name}
              </h3>
              <StatusPill tone={status}>{STATUS_LABEL[status]}</StatusPill>
              <span className="font-extrabold text-base text-purple">
                {formatCurrency(phase.budget)}
              </span>
            </div>

            <div className="grid sm:grid-cols-2 gap-2.5 mb-4">
              {phase.deliverables.map((d) => (
                <div
                  key={d.id}
                  onClick={
                    isAdmin ? () => toggleDeliverable(project.id, phase.id, d.id) : undefined
                  }
                  role={isAdmin ? 'checkbox' : undefined}
                  aria-checked={isAdmin ? d.done : undefined}
                  tabIndex={isAdmin ? 0 : undefined}
                  onKeyDown={
                    isAdmin
                      ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            toggleDeliverable(project.id, phase.id, d.id);
                          }
                        }
                      : undefined
                  }
                  className={cn(
                    'group flex gap-3 items-start bg-surface-2 rounded-[10px] p-3.5 relative',
                    isAdmin && 'cursor-pointer hover:bg-orange-dim transition-colors',
                  )}
                >
                  <div
                    className={cn(
                      'w-[22px] h-[22px] rounded-md border-2 shrink-0 mt-px',
                      'flex items-center justify-center bg-surface',
                      d.done ? 'bg-gold border-gold text-white' : 'border-line',
                    )}
                  >
                    {d.done ? <Check size={13} strokeWidth={3.5} /> : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div
                      className={cn(
                        'font-semibold text-sm',
                        d.done ? 'text-ink-soft line-through decoration-ink-faint' : 'text-ink',
                      )}
                    >
                      {d.title}
                    </div>
                    <div className="text-[12.5px] text-ink-soft mt-0.5">{d.description}</div>
                  </div>
                  {isAdmin ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeDeliverable(project.id, phase.id, d.id);
                      }}
                      aria-label={`Remove ${d.title}`}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-ink-faint hover:text-red p-1"
                    >
                      <Trash2 size={13} />
                    </button>
                  ) : null}
                </div>
              ))}
            </div>

            {isAdmin && addingTo === phase.id ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newTitle.trim()) return;
                  addDeliverable(project.id, phase.id, newTitle.trim(), 'Added manually');
                  setNewTitle('');
                  setAddingTo(null);
                }}
                className="flex gap-2 mb-4"
              >
                <Input
                  autoFocus
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onBlur={() => !newTitle.trim() && setAddingTo(null)}
                  placeholder="Deliverable title…"
                />
                <Button type="submit" size="sm">
                  Add
                </Button>
              </form>
            ) : isAdmin ? (
              <button
                onClick={() => setAddingTo(phase.id)}
                className="text-[11px] font-bold text-ink-faint hover:text-orange flex items-center gap-1 mb-4 transition-colors"
              >
                <Plus size={12} /> Add deliverable
              </button>
            ) : null}

            <div className="border-t border-line pt-4 flex items-center gap-2.5 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-wide text-ink-soft">
                Files
              </span>
              {isAdmin ? (
                <>
                  <Input
                    value={draft}
                    onChange={(e) =>
                      setLinkDrafts((prev) => ({ ...prev, [phase.id]: e.target.value }))
                    }
                    placeholder="Paste Google Drive / Docs link"
                    className="flex-1 min-w-[200px]"
                  />
                  <Button
                    variant="purple"
                    size="sm"
                    disabled={draft === phase.link}
                    onClick={() => {
                      setPhaseLink(project.id, phase.id, draft.trim());
                      toast.success('Phase link saved');
                    }}
                  >
                    Save link
                  </Button>
                </>
              ) : phase.link ? (
                <a
                  href={phase.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-purple-dim text-purple text-[13px] font-bold hover:bg-purple hover:text-white transition-colors"
                >
                  <ExternalLink size={14} /> View phase files
                </a>
              ) : (
                <span className="text-[13px] text-ink-faint italic">
                  Files not yet available
                </span>
              )}
            </div>
          </Card>
        );
      })}

      <div className="flex items-center justify-between gap-4 flex-wrap px-5 py-4 bg-surface-2 rounded-[10px] text-sm">
        <span className="text-ink-soft">
          {project.phases.length} phases · {projectProgress(project).total} deliverables
        </span>
        <span className="font-extrabold text-ink">
          Project total {formatCurrency(projectBudget(project))}
        </span>
      </div>
    </div>
  );
}

/* ----------------------------- Timeline ------------------------------- */

export function DeliveryTimeline({
  project,
  mode = 'client',
}: {
  project: Project;
  mode?: 'admin' | 'client';
}) {
  const { toggleTimelineWeek } = useStudio();
  const isAdmin = mode === 'admin';

  // "Current" is the first stage the studio hasn't signed off yet.
  const activeIdx = project.timeline.findIndex((w) => !w.done);

  return (
    <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
      {project.timeline.map((week, idx) => {
        const isCurrent = idx === activeIdx;
        return (
          <Card
            key={week.id}
            className={cn(
              'p-[18px] relative overflow-hidden transition-colors',
              week.done && 'border-gold bg-gold-dim/25',
              !week.done && isCurrent && 'border-purple ring-1 ring-purple',
            )}
          >
            {week.done ? (
              <span className="absolute top-0 right-0 bg-gold text-white text-[9.5px] font-bold tracking-wider px-2.5 py-1 rounded-bl-[10px]">
                COMPLETE
              </span>
            ) : isCurrent ? (
              <span className="absolute top-0 right-0 bg-purple text-white text-[9.5px] font-bold tracking-wider px-2.5 py-1 rounded-bl-[10px]">
                CURRENT
              </span>
            ) : null}

            <div className="text-[11.5px] font-bold uppercase tracking-wider text-ink-faint pr-16">
              {week.label}
            </div>
            <div
              className={cn(
                'disp font-extrabold text-[17px] mt-1 leading-tight',
                week.done ? 'text-ink-soft' : 'text-ink',
              )}
            >
              {week.title}
            </div>

            <ul className="mt-2.5 space-y-1.5">
              {week.points.map((point) => (
                <li
                  key={point}
                  className={cn(
                    'text-[12.5px] pl-3.5 relative before:absolute before:left-0 before:top-[7px] before:w-[5px] before:h-[5px] before:rounded-full',
                    week.done
                      ? 'text-ink-faint before:bg-gold'
                      : 'text-ink-soft before:bg-ink-faint',
                  )}
                >
                  {point}
                </li>
              ))}
            </ul>

            {isAdmin ? (
              <button
                onClick={() => toggleTimelineWeek(project.id, week.id)}
                aria-pressed={week.done}
                className={cn(
                  'mt-4 w-full py-2 rounded-lg text-[11.5px] font-bold transition-colors',
                  'flex items-center justify-center gap-1.5 border',
                  week.done
                    ? 'border-line text-ink-soft hover:bg-surface-2'
                    : 'border-gold bg-gold-dim text-gold-deep hover:bg-gold hover:text-white',
                )}
              >
                {week.done ? (
                  <>
                    <RotateCcw size={12} /> Reopen stage
                  </>
                ) : (
                  <>
                    <Check size={12} strokeWidth={3} /> Mark complete
                  </>
                )}
              </button>
            ) : null}
          </Card>
        );
      })}
    </div>
  );
}

/* --------------------------- Brand snapshot --------------------------- */

/**
 * Reveals each part of the identity as it lands rather than staying locked
 * until everything is approved — so a client who has signed off a new name in
 * week 1 sees that name, with the parts still to come listed beneath.
 */
export function BrandSnapshotPanel({ project }: { project: Project }) {
  const snapshot = project.brandSnapshot;

  const hasName = Boolean(snapshot?.name);
  const hasTagline = Boolean(snapshot?.tagline);
  const hasPalette = Boolean(snapshot?.palette?.length);
  const hasType = Boolean(snapshot?.typography);
  const hasLogo = Boolean(snapshot?.logoUrl);

  const pending = [
    !hasName && 'New Name',
    !hasLogo && 'Logo Suite',
    !hasPalette && 'Colour System',
    !hasType && 'Typography',
    !hasTagline && 'Tagline',
  ].filter(Boolean) as string[];

  const anything = hasName || hasTagline || hasPalette || hasType || hasLogo;

  // Nothing approved yet — keep the original locked treatment.
  if (!anything) {
    return (
      <div className="border border-dashed border-line rounded-[14px] py-10 px-7 text-center bg-surface">
        <div className="w-11 h-11 rounded-full bg-purple-dim text-purple flex items-center justify-center mx-auto mb-3.5">
          <Lock size={18} />
        </div>
        <div className="font-bold text-base text-ink">
          Your brand identity is still taking shape
        </div>
        <p className="text-[13.5px] text-ink-soft mt-1.5 max-w-md mx-auto">
          Each piece appears here as it's approved — you won't have to wait for the whole
          identity to be finished.
        </p>
        <div className="flex gap-2.5 justify-center mt-4 flex-wrap">
          {pending.map((f) => (
            <span
              key={f}
              className="px-4 py-1.5 rounded-full bg-surface-2 text-xs text-ink-faint font-semibold"
            >
              {f}
            </span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <Card className="p-7">
      {hasLogo ? (
        <img
          src={snapshot!.logoUrl}
          alt={`${snapshot!.name ?? project.name} logo`}
          className="h-16 w-auto mb-5 object-contain"
        />
      ) : null}

      {hasName ? (
        <div className="disp text-2xl font-extrabold text-ink">{snapshot!.name}</div>
      ) : (
        <div className="disp text-2xl font-extrabold text-ink-faint">{project.name}</div>
      )}
      {hasTagline ? (
        <div className="text-ink-soft font-medium mt-1">{snapshot!.tagline}</div>
      ) : null}

      {hasPalette ? (
        <div className="mt-6">
          <span className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">
            Colour System
          </span>
          <div className="flex gap-3 mt-2.5 flex-wrap">
            {snapshot!.palette!.map((swatch) => (
              <div key={swatch.hex} className="text-center">
                <div
                  className="w-16 h-16 rounded-xl border border-line"
                  style={{ background: swatch.hex }}
                />
                <div className="text-[10.5px] font-bold text-ink mt-1.5">{swatch.label}</div>
                <div className="text-[10px] text-ink-faint font-mono">{swatch.hex}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {hasType ? (
        <div className="mt-6 pt-5 border-t border-line">
          <span className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">
            Typography
          </span>
          <div className="font-semibold text-ink mt-1">{snapshot!.typography}</div>
        </div>
      ) : null}

      {pending.length > 0 ? (
        <div className="mt-6 pt-5 border-t border-line">
          <span className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">
            Still to come
          </span>
          <div className="flex gap-2 mt-2.5 flex-wrap">
            {pending.map((f) => (
              <span
                key={f}
                className="px-3.5 py-1.5 rounded-full bg-surface-2 text-xs text-ink-faint font-semibold"
              >
                {f}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </Card>
  );
}

/* ---------------------------- Action items ---------------------------- */

export function ActionItems({
  project,
  mode,
}: {
  project: Project;
  mode: 'admin' | 'client';
}) {
  const { toggleActionItem, removeActionItem } = useStudio();
  const open = project.actionItems.filter((a) => !a.resolved);

  if (open.length === 0) return null;

  return (
    <div className="rounded-[14px] border border-red-dim border-l-4 border-l-red bg-gradient-to-br from-[#FFF6F4] to-surface p-7">
      <div className="flex items-center gap-2 text-[11.5px] font-bold uppercase tracking-wider text-red mb-2.5">
        ⚠ Action Needed {mode === 'client' ? 'From You' : 'From The Client'}
      </div>
      <div className="font-bold text-[17px] text-ink">
        {open.length} {open.length === 1 ? 'item is' : 'items are'} waiting on input to keep
        this project on track
      </div>

      <div className="flex flex-col gap-3 mt-3.5">
        {open.map((item, idx) => (
          <div key={item.id} className="flex gap-3 items-start">
            <div className="w-6 h-6 rounded-full bg-red text-white shrink-0 flex items-center justify-center font-extrabold text-[13px]">
              {idx + 1}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-[14.5px] text-ink">{item.title}</div>
              <div className="text-[13px] text-ink-soft mt-0.5">{item.detail}</div>
            </div>
            {mode === 'admin' ? (
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => toggleActionItem(project.id, item.id)}
                  className="p-1.5 text-ink-faint hover:text-positive hover:bg-positive-dim rounded transition-colors"
                  title="Mark resolved"
                >
                  <Check size={14} />
                </button>
                <button
                  onClick={() => removeActionItem(project.id, item.id)}
                  className="p-1.5 text-ink-faint hover:text-red hover:bg-red-dim rounded transition-colors"
                  title="Remove"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------- Portal share button ------------------------ */

export function PortalShareButton({ token }: { token: string }) {
  return (
    <Button
      variant="secondary"
      icon={Link2}
      onClick={() => {
        const url = `${window.location.origin}/portal/${token}`;
        navigator.clipboard
          .writeText(url)
          .then(() => toast.success('Client portal link copied'))
          .catch(() => toast.error(`Copy this link: ${url}`));
      }}
    >
      Copy client link
    </Button>
  );
}
