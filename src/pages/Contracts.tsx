import { useState } from 'react';
import {
  AlertTriangle,
  Bell,
  BellOff,
  CheckCircle2,
  Edit2,
  FileSignature,
  Mail,
  Plus,
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
  Textarea,
} from '@/src/components/ui';
import SignatureModal from '@/src/components/SignatureModal';
import { cn, formatCurrency, formatDate } from '@/src/lib/utils';
import { daysUntil } from '@/src/lib/tracker';
import { useStudio } from '@/src/store/StudioStore';
import type { Contract, ContractStatus } from '@/src/types';

const STATUSES: ContractStatus[] = ['draft', 'pending', 'signed', 'expired'];

type FormState = {
  title: string;
  clientId: string;
  projectId: string;
  amount: string;
  expires: string;
  status: ContractStatus;
  body: string;
};

const blankForm = (): FormState => ({
  title: '',
  clientId: '',
  projectId: '',
  amount: '',
  expires: '',
  status: 'draft',
  body: '',
});

/** Renewal urgency, so an expiring agreement can't quietly lapse. */
function expiryInfo(contract: Contract) {
  if (!contract.expires) return null;
  const days = daysUntil(contract.expires);
  if (days < 0) return { label: 'Expired', tone: 'danger' as const };
  if (days <= 7) return { label: `Expires in ${days}d`, tone: 'danger' as const };
  if (days <= 30) return { label: `Expires in ${days}d`, tone: 'warning' as const };
  return null;
}

