import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarRange,
  Copy,
  Edit2,
  FileText,
  Layers,
  LayoutTemplate,
  Plus,
  Trash2,
  Wand2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  StatusPill,
  Textarea,
} from '@/src/components/ui';
import {
  MilestoneEditor,
  cloneMilestones,
  milestonesTotal,
  newMilestone,
} from '@/src/components/MilestoneEditor';
import { cn, formatCurrency } from '@/src/lib/utils';
import { freshPhases, freshTimeline, useStudio } from '@/src/store/StudioStore';
import {
  BLUEPRINT_CATEGORIES,
  type Blueprint,
  type QuoteMilestone,
  type TimelineWeek,
  type TrackerPhase,
} from '@/src/types';

/**
 * The blueprint library: reusable templates for every kind of engagement the
 * studio sells, across all its business lines. Each holds the three things a
 * new piece of work needs — a priced breakdown (quote), a delivery workflow
 * (tracker phases) and a client-facing timeline — and every part is editable.
 *
 * Quotes start from a blueprint or are saved back as one; projects seed their
 * tracker from one. Nothing here is hardcoded to branding.
 */

let seq = 0;
const uid = (p: string) => `${p}-${Date.now().toString(36)}-${(seq++).toString(36)}`;

type FormState = {
  title: string;
  category: string;
  description: string;
  timelineDays: string;
  milestones: QuoteMilestone[];
  phases: TrackerPhase[];
  timeline: TimelineWeek[];
};

const blankForm = (): FormState => ({
  title: '',
  category: 'Branding',
  description: '',
  timelineDays: '28',
  milestones: [newMilestone()],
  phases: [],
  timeline: [],
});

/* ------------------------- text <-> structure helpers ------------------------- */

/** One deliverable per line; an optional description after " | ". */
const deliverablesToText = (phase: TrackerPhase) =>
  phase.deliverables.map((d) => (d.description ? `${d.title} | ${d.description}` : d.title)).join('\n');

const textToDeliverables = (text: string): TrackerPhase['deliverables'] =>
  text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const [title, ...rest] = line.split('|');
      return { id: uid('dl'), title: title.trim(), description: rest.join('|').trim(), done: false };
    });

/** Milestones → phases: each milestone becomes a phase, its lines the deliverables. */
const phasesFromMilestones = (milestones: QuoteMilestone[]): TrackerPhase[] =>
  milestones.map((m) => ({
    id: uid('ph'),
    name: m.title || 'Phase',
    budget: m.tasks.reduce((s, t) => s + (Number(t.price) || 0), 0),
    link: '',
    deliverables: m.tasks
      .filter((t) => t.title.trim())
      .map((t) => ({ id: uid('dl'), title: t.title.trim(), description: '', done: false })),
  }));

/** Phases → timeline: one stage per phase, spread evenly across the duration. */
const timelineFromPhases = (phases: TrackerPhase[], totalDays: number): TimelineWeek[] => {
  if (!phases.length) return [];
  const per = Math.max(1, Math.round(totalDays / phases.length));
  return phases.map((ph, i) => {
    const start = i * per + 1;
    const end = i === phases.length - 1 ? totalDays : (i + 1) * per;
    const label =
      per >= 7
        ? `Week${Math.ceil(end / 7) > Math.ceil(start / 7) ? 's' : ''} ${Math.ceil(start / 7)}${
            Math.ceil(end / 7) > Math.ceil(start / 7) ? `–${Math.ceil(end / 7)}` : ''
          }`
        : `Days ${start}–${end}`;
    return {
      id: uid('wk'),
      label,
      title: ph.name,
      points: ph.deliverables.slice(0, 4).map((d) => d.title),
      done: false,
    };
  });
};

