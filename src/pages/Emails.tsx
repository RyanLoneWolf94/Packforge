import { useState } from 'react';
import { Copy, Edit2, Eye, Mail, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  StatusPill,
  Textarea,
} from '@/src/components/ui';
import { useStudio } from '@/src/store/StudioStore';
import type { EmailTemplate } from '@/src/types';

/**
 * Email template library. Templates persist to the store; the merge variables
 * (`{{clientName}}` etc.) are documented here so they line up with what the
 * backend will substitute when sending goes live.
 */

const VARIABLES = [
  'clientName',
  'projectName',
  'invoiceNumber',
  'expiryDate',
  'studioName',
  'studioLead',
];

type FormState = Omit<EmailTemplate, 'id'>;

const blankForm = (): FormState => ({ name: '', subject: '', body: '', category: 'General' });

export default function Emails() {
  const { emailTemplates, add, update, remove } = useStudio();

  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(blankForm);
  const [preview, setPreview] = useState<EmailTemplate | null>(null);

  const openAdd = () => {
    setEditingId(null);
    setForm(blankForm());
    setIsOpen(true);
  };

  const openEdit = (template: EmailTemplate) => {
    setEditingId(template.id);
    setForm({
      name: template.name,
      subject: template.subject,
      body: template.body,
      category: template.category,
    });
    setIsOpen(true);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.subject.trim()) {
      toast.error('Name and subject are required');
      return;
    }
    const payload = {
      name: form.name.trim(),
      subject: form.subject.trim(),
      body: form.body,
      category: form.category.trim() || 'General',
    };
    if (editingId) {
      update('emailTemplates', editingId, payload);
      toast.success('Template updated');
    } else {
      add('emailTemplates', payload);
      toast.success('Template created');
    }
    setIsOpen(false);
  };

  return (
    <div className="max-w-[1200px] space-y-6">
      <PageHeader
        title="Email Templates"
        subtitle="Reusable copy for the emails the studio sends clients."
        actions={
          <Button icon={Plus} onClick={openAdd}>
            New Template
          </Button>
        }
      />

      {emailTemplates.length === 0 ? (
        <Card>
          <EmptyState
            icon={Mail}
            title="No templates yet"
            description="Create a reusable template for invoices, quotes and updates."
            action={
              <Button icon={Plus} onClick={openAdd}>
                New Template
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {emailTemplates.map((template) => (
            <Card key={template.id} className="p-5 flex flex-col group">
              <div className="flex items-start justify-between gap-2 mb-2">
                <StatusPill tone="neutral">{template.category}</StatusPill>
                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => setPreview(template)}
                    className="p-1.5 text-ink-faint hover:text-purple hover:bg-purple-dim rounded transition-colors"
                    aria-label="Preview"
                  >
                    <Eye size={14} />
                  </button>
                  <button
                    onClick={() => {
                      add('emailTemplates', {
                        name: `${template.name} (copy)`,
                        subject: template.subject,
                        body: template.body,
                        category: template.category,
                      });
                      toast.success('Template duplicated');
                    }}
                    className="p-1.5 text-ink-faint hover:text-purple hover:bg-purple-dim rounded transition-colors"
                    aria-label="Duplicate"
                  >
                    <Copy size={14} />
                  </button>
                  <button
                    onClick={() => openEdit(template)}
                    className="p-1.5 text-ink-faint hover:text-purple hover:bg-purple-dim rounded transition-colors"
                    aria-label="Edit"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => {
                      remove('emailTemplates', template.id);
                      toast.success('Template deleted');
                    }}
                    className="p-1.5 text-ink-faint hover:text-red hover:bg-red-dim rounded transition-colors"
                    aria-label="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <h3 className="font-bold text-ink leading-tight">{template.name}</h3>
              <p className="text-xs text-ink-soft mt-1 font-mono truncate">{template.subject}</p>
              <p className="text-[13px] text-ink-soft mt-3 line-clamp-3 flex-1 whitespace-pre-wrap">
                {template.body}
              </p>

              <button
                onClick={() => openEdit(template)}
                className="mt-4 pt-3 border-t border-line text-xs font-bold text-orange hover:text-orange-deep flex items-center gap-1"
              >
                <Pencil size={13} /> Edit template
              </button>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={isOpen}
        onClose={() => setIsOpen(false)}
        title={editingId ? 'Edit Template' : 'New Template'}
        width="max-w-2xl"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="email-form">
              {editingId ? 'Save Changes' : 'Create Template'}
            </Button>
          </>
        }
      >
        <form id="email-form" onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Template Name">
              <Input
                autoFocus
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Overdue Invoice"
              />
            </Field>
            <Field label="Category">
              <Input
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="Invoice"
              />
            </Field>
          </div>
          <Field label="Subject">
            <Input
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              className="font-mono"
              placeholder="Invoice {{invoiceNumber}} from {{studioName}}"
            />
          </Field>
          <Field label="Body">
            <Textarea
              rows={8}
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              className="font-mono leading-relaxed"
              placeholder="Hi {{clientName}},"
            />
          </Field>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">
              Merge variables — click to insert
            </span>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {VARIABLES.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setForm({ ...form, body: `${form.body}{{${v}}}` })}
                  className="px-2.5 py-1 rounded-md bg-surface-2 text-[11px] font-mono text-ink-soft hover:bg-purple-dim hover:text-purple transition-colors"
                >
                  {`{{${v}}}`}
                </button>
              ))}
            </div>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(preview)}
        onClose={() => setPreview(null)}
        title={preview?.name ?? 'Preview'}
        subtitle={preview?.subject}
        width="max-w-xl"
      >
        <div className="bg-surface-2 rounded-xl p-6">
          <div className="bg-surface rounded-lg border border-line p-6 whitespace-pre-wrap text-[13.5px] text-ink leading-relaxed">
            {preview?.body}
          </div>
        </div>
      </Modal>
    </div>
  );
}
