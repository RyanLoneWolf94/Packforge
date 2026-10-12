import { useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { CaretLeft, CaretRight, Check, Eye, EyeSlash, Clock, FolderOpen, Gauge, ListChecks, PencilSimple, Plus, Trash, X } from '@phosphor-icons/react';
import { motion } from 'motion/react';
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
  StatusPill,
} from '@/src/components/ui';
import { cn, formatDate } from '@/src/lib/utils';
import { projectProgress } from '@/src/lib/tracker';
import { useStudio } from '@/src/store/StudioStore';
import NewProjectModal from '@/src/components/NewProjectModal';
import EditProjectModal from '@/src/components/EditProjectModal';
import ProjectSummary from '@/src/components/ProjectSummary';
import type { ProjectStatus, ProjectTask, Subtask, TaskLane } from '@/src/types';

/**
 * Day-to-day task board. Projects themselves are created and tracked in
 * `/admin/tracker`; this page layers the studio's internal Kanban on top and
 * owns the project's lifecycle status.
 *
 * Tasks live in the shared store (and therefore Supabase) like everything else,
 * so a board moves with the studio rather than being stranded in one browser.
 * They are deliberately separate from a phase's `Deliverable`: deliverables are
 * the client-facing promise, these are how the studio gets there.
 */

const LANES: TaskLane[] = ['Todo', 'In Progress', 'Done'];

const PROJECT_STATUSES: ProjectStatus[] = [
  'planning',
  'active',
  'review',
  'completed',
  'archived',
];

const STATUS_TONE: Record<ProjectStatus, 'neutral' | 'active' | 'warning' | 'done'> = {
  planning: 'neutral',
  active: 'active',
  review: 'warning',
  completed: 'done',
  archived: 'neutral',
};

const PRIORITIES = ['High', 'Medium', 'Low'] as const;

const PRIORITY_CLASS: Record<string, string> = {
  high: 'bg-red-dim text-red',
  medium: 'bg-gold-dim text-gold-deep',
  low: 'bg-purple-dim text-purple',
};

let seq = 0;
const uid = (p: string) => `${p}-${Date.now().toString(36)}-${(seq++).toString(36)}`;

type TaskForm = { title: string; tag: string; dueDate: string; phaseId: string };
const blankTask = (): TaskForm => ({ title: '', tag: 'Medium', dueDate: '', phaseId: '' });

