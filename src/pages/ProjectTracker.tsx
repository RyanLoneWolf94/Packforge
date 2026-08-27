import { CalendarDays, ExternalLink, FolderOpen, Palette, Plus, Wallet } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ActionItems,
  BrandSnapshotPanel,
  DeliveryTimeline,
  PhaseTracker,
  PortalShareButton,
  TrackerSummary,
} from '@/src/components/tracker/PhaseTracker';
import {
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  MetaPill,
  Modal,
  PageHeader,
  ProgressBar,
  Select,
  StatusPill,
  Textarea,
} from '@/src/components/ui';
import { BRANDING_PACKAGES, type TierId } from '@/src/brand';
import { cn, formatCurrency, formatDate } from '@/src/lib/utils';
import {
  projectBudget,
  projectEarned,
  projectHealth,
  projectProgress,
} from '@/src/lib/tracker';
import { useStudio } from '@/src/store/StudioStore';
import type { Project } from '@/src/types';

/**
 * Admin-side project tracker. This is the editable half of the client
 * dashboard: ticking a deliverable here is what the client sees in their
 * portal, since both render `<PhaseTracker>` off the same store.
 */

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

export default function ProjectTracker() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { projects, clientFor, addActionItem } = useStudio();

  const selected = projects.find((p) => p.id === projectId) ?? projects[0];

  const [isNewOpen, setIsNewOpen] = useState(false);
  const [isActionOpen, setIsActionOpen] = useState(false);
  const [isSnapshotOpen, setIsSnapshotOpen] = useState(false);

  if (projects.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={FolderOpen}
          title="No projects yet"
          description="Create a project from a service package to generate its phase tracker automatically."
          action={<Button icon={Plus} onClick={() => setIsNewOpen(true)}>New Project</Button>}
        />
        <NewProjectModal open={isNewOpen} onClose={() => setIsNewOpen(false)} />
      </Card>
    );
  }

  const client = selected ? clientFor(selected) : undefined;
  const health = projectHealth(selected);
  const stagesDone = selected.timeline.filter((w) => w.done).length;

  return (
    <div className="max-w-[1400px] space-y-6">
      <PageHeader
        title="Project Tracker"
        subtitle="Tick deliverables here — the client portal updates instantly."
        actions={
          <>
            {client ? <PortalShareButton token={client.portalToken} /> : null}
            <Button icon={Plus} onClick={() => setIsNewOpen(true)}>
              New Project
            </Button>
          </>
        }
      />

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Project rail */}
        <div className="w-full lg:w-[280px] shrink-0 space-y-3">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-ink-faint px-1">
            Projects ({projects.length})
          </h3>
          {projects.map((project) => {
            const p = projectProgress(project).pct;
            const isActive = project.id === selected.id;
            return (
              <Link
                key={project.id}
                to={`/admin/tracker/${project.id}`}
                className={cn(
                  'block bg-surface rounded-xl p-4 border shadow-sm transition-all hover:shadow-md',
                  isActive ? 'border-orange ring-1 ring-orange' : 'border-line',
                )}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h4 className="font-bold text-ink text-sm leading-tight">{project.name}</h4>
                  <StatusPill tone={HEALTH_TONE[projectHealth(project)]}>
                    {HEALTH_LABEL[projectHealth(project)]}
                  </StatusPill>
                </div>
                <p className="text-xs text-ink-soft mb-3">
                  {clientFor(project)?.name ?? 'Unassigned'}
                </p>
                <div className="flex items-center justify-between text-[11px] font-medium text-ink-soft uppercase tracking-wide mb-1.5">
                  <span>{project.packageName}</span>
                  <span className="text-ink font-bold">{p}%</span>
                </div>
                <ProgressBar value={p} tone={isActive ? 'orange' : 'purple'} className="h-1.5" />
              </Link>
            );
          })}
        </div>

        {/* Detail */}
        <div className="flex-1 min-w-0 space-y-8">
          <section className="space-y-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-2 text-[12.5px] font-bold uppercase tracking-wider text-purple mb-2">
                  <span className="w-4 h-0.5 bg-orange inline-block" />
                  Ref {selected.ref} · {selected.packageName}
                </div>
                <h2 className="disp text-3xl font-extrabold text-ink leading-tight">
                  {selected.name}
                </h2>
                <p className="text-ink-soft mt-1.5 max-w-2xl">{selected.summary}</p>
              </div>
              <StatusPill tone={HEALTH_TONE[health]}>{HEALTH_LABEL[health]}</StatusPill>
            </div>

            <div className="flex gap-2.5 flex-wrap">
              {client ? (
                <MetaPill>
                  Client: <b className="text-ink">{client.name}</b>
                </MetaPill>
              ) : null}
              <MetaPill>
                <CalendarDays size={13} /> Started {formatDate(selected.startDate)}
              </MetaPill>
              <MetaPill>
                Target <b className="text-ink">{formatDate(selected.targetDelivery)}</b>
              </MetaPill>
              <MetaPill>
                <Wallet size={13} /> Value{' '}
                <b className="text-ink">{formatCurrency(projectBudget(selected))}</b>
              </MetaPill>
              <MetaPill>
                Earned{' '}
                <b className="text-ink">{formatCurrency(Math.round(projectEarned(selected)))}</b>
              </MetaPill>
              {client ? (
                <Link
                  to={`/portal/${client.portalToken}`}
                  target="_blank"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-purple-dim text-purple border border-purple/20 hover:bg-purple hover:text-white transition-colors"
                >
                  <ExternalLink size={13} /> Preview client view
                </Link>
              ) : null}
            </div>

            <TrackerSummary project={selected} />
          </section>

          <ActionItems project={selected} mode="admin" />

          <section>
            <SectionHead
              title="Phases & Deliverables"
              sub="Click any deliverable to mark it done"
              action={
                <Button variant="secondary" size="sm" icon={Plus} onClick={() => setIsActionOpen(true)}>
                  Request from client
                </Button>
              }
            />
            <PhaseTracker project={selected} mode="admin" />
          </section>

          <section>
            <SectionHead
              title="Delivery Timeline"
              sub={`${stagesDone} of ${selected.timeline.length} stages signed off`}
            />
            <DeliveryTimeline project={selected} mode="admin" />
          </section>

          <section>
            <SectionHead
              title="Brand Snapshot"
              sub="Each field you fill in appears immediately in the client portal"
              action={
                <Button
                  variant="secondary"
                  size="sm"
                  icon={Palette}
                  onClick={() => setIsSnapshotOpen(true)}
                >
                  Edit snapshot
                </Button>
              }
            />
            <BrandSnapshotPanel project={selected} />
          </section>
        </div>
      </div>

      <NewProjectModal
        open={isNewOpen}
        onClose={() => setIsNewOpen(false)}
        onCreated={(id) => navigate(`/admin/tracker/${id}`)}
      />

      <RequestFromClientModal
        open={isActionOpen}
        onClose={() => setIsActionOpen(false)}
        onSubmit={(title, detail) => {
          addActionItem(selected.id, title, detail);
          toast.success('Added to the client’s action list');
        }}
      />

      <BrandSnapshotModal
        key={selected.id}
        project={selected}
        open={isSnapshotOpen}
        onClose={() => setIsSnapshotOpen(false)}
      />
    </div>
  );
}

