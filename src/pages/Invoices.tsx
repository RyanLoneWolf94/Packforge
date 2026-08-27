import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  DollarSign,
  Download,
  Edit2,
  Plus,
  Receipt,
  Search,
  Trash2,
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
  Select,
  StatCard,
  StatusPill,
} from '@/src/components/ui';
import { cn, formatCurrency, formatDate, relativeDays } from '@/src/lib/utils';
import { isOverdue, outstandingTotal, paidTotal } from '@/src/lib/finance';
import { downloadInvoicePdf } from '@/src/lib/invoicePdf';
import { useStudio } from '@/src/store/StudioStore';
import type { Invoice, InvoiceStatus } from '@/src/types';

const STATUS_TONE: Record<InvoiceStatus, 'positive' | 'danger' | 'warning' | 'neutral'> = {
  paid: 'positive',
  overdue: 'danger',
  sent: 'warning',
  'partially-paid': 'warning',
  draft: 'neutral',
  cancelled: 'neutral',
};

const STATUSES: InvoiceStatus[] = [
  'draft',
  'sent',
  'partially-paid',
  'paid',
  'overdue',
  'cancelled',
];

type FormState = {
  number: string;
  clientId: string;
  projectId: string;
  amount: string;
  issueDate: string;
  dueDate: string;
  status: InvoiceStatus;
  notes: string;
};

const blankForm = (): FormState => ({
  number: '',
  clientId: '',
  projectId: '',
  amount: '',
  issueDate: new Date().toISOString().slice(0, 10),
  dueDate: '',
  status: 'draft',
  notes: '',
});