export default function Projects() {
  const { projects, projectTasks, clientFor, add, update, remove, addDeliverable, addPhase } =
    useStudio();

  const [showArchived, setShowArchived] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isNewOpen, setIsNewOpen] = useState(false);
  // Board can be narrowed to one phase, which is also how tasks get organised
  // into phases after the fact.
  const [phaseFilter, setPhaseFilter] = useState<string>('all');
  const [addingPhase, setAddingPhase] = useState(false);
  const [newPhaseName, setNewPhaseName] = useState('');
  const [isEditOpen, setIsEditOpen] = useState(false);

  const visibleProjects = useMemo(
    () => projects.filter((p) => showArchived || p.status !== 'archived'),
    [projects, showArchived],
  );

  // Fall back to the first visible project if the selection is gone or hidden.
  const selected =
    visibleProjects.find((p) => p.id === selectedId) ?? visibleProjects[0] ?? null;

  const archivedCount = projects.filter((p) => p.status === 'archived').length;

  /* ------------------------------- Tasks ------------------------------- */

  const tasksByLane = useMemo(() => {
    const grouped: Record<TaskLane, ProjectTask[]> = {
      Todo: [],
      'In Progress': [],
      Done: [],
    };
    if (!selected) return grouped;
    for (const task of projectTasks) {
      if (task.projectId !== selected.id) continue;
      if (phaseFilter === 'unassigned' && task.phaseId) continue;
      if (phaseFilter !== 'all' && phaseFilter !== 'unassigned' && task.phaseId !== phaseFilter)
        continue;
      (grouped[task.lane] ?? grouped.Todo).push(task);
    }
    for (const lane of LANES) grouped[lane].sort((a, b) => a.sortOrder - b.sortOrder);
    return grouped;
  }, [projectTasks, selected, phaseFilter]);

  const [taskModal, setTaskModal] = useState<{ lane: TaskLane; editing: ProjectTask | null } | null>(
    null,
  );
  // Promoting a task copies it onto the client-facing tracker as a deliverable.
  // Tasks stay internal by default — this is the deliberate hand-off.
  const [promoting, setPromoting] = useState<ProjectTask | null>(null);
  const [promotePhaseId, setPromotePhaseId] = useState('');

  const promotedTitles = useMemo(() => {
    const titles = new Set<string>();
    selected?.phases.forEach((ph) =>
      ph.deliverables.forEach((d) => titles.add(d.title.trim().toLowerCase())),
    );
    return titles;
  }, [selected]);
  const [taskForm, setTaskForm] = useState<TaskForm>(blankTask);
  const [subtaskDraft, setSubtaskDraft] = useState<Record<string, string>>({});
  const [addingSubtaskTo, setAddingSubtaskTo] = useState<string | null>(null);

  const openNewTask = (lane: TaskLane) => {
    setTaskForm(blankTask());
    setTaskModal({ lane, editing: null });
  };

  const openEditTask = (task: ProjectTask) => {
    setTaskForm({
      title: task.title,
      tag: task.tags[0] ?? 'Medium',
      dueDate: task.dueDate,
      phaseId: task.phaseId ?? '',
    });
    setTaskModal({ lane: task.lane, editing: task });
  };

  const submitTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskModal || !selected) return;
    if (!taskForm.title.trim()) {
      toast.error('Give the task a title');
      return;
    }

    if (taskModal.editing) {
      update('projectTasks', taskModal.editing.id, {
        title: taskForm.title.trim(),
        tags: [taskForm.tag],
        dueDate: taskForm.dueDate,
        phaseId: taskForm.phaseId || undefined,
      });
      toast.success('Task updated');
    } else {
      add('projectTasks', {
        projectId: selected.id,
        lane: taskModal.lane,
        title: taskForm.title.trim(),
        tags: [taskForm.tag],
        dueDate: taskForm.dueDate,
        phaseId: taskForm.phaseId || (phaseFilter !== 'all' ? phaseFilter : undefined),
        assignee: 'RM',
        subtasks: [],
        clientVisible: true,
        sortOrder: tasksByLane[taskModal.lane].length,
        createdAt: new Date().toISOString().slice(0, 10),
      });
      toast.success('Task added');
    }
    setTaskModal(null);
  };

  /** Tick a task straight to Done, or send a finished one back to In Progress. */
  const toggleDone = (task: ProjectTask) => {
    const next: TaskLane = task.lane === 'Done' ? 'In Progress' : 'Done';
    update('projectTasks', task.id, { lane: next, sortOrder: tasksByLane[next].length });
    toast.success(next === 'Done' ? 'Task completed' : 'Task reopened');
  };

  /** Move a task one lane left or right — the board has no drag-and-drop. */
  const moveTask = (task: ProjectTask, direction: -1 | 1) => {
    const next = LANES[LANES.indexOf(task.lane) + direction];
    if (!next) return;
    update('projectTasks', task.id, { lane: next, sortOrder: tasksByLane[next].length });
  };

  const patchSubtasks = (task: ProjectTask, subtasks: Subtask[]) =>
    update('projectTasks', task.id, { subtasks });

  return (
    <div className="max-w-[1400px] h-full flex flex-col space-y-6">
      <PageHeader
        title="Projects Workspace"
        subtitle="Plan and move the work behind each project."
        actions={
          <>
            <RouterLink to="/admin/tracker">
              <Button variant="secondary" icon={Gauge}>
                Open Tracker
              </Button>
            </RouterLink>
            <Button icon={Plus} onClick={() => setIsNewOpen(true)}>
              New Project
            </Button>
          </>
        }
      />

      {projects.length === 0 ? (
        <Card>
          <EmptyState
            icon={FolderOpen}
            title="No projects yet"
            description="Start a project from a blueprint and its phases, deliverables and timeline are seeded for you."
            action={
              <Button icon={Plus} onClick={() => setIsNewOpen(true)}>
                New Project
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="flex-1 flex flex-col md:flex-row gap-6 min-h-[600px] overflow-hidden pb-4">
          {/* Project rail */}
          <div className="w-full md:w-[300px] shrink-0 flex flex-col">
            <div className="flex items-center justify-between gap-2 mb-3 px-1">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-ink-faint">
                Projects ({visibleProjects.length})
              </h3>
              {archivedCount > 0 ? (
                <button
                  onClick={() => setShowArchived((v) => !v)}
                  className="text-[11px] font-bold text-orange hover:text-orange-deep"
                >
                  {showArchived ? 'Hide' : `Show`} archived ({archivedCount})
                </button>
              ) : null}
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-none pb-8">
              {visibleProjects.map((project) => {
                const pct = projectProgress(project).pct;
                const isActive = selected?.id === project.id;
                return (
                  <button
                    key={project.id}
                    onClick={() => setSelectedId(project.id)}
                    className={cn(
                      'w-full text-left bg-surface rounded-xl p-4 border shadow-sm transition-all hover:shadow-md',
                      isActive ? 'border-orange ring-1 ring-orange' : 'border-line',
                      project.status === 'archived' && 'opacity-60',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h4 className="font-bold text-ink text-sm leading-tight">{project.name}</h4>
                      <StatusPill tone={STATUS_TONE[project.status]}>{project.status}</StatusPill>
                    </div>
                    <p className="text-xs text-ink-soft mb-4">
                      {clientFor(project)?.name ?? 'Unassigned'}
                    </p>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-medium text-ink-soft uppercase tracking-wide">
                        <span>Phase progress</span>
                        <span className="text-ink font-bold">{pct}%</span>
                      </div>
                      <ProgressBar
                        value={pct}
                        tone={isActive ? 'orange' : 'purple'}
                        className="h-1.5"
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Board */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {selected ? (
              <div className="h-full flex flex-col">
                <div className="flex items-center justify-between gap-3 flex-wrap mb-6 bg-surface p-4 rounded-xl border border-line shadow-sm shrink-0">
                  <h2 className="text-lg font-bold text-ink flex items-center gap-2 min-w-0">
                    <FolderOpen size={20} className="text-orange shrink-0" />
                    <span className="truncate">{selected.name}</span>
                    <span className="text-ink-faint font-normal">/ Kanban</span>
                  </h2>

                  <div className="flex items-center gap-3">
                    {/* The project's lifecycle status — the one place it's set. */}
                    <label className="flex items-center gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">
                        Status
                      </span>
                      <Select
                        value={selected.status}
                        onChange={(e) => {
                          const status = e.target.value as ProjectStatus;
                          update('projects', selected.id, { status });
                          toast.success(
                            status === 'archived'
                              ? `${selected.name} archived — hidden from the client portal`
                              : `Status set to ${status}`,
                          );
                        }}
                        className="py-1.5 text-[13px] w-[140px]"
                      >
                        {PROJECT_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </Select>
                    </label>

                    <button
                      onClick={() => setIsEditOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-ink-soft hover:text-ink hover:bg-surface-2 transition-colors"
                    >
                      <PencilSimple size={14} /> Edit
                    </button>

                    <RouterLink
                      to={`/admin/tracker/${selected.id}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-purple-dim text-purple hover:bg-purple hover:text-white transition-colors"
                    >
                      <Gauge size={14} /> Phase tracker
                    </RouterLink>
                  </div>
                </div>

                <div className="mb-6 shrink-0">
                  <ProjectSummary project={selected} />
                </div>

                {selected.status === 'archived' ? (
                  <div className="mb-4 px-4 py-2.5 rounded-lg bg-surface-2 border border-line text-[13px] text-ink-soft">
                    This project is archived. It stays in your records but no longer
                    appears in the client's portal.
                  </div>
                ) : null}

                {/* Phases live on the project; this is where tasks get sorted
                    into them, including tasks created before the phase existed. */}
                <div className="flex items-center gap-2 flex-wrap mb-4 shrink-0">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-ink-faint mr-1">
                    Phases
                  </span>

                  {(() => {
                    const all = projectTasks.filter((t) => t.projectId === selected.id);
                    const chip = (key: string, label: string, count: number) => (
                      <button
                        key={key}
                        onClick={() => setPhaseFilter(key)}
                        className={cn(
                          'px-3 py-1.5 rounded-full text-[11.5px] font-bold transition-colors',
                          phaseFilter === key
                            ? 'bg-night text-white'
                            : 'bg-surface-2 text-ink-soft hover:text-ink',
                        )}
                      >
                        {label} <span className="opacity-60">{count}</span>
                      </button>
                    );
                    const unassigned = all.filter((t) => !t.phaseId).length;
                    return (
                      <>
                        {chip('all', 'All', all.length)}
                        {selected.phases.map((ph, i) =>
                          chip(
                            ph.id,
                            `${i + 1}. ${ph.name}`,
                            all.filter((t) => t.phaseId === ph.id).length,
                          ),
                        )}
                        {unassigned > 0 ? chip('unassigned', 'Unassigned', unassigned) : null}
                      </>
                    );
                  })()}

                  {addingPhase ? (
                    <span className="flex items-center gap-1.5">
                      <input
                        autoFocus
                        value={newPhaseName}
                        onChange={(e) => setNewPhaseName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') setAddingPhase(false);
                          if (e.key !== 'Enter') return;
                          if (!newPhaseName.trim()) return;
                          addPhase(selected.id, newPhaseName.trim(), 0);
                          setNewPhaseName('');
                          setAddingPhase(false);
                          toast.success('Phase added');
                        }}
                        placeholder="Phase name"
                        className="px-3 py-1.5 w-44 bg-surface border border-line rounded-full text-[12px] text-ink outline-none focus:border-orange focus:ring-2 focus:ring-orange/20"
                      />
                      <button
                        onClick={() => {
                          if (!newPhaseName.trim()) return;
                          addPhase(selected.id, newPhaseName.trim(), 0);
                          setNewPhaseName('');
                          setAddingPhase(false);
                          toast.success('Phase added');
                        }}
                        className="text-[11.5px] font-bold text-orange hover:text-orange-deep"
                      >
                        Add
                      </button>
                    </span>
                  ) : (
                    <button
                      onClick={() => setAddingPhase(true)}
                      className="px-3 py-1.5 rounded-full border border-dashed border-line text-[11.5px] font-bold text-ink-soft hover:border-orange hover:text-orange transition-colors flex items-center gap-1"
                    >
                      <Plus size={12} /> Phase
                    </button>
                  )}
                </div>

                <div className="flex-1 overflow-x-auto pb-4">
                  <div className="flex gap-6 h-full min-w-max">
                    {LANES.map((lane) => (
                      <div
                        key={lane}
                        className="w-[320px] flex flex-col bg-surface-2 rounded-2xl border border-line p-3 h-fit max-h-full"
                      >
                        <div className="flex items-center justify-between mb-3 px-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-ink text-sm">{lane}</h3>
                            <span className="bg-surface border border-line text-ink-soft text-[10px] font-bold px-2 py-0.5 rounded-full">
                              {tasksByLane[lane].length}
                            </span>
                          </div>
                          <button
                            onClick={() => openNewTask(lane)}
                            aria-label={`Add task to ${lane}`}
                            className="text-ink-faint hover:text-ink hover:bg-surface p-1 rounded-md transition-colors"
                          >
                            <Plus size={16} />
                          </button>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-none pb-2">
                          {tasksByLane[lane].map((task) => (
                            <motion.div
                              key={task.id}
                              layout
                              className="bg-surface p-4 rounded-xl border border-line shadow-sm group relative"
                            >
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex flex-wrap gap-1.5">
                                  {task.tags.map((tag) => (
                                    <span
                                      key={tag}
                                      className={cn(
                                        'px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider',
                                        PRIORITY_CLASS[tag.toLowerCase()] ??
                                          'bg-surface-2 text-ink-soft',
                                      )}
                                    >
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center absolute top-2 right-2 bg-surface/90 backdrop-blur rounded p-0.5 shadow-sm border border-line">
                                  {promotedTitles.has(task.title.trim().toLowerCase()) ? (
                                    <span
                                      className="text-positive p-1"
                                      title="Already on the client tracker"
                                    >
                                      <ListChecks size={12} />
                                    </span>
                                  ) : (
                                    <button
                                      onClick={() => {
                                        if (!selected?.phases.length) {
                                          toast.error('Add a phase in the tracker first');
                                          return;
                                        }
                                        setPromotePhaseId(selected.phases[0].id);
                                        setPromoting(task);
                                      }}
                                      aria-label="Add to client tracker"
                                      title="Add to the client-facing tracker"
                                      className="text-ink-faint hover:text-orange p-1 hover:bg-orange-dim rounded transition-colors"
                                    >
                                      <ListChecks size={12} />
                                    </button>
                                  )}
                                  <button
                                    onClick={() => {
                                      update('projectTasks', task.id, {
                                        clientVisible: !task.clientVisible,
                                      });
                                      toast.success(
                                        task.clientVisible
                                          ? 'Hidden from the client'
                                          : 'Visible to the client',
                                      );
                                    }}
                                    aria-label={
                                      task.clientVisible
                                        ? 'Hide from client portal'
                                        : 'Show in client portal'
                                    }
                                    title={
                                      task.clientVisible
                                        ? 'Visible to the client'
                                        : 'Hidden from the client'
                                    }
                                    className={cn(
                                      'p-1 rounded transition-colors',
                                      task.clientVisible
                                        ? 'text-positive hover:bg-positive-dim'
                                        : 'text-ink-faint hover:bg-surface-2',
                                    )}
                                  >
                                    {task.clientVisible ? (
                                      <Eye size={12} />
                                    ) : (
                                      <EyeSlash size={12} />
                                    )}
                                  </button>
                                  <button
                                    onClick={() => openEditTask(task)}
                                    aria-label="Edit task"
                                    className="text-ink-faint hover:text-purple p-1 hover:bg-purple-dim rounded transition-colors"
                                  >
                                    <PencilSimple size={12} />
                                  </button>
                                  <button
                                    onClick={() => {
                                      remove('projectTasks', task.id);
                                      toast.success('Task removed');
                                    }}
                                    aria-label="Delete task"
                                    className="text-ink-faint hover:text-red p-1 hover:bg-red-dim rounded transition-colors"
                                  >
                                    <Trash size={12} />
                                  </button>
                                </div>
                              </div>

                              <div className="flex items-start gap-2 mb-2 pr-12">
                                <button
                                  onClick={() => toggleDone(task)}
                                  role="checkbox"
                                  aria-checked={task.lane === 'Done'}
                                  aria-label={
                                    task.lane === 'Done' ? 'Reopen task' : 'Mark task done'
                                  }
                                  title={task.lane === 'Done' ? 'Reopen task' : 'Mark task done'}
                                  className={cn(
                                    'w-[18px] h-[18px] rounded-full border-2 shrink-0 mt-px',
                                    'flex items-center justify-center transition-colors',
                                    task.lane === 'Done'
                                      ? 'bg-positive border-positive text-white'
                                      : 'border-line hover:border-positive',
                                  )}
                                >
                                  {task.lane === 'Done' ? <Check size={11} /> : null}
                                </button>
                                <h4
                                  className={cn(
                                    'font-bold text-sm leading-tight',
                                    task.lane === 'Done'
                                      ? 'text-ink-faint line-through'
                                      : 'text-ink',
                                  )}
                                >
                                  {task.title}
                                </h4>
                              </div>

                              <div className="flex flex-col gap-1.5 mb-3">
                                {task.subtasks.map((subtask) => (
                                  <div key={subtask.id} className="flex items-start gap-2 group/sub">
                                    <input
                                      type="checkbox"
                                      checked={subtask.completed}
                                      onChange={() =>
                                        patchSubtasks(
                                          task,
                                          task.subtasks.map((s) =>
                                            s.id === subtask.id
                                              ? { ...s, completed: !s.completed }
                                              : s,
                                          ),
                                        )
                                      }
                                      className="mt-0.5 w-3 h-3 rounded border-line accent-orange cursor-pointer"
                                    />
                                    <span
                                      className={cn(
                                        'text-xs flex-1',
                                        subtask.completed
                                          ? 'line-through text-ink-faint'
                                          : 'text-ink-soft',
                                      )}
                                    >
                                      {subtask.title}
                                    </span>
                                    <button
                                      onClick={() =>
                                        patchSubtasks(
                                          task,
                                          task.subtasks.filter((s) => s.id !== subtask.id),
                                        )
                                      }
                                      aria-label="Remove subtask"
                                      className="opacity-0 group-hover/sub:opacity-100 text-ink-faint hover:text-red transition-opacity p-0.5"
                                    >
                                      <X size={10} />
                                    </button>
                                  </div>
                                ))}

                                {addingSubtaskTo === task.id ? (
                                  <input
                                    autoFocus
                                    type="text"
                                    value={subtaskDraft[task.id] ?? ''}
                                    onChange={(e) =>
                                      setSubtaskDraft({ ...subtaskDraft, [task.id]: e.target.value })
                                    }
                                    onKeyDown={(e) => {
                                      if (e.key === 'Escape') {
                                        setAddingSubtaskTo(null);
                                        setSubtaskDraft({ ...subtaskDraft, [task.id]: '' });
                                      }
                                      if (e.key !== 'Enter') return;
                                      const title = (subtaskDraft[task.id] ?? '').trim();
                                      if (!title) return;
                                      patchSubtasks(task, [
                                        ...task.subtasks,
                                        { id: uid('st'), title, completed: false },
                                      ]);
                                      setSubtaskDraft({ ...subtaskDraft, [task.id]: '' });
                                    }}
                                    onBlur={() => {
                                      const title = (subtaskDraft[task.id] ?? '').trim();
                                      if (title) {
                                        patchSubtasks(task, [
                                          ...task.subtasks,
                                          { id: uid('st'), title, completed: false },
                                        ]);
                                      }
                                      setAddingSubtaskTo(null);
                                      setSubtaskDraft({ ...subtaskDraft, [task.id]: '' });
                                    }}
                                    className="text-xs px-2 py-1 w-full border border-orange/40 rounded bg-orange-dim outline-none focus:ring-1 focus:ring-orange"
                                    placeholder="Subtask title…"
                                  />
                                ) : (
                                  <button
                                    onClick={() => setAddingSubtaskTo(task.id)}
                                    className="text-[11px] font-medium text-ink-faint hover:text-orange flex items-center gap-1 transition-colors w-fit pt-0.5"
                                  >
                                    <Plus size={12} /> Add subtask
                                  </button>
                                )}
                              </div>

                              {selected.phases.length > 0 ? (
                                <select
                                  value={task.phaseId ?? ''}
                                  onChange={(e) =>
                                    update('projectTasks', task.id, {
                                      phaseId: e.target.value || undefined,
                                    })
                                  }
                                  aria-label="Phase"
                                  className={cn(
                                    'w-full mb-2 px-2 py-1 rounded-md text-[11px] font-bold border outline-none cursor-pointer',
                                    task.phaseId
                                      ? 'bg-purple-dim text-purple border-purple/30'
                                      : 'bg-surface-2 text-ink-faint border-line',
                                  )}
                                >
                                  <option value="">No phase</option>
                                  {selected.phases.map((ph, i) => (
                                    <option key={ph.id} value={ph.id}>
                                      {i + 1}. {ph.name}
                                    </option>
                                  ))}
                                </select>
                              ) : null}

                              <div className="flex items-center justify-between mt-auto pt-3 border-t border-line">
                                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-ink-soft bg-surface-2 px-2 py-1 rounded-md">
                                  <Clock size={12} className="text-ink-faint" />
                                  {task.dueDate ? formatDate(task.dueDate) : 'No date'}
                                </div>

                                <div className="flex items-center gap-1">
                                  {/* No drag-and-drop on this board, so moving lanes is explicit. */}
                                  <button
                                    onClick={() => moveTask(task, -1)}
                                    disabled={lane === LANES[0]}
                                    aria-label="Move left"
                                    className="p-1 rounded text-ink-faint hover:text-purple hover:bg-purple-dim disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-ink-faint transition-colors"
                                  >
                                    <CaretLeft size={14} />
                                  </button>
                                  <button
                                    onClick={() => moveTask(task, 1)}
                                    disabled={lane === LANES[LANES.length - 1]}
                                    aria-label="Move right"
                                    className="p-1 rounded text-ink-faint hover:text-purple hover:bg-purple-dim disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-ink-faint transition-colors"
                                  >
                                    <CaretRight size={14} />
                                  </button>
                                  <div className="w-6 h-6 rounded-full bg-night text-white flex items-center justify-center text-[10px] font-bold ml-1">
                                    {task.assignee || 'RM'}
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          ))}

                          <button
                            onClick={() => openNewTask(lane)}
                            className="w-full py-2.5 border border-dashed border-line bg-surface/60 rounded-xl text-[13px] font-bold text-ink-soft hover:text-ink hover:border-ink-faint hover:bg-surface transition-all flex items-center justify-center gap-2"
                          >
                            <Plus size={14} /> Add Task
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <Card className="flex-1 flex items-center justify-center">
                <EmptyState
                  icon={FolderOpen}
                  title="Select a project"
                  description="Pick a project on the left to see its board."
                />
              </Card>
            )}
          </div>
        </div>
      )}

      <Modal
        open={Boolean(promoting)}
        onClose={() => setPromoting(null)}
        title="Add to client tracker"
        subtitle="Copies this task onto a phase as a deliverable the client can see"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPromoting(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!promoting || !selected || !promotePhaseId) return;
                addDeliverable(
                  selected.id,
                  promotePhaseId,
                  promoting.title,
                  promoting.subtasks.map((st) => st.title).join(' · '),
                );
                setPromoting(null);
                toast.success('Added to the client tracker');
              }}
            >
              Add deliverable
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="bg-surface-2 rounded-[10px] p-4">
            <p className="text-sm font-bold text-ink">{promoting?.title}</p>
            {promoting?.subtasks.length ? (
              <p className="text-[12.5px] text-ink-soft mt-1">
                {promoting.subtasks.map((st) => st.title).join(' · ')}
              </p>
            ) : null}
          </div>
          <Field label="Add to phase">
            <Select
              value={promotePhaseId}
              onChange={(e) => setPromotePhaseId(e.target.value)}
            >
              {selected?.phases.map((ph, i) => (
                <option key={ph.id} value={ph.id}>
                  Phase {i + 1} — {ph.name}
                </option>
              ))}
            </Select>
          </Field>
          <p className="text-[12px] text-ink-soft">
            The task stays on your board. Ticking the deliverable off in the tracker is what
            moves the client's progress.
          </p>
        </div>
      </Modal>

      <EditProjectModal
        project={selected}
        open={isEditOpen}
        onClose={() => setIsEditOpen(false)}
      />

      <NewProjectModal
        open={isNewOpen}
        onClose={() => setIsNewOpen(false)}
        onCreated={(id) => setSelectedId(id)}
      />

      <Modal
        open={Boolean(taskModal)}
        onClose={() => setTaskModal(null)}
        title={taskModal?.editing ? 'Edit Task' : `Add Task to ${taskModal?.lane ?? ''}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setTaskModal(null)}>
              Cancel
            </Button>
            <Button type="submit" form="task-form">
              {taskModal?.editing ? 'Save Changes' : 'Add Task'}
            </Button>
          </>
        }
      >
        <form id="task-form" onSubmit={submitTask} className="space-y-4">
          <Field label="Task Title">
            <Input
              autoFocus
              value={taskForm.title}
              onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
              placeholder="e.g. Design packaging dielines"
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Priority">
              <Select
                value={taskForm.tag}
                onChange={(e) => setTaskForm({ ...taskForm, tag: e.target.value })}
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Due Date">
              <Input
                type="date"
                value={taskForm.dueDate}
                onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
              />
            </Field>
          </div>
          {selected && selected.phases.length > 0 ? (
            <Field label="Phase" hint="Groups this task under a phase of the project">
              <Select
                value={taskForm.phaseId}
                onChange={(e) => setTaskForm({ ...taskForm, phaseId: e.target.value })}
              >
                <option value="">No phase</option>
                {selected.phases.map((ph, i) => (
                  <option key={ph.id} value={ph.id}>
                    {i + 1}. {ph.name}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
        </form>
      </Modal>
    </div>
  );
}
