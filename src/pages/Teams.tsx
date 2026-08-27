import { useState } from 'react';
import { Clock, Edit2, Mail, Plus, Trash2, Users } from 'lucide-react';
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
import { cn, initials } from '@/src/lib/utils';
import { formatDuration, trackedHours } from '@/src/lib/finance';
import { useStudio } from '@/src/store/StudioStore';
import type { TeamMember } from '@/src/types';

const STATUS_TONE = {
  active: 'positive',
  busy: 'warning',
  offline: 'neutral',
} as const;

type FormState = Omit<TeamMember, 'id' | 'capacityHours'> & { capacityHours: string };

const blankForm = (): FormState => ({
  name: '',
  role: '',
  email: '',
  status: 'active',
  capacityHours: '40',
});

export default function Teams() {
  const { team, timeEntries, add, update, remove } = useStudio();

  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(blankForm);

  const openAdd = () => {
    setEditingId(null);
    setForm(blankForm());
    setIsOpen(true);
  };

  const openEdit = (member: TeamMember) => {
    setEditingId(member.id);
    setForm({
      name: member.name,
      role: member.role,
      email: member.email,
      status: member.status,
      capacityHours: String(member.capacityHours),
    });
    setIsOpen(true);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) {
      toast.error('Name and email are required');
      return;
    }
    const payload = {
      name: form.name.trim(),
      role: form.role.trim(),
      email: form.email.trim(),
      status: form.status,
      capacityHours: Number(form.capacityHours) || 0,
    };
    if (editingId) {
      update('team', editingId, payload);
      toast.success('Team member updated');
    } else {
      add('team', payload);
      toast.success('Team member added');
    }
    setIsOpen(false);
  };

  const totalCapacity = team.reduce((sum, m) => sum + m.capacityHours, 0);
  // Hours logged this week across the studio, against total weekly capacity.
  const loggedHours = trackedHours(timeEntries);

  return (
    <div className="max-w-[1400px] space-y-6">
      <PageHeader
        title="Team"
        subtitle="Who's on the pack, and how much capacity is available."
        actions={
          <Button icon={Plus} onClick={openAdd}>
            Add Member
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <StatCard icon={Users} tone="purple" value={team.length} label="Team Members" />
        <StatCard
          icon={Clock}
          tone="orange"
          value={`${totalCapacity}h`}
          label="Weekly Capacity"
        />
        <StatCard
          icon={Clock}
          tone={loggedHours > totalCapacity ? 'red' : 'neutral'}
          value={formatDuration(loggedHours * 3600)}
          label="Logged This Week"
          hint={
            totalCapacity
              ? `${Math.round((loggedHours / totalCapacity) * 100)}% of capacity`
              : undefined
          }
        />
      </div>

      {team.length === 0 ? (
        <Card>
          <EmptyState
            icon={Users}
            title="No team members"
            description="Add collaborators to track capacity across the studio."
            action={
              <Button icon={Plus} onClick={openAdd}>
                Add Member
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {team.map((member) => (
            <Card key={member.id} className="p-6 group relative">
              <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => openEdit(member)}
                  className="p-1.5 text-ink-faint hover:text-purple hover:bg-purple-dim rounded transition-colors"
                  aria-label="Edit"
                >
                  <Edit2 size={14} />
                </button>
                <button
                  onClick={() => {
                    remove('team', member.id);
                    toast.success('Team member removed');
                  }}
                  className="p-1.5 text-ink-faint hover:text-red hover:bg-red-dim rounded transition-colors"
                  aria-label="Remove"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              <div className="flex items-center gap-3 mb-4 pr-16">
                <div
                  className={cn(
                    'w-12 h-12 rounded-xl flex items-center justify-center text-sm font-extrabold shrink-0',
                    member.status === 'offline'
                      ? 'bg-surface-2 text-ink-faint'
                      : 'bg-night text-white',
                  )}
                >
                  {initials(member.name)}
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-ink truncate">{member.name}</h3>
                  <p className="text-xs text-ink-soft truncate">{member.role}</p>
                </div>
              </div>

              <a
                href={`mailto:${member.email}`}
                className="flex items-center gap-2 text-[12.5px] text-ink-soft hover:text-purple transition-colors truncate"
              >
                <Mail size={13} className="shrink-0" />
                <span className="truncate">{member.email}</span>
              </a>

              <div className="mt-4 pt-4 border-t border-line">
                <div className="flex items-center justify-between text-[11.5px] mb-1.5">
                  <span className="text-ink-soft font-semibold">Weekly capacity</span>
                  <span className="text-ink font-bold">{member.capacityHours}h</span>
                </div>
                <ProgressBar
                  value={totalCapacity ? (member.capacityHours / totalCapacity) * 100 : 0}
                  tone="purple"
                  className="h-1.5"
                />
              </div>

              <StatusPill tone={STATUS_TONE[member.status]} className="mt-4">
                {member.status}
              </StatusPill>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={isOpen}
        onClose={() => setIsOpen(false)}
        title={editingId ? 'Edit Member' : 'Add Member'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="team-form">
              {editingId ? 'Save Changes' : 'Add Member'}
            </Button>
          </>
        }
      >
        <form id="team-form" onSubmit={submit} className="space-y-4">
          <Field label="Name">
            <Input
              autoFocus
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field label="Role">
            <Input
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              placeholder="e.g. Contract Designer"
            />
          </Field>
          <Field label="Email">
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Status">
              <Select
                value={form.status}
                onChange={(e) =>
                  setForm({ ...form, status: e.target.value as TeamMember['status'] })
                }
              >
                <option value="active">active</option>
                <option value="busy">busy</option>
                <option value="offline">offline</option>
              </Select>
            </Field>
            <Field label="Weekly Hours">
              <Input
                type="number"
                min="0"
                value={form.capacityHours}
                onChange={(e) => setForm({ ...form, capacityHours: e.target.value })}
              />
            </Field>
          </div>
        </form>
      </Modal>
    </div>
  );
}
