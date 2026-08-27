import { useState } from 'react';
import { Edit2, MailOpen, Plus, Send, Trash2, Users } from 'lucide-react';
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
import { formatDate } from '@/src/lib/utils';
import { useStudio } from '@/src/store/StudioStore';
import type { Newsletter, NewsletterStatus } from '@/src/types';

const STATUSES: NewsletterStatus[] = ['draft', 'scheduled', 'published'];

const STATUS_TONE: Record<NewsletterStatus, 'positive' | 'warning' | 'neutral'> = {
  published: 'positive',
  scheduled: 'warning',
  draft: 'neutral',
};

type FormState = { title: string; audience: string; status: NewsletterStatus };

const blankForm = (): FormState => ({ title: '', audience: 'All subscribers', status: 'draft' });

export default function Newsletters() {
  const { newsletters, add, update, remove } = useStudio();

  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(blankForm);

  const openAdd = () => {
    setEditingId(null);
    setForm(blankForm());
    setIsOpen(true);
  };

  const openEdit = (nl: Newsletter) => {
    setEditingId(nl.id);
    setForm({ title: nl.title, audience: nl.audience, status: nl.status });
    setIsOpen(true);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error('Title is required');
      return;
    }
    const now = new Date().toISOString().slice(0, 10);
    if (editingId) {
      update('newsletters', editingId, { ...form, updatedAt: now });
      toast.success('Newsletter updated');
    } else {
      add('newsletters', { ...form, updatedAt: now });
      toast.success('Newsletter created');
    }
    setIsOpen(false);
  };

  const published = newsletters.filter((n) => n.status === 'published').length;

  return (
    <div className="max-w-[1200px] space-y-6">
      <PageHeader
        title="Newsletters"
        subtitle="Draft and schedule issues. Delivery connects with the backend."
        actions={
          <Button icon={Plus} onClick={openAdd}>
            New Issue
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <StatCard icon={MailOpen} tone="purple" value={newsletters.length} label="Total Issues" />
        <StatCard icon={Send} tone="positive" value={published} label="Published" />
        <StatCard
          icon={Users}
          tone="neutral"
          value={newsletters.length - published}
          label="In Progress"
        />
      </div>

      {newsletters.length === 0 ? (
        <Card>
          <EmptyState
            icon={MailOpen}
            title="No newsletters yet"
            description="Draft your first issue to start building your audience."
            action={
              <Button icon={Plus} onClick={openAdd}>
                New Issue
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {newsletters.map((nl) => (
            <Card key={nl.id} className="p-6 flex flex-col group">
              <div className="flex items-start justify-between gap-2">
                <StatusPill tone={STATUS_TONE[nl.status]}>{nl.status}</StatusPill>
                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => openEdit(nl)}
                    className="p-1.5 text-ink-faint hover:text-purple hover:bg-purple-dim rounded transition-colors"
                    aria-label="Edit"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => {
                      remove('newsletters', nl.id);
                      toast.success('Newsletter deleted');
                    }}
                    className="p-1.5 text-ink-faint hover:text-red hover:bg-red-dim rounded transition-colors"
                    aria-label="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <h3 className="text-lg font-bold text-ink leading-tight mt-3">{nl.title}</h3>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-ink-soft mt-2">
                <Users size={14} /> {nl.audience}
              </div>

              <div className="mt-auto pt-4 border-t border-line flex items-center justify-between">
                <span className="text-[11px] font-bold text-ink-faint">
                  {nl.status === 'published' && nl.sentAt
                    ? `Sent ${formatDate(nl.sentAt)}`
                    : `Edited ${formatDate(nl.updatedAt)}`}
                </span>
                {nl.status !== 'published' ? (
                  <button
                    onClick={() => {
                      update('newsletters', nl.id, {
                        status: 'published',
                        sentAt: new Date().toISOString().slice(0, 10),
                      });
                      toast.success('Newsletter published');
                    }}
                    className="text-sm font-bold text-purple hover:text-orange flex items-center gap-1 transition-colors"
                  >
                    Publish <Send size={14} />
                  </button>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={isOpen}
        onClose={() => setIsOpen(false)}
        title={editingId ? 'Edit Issue' : 'New Issue'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="newsletter-form">
              {editingId ? 'Save Changes' : 'Create Issue'}
            </Button>
          </>
        }
      >
        <form id="newsletter-form" onSubmit={submit} className="space-y-4">
          <Field label="Title">
            <Input
              autoFocus
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Design trends this quarter"
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Audience">
              <Input
                value={form.audience}
                onChange={(e) => setForm({ ...form, audience: e.target.value })}
              />
            </Field>
            <Field label="Status">
              <Select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as NewsletterStatus })}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </form>
      </Modal>
    </div>
  );
}
