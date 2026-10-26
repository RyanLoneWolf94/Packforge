import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { Button, Modal, Select } from '@/src/components/ui';
import { cn } from '@/src/lib/utils';
import { useStudio } from '@/src/store/StudioStore';
import { PROJECT_STATUSES, type Project, type ProjectStatus } from '@/src/types';

/**
 * Admin controls for a project's lifecycle, shared by the Projects board and
 * the Phase Tracker so the two can't drift.
 *
 * Both of these are admin-only surfaces; nothing here is reachable from the
 * client portal.
 */

export function ProjectStatusSelect({
  project,
  className,
}: {
  project: Project;
  className?: string;
}) {
  const { update } = useStudio();

  return (
    <label className="flex items-center gap-2">
      <span className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">Status</span>
      <Select
        value={project.status}
        onChange={(e) => {
          const status = e.target.value as ProjectStatus;
          update('projects', project.id, { status });
          toast.success(
            status === 'archived'
              ? `${project.name} archived — hidden from the client portal`
              : `Status set to ${status}`,
          );
        }}
        className={cn('py-1.5 text-[13px] w-[140px]', className)}
      >
        {PROJECT_STATUSES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </Select>
    </label>
  );
}

/**
 * Deleting a project is permanent and takes its task board with it, so this
 * asks for the project's name rather than a bare "are you sure" — the same
 * rule the MCP tool follows. Archiving is offered in the same breath, since
 * it is what's usually wanted.
 */
export function DeleteProjectButton({
  project,
  onDeleted,
}: {
  project: Project;
  onDeleted?: () => void;
}) {
  const { deleteProject, update, invoices, contracts, files, expenses, projectTasks } = useStudio();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');

  const linked = {
    tasks: projectTasks.filter((t) => t.projectId === project.id).length,
    invoices: invoices.filter((i) => i.projectId === project.id).length,
    contracts: contracts.filter((c) => c.projectId === project.id).length,
    files: files.filter((f) => f.projectId === project.id).length,
    expenses: expenses.filter((e) => e.projectId === project.id).length,
  };
  const unlinked = linked.invoices + linked.contracts + linked.files + linked.expenses;

  const close = () => {
    setOpen(false);
    setTyped('');
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Delete project"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-ink-soft hover:text-red hover:bg-red-dim transition-colors"
      >
        <Trash size={14} /> Delete
      </button>

      <Modal
        open={open}
        onClose={close}
        title="Delete this project?"
        subtitle="This cannot be undone"
        footer={
          <>
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            {project.status !== 'archived' ? (
              <Button
                variant="secondary"
                onClick={() => {
                  update('projects', project.id, { status: 'archived' });
                  toast.success(`${project.name} archived instead — nothing was deleted`);
                  close();
                }}
              >
                Archive instead
              </Button>
            ) : null}
            <Button
              variant="danger"
              disabled={typed.trim() !== project.name}
              onClick={() => {
                deleteProject(project.id);
                toast.success(`${project.name} deleted`);
                close();
                if (onDeleted) onDeleted();
                else navigate('/admin/projects');
              }}
            >
              Delete permanently
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-ink-soft leading-relaxed">
            <b className="text-ink">{project.name}</b> and its{' '}
            <b className="text-ink">{linked.tasks}</b> board task
            {linked.tasks === 1 ? '' : 's'} will be permanently removed.
          </p>

          {unlinked > 0 ? (
            <div className="px-4 py-3 rounded-lg bg-surface-2 border border-line text-[13px] text-ink-soft">
              <b className="text-ink">{unlinked} other record{unlinked === 1 ? '' : 's'}</b> will
              survive but lose their link to this project:{' '}
              {[
                linked.invoices && `${linked.invoices} invoice${linked.invoices === 1 ? '' : 's'}`,
                linked.contracts &&
                  `${linked.contracts} contract${linked.contracts === 1 ? '' : 's'}`,
                linked.files && `${linked.files} file${linked.files === 1 ? '' : 's'}`,
                linked.expenses && `${linked.expenses} expense${linked.expenses === 1 ? '' : 's'}`,
              ]
                .filter(Boolean)
                .join(', ')}
              .
            </div>
          ) : null}

          <p className="text-[13px] text-ink-soft">
            If you only want it out of the way, <b className="text-ink">archive</b> it instead. It
            keeps the record and hides it from the client's portal.
          </p>

          <label className="block">
            <span className="text-[13px] text-ink-soft">
              Type <b className="text-ink">{project.name}</b> to confirm:
            </span>
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              className="mt-2 w-full px-4 py-2.5 rounded-lg border border-line bg-surface text-sm text-ink outline-none focus:border-orange"
            />
          </label>
        </div>
      </Modal>
    </>
  );
}
