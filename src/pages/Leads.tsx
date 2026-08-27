import { useState } from 'react';
import { ArrowUpRight, Edit2, Plus, Target, Trash2, TrendingUp } from 'lucide-react';
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
  Textarea,
} from '@/src/components/ui';
import { cn, formatCurrency, formatDate } from '@/src/lib/utils';
import { useStudio } from '@/src/store/StudioStore';
import type { Lead, LeadStage } from '@/src/types';

/** Pipeline order — also the column order on the board. */
const STAGES: LeadStage[] = ['new', 'contacted', 'qualified', 'proposal', 'won', 'lost'];

type FormState = Omit<Lead, 'id' | 'createdAt' | 'value'> & { value: string };

const blankForm = (): FormState => ({
  name: '',
  contactName: '',
  email: '',
  phone: '',
  source: '',
  stage: 'new',
  value: '',
  notes: '',
});

export default function Leads() {
  const { leads, add, update, remove, createClient } = useStudio();
  const navigate = useNavigate();

  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(blankForm);

  const openAdd = () => {
    setEditingId(null);
    setForm(blankForm());
    setIsOpen(true);
  };

  const openEdit = (lead: Lead) => {
    setEditingId(lead.id);
    setForm({
      name: lead.name,
      contactName: lead.contactName,
      email: lead.email,
      phone: lead.phone,
      source: lead.source,
      stage: lead.stage,
      value: lead.value != null ? String(lead.value) : '',
      notes: lead.notes,
    });
    setIsOpen(true);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) {
      toast.error('Business name and email are required');
      return;
    }
    const payload = {
      name: form.name.trim(),
      contactName: form.contactName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      source: form.source.trim(),
      stage: form.stage,
      value: form.value ? Number(form.value) : null,
      notes: form.notes.trim(),
    };
    if (editingId) {
      update('leads', editingId, payload);
      toast.success('Lead updated');
    } else {
      add('leads', { ...payload, createdAt: new Date().toISOString().slice(0, 10) });
      toast.success('Lead added');
    }
    setIsOpen(false);
  };

  /** Promote a won lead into a real client record without re-typing details. */
  const convert = (lead: Lead) => {
    const client = createClient({
      name: lead.name,
      contactName: lead.contactName || lead.name,
      email: lead.email,
      phone: lead.phone,
      location: '',
      industry: lead.source ? `via ${lead.source}` : '',
      status: 'active',
    });
    update('leads', lead.id, { stage: 'won' });
    toast.success(`${client.name} is now a client`);
    navigate('/admin/clients');
  };

  const openPipeline = leads
    .filter((l) => l.stage !== 'won' && l.stage !== 'lost')
    .reduce((sum, l) => sum + (l.value ?? 0), 0);
  const wonValue = leads
    .filter((l) => l.stage === 'won')
    .reduce((sum, l) => sum + (l.value ?? 0), 0);

  return (
    <div className="max-w-[1400px] space-y-6">
      <PageHeader
        title="Leads"
        subtitle="Track potential clients and convert them to active accounts."
        actions={
          <Button icon={Plus} onClick={openAdd}>
            Add Lead
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <StatCard
          icon={Target}
          tone="purple"
          value={leads.filter((l) => l.stage !== 'won' && l.stage !== 'lost').length}
          label="Open Leads"
        />
        <StatCard
          icon={TrendingUp}
          tone="orange"
          value={formatCurrency(openPipeline)}
          label="Pipeline Value"
        />
        <StatCard
          icon={ArrowUpRight}
          tone="positive"
          value={formatCurrency(wonValue)}
          label="Won This Period"
        />
      </div>

      {leads.length === 0 ? (
        <Card>
          <EmptyState
            icon={Target}
            title="No leads yet"
            description="Add an enquiry to start tracking your pipeline."
            action={
              <Button icon={Plus} onClick={openAdd}>
                Add Lead
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin">
          {STAGES.map((stage) => {
            const column = leads.filter((l) => l.stage === stage);
            return (
              <div
                key={stage}
                className="w-[280px] shrink-0 bg-surface-2/60 rounded-2xl border border-line p-3"
              >
                <div className="flex items-center justify-between mb-3 px-1">
                  <h3 className="text-[11px] font-bold uppercase tracking-widest text-ink-soft">
                    {stage}
                  </h3>
                  <span className="bg-surface border border-line text-ink-soft text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {column.length}
                  </span>
                </div>

                <div className="space-y-2.5">
                  {column.map((lead) => (
                    <Card key={lead.id} className="p-3.5 group">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h4 className="font-bold text-[13px] text-ink leading-tight">
                          {lead.name}
                        </h4>
                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <button
                            onClick={() => openEdit(lead)}
                            className="p-1 text-ink-faint hover:text-purple rounded"
                            aria-label="Edit"
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            onClick={() => {
                              remove('leads', lead.id);
                              toast.success('Lead removed');
                            }}
                            className="p-1 text-ink-faint hover:text-red rounded"
                            aria-label="Delete"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>

                      <p className="text-[11.5px] text-ink-soft">{lead.contactName}</p>
                      <p className="text-[11px] text-ink-faint truncate">{lead.email}</p>

                      {lead.notes ? (
                        <p className="text-[11px] text-ink-soft mt-2 line-clamp-2">{lead.notes}</p>
                      ) : null}

                      <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-line">
                        <span className="text-[13px] font-extrabold text-ink">
                          {lead.value != null ? formatCurrency(lead.value) : '—'}
                        </span>
                        <span className="text-[10px] text-ink-faint">
                          {formatDate(lead.createdAt)}
                        </span>
                      </div>

                      {/* Stage moves happen here — a select beats drag-and-drop for keyboard users. */}
                      <select
                        value={lead.stage}
                        onChange={(e) => {
                          update('leads', lead.id, { stage: e.target.value as LeadStage });
                        }}
                        className={cn(
                          'mt-2.5 w-full text-[11px] font-bold rounded-lg px-2 py-1.5',
                          'border border-line bg-surface text-ink-soft',
                          'outline-none focus:border-orange',
                        )}
                        aria-label={`Move ${lead.name} to another stage`}
                      >
                        {STAGES.map((s) => (
                          <option key={s} value={s}>
                            Move to {s}
                          </option>
                        ))}
                      </select>

                      {lead.stage === 'won' ? (
                        <Button
                          size="sm"
                          variant="purple"
                          icon={ArrowUpRight}
                          className="w-full mt-2"
                          onClick={() => convert(lead)}
                        >
                          Make a client
                        </Button>
                      ) : null}
                    </Card>
                  ))}

                  {column.length === 0 ? (
                    <p className="text-[11px] text-ink-faint italic px-1 py-3">Nothing here</p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={isOpen}
        onClose={() => setIsOpen(false)}
        title={editingId ? 'Edit Lead' : 'Add Lead'}
        width="max-w-lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="lead-form">
              {editingId ? 'Save Changes' : 'Add Lead'}
            </Button>
          </>
        }
      >
        <form id="lead-form" onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Business Name">
              <Input
                autoFocus
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </Field>
            <Field label="Contact Name">
              <Input
                value={form.contactName}
                onChange={(e) => setForm({ ...form, contactName: e.target.value })}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Email">
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </Field>
            <Field label="Phone">
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Source">
              <Input
                value={form.source}
                onChange={(e) => setForm({ ...form, source: e.target.value })}
                placeholder="Referral"
              />
            </Field>
            <Field label="Stage">
              <Select
                value={form.stage}
                onChange={(e) => setForm({ ...form, stage: e.target.value as LeadStage })}
              >
                {STAGES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Est. Value">
              <Input
                type="number"
                min="0"
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Notes">
            <Textarea
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="What do they need?"
            />
          </Field>
        </form>
      </Modal>
    </div>
  );
}