export default function Contracts() {
  const { contracts, clients, projects, clientFor, projectFor, add, update, remove } = useStudio();

  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(blankForm);
  const [signing, setSigning] = useState<Contract | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Contract | null>(null);

  const openAdd = () => {
    setEditingId(null);
    setForm(blankForm());
    setIsOpen(true);
  };

  const openEdit = (contract: Contract) => {
    setEditingId(contract.id);
    setForm({
      title: contract.title,
      clientId: contract.clientId,
      projectId: contract.projectId ?? '',
      amount: String(contract.amount),
      expires: contract.expires,
      status: contract.status,
      body: contract.body ?? '',
    });
    setIsOpen(true);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.clientId) {
      toast.error('Title and client are required');
      return;
    }
    const payload = {
      title: form.title.trim(),
      clientId: form.clientId,
      projectId: form.projectId || undefined,
      amount: Number(form.amount) || 0,
      expires: form.expires,
      status: form.status,
      body: form.body,
      autoRemind: editingId
        ? (contracts.find((c) => c.id === editingId)?.autoRemind ?? false)
        : false,
    };
    if (editingId) {
      update('contracts', editingId, payload);
      toast.success('Contract updated');
    } else {
      add('contracts', payload);
      toast.success('Contract created');
    }
    setIsOpen(false);
  };

  const expiringSoon = contracts.filter((c) => {
    const info = expiryInfo(c);
    return info !== null && c.status !== 'expired';
  }).length;

  return (
    <div className="max-w-[1400px] space-y-6">
      <PageHeader
        title="Contracts"
        subtitle="Agreements are visible to the client in their portal."
        actions={
          <Button icon={Plus} onClick={openAdd}>
            New Contract
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <StatCard
          icon={FileSignature}
          tone="purple"
          value={contracts.length}
          label="Total Contracts"
        />
        <StatCard
          icon={CheckCircle2}
          tone="positive"
          value={contracts.filter((c) => c.status === 'signed').length}
          label="Signed"
        />
        <StatCard
          icon={AlertTriangle}
          tone={expiringSoon > 0 ? 'red' : 'neutral'}
          value={expiringSoon}
          label="Needing Attention"
        />
      </div>

      {contracts.length === 0 ? (
        <Card>
          <EmptyState
            icon={FileSignature}
            title="No contracts yet"
            description="Create an agreement and it appears in the client's portal."
            action={
              <Button icon={Plus} onClick={openAdd}>
                New Contract
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {contracts.map((contract) => {
            const info = expiryInfo(contract);
            return (
              <Card
                key={contract.id}
                className={cn('p-5 group', info?.tone === 'danger' && 'border-red')}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h3 className="font-bold text-ink text-sm leading-tight">{contract.title}</h3>
                  <StatusPill
                    tone={
                      contract.status === 'signed'
                        ? 'positive'
                        : contract.status === 'pending'
                          ? 'warning'
                          : 'neutral'
                    }
                  >
                    {contract.status}
                  </StatusPill>
                </div>

                <p className="text-xs text-ink-soft">
                  {clientFor(contract)?.name ?? '—'}
                  {projectFor(contract) ? ` · ${projectFor(contract)!.name}` : ''}
                </p>

                {info ? (
                  <StatusPill tone={info.tone} className="mt-3">
                    {info.label}
                  </StatusPill>
                ) : null}

                <div className="flex items-center justify-between gap-2 mt-4 pt-4 border-t border-line">
                  <div>
                    <div className="text-base font-extrabold text-purple">
                      {formatCurrency(contract.amount)}
                    </div>
                    <div className="text-[11px] text-ink-faint">
                      {contract.expires ? `Valid to ${formatDate(contract.expires)}` : 'No expiry'}
                    </div>
                  </div>
                </div>

                {contract.signedBy ? (
                  <p className="text-[11px] text-ink-soft mt-2">
                    Signed by <b className="text-ink">{contract.signedBy}</b>
                    {contract.signedAt ? ` · ${formatDate(contract.signedAt)}` : ''}
                  </p>
                ) : null}

                <div className="flex items-center gap-1 mt-4 pt-3 border-t border-line">
                  <button
                    onClick={() => {
                      update('contracts', contract.id, { autoRemind: !contract.autoRemind });
                      toast[contract.autoRemind ? 'info' : 'success'](
                        contract.autoRemind
                          ? 'Renewal reminders off'
                          : 'Renewal reminders on (14, 7 and 3 days before expiry)',
                      );
                    }}
                    title={contract.autoRemind ? 'Disable reminders' : 'Enable reminders'}
                    className={cn(
                      'p-2 rounded-lg transition-colors',
                      contract.autoRemind
                        ? 'text-gold-deep bg-gold-dim'
                        : 'text-ink-faint hover:bg-surface-2',
                    )}
                  >
                    {contract.autoRemind ? <Bell size={15} /> : <BellOff size={15} />}
                  </button>
                  <button
                    onClick={() =>
                      toast.success(`Reminder emailed to ${clientFor(contract)?.name ?? 'client'}`)
                    }
                    title="Send reminder now"
                    className="p-2 text-ink-faint hover:text-purple hover:bg-purple-dim rounded-lg transition-colors"
                  >
                    <Mail size={15} />
                  </button>
                  <button
                    onClick={() => openEdit(contract)}
                    title="Edit"
                    className="p-2 text-ink-faint hover:text-purple hover:bg-purple-dim rounded-lg transition-colors"
                  >
                    <Edit2 size={15} />
                  </button>
                  <button
                    onClick={() => setConfirmDelete(contract)}
                    title="Delete"
                    className="p-2 text-ink-faint hover:text-red hover:bg-red-dim rounded-lg transition-colors ml-auto"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

                {contract.status !== 'signed' ? (
                  <Button
                    variant="purple"
                    size="sm"
                    icon={FileSignature}
                    className="w-full mt-3"
                    onClick={() => setSigning(contract)}
                  >
                    Capture Signature
                  </Button>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}

      <SignatureModal
        isOpen={Boolean(signing)}
        onClose={() => setSigning(null)}
        contractTitle={signing?.title ?? ''}
        defaultSigner={signing ? (clientFor(signing)?.contactName ?? '') : ''}
        onSign={({ signature, signerName }) => {
          if (!signing) return;
          update('contracts', signing.id, {
            status: 'signed',
            signedBy: signerName,
            signedAt: new Date().toISOString().slice(0, 10),
            signature,
          });
          toast.success('Contract signed');
        }}
      />

      <Modal
        open={isOpen}
        onClose={() => setIsOpen(false)}
        title={editingId ? 'Edit Contract' : 'New Contract'}
        width="max-w-lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="contract-form">
              {editingId ? 'Save Changes' : 'Create Contract'}
            </Button>
          </>
        }
      >
        <form id="contract-form" onSubmit={submit} className="space-y-4">
          <Field label="Title">
            <Input
              autoFocus
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Service Agreement — Wolf Package"
            />
          </Field>
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
          <Field label="Project" hint="Optional">
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
            <Field label="Value (USD)">
              <Input
                type="number"
                min="0"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </Field>
            <Field label="Expires">
              <Input
                type="date"
                value={form.expires}
                onChange={(e) => setForm({ ...form, expires: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Status">
            <Select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as ContractStatus })}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Terms"
            hint="Shown to the client in their portal for review before signing"
          >
            <Textarea
              rows={10}
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              className="leading-relaxed"
              placeholder={'1. SCOPE OF WORK\nWhat the studio will deliver…'}
            />
          </Field>
        </form>
      </Modal>

      <Modal
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        title="Delete contract?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (confirmDelete) {
                  remove('contracts', confirmDelete.id);
                  toast.success('Contract deleted');
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
          <b className="text-ink">{confirmDelete?.title}</b> will be removed from the studio and
          from the client's portal.
        </p>
      </Modal>
    </div>
  );
}
