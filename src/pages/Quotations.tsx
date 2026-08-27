import { useState } from 'react';
import {
  ArrowUpRight,
  CheckCircle2,
  Edit2,
  Plus,
  ScrollText,
  Send,
  Trash2,
  X,
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
  StatCard,
  StatusPill,
} from '@/src/components/ui';
import { BRANDING_PACKAGES, type TierId } from '@/src/brand';
import { cn, formatCurrency, formatDate } from '@/src/lib/utils';
import { quoteTotal } from '@/src/lib/finance';
import { useStudio } from '@/src/store/StudioStore';
import type { Quote, QuoteMilestone, QuoteStatus } from '@/src/types';

const STATUSES: QuoteStatus[] = ['draft', 'sent', 'accepted', 'rejected', 'expired'];

const STATUS_TONE: Record<QuoteStatus, 'positive' | 'danger' | 'warning' | 'neutral'> = {
  accepted: 'positive',
  rejected: 'danger',
  sent: 'warning',
  expired: 'neutral',
  draft: 'neutral',
};

let seq = 0;
const uid = (p: string) => `${p}-${Date.now().toString(36)}-${(seq++).toString(36)}`;

type FormState = {
  number: string;
  title: string;
  clientId: string;
  validUntil: string;
  timelineDays: string;
  status: QuoteStatus;
  milestones: QuoteMilestone[];
};

const blankForm = (count: number): FormState => ({
  number: `QT-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`,
  title: '',
  clientId: '',
  validUntil: '',
  timelineDays: '28',
  status: 'draft',
  milestones: [{ id: uid('qm'), title: 'Phase 1', tasks: [{ id: uid('qt'), title: '', price: 0 }] }],
});

export default function Quotations() {
  const { quotes, clients, clientFor, add, update, remove, createProject } = useStudio();
  const navigate = useNavigate();

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
    });
    setIsOpen(true);
  };

  /** Seed the milestone breakdown from a standard package rather than typing it out. */
  const applyPackage = (tier: TierId) => {
    const pkg = BRANDING_PACKAGES.find((p) => p.id === tier)!;
    setForm((prev) => ({
      ...prev,
      title: prev.title || `${pkg.name} Engagement`,
      milestones: [
        {
          id: uid('qm'),
          title: pkg.name,
          tasks: pkg.includes.slice(0, 4).map((line, idx, arr) => ({
            id: uid('qt'),
            title: line,
            // Spread the package price evenly, remainder on the last line.
            price:
              idx === arr.length - 1
                ? pkg.price - Math.floor(pkg.price / arr.length) * (arr.length - 1)
                : Math.floor(pkg.price / arr.length),
          })),
        },
      ],
    }));
    toast.success(`${pkg.name} breakdown applied`);
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
    const project = createProject({
      name: quote.title,
      clientId: quote.clientId,
      tier: 'wolf',
      packageName: 'Custom (from quote)',
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

          <Field label="Start from a package" hint="Optional — pre-fills the breakdown">
            <div className="grid grid-cols-3 gap-2">
              {BRANDING_PACKAGES.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPackage(p.id)}
                  className="rounded-lg border-2 border-line p-2.5 text-left hover:border-orange transition-colors"
                >
                  <div className="font-bold text-xs text-ink">{p.name}</div>
                  <div className="text-[11px] text-ink-soft">{formatCurrency(p.price)}</div>
                </button>
              ))}
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

          {/* Milestone / line-item editor */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-ink">Breakdown</span>
              <span className="text-sm font-extrabold text-purple">
                {formatCurrency(
                  form.milestones.reduce(
                    (s, m) => s + m.tasks.reduce((ts, t) => ts + (Number(t.price) || 0), 0),
                    0,
                  ),
                )}
              </span>
            </div>

            {form.milestones.map((milestone, mIdx) => (
              <div key={milestone.id} className="bg-surface-2 rounded-[10px] p-3.5 space-y-2">
                <div className="flex gap-2">
                  <Input
                    value={milestone.title}
                    onChange={(e) => {
                      const next = [...form.milestones];
                      next[mIdx] = { ...milestone, title: e.target.value };
                      setForm({ ...form, milestones: next });
                    }}
                    placeholder="Milestone title"
                    className="font-bold"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setForm({
                        ...form,
                        milestones: form.milestones.filter((m) => m.id !== milestone.id),
                      })
                    }
                    className="p-2 text-ink-faint hover:text-red shrink-0"
                    aria-label="Remove milestone"
                  >
                    <X size={16} />
                  </button>
                </div>

                {milestone.tasks.map((task, tIdx) => (
                  <div key={task.id} className="flex gap-2">
                    <Input
                      value={task.title}
                      onChange={(e) => {
                        const next = [...form.milestones];
                        const tasks = [...milestone.tasks];
                        tasks[tIdx] = { ...task, title: e.target.value };
                        next[mIdx] = { ...milestone, tasks };
                        setForm({ ...form, milestones: next });
                      }}
                      placeholder="Line item"
                    />
                    <Input
                      type="number"
                      min="0"
                      value={task.price}
                      onChange={(e) => {
                        const next = [...form.milestones];
                        const tasks = [...milestone.tasks];
                        tasks[tIdx] = { ...task, price: Number(e.target.value) || 0 };
                        next[mIdx] = { ...milestone, tasks };
                        setForm({ ...form, milestones: next });
                      }}
                      className="w-28 shrink-0"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const next = [...form.milestones];
                        next[mIdx] = {
                          ...milestone,
                          tasks: milestone.tasks.filter((t) => t.id !== task.id),
                        };
                        setForm({ ...form, milestones: next });
                      }}
                      className="p-2 text-ink-faint hover:text-red shrink-0"
                      aria-label="Remove line"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => {
                    const next = [...form.milestones];
                    next[mIdx] = {
                      ...milestone,
                      tasks: [...milestone.tasks, { id: uid('qt'), title: '', price: 0 }],
                    };
                    setForm({ ...form, milestones: next });
                  }}
                  className="text-[11px] font-bold text-ink-faint hover:text-orange flex items-center gap-1"
                >
                  <Plus size={12} /> Add line item
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={() =>
                setForm({
                  ...form,
                  milestones: [
                    ...form.milestones,
                    {
                      id: uid('qm'),
                      title: `Phase ${form.milestones.length + 1}`,
                      tasks: [{ id: uid('qt'), title: '', price: 0 }],
                    },
                  ],
                })
              }
              className={cn(
                'w-full py-2 border border-dashed border-line rounded-lg',
                'text-xs font-bold text-ink-soft hover:border-orange hover:text-orange transition-colors',
              )}
            >
              + Add milestone
            </button>
          </div>
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
