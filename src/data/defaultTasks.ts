/**
 * Starter Kanban board for a project that has no saved tasks yet.
 *
 * Lives here rather than in `pages/Projects.tsx` so that Invoices (which reads
 * completed tasks for line-item linking) doesn't have to import from another
 * page — a cycle that also broke React Fast Refresh.
 */
export const defaultTasks: Record<string, any[]> = {
  Todo: [
    {
      id: '1',
      title: 'Design Landing Page',
      tags: ['High'],
      dueDate: 'Oct 23',
      comments: 3,
      attachments: 1,
      assignee: 'RM',
      subtasks: [
        { id: 's1', title: 'Find inspiration', completed: true },
        { id: 's2', title: 'Create wireframes', completed: false },
      ],
    },
  ],
  'In Progress': [
    {
      id: '2',
      title: 'Write copy for about page',
      tags: ['Medium'],
      dueDate: 'Oct 20',
      comments: 1,
      attachments: 0,
      assignee: 'SD',
      subtasks: [],
    },
    {
      id: '3',
      title: 'Prepare brand guidelines',
      tags: ['High'],
      dueDate: 'Oct 22',
      comments: 0,
      attachments: 2,
      assignee: 'RM',
      subtasks: [],
    },
  ],
  Done: [
    {
      id: '4',
      title: 'Client kickoff meeting',
      tags: ['Low'],
      dueDate: 'Oct 15',
      comments: 0,
      attachments: 0,
      assignee: 'JD',
      subtasks: [],
    },
  ],
};
