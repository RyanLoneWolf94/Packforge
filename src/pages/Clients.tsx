import { useState } from 'react';
import {
  Building2,
  Edit2,
  ExternalLink,
  Link2,
  Mail,
  Phone,
  Plus,
  Trash2,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';
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
  StatCard,
  StatusPill,
} from '@/src/components/ui';
import { formatCurrency, initials } from '@/src/lib/utils';
import { projectBudget, projectProgress } from '@/src/lib/tracker';
import { outstandingTotal } from '@/src/lib/finance';
import { useStudio } from '@/src/store/StudioStore';
import type { Client } from '@/src/types';

type FormState = Omit<Client, 'id' | 'portalToken' | 'createdAt'>;

const blankForm = (): FormState => ({
  name: '',
  contactName: '',
  email: '',
  phone: '',
  location: '',
  industry: '',
  status: 'active',
});

export default function Clients() {
  const { clients, projects, invoices, projectsForClient, createClient, update, deleteClient } =
    useStudio();

  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(blankForm);
  const [confirmDelete, setConfirmDelete] = useState<Client | null>(null);

  const openAdd = () => {
    setEditingId(null);
    setForm(blankForm());
    setIsOpen(true);
  };

  const openEdit = (client: Client) => {
    setEditingId(client.id);
    setForm({
      name: client.name,
      contactName: client.contactName,
      email: client.email,
      phone: client.phone,
      location: client.location,
      industry: client.industry,
      status: client.status,
    });
    setIsOpen(true);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) {
      toast.error('Client name and email are required');
      return;
    }
    if (editingId) {
      update('clients', editingId, form);
      toast.success('Client updated');
    } else {
      const created = createClient(form);
      toast.success(`${created.name} added — portal link ready`);
    }
    setIsOpen(false);
  };

  const totalValue = projects.reduce((sum, p) => sum + projectBudget(p), 0);

  return (
    <div className="max-w-[1400px] space-y-6">
      <PageHeader
        title="Clients"
        subtitle="Each client gets their own portal link, scoped to their work."
        actions={
          <Button icon={Plus} onClick={openAdd}>
            New Client
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <StatCard icon={Users} tone="purple" value={clients.length} label="Total Clients" />
        <StatCard
          icon={Building2}
          tone="orange"
          value={formatCurrency(totalValue)}
          label="Lifetime Engagement Value"
        />
        <StatCard
          icon={Mail}
          tone="gold"
          value={formatCurrency(outstandingTotal(invoices))}
          label="Outstanding Across Clients"
        />
      </div>

      {clients.length === 0 ? (
        <Card>
          <EmptyState
            icon={Users}
            title="No clients yet"
            description="Add a client to start tracking their projects, invoices and files."
            action={
              <Button icon={Plus} onClick={openAdd}>
                New Client
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {clients.map((client) => {
            const clientProjects = projectsForClient(client.id);
            const value = clientProjects.reduce((sum, p) => sum + projectBudget(p), 0);
            const owed = outstandingTotal(invoices.filter((i) => i.clientId === client.id));

            return (
              <Card key={client.id} className="p-6 group relative">
                <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => {
                      const url = `${window.location.origin}/portal/${client.portalToken}`;
                      navigator.clipboard
                        .writeText(url)
                        .then(() => toast.success('Portal link copied'))
                        .catch(() => toast.error(url));
                    }}
                    title="Copy portal link"
                    className="p-1.5 text-ink-faint hover:text-orange hover:bg-orange-dim rounded transition-colors"
                  >
                    <Link2 size={14} />
                  </button>
                  <button
                    onClick={() => openEdit(client)}
                    title="Edit"
                    className="p-1.5 text-ink-faint hover:text-purple hover:bg-purple-dim rounded transition-colors"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => setConfirmDelete(client)}
                    title="Delete"
                    className="p-1.5 text-ink-faint hover:text-red hover:bg-red-dim rounded transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <div className="flex items-center gap-3 mb-4 pr-20">
                  <div className="w-11 h-11 rounded-xl bg-night text-white flex items-center justify-center text-sm font-extrabold shrink-0">
                    {initials(client.name)}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-ink truncate">{client.name}</h3>
                    <p className="text-xs text-ink-soft truncate">{client.industry}</p>
                  </div>
                </div>

                <div className="space-y-1.5 text-[12.5px] text-ink-soft mb-4">
                  <div className="flex items-center gap-2 truncate">
                    <Mail size={13} className="shrink-0 text-ink-faint" />
                    <span className="truncate">{client.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone size={13} className="shrink-0 text-ink-faint" />
                    {client.phone || '—'}
                  </div>
                  <div className="flex items-center gap-2">
                    <Building2 size={13} className="shrink-0 text-ink-faint" />
                    {client.location || '—'}
                  </div>
                </div>

                <div className="space-y-2 pt-4 border-t border-line">
                  {clientProjects.length === 0 ? (
                    <p className="text-xs text-ink-faint italic">No projects yet</p>
                  ) : (
                    clientProjects.slice(0, 2).map((project) => (
                      <Link
                        key={project.id}
                        to={`/admin/tracker/${project.id}`}
                        className="block group/proj"
                      >
                        <div className="flex items-center justify-between text-[11.5px] mb-1">
                          <span className="font-semibold text-ink truncate group-hover/proj:text-orange transition-colors">
                            {project.name}
                          </span>
                          <span className="text-ink-faint font-bold shrink-0 ml-2">
                            {projectProgress(project).pct}%
                          </span>
                        </div>
                        <ProgressBar value={projectProgress(project).pct} className="h-1" />
                      </Link>
                    ))
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 mt-4 pt-4 border-t border-line">
                  <div>
                    <div className="text-sm font-extrabold text-ink">{formatCurrency(value)}</div>
                    <div className="text-[10px] uppercase tracking-widest font-bold text-ink-faint">
                      Engagement value
                    </div>
                  </div>
                  {owed > 0 ? (
                    <StatusPill tone="warning">{formatCurrency(owed)} due</StatusPill>
                  ) : (
                    <StatusPill tone="positive">Settled</StatusPill>
                  )}
                </div>

                <Link
                  to={`/portal/${client.portalToken}`}
                  target="_blank"
                  className="mt-4 w-full inline-flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold bg-purple-dim text-purple hover:bg-purple hover:text-white transition-colors"
                >
                  <ExternalLink size={13} /> Open client portal
                </Link>
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        open={isOpen}
        onClose={() => setIsOpen(false)}
        title={editingId ? 'Edit Client' : 'New Client'}
        width="max-w-lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="client-form">
              {editingId ? 'Save Changes' : 'Add Client'}
            </Button>
          </>
        }
      >
        <form id="client-form" onSubmit={submit} className="space-y-4">
          <Field label="Business Name">
            <Input
              autoFocus
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Serene Haven Lodge"
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Primary Contact">
              <Input
                value={form.contactName}
                onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                placeholder="e.g. Farai Nyathi"
              />
            </Field>
            <Field label="Industry">
              <Input
                value={form.industry}
                onChange={(e) => setForm({ ...form, industry: e.target.value })}
                placeholder="e.g. Hospitality"
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
          <Field label="Location">
            <Input
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="e.g. Harare, Zimbabwe"
            />
          </Field>
        </form>
      </Modal>

      <Modal
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        title="Delete client?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (confirmDelete) {
                  deleteClient(confirmDelete.id);
                  toast.success(`${confirmDelete.name} removed`);
                }
                setConfirmDelete(null);
              }}
            >
              Delete Everything
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-soft">
          Deleting <b className="text-ink">{confirmDelete?.name}</b> also removes their projects,
          invoices, quotes, contracts and files, and disables their portal link. This can't be
          undone.
        </p>
      </Modal>
    </div>
  );
}