function SectionHead({
  title,
  sub,
  action,
}: {
  title: string;
  sub?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 flex-wrap mb-4">
      <div>
        <h3 className="disp text-xl font-extrabold text-ink">{title}</h3>
        {sub ? <p className="text-sm text-ink-soft mt-0.5">{sub}</p> : null}
      </div>
      {action}
    </div>
  );
}

function NewProjectModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: (id: string) => void;
}) {
  const { clients, createProject } = useStudio();
  const [form, setForm] = useState({
    name: '',
    clientId: '',
    tier: 'wolf' as TierId,
    startDate: new Date().toISOString().slice(0, 10),
    targetDelivery: '',
    summary: '',
  });

  const pkg = BRANDING_PACKAGES.find((p) => p.id === form.tier)!;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.clientId) {
      toast.error('Project name and client are required');
      return;
    }
    const project = createProject({
      name: form.name.trim(),
      clientId: form.clientId,
      tier: form.tier,
      packageName: pkg.name,
      startDate: form.startDate,
      targetDelivery:
        form.targetDelivery ||
        new Date(Date.now() + 28 * 86_400_000).toISOString().slice(0, 10),
      summary: form.summary.trim() || pkg.bestFor,
    });
    toast.success(`${project.name} created with ${project.phases.length} phases`);
    onCreated?.(project.id);
    onClose();
    setForm({
      name: '',
      clientId: '',
      tier: 'wolf',
      startDate: new Date().toISOString().slice(0, 10),
      targetDelivery: '',
      summary: '',
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Project"
      subtitle="Picking a package seeds the phases, deliverables and budget split"
      width="max-w-lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="new-tracker-project">
            Create Project
          </Button>
        </>
      }
    >
      <form id="new-tracker-project" onSubmit={submit} className="space-y-4">
        <Field label="Project Name">
          <Input
            autoFocus
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Serene Haven Rebrand"
          />
        </Field>

        <Field label="Client">
          <Select
            value={form.clientId}
            onChange={(e) => setForm({ ...form, clientId: e.target.value })}
          >
            <option value="">Select a client…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Service Package" hint={pkg.bestFor}>
          <div className="grid grid-cols-3 gap-2">
            {BRANDING_PACKAGES.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setForm({ ...form, tier: p.id })}
                className={cn(
                  'rounded-lg border-2 p-3 text-left transition-colors',
                  form.tier === p.id
                    ? 'border-orange bg-orange-dim'
                    : 'border-line hover:border-ink-faint',
                )}
              >
                <div className="font-bold text-sm text-ink">{p.name}</div>
                <div className="text-xs text-ink-soft">{formatCurrency(p.price)}</div>
              </button>
            ))}
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Start Date">
            <Input
              type="date"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
            />
          </Field>
          <Field label="Target Delivery">
            <Input
              type="date"
              value={form.targetDelivery}
              onChange={(e) => setForm({ ...form, targetDelivery: e.target.value })}
            />
          </Field>
        </div>

        <Field label="Summary" hint="Shown at the top of the client portal">
          <Textarea
            rows={3}
            value={form.summary}
            onChange={(e) => setForm({ ...form, summary: e.target.value })}
            placeholder={pkg.bestFor}
          />
        </Field>
      </form>
    </Modal>
  );
}

