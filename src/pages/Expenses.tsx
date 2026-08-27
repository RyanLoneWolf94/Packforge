import { useMemo, useState } from 'react';
import { Plus, Receipt, Trash2, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import {
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  ProgressBar,
  Select,
  StatCard,
  StatusPill,
} from '@/src/components/ui';
import { formatCurrency, formatDate } from '@/src/lib/utils';
import { expenseTotal } from '@/src/lib/finance';
import { useStudio } from '@/src/store/StudioStore';
import type { ExpenseCategory } from '@/src/types';

const CATEGORIES: ExpenseCategory[] = [
  'software',
  'contractor',
  'marketing',
  'travel',
  'office',
  'other',
];

export default function Expenses() {
  const { expenses, projects, projectFor, add, remove } = useStudio();

  const [categoryFilter, setCategoryFilter] = useState<'all' | ExpenseCategory>('all');
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState({
    title: '',
    category: 'software' as ExpenseCategory,
    projectId: '',
    date: new Date().toISOString().slice(0, 10),
    amount: '',
    billable: false,
  });

  const rows = useMemo(
    () =>
      expenses
        .filter((e) => (categoryFilter === 'all' ? true : e.category === categoryFilter))
        .sort((a, b) => b.date.localeCompare(a.date)),
    [expenses, categoryFilter],
  );

  const total = expenseTotal(expenses);
  const billable = expenseTotal(expenses.filter((e) => e.billable));

  /** Spend per category, largest first — shows where the money actually goes. */
  const byCategory = useMemo(() => {
    const map = new Map<ExpenseCategory, number>();
    for (const e of expenses) map.set(e.category, (map.get(e.category) ?? 0) + e.amount);
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [expenses]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.amount) {
      toast.error('Title and amount are required');
      return;
    }
    add('expenses', {
      title: form.title.trim(),
      category: form.category,
      projectId: form.projectId || undefined,
      date: form.date,
      amount: Number(form.amount),
      billable: form.billable,
    });
    toast.success('Expense logged');
    setIsOpen(false);
    setForm({ ...form, title: '', amount: '' });
  };

  return (
    <div className="max-w-[1400px] space-y-6">
      <PageHeader
        title="Expenses"
        subtitle="Studio overhead and rebillable project costs."
        actions={
          <Button icon={Plus} onClick={() => setIsOpen(true)}>
            Log Expense
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <StatCard icon={Wallet} tone="purple" value={formatCurrency(total)} label="Total Spend" />
        <StatCard
          icon={Receipt}
          tone="orange"
          value={formatCurrency(billable)}
          label="Rebillable"
        />
        <StatCard
          icon={Wallet}
          tone="neutral"
          value={formatCurrency(total - billable)}
          label="Studio Overhead"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 overflow-hidden">
          <div className="p-4 border-b border-line flex items-center justify-between gap-3 flex-wrap">
            <h2 className="disp font-extrabold text-ink">All Expenses</h2>
            <Select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as 'all' | ExpenseCategory)}
              className="w-auto"
            >
              <option value="all">All categories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>

          {rows.length === 0 ? (
            <EmptyState icon={Wallet} title="Nothing logged yet" />
          ) : (
            <div className="divide-y divide-line">
              {rows.map((expense) => (
                <div
                  key={expense.id}
                  className="flex items-center justify-between gap-4 px-5 py-3.5 group"
                >
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold text-ink truncate">{expense.title}</p>
                    <p className="text-[11.5px] text-ink-soft">
                      {expense.category} · {formatDate(expense.date)}
                      {projectFor(expense) ? ` · ${projectFor(expense)!.name}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {expense.billable ? (
                      <StatusPill tone="warning">Rebillable</StatusPill>
                    ) : null}
                    <span className="text-[13px] font-bold text-ink">
                      {formatCurrency(expense.amount)}
                    </span>
                    <button
                      onClick={() => {
                        remove('expenses', expense.id);
                        toast.success('Expense removed');
                      }}
                      className="p-1.5 text-ink-faint hover:text-red hover:bg-red-dim rounded transition-colors opacity-0 group-hover:opacity-100"
                      aria-label={`Delete ${expense.title}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-6 h-fit">
          <h2 className="disp font-extrabold text-ink mb-4">By Category</h2>
          {byCategory.length === 0 ? (
            <p className="text-sm text-ink-soft">No spend recorded.</p>
          ) : (
            <div className="space-y-3.5">
              {byCategory.map(([category, amount]) => (
                <div key={category}>
                  <div className="flex items-center justify-between text-[12px] mb-1.5">
                    <span className="font-semibold text-ink capitalize">{category}</span>
                    <span className="text-ink-soft font-bold">{formatCurrency(amount)}</span>
                  </div>
                  <ProgressBar value={total ? (amount / total) * 100 : 0} tone="purple" />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Modal
        open={isOpen}
        onClose={() => setIsOpen(false)}
        title="Log Expense"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="expense-form">
              Log Expense
            </Button>
          </>
        }
      >
        <form id="expense-form" onSubmit={submit} className="space-y-4">
          <Field label="Description">
            <Input
              autoFocus
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Voiceover artist"
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Category">
              <Select
                value={form.category}
                onChange={(e) =>
                  setForm({ ...form, category: e.target.value as ExpenseCategory })
                }
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
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
          <div className="grid grid-cols-2 gap-4">
            <Field label="Date">
              <Input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </Field>
            <Field label="Project" hint="Optional">
              <Select
                value={form.projectId}
                onChange={(e) => setForm({ ...form, projectId: e.target.value })}
              >
                <option value="">Studio overhead</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={form.billable}
              onChange={(e) => setForm({ ...form, billable: e.target.checked })}
              className="w-4 h-4 rounded border-line text-orange focus:ring-orange"
            />
            <span className="text-sm text-ink">Rebillable to the client</span>
          </label>
        </form>
      </Modal>
    </div>
  );
}
