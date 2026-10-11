import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button, Field, Input, Modal, Select, Textarea } from '@/src/components/ui';
import { useStudio } from '@/src/store/StudioStore';
import type { Project, ProjectStatus } from '@/src/types';

/**
 * Edit a project's details after it exists.
 *
 * Phases, deliverables and the client timeline are edited in the tracker where
 * you can see their state; this covers the things that describe the engagement
 * itself — who it's for, what it's called, when it's due and what the client
 * reads at the top of their portal.
 */

const STATUSES: ProjectStatus[] = ['planning', 'active', 'review', 'completed', 'archived'];

export default function EditProjectModal({
  project,
  open,
  onClose,
}: {
  project: Project | null;
  open: boolean;
  onClose: () => void;
}) {
  const { clients, update } = useStudio();
  const [form, setForm] = useState({
    name: '',
    clientId: '',
    ref: '',
    packageName: '',
    status: 'planning' as ProjectStatus,
    startDate: '',
    targetDelivery: '',
    summary: '',
  });

  // Re-seed whenever a different project is opened.
  useEffect(() => {
    if (!project) return;
    setForm({
      name: project.name,
      clientId: project.clientId,
      ref: project.ref,
      packageName: project.packageName,
      status: project.status,
      startDate: project.startDate,
      targetDelivery: project.targetDelivery,
      summary: project.summary,
    });
  }, [project]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!project) return;
    if (!form.name.trim() || !form.clientId) {
      toast.error('Project name and client are required');
      return;
    }
    update('projects', project.id, {
      name: form.name.trim(),
      clientId: form.clientId,
      ref: form.ref.trim(),
      packageName: form.packageName.trim(),
      status: form.status,
      startDate: form.startDate,
      targetDelivery: form.targetDelivery,
      summary: form.summary.trim(),
    });
    toast.success('Project updated');
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit Project"
      subtitle="Details here appear in the client's portal"
      width="max-w-lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="edit-project">
            Save Changes
          </Button>
        </>
      }
    >
      <form id="edit-project" onSubmit={submit} className="space-y-4">
        <Field label="Project Name">
          <Input
            autoFocus
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Client">
            <Select
              value={form.clientId}
              onChange={(e) => setForm({ ...form, clientId: e.target.value })}
            >
              <option value="">Select a client…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status">
            <Select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as ProjectStatus })}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Reference" hint="Shown on documents">
            <Input
              value={form.ref}
              onChange={(e) => setForm({ ...form, ref: e.target.value })}
              placeholder="e.g. KOKI-1026"
            />
          </Field>
          <Field label="Engagement">
            <Input
              value={form.packageName}
              onChange={(e) => setForm({ ...form, packageName: e.target.value })}
              placeholder="e.g. Web App MVP"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Start Date">
            <Input
              type="date"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
            />
          </Field>
          <Field label="Target Delivery">
            <Input
              type="date"
              value={form.targetDelivery}
              onChange={(e) => setForm({ ...form, targetDelivery: e.target.value })}
            />
          </Field>
        </div>

        <Field label="Summary" hint="Shown at the top of the client portal">
          <Textarea
            rows={3}
            value={form.summary}
            onChange={(e) => setForm({ ...form, summary: e.target.value })}
          />
        </Field>
      </form>
    </Modal>
  );
}