export default function Blueprints() {
  const { blueprints, add, update, remove } = useStudio();
  const navigate = useNavigate();

  const [filter, setFilter] = useState<string>('All');
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(blankForm);
  const [confirmDelete, setConfirmDelete] = useState<Blueprint | null>(null);

  const categories = useMemo(() => {
    const seen = new Set<string>([...BLUEPRINT_CATEGORIES]);
    blueprints.forEach((b) => seen.add(b.category));
    return [...seen];
  }, [blueprints]);

  const usedCategories = useMemo(
    () => ['All', ...new Set(blueprints.map((b) => b.category))],
    [blueprints],
  );

  const rows = useMemo(
    () =>
      blueprints
        .filter((b) => filter === 'All' || b.category === filter)
        .sort((a, b) => a.category.localeCompare(b.category) || a.title.localeCompare(b.title)),
    [blueprints, filter],
  );

  const openAdd = () => {
    setEditingId(null);
    setForm(blankForm());
    setIsOpen(true);
  };

  const openEdit = (bp: Blueprint) => {
    setEditingId(bp.id);
    setForm({
      title: bp.title,
      category: bp.category,
      description: bp.description,
      timelineDays: String(bp.timelineDays),
      milestones: bp.milestones,
      phases: bp.phases,
      timeline: bp.timeline,
    });
    setIsOpen(true);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error('Give the blueprint a name');
      return;
    }
    const payload = {
      title: form.title.trim(),
      category: form.category.trim() || 'Other',
      description: form.description.trim(),
      timelineDays: Number(form.timelineDays) || 28,
      milestones: form.milestones.filter((m) => m.tasks.some((t) => t.title.trim())),
      phases: form.phases.filter((p) => p.name.trim()),
      timeline: form.timeline.filter((w) => w.title.trim()),
    };
    if (editingId) {
      update('blueprints', editingId, payload);
      toast.success('Blueprint updated');
    } else {
      add('blueprints', { ...payload, createdAt: new Date().toISOString().slice(0, 10) });
      toast.success('Blueprint saved');
    }
    setIsOpen(false);
  };

  const duplicate = (bp: Blueprint) => {
    add('blueprints', {
      title: `${bp.title} (copy)`,
      category: bp.category,
      description: bp.description,
      timelineDays: bp.timelineDays,
      milestones: cloneMilestones(bp.milestones),
      phases: freshPhases(bp.phases),
      timeline: freshTimeline(bp.timeline),
      createdAt: new Date().toISOString().slice(0, 10),
    });
    toast.success('Blueprint duplicated');
  };

  /* --------------------------- workflow editing --------------------------- */

  const patchPhase = (idx: number, patch: Partial<TrackerPhase>) => {
    const next = [...form.phases];
    next[idx] = { ...next[idx], ...patch };
    setForm({ ...form, phases: next });
  };

  const patchStage = (idx: number, patch: Partial<TimelineWeek>) => {
    const next = [...form.timeline];
    next[idx] = { ...next[idx], ...patch };
    setForm({ ...form, timeline: next });
  };

  return (
    <div className="max-w-[1400px] space-y-6">
      <PageHeader
        title="Blueprints"
        subtitle="Reusable templates for every kind of engagement — breakdown, workflow and timeline, all editable."
        actions={
          <Button icon={Plus} onClick={openAdd}>
            New Blueprint
          </Button>
        }
      />

      {blueprints.length > 0 ? (
        <div className="flex gap-2 flex-wrap">
          {usedCategories.map((c) => (
            <button
              key={c}
              onClick={() => setFilter(c)}
              className={cn(
                'px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors',
                filter === c ? 'bg-night text-white' : 'bg-surface-2 text-ink-soft hover:text-ink',
              )}
            >
              {c}
            </button>
          ))}
        </div>
      ) : null}

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={LayoutTemplate}
            title="No blueprints yet"
            description="Save the way you sell and deliver each kind of work once, then reuse it for every quote and project."
            action={
              <Button icon={Plus} onClick={openAdd}>
                New Blueprint
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {rows.map((bp) => {
            const price = milestonesTotal(bp.milestones);
            const deliverables = bp.phases.reduce((s, p) => s + p.deliverables.length, 0);
            return (
              <Card key={bp.id} className="p-5 flex flex-col group">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <StatusPill tone="neutral">{bp.category}</StatusPill>
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => duplicate(bp)}
                      aria-label="Duplicate"
                      className="p-1.5 text-ink-faint hover:text-purple hover:bg-purple-dim rounded transition-colors"
                    >
                      <Copy size={14} />
                    </button>
                    <button
                      onClick={() => openEdit(bp)}
                      aria-label="Edit"
                      className="p-1.5 text-ink-faint hover:text-purple hover:bg-purple-dim rounded transition-colors"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => setConfirmDelete(bp)}
                      aria-label="Delete"
                      className="p-1.5 text-ink-faint hover:text-red hover:bg-red-dim rounded transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <h3 className="disp text-lg font-extrabold text-ink leading-tight">{bp.title}</h3>
                <p className="text-[13px] text-ink-soft mt-1 line-clamp-2 flex-1">{bp.description}</p>

                <div className="mt-4 flex items-end justify-between gap-3">
                  <div className="text-2xl font-extrabold text-purple">{formatCurrency(price)}</div>
                  <div className="text-[11px] text-ink-faint text-right leading-snug">
                    {bp.phases.length} phase{bp.phases.length === 1 ? '' : 's'} · {deliverables}{' '}
                    deliverable{deliverables === 1 ? '' : 's'}
                    <br />
                    {bp.timeline.length} stage{bp.timeline.length === 1 ? '' : 's'} ·{' '}
                    {bp.timelineDays} days
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-line flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={FileText}
                    className="flex-1"
                    onClick={() => navigate(`/admin/quotations?blueprint=${bp.id}`)}
                  >
                    Quote from this
                  </Button>
                  <Button size="sm" variant="ghost" icon={Edit2} onClick={() => openEdit(bp)}>
                    Edit
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* ------------------------------ Editor ------------------------------ */}
      <Modal
        open={isOpen}
        onClose={() => setIsOpen(false)}
        title={editingId ? 'Edit Blueprint' : 'New Blueprint'}
        subtitle="Everything here becomes the starting point for a quote and a project"
        width="max-w-3xl"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="blueprint-form">
              {editingId ? 'Save Changes' : 'Save Blueprint'}
            </Button>
          </>
        }
      >
        <form id="blueprint-form" onSubmit={submit} className="space-y-7">
          {/* Details */}
          <section className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Name">
                <Input
                  autoFocus
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Social Growth Retainer"
                />
              </Field>
              <Field label="Business line">
                <Input
                  list="blueprint-categories"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="Branding, Software Development…"
                />
                <datalist id="blueprint-categories">
                  {categories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </Field>
            </div>
            <div className="grid grid-cols-[1fr_140px] gap-4">
              <Field label="Best for">
                <Input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Who this is the right fit for"
                />
              </Field>
              <Field label="Duration (days)">
                <Input
                  type="number"
                  min="1"
                  value={form.timelineDays}
                  onChange={(e) => setForm({ ...form, timelineDays: e.target.value })}
                />
              </Field>
            </div>
          </section>

          {/* Breakdown */}
          <section>
            <MilestoneEditor
              label="Priced breakdown"
              value={form.milestones}
              onChange={(milestones) => setForm({ ...form, milestones })}
            />
          </section>

          {/* Workflow */}
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Layers size={15} className="text-purple" />
                <span className="text-xs font-bold text-ink">Delivery workflow</span>
                <span className="text-[11px] text-ink-faint">— seeds the project tracker</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setForm({ ...form, phases: phasesFromMilestones(form.milestones) });
                  toast.success('Workflow built from the breakdown');
                }}
                className="text-[11px] font-bold text-orange hover:text-orange-deep flex items-center gap-1"
              >
                <Wand2 size={12} /> Build from breakdown
              </button>
            </div>

            {form.phases.map((phase, idx) => (
              <div key={phase.id} className="bg-surface-2 rounded-[10px] p-3.5 space-y-2">
                <div className="flex gap-2">
                  <Input
                    value={phase.name}
                    onChange={(e) => patchPhase(idx, { name: e.target.value })}
                    placeholder="Phase name"
                    className="font-bold"
                  />
                  <Input
                    type="number"
                    min="0"
                    value={phase.budget}
                    onChange={(e) => patchPhase(idx, { budget: Number(e.target.value) || 0 })}
                    className="w-28 shrink-0"
                    title="Phase budget"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setForm({ ...form, phases: form.phases.filter((p) => p.id !== phase.id) })
                    }
                    className="p-2 text-ink-faint hover:text-red shrink-0"
                    aria-label="Remove phase"
                  >
                    <X size={16} />
                  </button>
                </div>
                <Textarea
                  rows={Math.min(6, Math.max(2, phase.deliverables.length + 1))}
                  defaultValue={deliverablesToText(phase)}
                  onBlur={(e) => patchPhase(idx, { deliverables: textToDeliverables(e.target.value) })}
                  placeholder={'One deliverable per line\nLogo suite | Developed through to final'}
                  className="font-mono text-[12px] leading-relaxed"
                />
              </div>
            ))}

            <button
              type="button"
              onClick={() =>
                setForm({
                  ...form,
                  phases: [
                    ...form.phases,
                    { id: uid('ph'), name: `Phase ${form.phases.length + 1}`, budget: 0, link: '', deliverables: [] },
                  ],
                })
              }
              className="w-full py-2 border border-dashed border-line rounded-lg text-xs font-bold text-ink-soft hover:border-orange hover:text-orange transition-colors"
            >
              + Add phase
            </button>
          </section>

          {/* Timeline */}
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <CalendarRange size={15} className="text-purple" />
                <span className="text-xs font-bold text-ink">Client timeline</span>
                <span className="text-[11px] text-ink-faint">— what the client sees in their portal</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setForm({
                    ...form,
                    timeline: timelineFromPhases(form.phases, Number(form.timelineDays) || 28),
                  });
                  toast.success('Timeline built from the workflow');
                }}
                className="text-[11px] font-bold text-orange hover:text-orange-deep flex items-center gap-1"
              >
                <Wand2 size={12} /> Build from workflow
              </button>
            </div>

            {form.timeline.map((stage, idx) => (
              <div key={stage.id} className="bg-surface-2 rounded-[10px] p-3.5 space-y-2">
                <div className="flex gap-2">
                  <Input
                    value={stage.label}
                    onChange={(e) => patchStage(idx, { label: e.target.value })}
                    placeholder="Week 1"
                    className="w-32 shrink-0"
                  />
                  <Input
                    value={stage.title}
                    onChange={(e) => patchStage(idx, { title: e.target.value })}
                    placeholder="Stage title"
                    className="font-bold"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setForm({ ...form, timeline: form.timeline.filter((w) => w.id !== stage.id) })
                    }
                    className="p-2 text-ink-faint hover:text-red shrink-0"
                    aria-label="Remove stage"
                  >
                    <X size={16} />
                  </button>
                </div>
                <Textarea
                  rows={Math.min(5, Math.max(2, stage.points.length + 1))}
                  defaultValue={stage.points.join('\n')}
                  onBlur={(e) =>
                    patchStage(idx, {
                      points: e.target.value.split('\n').map((l) => l.trim()).filter(Boolean),
                    })
                  }
                  placeholder={'One talking point per line'}
                  className="font-mono text-[12px] leading-relaxed"
                />
              </div>
            ))}

            <button
              type="button"
              onClick={() =>
                setForm({
                  ...form,
                  timeline: [
                    ...form.timeline,
                    { id: uid('wk'), label: `Week ${form.timeline.length + 1}`, title: '', points: [], done: false },
                  ],
                })
              }
              className="w-full py-2 border border-dashed border-line rounded-lg text-xs font-bold text-ink-soft hover:border-orange hover:text-orange transition-colors"
            >
              + Add stage
            </button>
          </section>
        </form>
      </Modal>

      <Modal
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        title="Delete blueprint?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (confirmDelete) {
                  remove('blueprints', confirmDelete.id);
                  toast.success('Blueprint deleted');
                }
                setConfirmDelete(null);
              }}
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-soft">
          <b className="text-ink">{confirmDelete?.title}</b> will be removed. Quotes and projects
          already made from it are unaffected.
        </p>
      </Modal>
    </div>
  );
}
