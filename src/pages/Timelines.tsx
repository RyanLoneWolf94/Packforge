import { useState } from 'react';
import {
  ChevronDown,
  Clock,
  Layers,
  Plus,
  Rocket,
  Trash2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
} from '@/src/components/ui';
import { cn } from '@/src/lib/utils';
import { useStudio } from '@/src/store/StudioStore';
import type { PlanPhase, PlanTemplate } from '@/src/types';

/**
 * Reusable delivery blueprints. Beyond documenting a standard plan, a blueprint
 * can seed a real project: "Use blueprint" creates a custom project whose
 * tracker phases mirror the blueprint, then drops the studio into it.
 */

const TONE_BG: Record<PlanPhase['tone'], string> = {
  orange: 'bg-orange',
  purple: 'bg-purple',
  gold: 'bg-gold',
  red: 'bg-red',
  positive: 'bg-positive',
};

const TONES = Object.keys(TONE_BG) as PlanPhase['tone'][];

let seq = 0;
const uid = (p: string) => `${p}-${Date.now().toString(36)}-${(seq++).toString(36)}`;

export default function Timelines() {
  const { planTemplates, clients, add, update, remove, createProject } = useStudio();
  const navigate = useNavigate();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [newForm, setNewForm] = useState({ title: '', description: '' });
  const [useTemplate, setUseTemplate] = useState<PlanTemplate | null>(null);

  const createTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newForm.title.trim()) return;
    const created = add('planTemplates', {
      title: newForm.title.trim(),
      description: newForm.description.trim() || 'Custom delivery blueprint',
      phases: [],
    });
    setIsNewOpen(false);
    setNewForm({ title: '', description: '' });
    setExpandedId(created.id);
    toast.success('Blueprint created — add phases to it');
  };

  const addPhase = (template: PlanTemplate) => {
    update('planTemplates', template.id, {
      phases: [
        ...template.phases,
        { id: uid('pp'), name: 'New Phase', days: 7, tone: TONES[template.phases.length % TONES.length] },
      ],
    });
  };

  const patchPhase = (template: PlanTemplate, phaseId: string, patch: Partial<PlanPhase>) => {
    update('planTemplates', template.id, {
      phases: template.phases.map((p) => (p.id === phaseId ? { ...p, ...patch } : p)),
    });
  };

  const removePhase = (template: PlanTemplate, phaseId: string) => {
    update('planTemplates', template.id, {
      phases: template.phases.filter((p) => p.id !== phaseId),
    });
  };

  return (
    <div className="max-w-[1200px] space-y-6">
      <PageHeader
        title="Delivery Blueprints"
        subtitle="Reusable phase plans. Use one to spin up a project in seconds."
        actions={
          <Button icon={Plus} onClick={() => setIsNewOpen(true)}>
            New Blueprint
          </Button>
        }
      />

      {planTemplates.length === 0 ? (
        <Card>
          <EmptyState
            icon={Layers}
            title="No blueprints yet"
            description="Build a standard set of phases you can reuse across projects."
            action={
              <Button icon={Plus} onClick={() => setIsNewOpen(true)}>
                New Blueprint
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {planTemplates.map((template) => {
            const totalDays = template.phases.reduce((s, p) => s + p.days, 0);
            const isOpen = expandedId === template.id;
            return (
              <Card key={template.id} className={cn(isOpen && 'border-orange')}>
                <div
                  onClick={() => setExpandedId(isOpen ? null : template.id)}
                  className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer group"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={cn(
                        'w-11 h-11 rounded-xl flex items-center justify-center transition-colors shrink-0',
                        isOpen ? 'bg-orange text-white' : 'bg-orange-dim text-orange',
                      )}
                    >
                      <Layers size={22} />
                    </div>
                    <div>
                      <h3 className="font-bold text-ink group-hover:text-orange transition-colors">
                        {template.title}
                      </h3>
                      <p className="text-sm text-ink-soft">{template.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="inline-flex items-center gap-1.5 text-[13px] font-bold text-ink-soft bg-surface-2 px-3 py-1.5 rounded-lg">
                      <Clock size={15} /> {totalDays}d
                    </span>
                    <span className="text-[13px] font-bold text-ink-soft bg-surface-2 px-3 py-1.5 rounded-lg">
                      {template.phases.length} phases
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setUseTemplate(template);
                      }}
                      className="p-2 text-ink-faint hover:text-orange hover:bg-orange-dim rounded-lg transition-colors"
                      title="Create a project from this blueprint"
                    >
                      <Rocket size={17} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        remove('planTemplates', template.id);
                        toast.success('Blueprint deleted');
                      }}
                      className="p-2 text-ink-faint hover:text-red hover:bg-red-dim rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={17} />
                    </button>
                    <ChevronDown
                      size={20}
                      className={cn('text-ink-faint transition-transform', isOpen && 'rotate-180')}
                    />
                  </div>
                </div>

                {isOpen ? (
                  <div className="p-5 pt-0">
                    <div className="bg-surface-2 rounded-xl p-5">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-bold text-ink text-sm">Phases</h4>
                        <Button size="sm" variant="secondary" icon={Plus} onClick={() => addPhase(template)}>
                          Add Phase
                        </Button>
                      </div>

                      {template.phases.length === 0 ? (
                        <div className="text-center py-8 bg-surface border border-dashed border-line rounded-xl">
                          <p className="text-sm text-ink-soft">No phases yet.</p>
                          <Button size="sm" className="mt-3" onClick={() => addPhase(template)}>
                            Add first phase
                          </Button>
                        </div>
                      ) : (
                        <>
                          {/* Gantt bar */}
                          <div className="h-6 w-full rounded-full overflow-hidden flex mb-5 bg-surface">
                            {template.phases.map((p) => (
                              <div
                                key={p.id}
                                className={cn('h-full', TONE_BG[p.tone])}
                                style={{ width: `${totalDays ? (p.days / totalDays) * 100 : 0}%` }}
                                title={`${p.name} · ${p.days}d`}
                              />
                            ))}
                          </div>

                          <div className="space-y-2">
                            {template.phases.map((phase, idx) => (
                              <div
                                key={phase.id}
                                className="bg-surface border border-line rounded-xl p-3 flex items-center gap-3"
                              >
                                <span className="w-6 h-6 rounded-full bg-surface-2 flex items-center justify-center text-[11px] font-extrabold text-ink-faint shrink-0">
                                  {idx + 1}
                                </span>
                                <Input
                                  value={phase.name}
                                  onChange={(e) =>
                                    patchPhase(template, phase.id, { name: e.target.value })
                                  }
                                  className="flex-1"
                                />
                                <div className="flex items-center gap-1 shrink-0">
                                  <Input
                                    type="number"
                                    min="1"
                                    value={phase.days}
                                    onChange={(e) =>
                                      patchPhase(template, phase.id, {
                                        days: Math.max(1, Number(e.target.value) || 1),
                                      })
                                    }
                                    className="w-20"
                                  />
                                  <span className="text-xs text-ink-faint">days</span>
                                </div>
                                <Select
                                  value={phase.tone}
                                  onChange={(e) =>
                                    patchPhase(template, phase.id, {
                                      tone: e.target.value as PlanPhase['tone'],
                                    })
                                  }
                                  className="w-28 shrink-0"
                                >
                                  {TONES.map((t) => (
                                    <option key={t} value={t}>
                                      {t}
                                    </option>
                                  ))}
                                </Select>
                                <button
                                  onClick={() => removePhase(template, phase.id)}
                                  className="p-1.5 text-ink-faint hover:text-red shrink-0"
                                  aria-label="Remove phase"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}

      {/* New blueprint */}
      <Modal
        open={isNewOpen}
        onClose={() => setIsNewOpen(false)}
        title="New Blueprint"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsNewOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="blueprint-form">
              Create Blueprint
            </Button>
          </>
        }
      >
        <form id="blueprint-form" onSubmit={createTemplate} className="space-y-4">
          <Field label="Title">
            <Input
              autoFocus
              value={newForm.title}
              onChange={(e) => setNewForm({ ...newForm, title: e.target.value })}
              placeholder="e.g. Enterprise Web Deployment"
            />
          </Field>
          <Field label="Description">
            <Input
              value={newForm.description}
              onChange={(e) => setNewForm({ ...newForm, description: e.target.value })}
              placeholder="Optional"
            />
          </Field>
        </form>
      </Modal>

      {/* Use blueprint → project */}
      <UseBlueprintModal
        template={useTemplate}
        clients={clients}
        onClose={() => setUseTemplate(null)}
        onCreate={(clientId, name) => {
          if (!useTemplate) return;
          const totalDays = useTemplate.phases.reduce((s, p) => s + p.days, 0) || 28;
          const project = createProject({
            name,
            clientId,
            tier: 'wolf',
            packageName: `Custom · ${useTemplate.title}`,
            startDate: new Date().toISOString().slice(0, 10),
            targetDelivery: new Date(Date.now() + totalDays * 86_400_000)
              .toISOString()
              .slice(0, 10),
            summary: `Delivered on the ${useTemplate.title} blueprint.`,
          });
          // Overlay the blueprint's phases onto the seeded tracker.
          update('projects', project.id, {
            phases: useTemplate.phases.map((p) => ({
              id: uid('ph'),
              name: p.name,
              budget: 0,
              link: '',
              deliverables: [],
            })),
            timeline: useTemplate.phases.map((p, i) => ({
              id: uid('wk'),
              label: `Stage ${i + 1}`,
              title: p.name,
              points: [`${p.days} days`],
              done: false,
            })),
          });
          toast.success('Project created from blueprint');
          navigate(`/admin/tracker/${project.id}`);
        }}
      />
    </div>
  );
}

function UseBlueprintModal({
  template,
  clients,
  onClose,
  onCreate,
}: {
  template: PlanTemplate | null;
  clients: { id: string; name: string }[];
  onClose: () => void;
  onCreate: (clientId: string, name: string) => void;
}) {
  const [clientId, setClientId] = useState('');
  const [name, setName] = useState('');

  return (
    <Modal
      open={Boolean(template)}
      onClose={onClose}
      title="Create Project From Blueprint"
      subtitle={template?.title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (!clientId || !name.trim()) {
                toast.error('Pick a client and name the project');
                return;
              }
              onCreate(clientId, name.trim());
              setClientId('');
              setName('');
            }}
          >
            Create Project
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Project Name">
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Acme Website Build"
          />
        </Field>
        <Field label="Client">
          <Select value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">Select a client…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <p className="text-xs text-ink-soft">
          The project's phases and timeline will mirror this blueprint. You can adjust budgets and
          deliverables afterwards in the tracker.
        </p>
      </div>
    </Modal>
  );
}
