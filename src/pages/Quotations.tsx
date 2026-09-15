import { useEffect, useState } from 'react';
import {
  ArrowUpRight,
  CheckCircle2,
  Download,
  Edit2,
  LayoutTemplate,
  Plus,
  Save,
  ScrollText,
  Send,
  Trash2,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  StatCard,
  StatusPill,
} from '@/src/components/ui';
import {
  MilestoneEditor,
  cloneMilestones,
  milestonesTotal,
  newMilestone,
} from '@/src/components/MilestoneEditor';
import { formatCurrency, formatDate } from '@/src/lib/utils';
import { quoteTotal } from '@/src/lib/finance';
import { downloadQuotePdf } from '@/src/lib/pdf';
import { freshPhases, useStudio } from '@/src/store/StudioStore';
import {
  BLUEPRINT_CATEGORIES,
  type Blueprint,
  type Quote,
  type QuoteMilestone,
  type QuoteStatus,
  type TrackerPhase,
} from '@/src/types';

const STATUSES: QuoteStatus[] = ['draft', 'sent', 'accepted', 'rejected', 'expired'];

const STATUS_TONE: Record<QuoteStatus, 'positive' | 'danger' | 'warning' | 'neutral'> = {
  accepted: 'positive',
  rejected: 'danger',
  sent: 'warning',
  expired: 'neutral',
  draft: 'neutral',
};

type FormState = {
  number: string;
  title: string;
  clientId: string;
  validUntil: string;
  timelineDays: string;
  status: QuoteStatus;
  milestones: QuoteMilestone[];
  blueprintId: string;
};

const blankForm = (count: number): FormState => ({
  number: `QT-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`,
  title: '',
  clientId: '',
  validUntil: '',
  timelineDays: '28',
  status: 'draft',
  milestones: [newMilestone()],
  blueprintId: '',
});

/**
 * A quote with no blueprint still converts into a real tracker: each milestone
 * becomes a phase and its line items the deliverables. That's what makes a
 * from-scratch quote for any business line trackable without extra setup.
 */
function phasesFromMilestones(milestones: QuoteMilestone[]): TrackerPhase[] {
  return milestones.map((m) => ({
    id: m.id,
    name: m.title || 'Phase',
    budget: m.tasks.reduce((s, t) => s + (Number(t.price) || 0), 0),
    link: '',
    deliverables: m.tasks
      .filter((t) => t.title.trim())
      .map((t) => ({ id: t.id, title: t.title.trim(), description: '', done: false })),
  }));
}

