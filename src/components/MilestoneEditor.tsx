import { Plus, X } from 'lucide-react';
import { Input } from '@/src/components/ui';
import { cn, formatCurrency } from '@/src/lib/utils';
import type { QuoteMilestone } from '@/src/types';

/**
 * Editor for a priced breakdown — milestones, each with priced line items.
 * Shared by quotes and blueprints so the two can never drift apart, and so a
 * quote's breakdown can be saved back as a blueprint without translation.
 */

let seq = 0;
const uid = (p: string) => `${p}-${Date.now().toString(36)}-${(seq++).toString(36)}`;

export const newMilestone = (title = 'Phase 1'): QuoteMilestone => ({
  id: uid('qm'),
  title,
  tasks: [{ id: uid('qt'), title: '', price: 0 }],
});

/** Total of every line item across all milestones. */
export function milestonesTotal(milestones: QuoteMilestone[]): number {
  return milestones.reduce(
    (s, m) => s + m.tasks.reduce((ts, t) => ts + (Number(t.price) || 0), 0),
    0,
  );
}

/** Deep-copy with fresh ids, so a template's breakdown can be reused safely. */
export function cloneMilestones(milestones: QuoteMilestone[]): QuoteMilestone[] {
  return milestones.map((m) => ({
    ...m,
    id: uid('qm'),
    tasks: m.tasks.map((t) => ({ ...t, id: uid('qt') })),
  }));
}

export function MilestoneEditor({
  value,
  onChange,
  label = 'Breakdown',
}: {
  value: QuoteMilestone[];
  onChange: (next: QuoteMilestone[]) => void;
  label?: string;
}) {
  const patchMilestone = (idx: number, patch: Partial<QuoteMilestone>) => {
    const next = [...value];
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-ink">{label}</span>
        <span className="text-sm font-extrabold text-purple">
          {formatCurrency(milestonesTotal(value))}
        </span>
      </div>

      {value.map((milestone, mIdx) => (
        <div key={milestone.id} className="bg-surface-2 rounded-[10px] p-3.5 space-y-2">
          <div className="flex gap-2">
            <Input
              value={milestone.title}
              onChange={(e) => patchMilestone(mIdx, { title: e.target.value })}
              placeholder="Milestone title"
              className="font-bold"
            />
            <button
              type="button"
              onClick={() => onChange(value.filter((m) => m.id !== milestone.id))}
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
                  const tasks = [...milestone.tasks];
                  tasks[tIdx] = { ...task, title: e.target.value };
                  patchMilestone(mIdx, { tasks });
                }}
                placeholder="Line item"
              />
              <Input
                type="number"
                min="0"
                value={task.price}
                onChange={(e) => {
                  const tasks = [...milestone.tasks];
                  tasks[tIdx] = { ...task, price: Number(e.target.value) || 0 };
                  patchMilestone(mIdx, { tasks });
                }}
                className="w-28 shrink-0"
              />
              <button
                type="button"
                onClick={() =>
                  patchMilestone(mIdx, { tasks: milestone.tasks.filter((t) => t.id !== task.id) })
                }
                className="p-2 text-ink-faint hover:text-red shrink-0"
                aria-label="Remove line"
              >
                <X size={14} />
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={() =>
              patchMilestone(mIdx, {
                tasks: [...milestone.tasks, { id: uid('qt'), title: '', price: 0 }],
              })
            }
            className="text-[11px] font-bold text-ink-faint hover:text-orange flex items-center gap-1"
          >
            <Plus size={12} /> Add line item
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={() => onChange([...value, newMilestone(`Phase ${value.length + 1}`)])}
        className={cn(
          'w-full py-2 border border-dashed border-line rounded-lg',
          'text-xs font-bold text-ink-soft hover:border-orange hover:text-orange transition-colors',
        )}
      >
        + Add milestone
      </button>
    </div>
  );
}