/**
 * Editor for the client's emerging identity. Fields are independent — leaving
 * one blank simply keeps it listed as "still to come" in the portal, which is
 * what makes the snapshot reveal progressively rather than all at once.
 */
function BrandSnapshotModal({
  project,
  open,
  onClose,
}: {
  project: Project;
  open: boolean;
  onClose: () => void;
}) {
  const { update } = useStudio();
  const snap = project.brandSnapshot;

  const [name, setName] = useState(snap?.name ?? '');
  const [tagline, setTagline] = useState(snap?.tagline ?? '');
  const [typography, setTypography] = useState(snap?.typography ?? '');
  const [logoUrl, setLogoUrl] = useState(snap?.logoUrl ?? '');
  // Freeform "Label #hex" per line — quicker to paste from a palette than a grid of inputs.
  const [paletteText, setPaletteText] = useState(
    (snap?.palette ?? []).map((p) => `${p.label} ${p.hex}`).join('\n'),
  );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();

    const palette = paletteText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const match = line.match(/(#[0-9a-fA-F]{3,8})\s*$/);
        const hex = match ? match[1] : '#CCCCCC';
        const label = (match ? line.slice(0, match.index).trim() : line) || 'Colour';
        return { label, hex };
      });

    update('projects', project.id, {
      brandSnapshot: {
        name: name.trim() || undefined,
        tagline: tagline.trim() || undefined,
        typography: typography.trim() || undefined,
        logoUrl: logoUrl.trim() || undefined,
        palette: palette.length ? palette : undefined,
      },
    });
    toast.success('Brand snapshot updated — visible to the client now');
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Brand Snapshot"
      subtitle="Leave a field blank to keep it hidden until it's approved"
      width="max-w-lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="snapshot-form">
            Save Snapshot
          </Button>
        </>
      }
    >
      <form id="snapshot-form" onSubmit={submit} className="space-y-4">
        <Field label="Approved Name" hint="The final business or brand name">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Rise & Crumb" />
        </Field>
        <Field label="Tagline">
          <Input
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            placeholder="e.g. Baked Before Dawn"
          />
        </Field>
        <Field
          label="Colour System"
          hint="One per line, label then hex — e.g. “Highland Green #2F4B3F”"
        >
          <Textarea
            rows={4}
            value={paletteText}
            onChange={(e) => setPaletteText(e.target.value)}
            placeholder={'Primary #FF6B00\nDeep Purple #5B0FA8'}
          />
        </Field>
        <Field label="Typography">
          <Input
            value={typography}
            onChange={(e) => setTypography(e.target.value)}
            placeholder="e.g. Montserrat / Lora"
          />
        </Field>
        <Field label="Logo Image URL" hint="Optional — shown at the top of the snapshot">
          <Input
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            placeholder="https://…"
          />
        </Field>
      </form>
    </Modal>
  );
}

function RequestFromClientModal({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (title: string, detail: string) => void;
}) {
  const [title, setTitle] = useState('');
  const [detail, setDetail] = useState('');

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Request From Client"
      subtitle="Appears as an “Action Needed” item in their portal"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="request-form">
            Add Request
          </Button>
        </>
      }
    >
      <form
        id="request-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return;
          onSubmit(title.trim(), detail.trim());
          setTitle('');
          setDetail('');
          onClose();
        }}
        className="space-y-4"
      >
        <Field label="What do you need?">
          <Input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Confirm domain & registrar preference"
          />
        </Field>
        <Field label="Why it matters" hint="Give the client the context to act on it">
          <Textarea
            rows={3}
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            placeholder="Needed before Phase 3 technical setup begins…"
          />
        </Field>
      </form>
    </Modal>
  );
}
