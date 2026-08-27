import { useMemo } from 'react';
import { DollarSign, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, EmptyState, PageHeader, StatCard } from '@/src/components/ui';
import { BRAND_COLORS } from '@/src/brand';
import { formatCurrency } from '@/src/lib/utils';
import { expenseTotal, outstandingTotal, paidTotal } from '@/src/lib/finance';
import { projectEarned } from '@/src/lib/tracker';
import { useStudio } from '@/src/store/StudioStore';

const PIE_COLORS = [
  BRAND_COLORS.orange,
  BRAND_COLORS.purple,
  BRAND_COLORS.gold,
  BRAND_COLORS.red,
  '#2F4B3F',
  '#6E7472',
];

/** Finance rollup, derived entirely from invoices, expenses and tracker state. */
export default function Overview() {
  const { invoices, expenses, projects, clients, clientFor } = useStudio();

  const collected = paidTotal(invoices);
  const outstanding = outstandingTotal(invoices);
  const spend = expenseTotal(expenses);
  const earnedNotBilled = projects.reduce((sum, p) => sum + projectEarned(p), 0) - collected;

  /** Cash in vs. spend, bucketed by calendar month. */
  const monthly = useMemo(() => {
    const buckets = new Map<string, { month: string; income: number; spend: number }>();
    const touch = (date: string) => {
      const key = date.slice(0, 7);
      if (!buckets.has(key)) {
        buckets.set(key, {
          month: new Date(`${key}-01`).toLocaleString('en-US', { month: 'short' }),
          income: 0,
          spend: 0,
        });
      }
      return buckets.get(key)!;
    };

    for (const invoice of invoices) {
      if (invoice.status === 'paid' && invoice.paidAt) {
        touch(invoice.paidAt).income += invoice.amount;
      }
    }
    for (const expense of expenses) touch(expense.date).spend += expense.amount;

    return [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
  }, [invoices, expenses]);

  /** Revenue share per client, largest first. */
  const byClient = useMemo(() => {
    const map = new Map<string, number>();
    for (const invoice of invoices) {
      if (invoice.status !== 'paid') continue;
      const name = clientFor(invoice)?.name ?? 'Unassigned';
      map.set(name, (map.get(name) ?? 0) + invoice.amount);
    }
    return [...map.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [invoices, clientFor]);

  const hasData = invoices.length > 0 || expenses.length > 0;

  return (
    <div className="max-w-[1400px] space-y-6">
      <PageHeader
        title="Finance Overview"
        subtitle={`Across ${clients.length} clients and ${projects.length} projects.`}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
        <StatCard
          icon={DollarSign}
          tone="positive"
          value={formatCurrency(collected)}
          label="Collected"
        />
        <StatCard
          icon={TrendingUp}
          tone="gold"
          value={formatCurrency(outstanding)}
          label="Outstanding"
        />
        <StatCard
          icon={TrendingDown}
          tone="red"
          value={formatCurrency(spend)}
          label="Total Spend"
        />
        <StatCard
          icon={Wallet}
          tone="purple"
          value={formatCurrency(collected - spend)}
          label="Net Position"
          hint={
            earnedNotBilled > 1
              ? `${formatCurrency(Math.round(earnedNotBilled))} earned, not yet billed`
              : undefined
          }
        />
      </div>

      {!hasData ? (
        <Card>
          <EmptyState
            icon={DollarSign}
            title="No financial data yet"
            description="Raise an invoice or log an expense to populate this view."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 p-6">
            <h2 className="disp font-extrabold text-ink mb-5">Income vs. Spend</h2>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke={BRAND_COLORS.line} vertical={false} />
                  <XAxis
                    dataKey="month"
                    stroke="#A7A29B"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#A7A29B"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `$${v}`}
                  />
                  <Tooltip
                    formatter={(value) => formatCurrency(Number(value))}
                    contentStyle={{
                      borderRadius: 10,
                      border: `1px solid ${BRAND_COLORS.line}`,
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="income" fill={BRAND_COLORS.orange} radius={[6, 6, 0, 0]} />
                  <Bar dataKey="spend" fill={BRAND_COLORS.purple} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="disp font-extrabold text-ink mb-5">Revenue by Client</h2>
            {byClient.length === 0 ? (
              <p className="text-sm text-ink-soft">No payments recorded yet.</p>
            ) : (
              <>
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={byClient}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={3}
                        stroke="none"
                      >
                        {byClient.map((_entry, index) => (
                          <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2 mt-3">
                  {byClient.map((entry, index) => (
                    <div key={entry.name} className="flex items-center gap-2.5 text-[12px]">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ background: PIE_COLORS[index % PIE_COLORS.length] }}
                      />
                      <span className="text-ink-soft flex-1 truncate">{entry.name}</span>
                      <span className="font-bold text-ink">{formatCurrency(entry.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
