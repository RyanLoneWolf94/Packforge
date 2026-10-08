import { useState } from 'react';
import { toast } from 'sonner';
import {
  Button,
  Field,
  Input,
  Modal,
  Select,
  Textarea,
} from '@/src/components/ui';
import { useStudio } from '@/src/store/StudioStore';

/**
 * Create a project, optionally seeded from a blueprint.
 *
 * Shared by the tracker and the projects workspace so a project can be started
 * from wherever you happen to be, with one definition of what "new project"
 * means.
 */
export default function NewProjectModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: (id: string) => void;
}) {
  const { clients, blueprints, createProject } = useStudio();
  const [form, setForm] = useState({
    name: '',
    clientId: '',
    blueprintId: '',
    startDate: new Date().toISOString().slice(0, 10),
    targetDelivery: '',
    summary: '',
  });

  // Optional: a blueprint seeds the phases, deliverables and client timeline.
  const bp = blueprints.find((b) => b.id === form.blueprintId);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.clientId) {
      toast.error('Project name and client are required');
      return;
    }
    const days = bp?.timelineDays ?? 28;
    const project = createProject({
      name: form.name.trim(),
      clientId: form.clientId,
      packageName: bp?.title ?? 'Custom engagement',
      blueprint: bp,
      startDate: form.startDate,
      targetDelivery:
        form.targetDelivery ||
        new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10),
      summary: form.summary.trim() || bp?.description || '',
    });
    toast.success(`${project.name} created with ${project.phases.length} phases`);
    onCreated?.(project.id);
    onClose();
    setForm({
      name: '',
      clientId: '',
      blueprintId: '',
      startDate: new Date().toISOString().slice(0, 10),
      targetDelivery: '',
      summary: '',
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Project"
      subtitle="Picking a package seeds the phases, deliverables and budget split"
      width="max-w-lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="new-tracker-project">
            Create Project
          </Button>
        </>
      }
    >
      <form id="new-tracker-project" onSubmit={submit} className="space-y-4">
        <Field label="Project Name">
          <Input
            autoFocus
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Serene Haven Rebrand"
          />
        </Field>

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

        <Field
          label="Blueprint"
          hint={
            bp
              ? `${bp.phases.length} phases · ${bp.timeline.length} timeline stages · ${bp.timelineDays} days`
              : 'Optional — seeds the phases, deliverables and client timeline. Leave blank to start empty.'
          }
        >
          <Select
            value={form.blueprintId}
            onChange={(e) => setForm({ ...form, blueprintId: e.target.value })}
          >
            <option value="">Blank project</option>
            {[...new Set(blueprints.map((b) => b.category))].sort().map((cat) => (
              <optgroup key={cat} label={cat}>
                {blueprints
                  .filter((b) => b.category === cat)
                  .map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.title}
                    </option>
                  ))}
              </optgroup>
            ))}
          </Select>
        </Field>

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
            placeholder={bp?.description || 'What this engagement is about'}
          />
        </Field>
      </form>
    </Modal>
  );
}

/**
 * Editor for the client's emerging identity. Fields are independent — leaving
 * one blank simply keeps it listed as "still to come" in the portal, which is
 * what makes the snapshot reveal progressively rather than all at once.
 */
