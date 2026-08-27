import { useEffect, useRef, useState } from 'react';
import { Clock, Pause, Play, Plus, Square, Trash2 } from 'lucide-react';
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
import { cn, formatDate } from '@/src/lib/utils';
import { formatDuration, trackedHours } from '@/src/lib/finance';
import { useStudio } from '@/src/store/StudioStore';

/**
 * Live timer plus a manual log. The running timer is deliberately component
 * state rather than store state — persisting a tick every second would thrash
 * localStorage; only the finished entry is committed.
 */
export default function TimeTracking() {
  const { timeEntries, projects, projectFor, add, remove } = useStudio();

  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [task, setTask] = useState('');
  const [projectId, setProjectId] = useState('');
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [manual, setManual] = useState({
    task: '',
    projectId: '',
    hours: '',
    minutes: '',
    date: new Date().toISOString().slice(0, 10),
    billable: true,
  });

  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (running) {
      intervalRef.current = window.setInterval(() => setElapsed((e) => e + 1), 1000);
    }
    return () => {
      if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
    };
  }, [running]);

  const stopAndSave = () => {
    if (elapsed < 1) {
      toast.error('Nothing to log yet');
      return;
    }
    if (!task.trim()) {
      toast.error('Give the entry a task name first');
      return;
    }
    add('timeEntries', {
      task: task.trim(),
      projectId: projectId || undefined,
      seconds: elapsed,
      date: new Date().toISOString().slice(0, 10),
      billable: Boolean(projectId),
    });
    toast.success(`Logged ${formatDuration(elapsed)}`);
    setRunning(false);
    setElapsed(0);
    setTask('');
  };

  const submitManual = (e: React.FormEvent) => {
    e.preventDefault();
    const seconds = (Number(manual.hours) || 0) * 3600 + (Number(manual.minutes) || 0) * 60;
    if (!manual.task.trim() || seconds <= 0) {
      toast.error('Task and a duration are required');
      return;
    }
    add('timeEntries', {
      task: manual.task.trim(),
      projectId: manual.projectId || undefined,
      seconds,
      date: manual.date,
      billable: manual.billable,
    });
    toast.success(`Logged ${formatDuration(seconds)}`);
    setIsManualOpen(false);
    setManual({ ...manual, task: '', hours: '', minutes: '' });
  };

  const today = new Date().toISOString().slice(0, 10);
  const todayEntries = timeEntries.filter((e) => e.date === today);
  const billableSeconds = timeEntries
    .filter((e) => e.billable)
    .reduce((sum, e) => sum + e.seconds, 0);

  const sorted = [...timeEntries].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="max-w-[1400px] space-y-6">
      <PageHeader
        title="Time Tracking"
        subtitle="Track studio hours against projects."
        actions={
          <Button variant="secondary" icon={Plus} onClick={() => setIsManualOpen(true)}>
            Manual Entry
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <StatCard
          icon={Clock}
          tone="purple"
          value={formatDuration(todayEntries.reduce((s, e) => s + e.seconds, 0))}
          label="Logged Today"
        />
        <StatCard
          icon={Clock}
          tone="orange"
          value={formatDuration(billableSeconds)}
          label="Billable Hours"
        />
        <StatCard
          icon={Clock}
          tone="neutral"
          value={`${trackedHours(timeEntries).toFixed(1)}h`}
          label="Total Tracked"
        />
      </div>

      {/* Live timer */}
      <Card className="p-7">
        <div className="flex flex-col lg:flex-row gap-6 items-center">
          <div
            className={cn(
              'text-5xl font-extrabold tabular-nums tracking-tight shrink-0',
              running ? 'text-orange' : 'text-ink',
            )}
          >
            {String(Math.floor(elapsed / 3600)).padStart(2, '0')}:
            {String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0')}:
            {String(elapsed % 60).padStart(2, '0')}
          </div>

          <div className="flex-1 w-full grid sm:grid-cols-2 gap-3">
            <Input
              value={task}
              onChange={(e) => setTask(e.target.value)}
              placeholder="What are you working on?"
            />
            <Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">No project (overhead)</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex gap-2 shrink-0">
            <Button
              variant={running ? 'secondary' : 'primary'}
              icon={running ? Pause : Play}
              onClick={() => setRunning((r) => !r)}
            >
              {running ? 'Pause' : 'Start'}
            </Button>
            <Button variant="purple" icon={Square} onClick={stopAndSave} disabled={elapsed < 1}>
              Stop & Log
            </Button>
          </div>
        </div>
      </Card>

      {sorted.length === 0 ? (
        <Card>
          <EmptyState
            icon={Clock}
            title="No time logged yet"
            description="Start the timer above, or add an entry manually."
          />
        </Card>
      ) : (
        <Card className="divide-y divide-line">
          {sorted.map((entry) => (
            <div key={entry.id} className="flex items-center justify-between gap-4 p-4 group">
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-ink truncate">{entry.task}</p>
                <p className="text-[11.5px] text-ink-soft">
                  {projectFor(entry)?.name ?? 'Studio overhead'} · {formatDate(entry.date)}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {entry.billable ? <StatusPill tone="warning">Billable</StatusPill> : null}
                <span className="text-[13px] font-bold text-ink tabular-nums">
                  {formatDuration(entry.seconds)}
                </span>
                <button
                  onClick={() => {
                    remove('timeEntries', entry.id);
                    toast.success('Entry removed');
                  }}
                  className="p-1.5 text-ink-faint hover:text-red hover:bg-red-dim rounded transition-colors opacity-0 group-hover:opacity-100"
                  aria-label="Delete entry"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </Card>
      )}

      <Modal
        open={isManualOpen}
        onClose={() => setIsManualOpen(false)}
        title="Manual Entry"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsManualOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="manual-time">
              Log Time
            </Button>
          </>
        }
      >
        <form id="manual-time" onSubmit={submitManual} className="space-y-4">
          <Field label="Task">
            <Input
              autoFocus
              value={manual.task}
              onChange={(e) => setManual({ ...manual, task: e.target.value })}
              placeholder="e.g. Logo refinement"
            />
          </Field>
          <Field label="Project">
            <Select
              value={manual.projectId}
              onChange={(e) => setManual({ ...manual, projectId: e.target.value })}
            >
              <option value="">Studio overhead</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Hours">
              <Input
                type="number"
                min="0"
                value={manual.hours}
                onChange={(e) => setManual({ ...manual, hours: e.target.value })}
              />
            </Field>
            <Field label="Minutes">
              <Input
                type="number"
                min="0"
                max="59"
                value={manual.minutes}
                onChange={(e) => setManual({ ...manual, minutes: e.target.value })}
              />
            </Field>
            <Field label="Date">
              <Input
                type="date"
                value={manual.date}
                onChange={(e) => setManual({ ...manual, date: e.target.value })}
              />
            </Field>
          </div>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={manual.billable}
              onChange={(e) => setManual({ ...manual, billable: e.target.checked })}
              className="w-4 h-4 rounded border-line text-orange focus:ring-orange"
            />
            <span className="text-sm text-ink">Billable</span>
          </label>
        </form>
      </Modal>
    </div>
  );
}
