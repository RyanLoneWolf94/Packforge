import { toast } from 'sonner';
import { useState, useEffect } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Plus,
  Clock,
  MessageSquare,
  Paperclip,
  X,
  Trash2,
  FolderOpen,
  GaugeCircle,
  Edit2,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { Button, EmptyState, PageHeader, ProgressBar, StatusPill } from '@/src/components/ui';
import { defaultTasks } from '@/src/data/defaultTasks';
import { projectProgress } from '@/src/lib/tracker';
import { useStudio } from '@/src/store/StudioStore';

/**
 * Day-to-day task board. Projects themselves live in the shared store (created
 * and tracked in `/admin/tracker`); this page layers a per-project Kanban of
 * internal working tasks on top, keyed by the store's project id.
 */


export default function Projects() {
  const { projects, clientFor } = useStudio();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    projects[0]?.id ?? null,
  );

  const [tasksState, setTasksState] = useState<Record<string, Record<string, any[]>>>(() => {
    try {
      const saved = localStorage.getItem('project_tasks');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    // Seed the first project's board so the page isn't empty on a fresh install.
    return projects[0] ? { [projects[0].id]: defaultTasks } : {};
  });

  // Persist to localStorage whenever tasksState changes
  useEffect(() => {
    const handleStorage = () => {
      try {
        const saved = localStorage.getItem('project_tasks');
        if (saved) setTasksState(JSON.parse(saved));
      } catch (e) {}
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  type TasksState = Record<string, Record<string, any[]>>;
  const updateTasksState = (
    updater: TasksState | ((prev: TasksState) => TasksState),
  ) => {
    setTasksState((prev: TasksState) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      localStorage.setItem('project_tasks', JSON.stringify(next));
      return next;
    });
  };


  // Task Modal
  const [isNewTaskOpen, setIsNewTaskOpen] = useState<{isOpen: boolean, column: string | null}>({isOpen: false, column: null});
  const [editingTask, setEditingTask] = useState<{id: string, column: string} | null>(null);
  const [newTaskForm, setNewTaskForm] = useState({ title: '', tag: 'Medium', dueDate: '' });

  // Subtasks State
  const [subtaskInputs, setSubtaskInputs] = useState<Record<string, string>>({});
  const [addingSubtaskTo, setAddingSubtaskTo] = useState<string | null>(null);

  const selectedProjectObj = projects.find(p => p.id === selectedProjectId);
  const selectedProject = selectedProjectObj?.name || null;

  const currentTasks = selectedProjectId && tasksState[selectedProjectId] 
    ? tasksState[selectedProjectId] 
    : { 'Todo': [], 'In Progress': [], 'Done': [] };


  const handleOpenEditTask = (task: any, column: string) => {
     setEditingTask({ id: task.id, column });
     setNewTaskForm({ title: task.title, tag: task.tags[0] || 'Medium', dueDate: task.dueDate || '' });
     setIsNewTaskOpen({ isOpen: true, column });
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskForm.title || !isNewTaskOpen.column || !selectedProjectId) return;
    
    if (editingTask) {
       updateTasksState((prev: TasksState) => {
          const colTasks = prev[selectedProjectId][isNewTaskOpen.column as string];
          return {
             ...prev,
             [selectedProjectId]: {
                ...currentTasks,
                [isNewTaskOpen.column as string]: colTasks.map((t: any) => t.id === editingTask.id ? { 
                   ...t, 
                   title: newTaskForm.title, 
                   tags: [newTaskForm.tag], 
                   dueDate: newTaskForm.dueDate || 'No Date'
                } : t)
             }
          }
       });
       toast.success("Task updated!");
    } else {
       const newTask = {
         id: Math.random().toString(36).substr(2, 9),
         title: newTaskForm.title,
         tags: [newTaskForm.tag],
         dueDate: newTaskForm.dueDate || 'No Date',
         comments: 0,
         attachments: 0,
         assignee: 'RM',
         subtasks: []
       };

       updateTasksState((prev: TasksState) => ({
         ...prev,
         [selectedProjectId]: {
           ...currentTasks,
           [isNewTaskOpen.column as string]: [...(currentTasks[isNewTaskOpen.column as string] || []), newTask]
         }
       }));
       toast.success("Task added!");
    }
    setIsNewTaskOpen({isOpen: false, column: null});
    setNewTaskForm({ title: '', tag: 'Medium', dueDate: '' });
    setEditingTask(null);
  };

  const handleDeleteTask = (taskId: string, column: string) => {
    if (!selectedProjectId) return;
    updateTasksState((prev: TasksState) => ({
      ...prev,
      [selectedProjectId]: {
        ...currentTasks,
        [column]: currentTasks[column].filter((t: any) => t.id !== taskId)
      }
    }));
    toast.success("Task removed");
  };

  const handleToggleSubtask = (taskId: string, column: string, subtaskId: string) => {
    if (!selectedProjectId) return;
    updateTasksState((prev: TasksState) => {
      const colTasks = prev[selectedProjectId][column];
      return {
        ...prev,
        [selectedProjectId]: {
          ...prev[selectedProjectId],
          [column]: colTasks.map((t: any) => t.id === taskId ? {
            ...t,
            subtasks: t.subtasks?.map((st: any) => st.id === subtaskId ? { ...st, completed: !st.completed } : st)
          } : t)
        }
      }
    });
  }

  const handleAddSubtask = (taskId: string, column: string, subtaskTitle: string) => {
    if (!selectedProjectId || !subtaskTitle.trim()) return;
    updateTasksState((prev: TasksState) => {
      const colTasks = prev[selectedProjectId][column];
      return {
        ...prev,
        [selectedProjectId]: {
          ...prev[selectedProjectId],
          [column]: colTasks.map((t: any) => t.id === taskId ? {
            ...t,
            subtasks: [...(t.subtasks || []), { id: Math.random().toString(36).substr(2, 9), title: subtaskTitle, completed: false }]
          } : t)
        }
      }
    });
  }

  const handleDeleteSubtask = (taskId: string, column: string, subtaskId: string) => {
    if (!selectedProjectId) return;
    updateTasksState((prev: TasksState) => {
      const colTasks = prev[selectedProjectId][column];
      return {
        ...prev,
        [selectedProjectId]: {
          ...prev[selectedProjectId],
          [column]: colTasks.map((t: any) => t.id === taskId ? {
            ...t,
            subtasks: (t.subtasks || []).filter((st: any) => st.id !== subtaskId)
          } : t)
        }
      }
    });
  }

  return (
    <div className="max-w-[1400px] h-full flex flex-col space-y-6 relative">
      <PageHeader
        title="Projects Workspace"
        subtitle="Internal task board. Client-facing phases live in the tracker."
        actions={
          <RouterLink to="/admin/tracker">
            <Button variant="secondary" icon={GaugeCircle}>
              Open Tracker
            </Button>
          </RouterLink>
        }
      />

      {projects.length === 0 ? (
        <div className="bg-surface border border-line rounded-[14px]">
          <EmptyState
            icon={FolderOpen}
            title="No projects yet"
            description="Projects are created in the tracker, where picking a package seeds their phases."
            action={
              <RouterLink to="/admin/tracker">
                <Button icon={Plus}>Go to Tracker</Button>
              </RouterLink>
            }
          />
        </div>
      ) : (
      <div className="flex-1 flex flex-col md:flex-row gap-6 min-h-[600px] overflow-hidden pb-4">
        {/* Active Projects Sidebar */}
        <div className="w-full md:w-[300px] flex-shrink-0 flex flex-col pt-2">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-ink-faint mb-3 px-1">
            Projects ({projects.length})
          </h3>
          <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-none pb-8">
            {projects.map((project) => {
              const pct = projectProgress(project).pct;
              const isActive = selectedProjectId === project.id;
              return (
              <div
                key={project.id}
                onClick={() => {
                  setSelectedProjectId(project.id);
                  if (!tasksState[project.id]) {
                     updateTasksState((prev: TasksState) => ({ ...prev, [project.id]: { 'Todo': [], 'In Progress': [], 'Done': [] } }));
                  }
                }}
                className={cn(
                  "bg-surface rounded-xl p-4 border shadow-sm cursor-pointer transition-all hover:shadow-md group relative",
                  isActive ? "border-orange ring-1 ring-orange" : "border-line",
                )}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h4 className="font-bold text-ink text-sm leading-tight">{project.name}</h4>
                  <StatusPill tone={project.status === 'completed' ? 'done' : 'positive'}>
                    {project.status}
                  </StatusPill>
                </div>
                <p className="text-xs text-ink-soft mb-4">
                  {clientFor(project)?.name ?? 'Unassigned'}
                </p>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-medium text-ink-soft uppercase tracking-wide">
                    <span>Phase progress</span>
                    <span className="text-ink font-bold">{pct}%</span>
                  </div>
                  <ProgressBar value={pct} tone={isActive ? 'orange' : 'purple'} className="h-1.5" />
                </div>
              </div>
            );})}
          </div>
        </div>

        {/* Project details / Kanban */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {selectedProject ? (
               <div className="h-full flex flex-col">
                  {/* Workspace Header */}
                  <div className="flex items-center justify-between gap-3 flex-wrap mb-6 bg-surface p-4 rounded-xl border border-line shadow-sm shrink-0">
                     <h2 className="text-lg font-bold text-ink flex items-center gap-2">
                       <FolderOpen size={20} className="text-orange" />
                       {selectedProject} <span className="text-ink-faint font-normal">/ Kanban</span>
                     </h2>
                     <div className="flex items-center gap-3">
                        {selectedProjectId ? (
                          <RouterLink
                            to={`/admin/tracker/${selectedProjectId}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-purple-dim text-purple hover:bg-purple hover:text-white transition-colors"
                          >
                            <GaugeCircle size={14} /> Phase tracker
                          </RouterLink>
                        ) : null}
                        <div className="flex -space-x-2">
                           <div className="w-8 h-8 rounded-full bg-night border-2 border-white flex items-center justify-center text-xs font-bold text-white z-10">RM</div>
                           <div className="w-8 h-8 rounded-full bg-surface-2 border-2 border-white flex items-center justify-center text-xs font-bold text-ink-soft z-0">SD</div>
                        </div>
                     </div>
                  </div>

                  {/* Kanban Columns */}
                  <div className="flex-1 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                      <div className="flex gap-6 h-full min-w-max">
                         {Object.entries(currentTasks).map(([columnName, tasks]) => (
                            <div key={columnName} className="w-[320px] flex flex-col bg-slate-100/50 rounded-2xl border border-slate-200 p-3 h-fit max-h-full">
                               <div className="flex items-center justify-between mb-3 px-1">
                                  <div className="flex items-center gap-2">
                                     <h3 className="font-bold text-slate-800 text-sm">{columnName}</h3>
                                     <span className="bg-white border border-slate-200 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                                        {tasks.length}
                                     </span>
                                  </div>
                                  <button onClick={() => { setEditingTask(null); setIsNewTaskOpen({isOpen: true, column: columnName}); }} className="text-slate-400 hover:text-slate-700 hover:bg-slate-200 p-1 rounded-md transition-colors">
                                     <Plus size={16} />
                                  </button>
                               </div>

                               <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-none pb-2">
                                  {tasks.map(task => (
                                     <motion.div 
                                       layoutId={task.id}
                                       key={task.id}
                                       whileHover={{ y: -2 }}
                                       className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm cursor-grab active:cursor-grabbing group relative"
                                     >
                                        <div className="flex items-start justify-between mb-3">
                                           <div className="flex flex-wrap gap-1.5">
                                              {task.tags.map((tag: string) => (
                                                 <span key={tag} className={cn(
                                                   "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                                                   tag.toLowerCase() === 'high' ? "bg-rose-50 text-rose-600" :
                                                   tag.toLowerCase() === 'medium' ? "bg-amber-50 text-amber-600" :
                                                   tag.toLowerCase() === 'low' ? "bg-blue-50 text-blue-600" :
                                                   "bg-slate-100 text-slate-600"
                                                 )}>
                                                    {tag}
                                                 </span>
                                              ))}
                                           </div>
                                           <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center absolute top-2 right-2 bg-white/80 backdrop-blur rounded p-0.5 shadow-sm border border-slate-100">
                                              <button onClick={() => handleOpenEditTask(task, columnName)} className="text-slate-400 hover:text-blue-500 p-1 hover:bg-blue-50 rounded transition-colors">
                                                 <Edit2 size={12} />
                                              </button>
                                              <button onClick={() => handleDeleteTask(task.id, columnName)} className="text-slate-400 hover:text-rose-500 p-1 hover:bg-rose-50 rounded transition-colors">
                                                 <Trash2 size={12} />
                                              </button>
                                           </div>
                                        </div>
                                        
                                        <h4 className="font-bold text-slate-900 text-sm mb-2 leading-tight pr-12">{task.title}</h4>
                                        
                                        <div className="flex flex-col gap-1.5 mb-3">
                                          {task.subtasks?.map((subtask: any) => (
                                            <div key={subtask.id} className="flex items-start gap-2 group/subtask">
                                              <input 
                                                type="checkbox" 
                                                checked={subtask.completed} 
                                                onChange={() => handleToggleSubtask(task.id, columnName, subtask.id)}
                                                className="mt-0.5 w-3 h-3 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600 cursor-pointer"
                                              />
                                              <span className={cn("text-xs flex-1", subtask.completed ? "line-through text-slate-400" : "text-slate-700")}>
                                                {subtask.title}
                                              </span>
                                              <button 
                                                onClick={() => handleDeleteSubtask(task.id, columnName, subtask.id)}
                                                className="opacity-0 group-hover/subtask:opacity-100 text-slate-300 hover:text-rose-500 transition-opacity p-0.5"
                                              >
                                                <X size={10} />
                                              </button>
                                            </div>
                                          ))}
                                          {addingSubtaskTo === task.id ? (
                                            <div className="flex items-center gap-2">
                                                <input 
                                                  autoFocus
                                                  type="text"
                                                  value={subtaskInputs[task.id] || ''}
                                                  onChange={e => setSubtaskInputs({...subtaskInputs, [task.id]: e.target.value})}
                                                  onKeyDown={e => {
                                                    if (e.key === 'Enter') {
                                                      handleAddSubtask(task.id, columnName, subtaskInputs[task.id] || '');
                                                      setSubtaskInputs({...subtaskInputs, [task.id]: ''});
                                                    } else if (e.key === 'Escape') {
                                                      setAddingSubtaskTo(null);
                                                      setSubtaskInputs({...subtaskInputs, [task.id]: ''});
                                                    }
                                                  }}
                                                  onBlur={() => {
                                                    if (subtaskInputs[task.id]?.trim()) {
                                                        handleAddSubtask(task.id, columnName, subtaskInputs[task.id] || '');
                                                    }
                                                    setAddingSubtaskTo(null);
                                                    setSubtaskInputs({...subtaskInputs, [task.id]: ''});
                                                  }}
                                                  className="text-xs px-2 py-1 w-full border border-indigo-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-indigo-50"
                                                  placeholder="Subtask title..."
                                                />
                                            </div>
                                          ) : (
                                            <button 
                                              onClick={() => setAddingSubtaskTo(task.id)}
                                              className="text-[11px] font-medium text-slate-400 hover:text-indigo-600 flex items-center gap-1 transition-colors w-fit pt-0.5"
                                            >
                                              <Plus size={12} /> Add subtask
                                            </button>
                                          )}
                                        </div>

                                        <div className="flex items-center justify-between mt-auto pt-3 border-t border-slate-100">
                                           <div className="flex items-center gap-3 text-xs font-semibold text-slate-500">
                                              <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                                                 <Clock size={12} className="text-slate-400" />
                                                 {task.dueDate}
                                              </div>
                                              {(task.comments > 0 || task.attachments > 0) && (
                                                 <div className="flex items-center gap-2">
                                                    {task.comments > 0 && (
                                                       <div className="flex items-center gap-1 hover:text-slate-700 transition-colors">
                                                          <MessageSquare size={12} />
                                                          {task.comments}
                                                       </div>
                                                    )}
                                                    {task.attachments > 0 && (
                                                       <div className="flex items-center gap-1 hover:text-slate-700 transition-colors">
                                                          <Paperclip size={12} />
                                                          {task.attachments}
                                                       </div>
                                                    )}
                                                 </div>
                                              )}
                                           </div>
                                           <div className="w-6 h-6 rounded-full bg-[#1B163B] text-white flex items-center justify-center text-[10px] font-bold shadow-sm">
                                              {task.assignee || 'AI'}
                                           </div>
                                        </div>
                                     </motion.div>
                                  ))}
                                  
                                  {/* Add Task Button inside column */}
                                  <button onClick={() => { setEditingTask(null); setIsNewTaskOpen({isOpen: true, column: columnName}); }} className="w-full py-2.5 border border-dashed border-slate-300 bg-slate-50/50 rounded-xl text-[13px] font-bold text-slate-500 hover:text-slate-700 hover:border-slate-400 hover:bg-white transition-all flex items-center justify-center gap-2">
                                     <Plus size={14} />
                                     Add Task
                                  </button>
                               </div>
                            </div>
                         ))}
                      </div>
                  </div>
               </div>
            ) : (
                <div className="flex-1 bg-white rounded-xl border border-slate-200 flex items-center justify-center p-8 shadow-sm">
                  <div className="text-center space-y-4">
                    <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
                       <FolderOpen size={32} />
                    </div>
                    <p className="text-slate-500 font-medium">Select a project to view its Kanban board</p>
                  </div>
                </div>
            )}
        </div>
      </div>
      )}

      {/* Add Task Modal */}
      <AnimatePresence>
        {isNewTaskOpen.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col"
            >
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-bold text-lg text-slate-900">{editingTask ? `Edit Task in ${isNewTaskOpen.column}` : `Add Task to ${isNewTaskOpen.column}`}</h3>
                <button onClick={() => setIsNewTaskOpen({isOpen: false, column: null})} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 overflow-y-auto">
                <form id="new-task-form" onSubmit={handleCreateTask} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Task Title</label>
                    <input 
                      type="text" 
                      value={newTaskForm.title}
                      onChange={e => setNewTaskForm({...newTaskForm, title: e.target.value})}
                      required 
                      autoFocus
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ff7a00]/20 focus:border-[#ff7a00]" 
                      placeholder="e.g. Design user profile section" 
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                     <div>
                       <label className="block text-xs font-bold text-slate-700 mb-1">Priority Tag</label>
                       <select 
                         value={newTaskForm.tag}
                         onChange={e => setNewTaskForm({...newTaskForm, tag: e.target.value})}
                         className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ff7a00]/20 focus:border-[#ff7a00] bg-white" 
                       >
                         <option value="Low">Low Priority</option>
                         <option value="Medium">Medium Priority</option>
                         <option value="High">High Priority</option>
                       </select>
                     </div>
                     <div>
                       <label className="block text-xs font-bold text-slate-700 mb-1">Due Date</label>
                       <input 
                         type="date" 
                         value={newTaskForm.dueDate}
                         onChange={e => setNewTaskForm({...newTaskForm, dueDate: e.target.value})}
                         className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ff7a00]/20 focus:border-[#ff7a00]" 
                       />
                     </div>
                  </div>
                </form>
              </div>
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                <button type="button" onClick={() => setIsNewTaskOpen({isOpen: false, column: null})} className="px-4 py-2 text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors">
                  Cancel
                </button>
                <button type="submit" form="new-task-form" className="px-4 py-2 bg-[#ff7a00] text-white text-sm font-bold rounded-lg hover:bg-[#e66d00] transition-colors shadow-sm">
                  {editingTask ? "Save Changes" : "Add Task"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