export default function Invoices() {
  const { invoices, clients, projects, settings, clientFor, projectFor, add, update, remove } =
    useStudio();

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | InvoiceStatus>('all');
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(blankForm);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return invoices
      .filter((i) => (statusFilter === 'all' ? true : i.status === statusFilter))
      .filter((i) => {
        if (!q) return true;
        const client = clientFor(i)?.name ?? '';
        return (
          i.number.toLowerCase().includes(q) ||
          client.toLowerCase().includes(q) ||
          i.notes.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.issueDate.localeCompare(a.issueDate));
  }, [invoices, query, statusFilter, clientFor]);

  const openAdd = () => {
    setEditingId(null);
    setForm({
      ...blankForm(),
      number: `LW-${new Date().getFullYear()}-${String(invoices.length + 1).padStart(3, '0')}`,
    });
    setIsOpen(true);
  };

  const openEdit = (invoice: Invoice) => {
    setEditingId(invoice.id);
    setForm({
      number: invoice.number,
      clientId: invoice.clientId,
      projectId: invoice.projectId ?? '',
      amount: String(invoice.amount),
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      status: invoice.status,
      notes: invoice.notes,
    });
    setIsOpen(true);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.number.trim() || !form.clientId || !form.amount) {
      toast.error('Number, client and amount are required');
      return;
    }
    const payload = {
      number: form.number.trim(),
      clientId: form.clientId,
      projectId: form.projectId || undefined,
      amount: Number(form.amount),
      issueDate: form.issueDate,
      dueDate: form.dueDate || form.issueDate,
      status: form.status,
      notes: form.notes.trim(),
    };

    if (editingId) {
      update('invoices', editingId, payload);
      toast.success('Invoice updated');
    } else {
      add('invoices', payload);
      toast.success('Invoice created');
    }
    setIsOpen(false);
  };

  const markPaid = (invoice: Invoice) => {
    update('invoices', invoice.id, {
      status: 'paid',
      paidAt: new Date().toISOString().slice(0, 10),
    });
    toast.success(`${invoice.number} marked paid`);
  };

  return (
    <div className="max-w-[1400px] space-y-6">
      <PageHeader
        title="Invoices"
        subtitle="Anything other than a draft shows in the client's portal."
        actions={
          <Button icon={Plus} onClick={openAdd}>
            New Invoice
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <StatCard
          icon={DollarSign}
          tone="purple"
          value={formatCurrency(paidTotal(invoices))}
          label="Collected"
        />
        <StatCard
          icon={Receipt}
          tone="gold"
          value={formatCurrency(outstandingTotal(invoices))}
          label="Outstanding"
        />
        <StatCard
          icon={CheckCircle2}
          tone={invoices.some((i) => isOverdue(i)) ? 'red' : 'neutral'}
          value={invoices.filter((i) => isOverdue(i)).length}
          label="Past Due"
        />
      </div>

      <Card className="p-4 flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search
            size={15}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search number, client or note…"
            className="pl-10"
          />
        </div>
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'all' | InvoiceStatus)}
          className="w-auto"
        >
          <option value="all">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace('-', ' ')}
            </option>
          ))}
        </Select>
      </Card>

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={Receipt}
            title="No invoices match"
            description="Adjust the filters, or raise a new invoice."
            action={
              <Button icon={Plus} onClick={openAdd}>
                New Invoice
              </Button>
            }
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left min-w-[820px]">
              <thead>
                <tr className="text-[10px] text-ink-faint font-bold uppercase tracking-widest bg-surface-2">
                  <th className="px-5 py-3">Invoice</th>
                  <th className="px-5 py-3">Client</th>
                  <th className="px-5 py-3">Project</th>
                  <th className="px-5 py-3">Due</th>
                  <th className="px-5 py-3 text-right">Amount</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((invoice) => {
                  const overdue = isOverdue(invoice);
                  return (
                    <tr key={invoice.id} className="hover:bg-surface-2/60 transition-colors group">
                      <td className="px-5 py-4">
                        <div className="text-[13px] font-bold text-ink">{invoice.number}</div>
                        <div className="text-[11px] text-ink-faint">{invoice.notes}</div>
                      </td>
                      <td className="px-5 py-4 text-[13px] text-ink-soft">
                        {clientFor(invoice)?.name ?? '—'}
                      </td>
                      <td className="px-5 py-4 text-[13px] text-ink-soft">
                        {projectFor(invoice)?.name ?? '—'}
                      </td>
                      <td className="px-5 py-4">
                        <div className="text-[13px] text-ink-soft">
                          {formatDate(invoice.dueDate)}
                        </div>
                        {invoice.status !== 'paid' ? (
                          <div
                            className={cn(
                              'text-[11px] font-semibold',
                              overdue ? 'text-red' : 'text-ink-faint',
                            )}
                          >
                            {relativeDays(invoice.dueDate)}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-5 py-4 text-right text-[13px] font-bold text-ink">
                        {formatCurrency(invoice.amount)}
                      </td>
                      <td className="px-5 py-4">
                        <StatusPill tone={STATUS_TONE[overdue ? 'overdue' : invoice.status]}>
                          {(overdue ? 'overdue' : invoice.status).replace('-', ' ')}
                        </StatusPill>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {invoice.status !== 'paid' ? (
                            <button
                              onClick={() => markPaid(invoice)}
                              title="Mark paid"
                              className="p-1.5 text-ink-faint hover:text-positive hover:bg-positive-dim rounded transition-colors"
                            >
                              <CheckCircle2 size={15} />
                            </button>
                          ) : null}
                          <button
                            onClick={() =>
                              downloadInvoicePdf({
                                invoice,
                                client: clientFor(invoice),
                                project: projectFor(invoice),
                                settings,
                              })
                            }
                            title="Download PDF"
                            className="p-1.5 text-ink-faint hover:text-orange hover:bg-orange-dim rounded transition-colors"
                          >
                            <Download size={15} />
                          </button>
                          <button
                            onClick={() => openEdit(invoice)}
                            title="Edit"
                            className="p-1.5 text-ink-faint hover:text-purple hover:bg-purple-dim rounded transition-colors"
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            onClick={() => {
                              remove('invoices', invoice.id);
                              toast.success('Invoice deleted');
                            }}
                            title="Delete"
                            className="p-1.5 text-ink-faint hover:text-red hover:bg-red-dim rounded transition-colors"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal
        open={isOpen}
        onClose={() => setIsOpen(false)}
        title={editingId ? 'Edit Invoice' : 'New Invoice'}
        subtitle="Anything other than a draft is visible in the client portal"
        width="max-w-lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="invoice-form">
              {editingId ? 'Save Changes' : 'Create Invoice'}
            </Button>
          </>
        }
      >
        <form id="invoice-form" onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Invoice Number">
              <Input
                autoFocus
                value={form.number}
                onChange={(e) => setForm({ ...form, number: e.target.value })}
              />
            </Field>
            <Field label="Amount (USD)">
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </Field>
          </div>

          <Field label="Client">
            <Select
              value={form.clientId}
              onChange={(e) => setForm({ ...form, clientId: e.target.value, projectId: '' })}
            >
              <option value="">Select a client…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Project" hint="Optional — links the invoice to a tracked project">
            <Select
              value={form.projectId}
              onChange={(e) => setForm({ ...form, projectId: e.target.value })}
            >
              <option value="">None</option>
              {projects
                .filter((p) => !form.clientId || p.clientId === form.clientId)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </Select>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Issue Date">
              <Input
                type="date"
                value={form.issueDate}
                onChange={(e) => setForm({ ...form, issueDate: e.target.value })}
              />
            </Field>
            <Field label="Due Date">
              <Input
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              />
            </Field>
          </div>

          <Field label="Status">
            <Select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as InvoiceStatus })}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace('-', ' ')}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Note" hint="Shown to the client beside the invoice">
            <Input
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="e.g. Wolf Package — 50% deposit"
            />
          </Field>
        </form>
      </Modal>
    </div>
  );
}