export default function Quotations() {
  const { quotes, clients, blueprints, settings, clientFor, add, update, remove, createProject } =
    useStudio();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(() => blankForm(0));
  const [confirmDelete, setConfirmDelete] = useState<Quote | null>(null);

  const openAdd = () => {
    setEditingId(null);
    setForm(blankForm(quotes.length));
    setIsOpen(true);
  };

  const openEdit = (quote: Quote) => {
    setEditingId(quote.id);
    setForm({
      number: quote.number,
      title: quote.title,
      clientId: quote.clientId,
      validUntil: quote.validUntil,
      timelineDays: String(quote.timelineDays),
      status: quote.status,
      milestones: quote.milestones,
      blueprintId: quote.blueprintId ?? '',
    });
    setIsOpen(true);
  };

  /** Seed the quote from a blueprint: title, breakdown and duration, with fresh ids. */
  const applyBlueprint = (bp: Blueprint) => {
    setForm((prev) => ({
      ...prev,
      title: prev.title || `${bp.title} Engagement`,
      milestones: cloneMilestones(bp.milestones),
      timelineDays: String(bp.timelineDays),
      blueprintId: bp.id,
    }));
    toast.success(`${bp.title} applied`);
  };

  // "Quote from this" on the Blueprints page lands here with ?blueprint=ID.
  useEffect(() => {
    const id = searchParams.get('blueprint');
    if (!id) return;
    const bp = blueprints.find((b) => b.id === id);
    setSearchParams({}, { replace: true });
    if (!bp) return;
    setEditingId(null);
    setForm({ ...blankForm(quotes.length), blueprintId: bp.id });
    setIsOpen(true);
    applyBlueprint(bp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, blueprints]);

  /* Save the current breakdown back to the library for next time. */
  const [saveAsOpen, setSaveAsOpen] = useState(false);
  const [saveAs, setSaveAs] = useState({ title: '', category: 'Branding' });
  const saveAsBlueprint = (e: React.FormEvent) => {
    e.preventDefault();
    if (!saveAs.title.trim()) {
      toast.error('Name the blueprint');
      return;
    }
    const milestones = cloneMilestones(form.milestones.filter((m) => m.tasks.some((t) => t.title.trim())));
    const created = add('blueprints', {
      title: saveAs.title.trim(),
      category: saveAs.category.trim() || 'Other',
      description: '',
      milestones,
      phases: phasesFromMilestones(milestones),
      timeline: [],
      timelineDays: Number(form.timelineDays) || 28,
      createdAt: new Date().toISOString().slice(0, 10),
    });
    setForm((prev) => ({ ...prev, blueprintId: created.id }));
    setSaveAsOpen(false);
    toast.success(`Saved as blueprint — refine its workflow under Blueprints`);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.clientId) {
      toast.error('Title and client are required');
      return;
    }
    const payload = {
      number: form.number.trim(),
      title: form.title.trim(),
      clientId: form.clientId,
      validUntil: form.validUntil || new Date().toISOString().slice(0, 10),
      timelineDays: Number(form.timelineDays) || 0,
      status: form.status,
      milestones: form.milestones.filter((m) => m.tasks.some((t) => t.title.trim())),
      blueprintId: form.blueprintId || undefined,
    };
    if (editingId) {
      update('quotes', editingId, payload);
      toast.success('Quote updated');
    } else {
      add('quotes', payload);
      toast.success('Quote created');
    }
    setIsOpen(false);
  };

  /** Turn an accepted quote into a tracked project without re-keying anything. */
  const convert = (quote: Quote) => {
    const bp = quote.blueprintId ? blueprints.find((b) => b.id === quote.blueprintId) : undefined;
    const project = createProject({
      name: quote.title,
      clientId: quote.clientId,
      packageName: bp?.title ?? 'Custom (from quote)',
      blueprint: bp,
      // No blueprint workflow to lean on? Build the tracker from the quote itself.
      ...(bp && bp.phases.length ? {} : { phases: freshPhases(phasesFromMilestones(quote.milestones)) }),
      startDate: new Date().toISOString().slice(0, 10),
      targetDelivery: new Date(Date.now() + quote.timelineDays * 86_400_000)
        .toISOString()
        .slice(0, 10),
      summary: `Converted from quote ${quote.number}.`,
    });
    update('quotes', quote.id, { status: 'accepted', convertedProjectId: project.id });
    toast.success('Quote converted to a tracked project');
    navigate(`/admin/tracker/${project.id}`);
  };

  const pipeline = quotes
    .filter((q) => q.status === 'sent')
    .reduce((sum, q) => sum + quoteTotal(q), 0);
  const won = quotes
    .filter((q) => q.status === 'accepted')
    .reduce((sum, q) => sum + quoteTotal(q), 0);

  return (
    <div className="max-w-[1400px] space-y-6">
      <PageHeader
        title="Quotations"
        subtitle="Sent quotes appear in the client's portal, where they can accept or decline."
        actions={
          <Button icon={Plus} onClick={openAdd}>
            New Quote
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <StatCard icon={ScrollText} tone="purple" value={quotes.length} label="Total Quotes" />
        <StatCard
          icon={Send}
          tone="gold"
          value={formatCurrency(pipeline)}
          label="Awaiting Decision"
        />
        <StatCard
          icon={CheckCircle2}
          tone="positive"
          value={formatCurrency(won)}
          label="Accepted Value"
        />
      </div>

      {quotes.length === 0 ? (
        <Card>
          <EmptyState
            icon={ScrollText}
            title="No quotes yet"
            description="Build a priced breakdown and send it to a client's portal."
            action={
              <Button icon={Plus} onClick={openAdd}>
                New Quote
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-5">
          {quotes.map((quote) => (
            <Card key={quote.id} className="p-6 group">
              <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">
                    {quote.number} · {clientFor(quote)?.name ?? '—'}
                  </div>
                  <h3 className="disp text-xl font-extrabold text-ink mt-0.5">{quote.title}</h3>
                  <p className="text-xs text-ink-soft mt-1">
                    Valid until {formatDate(quote.validUntil)} · ~{quote.timelineDays} day delivery
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-extrabold text-purple">
                    {formatCurrency(quoteTotal(quote))}
                  </div>
                  <StatusPill tone={STATUS_TONE[quote.status]} className="mt-1">
                    {quote.status}
                  </StatusPill>
                </div>
              </div>

              <div className="grid gap-2.5 sm:grid-cols-2">
                {quote.milestones.map((milestone) => (
                  <div key={milestone.id} className="bg-surface-2 rounded-[10px] p-4">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <h4 className="font-bold text-[13px] text-ink">{milestone.title}</h4>
                      <span className="text-[13px] font-bold text-ink-soft">
                        {formatCurrency(milestone.tasks.reduce((s, t) => s + t.price, 0))}
                      </span>
                    </div>
                    <ul className="space-y-1">
                      {milestone.tasks.map((task) => (
                        <li
                          key={task.id}
                          className="flex items-center justify-between gap-3 text-[12px] text-ink-soft"
                        >
                          <span className="truncate">{task.title}</span>
                          <span className="font-semibold shrink-0">
                            {formatCurrency(task.price)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 mt-5 pt-4 border-t border-line flex-wrap">
                {quote.status === 'draft' ? (
                  <Button
                    size="sm"
                    icon={Send}
                    onClick={() => {
                      update('quotes', quote.id, { status: 'sent' });
                      toast.success("Quote sent — it's now in the client's portal");
                    }}
                  >
                    Send to Client
                  </Button>
                ) : null}
                {quote.status === 'accepted' && !quote.convertedProjectId ? (
                  <Button size="sm" variant="purple" icon={ArrowUpRight} onClick={() => convert(quote)}>
                    Convert to Project
                  </Button>
                ) : null}
                {quote.convertedProjectId ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={ArrowUpRight}
                    onClick={() => navigate(`/admin/tracker/${quote.convertedProjectId}`)}
                  >
                    Open Project
                  </Button>
                ) : null}
                <div className="flex items-center gap-1 ml-auto">
                  <button
                    onClick={() => downloadQuotePdf({ quote, client: clientFor(quote), settings })}
                    title="Download PDF"
                    className="p-2 text-ink-faint hover:text-orange hover:bg-orange-dim rounded-lg transition-colors"
                  >
                    <Download size={15} />
                  </button>
                  <button
                    onClick={() => openEdit(quote)}
                    title="Edit"
                    className="p-2 text-ink-faint hover:text-purple hover:bg-purple-dim rounded-lg transition-colors"
                  >
                    <Edit2 size={15} />
                  </button>
                  <button
                    onClick={() => setConfirmDelete(quote)}
                    title="Delete"
                    className="p-2 text-ink-faint hover:text-red hover:bg-red-dim rounded-lg transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={isOpen}
        onClose={() => setIsOpen(false)}
        title={editingId ? 'Edit Quote' : 'New Quote'}
        subtitle="The total is calculated from the line items below"
        width="max-w-2xl"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="quote-form">
              {editingId ? 'Save Changes' : 'Create Quote'}
            </Button>
          </>
        }
      >
        <form id="quote-form" onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Quote Number">
              <Input
                value={form.number}
                onChange={(e) => setForm({ ...form, number: e.target.value })}
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
          </div>

          <Field label="Title">
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Serene Haven — Brand Foundation"
            />
          </Field>

          <Field
            label="Start from a blueprint"
            hint="Optional — pre-fills the breakdown and duration. Or build from scratch below."
          >
            <div className="flex gap-2">
              <Select
                value={form.blueprintId}
                onChange={(e) => {
                  const bp = blueprints.find((b) => b.id === e.target.value);
                  if (bp) applyBlueprint(bp);
                  else setForm({ ...form, blueprintId: '' });
                }}
              >
                <option value="">From scratch</option>
                {[...new Set(blueprints.map((b) => b.category))].sort().map((cat) => (
                  <optgroup key={cat} label={cat}>
                    {blueprints
                      .filter((b) => b.category === cat)
                      .map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.title} · {formatCurrency(milestonesTotal(b.milestones))}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </Select>
              <Button
                type="button"
                variant="secondary"
                icon={LayoutTemplate}
                onClick={() => navigate('/admin/blueprints')}
                title="Manage blueprints"
              >
                Library
              </Button>
            </div>
          </Field>

          <div className="grid grid-cols-3 gap-4">
            <Field label="Valid Until">
              <Input
                type="date"
                value={form.validUntil}
                onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
              />
            </Field>
            <Field label="Timeline (days)">
              <Input
                type="number"
                min="1"
                value={form.timelineDays}
                onChange={(e) => setForm({ ...form, timelineDays: e.target.value })}
              />
            </Field>
            <Field label="Status">
              <Select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as QuoteStatus })}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <MilestoneEditor
            value={form.milestones}
            onChange={(milestones) => setForm({ ...form, milestones })}
          />

          {/* From-scratch breakdowns are worth keeping. */}
          {form.milestones.some((m) => m.tasks.some((t) => t.title.trim())) ? (
            <button
              type="button"
              onClick={() => {
                setSaveAs({ title: form.title.trim(), category: 'Branding' });
                setSaveAsOpen(true);
              }}
              className="text-xs font-bold text-purple hover:text-orange flex items-center gap-1.5"
            >
              <Save size={13} /> Save this breakdown as a blueprint for next time
            </button>
          ) : null}
        </form>
      </Modal>

      <Modal
        open={saveAsOpen}
        onClose={() => setSaveAsOpen(false)}
        title="Save as blueprint"
        subtitle="The breakdown becomes reusable; refine its workflow and timeline under Blueprints"
        footer={
          <>
            <Button variant="ghost" onClick={() => setSaveAsOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="save-as-form" icon={Save}>
              Save Blueprint
            </Button>
          </>
        }
      >
        <form id="save-as-form" onSubmit={saveAsBlueprint} className="space-y-4">
          <Field label="Blueprint name">
            <Input
              autoFocus
              value={saveAs.title}
              onChange={(e) => setSaveAs({ ...saveAs, title: e.target.value })}
              placeholder="e.g. Podcast Launch Package"
            />
          </Field>
          <Field label="Business line">
            <Input
              list="save-as-categories"
              value={saveAs.category}
              onChange={(e) => setSaveAs({ ...saveAs, category: e.target.value })}
            />
            <datalist id="save-as-categories">
              {[...new Set([...BLUEPRINT_CATEGORIES, ...blueprints.map((b) => b.category)])].map(
                (c) => (
                  <option key={c} value={c} />
                ),
              )}
            </datalist>
          </Field>
        </form>
      </Modal>

      <Modal
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        title="Delete quote?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (confirmDelete) {
                  remove('quotes', confirmDelete.id);
                  toast.success('Quote deleted');
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
          <b className="text-ink">{confirmDelete?.title}</b> will be removed for you and the client.
        </p>
      </Modal>
    </div>
  );
}
