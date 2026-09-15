import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { toast } from 'sonner';
import { SEED } from '../data/seed';
import { supabase } from '../lib/supabase';
import type {
  ActionItem,
  Campaign,
  Client,
  Contract,
  EmailTemplate,
  Expense,
  FileAsset,
  Invoice,
  Lead,
  Newsletter,
  Blueprint,
  Project,
  ProjectTask,
  Quote,
  StudioSettings,
  TeamMember,
  TimeEntry,
  TimelineWeek,
  TrackerPhase,
} from '../types';

/**
 * Single source of truth for studio data, now backed by Supabase.
 *
 * The context API is unchanged from the localStorage era on purpose: every page
 * still reads collections and calls `add`/`update`/`remove` and the domain
 * helpers exactly as before. What changed is underneath — reads come from
 * Supabase on mount, and every mutation is applied optimistically to local
 * state and then persisted. On a write failure we surface a toast and refetch
 * so the UI can't drift from the database.
 *
 * This provider assumes an authenticated studio-admin session exists; it is
 * only ever mounted behind `RequireAdmin`. The public client portal uses its
 * own provider (`PortalStore`) fed by the `portal_snapshot` RPC.
 */

/** Array-backed collections, all sharing the generic add/update/remove API. */
interface Collections {
  clients: Client[];
  projects: Project[];
  invoices: Invoice[];
  quotes: Quote[];
  contracts: Contract[];
  files: FileAsset[];
  expenses: Expense[];
  leads: Lead[];
  team: TeamMember[];
  timeEntries: TimeEntry[];
  projectTasks: ProjectTask[];
  emailTemplates: EmailTemplate[];
  blueprints: Blueprint[];
  campaigns: Campaign[];
  newsletters: Newsletter[];
}

interface StudioState extends Collections {
  /** Single-record studio settings, updated via `updateSettings`, not the array API. */
  settings: StudioSettings;
}

/** Names of the collections that share the generic add/update/remove API. */
type CollectionKey = keyof Collections;

/** The element type stored in a given collection. */
type Item<K extends CollectionKey> = StudioState[K][number];

/** Every collection key === its Postgres table name (camelCase ones are quoted server-side). */
const COLLECTION_KEYS: CollectionKey[] = [
  'clients',
  'projects',
  'invoices',
  'quotes',
  'contracts',
  'files',
  'expenses',
  'leads',
  'team',
  'timeEntries',
  'projectTasks',
  'emailTemplates',
  'blueprints',
  'campaigns',
  'newsletters',
];

interface StudioContextValue extends StudioState {
  /** True until the first load from Supabase resolves. */
  loading: boolean;
  /** Re-pull everything from Supabase (used as the rollback on a failed write). */
  refresh: () => Promise<void>;

  /**
   * Generic CRUD over any collection. One typed API instead of thirty
   * hand-written methods — `add('leads', {...})` is checked against `Lead`.
   */
  add: <K extends CollectionKey>(key: K, item: Omit<Item<K>, 'id'>) => Item<K>;
  update: <K extends CollectionKey>(key: K, id: string, patch: Partial<Item<K>>) => void;
  remove: <K extends CollectionKey>(key: K, id: string) => void;

  /** Merge a partial into the studio settings record. */
  updateSettings: (patch: Partial<StudioSettings>) => void;

  /* Projects — richer than generic add because a project seeds its phases. */
  createProject: (input: {
    name: string;
    clientId: string;
    packageName: string;
    startDate: string;
    targetDelivery: string;
    summary: string;
    /** Seed the workflow and timeline from a blueprint. */
    blueprint?: Blueprint;
    /** …or from explicit phases/timeline (e.g. derived from a quote). Wins over `blueprint`. */
    phases?: TrackerPhase[];
    timeline?: TimelineWeek[];
  }) => Project;
  deleteProject: (id: string) => void;

  /* Tracker */
  toggleDeliverable: (projectId: string, phaseId: string, deliverableId: string) => void;
  setPhaseLink: (projectId: string, phaseId: string, link: string) => void;
  addDeliverable: (projectId: string, phaseId: string, title: string, description: string) => void;
  removeDeliverable: (projectId: string, phaseId: string, deliverableId: string) => void;
  addActionItem: (projectId: string, title: string, detail: string) => void;
  toggleActionItem: (projectId: string, itemId: string) => void;
  removeActionItem: (projectId: string, itemId: string) => void;
  /** Mark a delivery-timeline stage complete (or reopen it). */
  toggleTimelineWeek: (projectId: string, weekId: string) => void;

  /* Clients — wraps `add` to mint a portal token. */
  createClient: (input: Omit<Client, 'id' | 'portalToken' | 'createdAt'>) => Client;
  deleteClient: (id: string) => void;

  /* Lookups */
  clientFor: (item: { clientId?: string }) => Client | undefined;
  projectFor: (item: { projectId?: string }) => Project | undefined;
  projectsForClient: (clientId: string) => Project[];
  clientByToken: (token: string) => Client | undefined;
}

// Exported so the portal provider can supply the same shape to shared pages
// (PhaseTracker et al.) that call `useStudio()`.
export const StudioContext = createContext<StudioContextValue | null>(null);

let seq = 0;
const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(seq++).toString(36)}`;

/**
 * Drop undefined keys from a row before INSERT, so the column falls back to its
 * database default instead of being sent as an explicit null.
 */
function forInsert(row: object): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(row).filter(([, v]) => v !== undefined),
  ) as Record<string, unknown>;
}

/**
 * Turn undefined into null before UPDATE. JSON serialisation drops undefined
 * entirely, which would silently leave the old value in place — so clearing an
 * optional field (an invoice's project link, say) would never persist.
 */
function forUpdate(patch: object): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(patch).map(([k, v]) => [k, v === undefined ? null : v]),
  ) as Record<string, unknown>;
}

/** Deep-copy phases with new ids and nothing ticked — a clean slate from a template. */
export function freshPhases(phases: TrackerPhase[]): TrackerPhase[] {
  return phases.map((ph) => ({
    ...ph,
    id: uid('ph'),
    link: '',
    deliverables: ph.deliverables.map((d) => ({ ...d, id: uid('dl'), done: false })),
  }));
}

/** Deep-copy timeline stages with new ids and nothing complete. */
export function freshTimeline(timeline: TimelineWeek[]): TimelineWeek[] {
  return timeline.map((w) => ({ ...w, id: uid('wk'), done: false }));
}

/** Lowercase, hyphenated, URL-safe token for portal share links. */
function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'client'
  );
}

const EMPTY_STATE: StudioState = {
  clients: [],
  projects: [],
  invoices: [],
  quotes: [],
  contracts: [],
  files: [],
  expenses: [],
  leads: [],
  team: [],
  timeEntries: [],
  projectTasks: [],
  emailTemplates: [],
  blueprints: [],
  campaigns: [],
  newsletters: [],
  settings: SEED.settings,
};

export function StudioProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<StudioState>(EMPTY_STATE);
  const [loading, setLoading] = useState(true);

  // Mirror of state for mutators that need the current entity synchronously
  // (nested project edits) without threading it through setState.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const refresh = useCallback(async () => {
    const results = await Promise.all(
      COLLECTION_KEYS.map((key) => supabase.from(key).select('*')),
    );
    const settingsRes = await supabase.from('settings').select('*').eq('id', 'studio').maybeSingle();

    const next = { ...EMPTY_STATE } as StudioState;
    COLLECTION_KEYS.forEach((key, i) => {
      const { data, error } = results[i];
      if (error) {
        console.error(`Failed to load ${key}:`, error.message);
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (next as any)[key] = data ?? [];
    });
    next.settings = (settingsRes.data as StudioSettings | null) ?? SEED.settings;

    setState(next);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh().catch((err) => {
      console.error('Initial studio load failed:', err);
      setLoading(false);
    });
  }, [refresh]);

  /**
   * Serialised write queue.
   *
   * Writes must reach Postgres in the order the UI issued them: converting a
   * quote inserts a project and then points the quote at it, and a blueprint
   * inserts a project then overwrites its phases. Fired concurrently, the
   * dependent write can land first — tripping the foreign key, or silently
   * updating zero rows. Each request is therefore a thunk that is only issued
   * when its turn in the chain comes up.
   */
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  const persist = useCallback(
    (run: () => PromiseLike<{ error: { message: string } | null }>, label: string) => {
      queue.current = queue.current
        .then(() => run())
        .then(({ error }) => {
          if (error) {
            console.error(`${label} failed:`, error.message);
            toast.error(`Couldn't save — ${label}. Reverting.`);
            return refresh().catch(() => undefined);
          }
        })
        .catch((err) => {
          console.error(`${label} threw:`, err);
        });
    },
    [refresh],
  );

  /** Apply a change to one project locally and persist the whole row. */
  const patchProject = useCallback(
    (projectId: string, fn: (project: Project) => Project) => {
      const current = stateRef.current.projects.find((p) => p.id === projectId);
      if (!current) return;
      const nextProject = fn(current);
      setState((prev) => ({
        ...prev,
        projects: prev.projects.map((p) => (p.id === projectId ? nextProject : p)),
      }));
      persist(
        () =>
          supabase
            .from('projects')
            .update({
              phases: nextProject.phases,
              timeline: nextProject.timeline,
              actionItems: nextProject.actionItems,
              brandSnapshot: nextProject.brandSnapshot ?? null,
            })
            .eq('id', projectId),
        'update project',
      );
    },
    [persist],
  );

  const patchPhase = useCallback(
    (
      projectId: string,
      phaseId: string,
      fn: (phase: Project['phases'][number]) => Project['phases'][number],
    ) => {
      patchProject(projectId, (project) => ({
        ...project,
        phases: project.phases.map((ph) => (ph.id === phaseId ? fn(ph) : ph)),
      }));
    },
    [patchProject],
  );

  const value = useMemo<StudioContextValue>(() => {
    return {
      ...state,
      loading,
      refresh,

      add(key, item) {
        const created = { ...(item as object), id: uid(key.slice(0, 2)) } as Item<typeof key>;
        setState((prev) => ({ ...prev, [key]: [created, ...prev[key]] }) as StudioState);
        persist(() => supabase.from(key).insert(forInsert(created as object)), `add ${key}`);
        return created;
      },

      update(key, id, patch) {
        setState(
          (prev) =>
            ({
              ...prev,
              [key]: (prev[key] as { id: string }[]).map((row) =>
                row.id === id ? { ...row, ...patch } : row,
              ),
            }) as StudioState,
        );
        persist(
          () => supabase.from(key).update(forUpdate(patch as object)).eq('id', id),
          `update ${key}`,
        );
      },

      remove(key, id) {
        setState(
          (prev) =>
            ({
              ...prev,
              [key]: (prev[key] as { id: string }[]).filter((row) => row.id !== id),
            }) as StudioState,
        );
        persist(() => supabase.from(key).delete().eq('id', id), `remove ${key}`);
      },

      updateSettings(patch) {
        setState((prev) => ({ ...prev, settings: { ...prev.settings, ...patch } }));
        persist(
          () => supabase.from('settings').update(forUpdate(patch as object)).eq('id', 'studio'),
          'update settings',
        );
      },

      createProject(input) {
        const project: Project = {
          id: uid('pr'),
          name: input.name,
          clientId: input.clientId,
          ref: `${slugify(input.name).slice(0, 3).toUpperCase()}-${new Date()
            .toISOString()
            .slice(2, 7)
            .replace('-', '')}`,
          status: 'planning',
          packageTier: 'custom',
          packageName: input.packageName,
          startDate: input.startDate,
          targetDelivery: input.targetDelivery,
          summary: input.summary,
          // Blueprint content is copied with fresh ids so editing the project
          // never reaches back into the template (and vice versa).
          phases: freshPhases(input.phases ?? input.blueprint?.phases ?? []),
          timeline: freshTimeline(input.timeline ?? input.blueprint?.timeline ?? []),
          actionItems: [],
          blueprintId: input.blueprint?.id,
        };
        setState((prev) => ({ ...prev, projects: [project, ...prev.projects] }));
        persist(
          () => supabase.from('projects').insert(forInsert(project as object)),
          'create project',
        );
        return project;
      },

      deleteProject(id) {
        // The DB FKs null out projectId on dependents; mirror that locally.
        setState((prev) => ({
          ...prev,
          projects: prev.projects.filter((p) => p.id !== id),
          invoices: prev.invoices.map((i) =>
            i.projectId === id ? { ...i, projectId: undefined } : i,
          ),
          contracts: prev.contracts.map((c) =>
            c.projectId === id ? { ...c, projectId: undefined } : c,
          ),
          files: prev.files.map((f) => (f.projectId === id ? { ...f, projectId: undefined } : f)),
          expenses: prev.expenses.map((e) =>
            e.projectId === id ? { ...e, projectId: undefined } : e,
          ),
          timeEntries: prev.timeEntries.map((t) =>
            t.projectId === id ? { ...t, projectId: undefined } : t,
          ),
          // Internal tasks belong to the project and are cascaded by the DB.
          projectTasks: prev.projectTasks.filter((t) => t.projectId !== id),
          quotes: prev.quotes.map((q) =>
            q.convertedProjectId === id ? { ...q, convertedProjectId: undefined } : q,
          ),
        }));
        persist(() => supabase.from('projects').delete().eq('id', id), 'delete project');
      },

      toggleDeliverable(projectId, phaseId, deliverableId) {
        patchPhase(projectId, phaseId, (phase) => ({
          ...phase,
          deliverables: phase.deliverables.map((d) =>
            d.id === deliverableId ? { ...d, done: !d.done } : d,
          ),
        }));
      },

      setPhaseLink(projectId, phaseId, link) {
        patchPhase(projectId, phaseId, (phase) => ({ ...phase, link }));
      },

      addDeliverable(projectId, phaseId, title, description) {
        patchPhase(projectId, phaseId, (phase) => ({
          ...phase,
          deliverables: [...phase.deliverables, { id: uid('dl'), title, description, done: false }],
        }));
      },

      removeDeliverable(projectId, phaseId, deliverableId) {
        patchPhase(projectId, phaseId, (phase) => ({
          ...phase,
          deliverables: phase.deliverables.filter((d) => d.id !== deliverableId),
        }));
      },

      addActionItem(projectId, title, detail) {
        const item: ActionItem = { id: uid('ai'), title, detail, resolved: false };
        patchProject(projectId, (project) => ({
          ...project,
          actionItems: [...project.actionItems, item],
        }));
      },

      toggleActionItem(projectId, itemId) {
        patchProject(projectId, (project) => ({
          ...project,
          actionItems: project.actionItems.map((a) =>
            a.id === itemId ? { ...a, resolved: !a.resolved } : a,
          ),
        }));
      },

      removeActionItem(projectId, itemId) {
        patchProject(projectId, (project) => ({
          ...project,
          actionItems: project.actionItems.filter((a) => a.id !== itemId),
        }));
      },

      toggleTimelineWeek(projectId, weekId) {
        patchProject(projectId, (project) => ({
          ...project,
          timeline: project.timeline.map((w) => (w.id === weekId ? { ...w, done: !w.done } : w)),
        }));
      },

      createClient(input) {
        // portalToken is UNIQUE in the database, so two clients whose names
        // slugify the same way would collide and fail the insert. Suffix until
        // the token is free.
        const base = slugify(input.name);
        const taken = new Set(state.clients.map((c) => c.portalToken));
        let portalToken = base;
        for (let n = 2; taken.has(portalToken); n++) portalToken = `${base}-${n}`;

        const client: Client = {
          ...input,
          id: uid('cl'),
          portalToken,
          createdAt: new Date().toISOString().slice(0, 10),
        };
        setState((prev) => ({ ...prev, clients: [client, ...prev.clients] }));
        persist(() => supabase.from('clients').insert(forInsert(client as object)), 'create client');
        return client;
      },

      deleteClient(id) {
        // The DB cascades everything below; mirror that locally.
        setState((prev) => {
          const goneProjects = new Set(
            prev.projects.filter((p) => p.clientId === id).map((p) => p.id),
          );
          return {
            ...prev,
            clients: prev.clients.filter((c) => c.id !== id),
            projects: prev.projects.filter((p) => p.clientId !== id),
            invoices: prev.invoices.filter((i) => i.clientId !== id),
            quotes: prev.quotes.filter((q) => q.clientId !== id),
            contracts: prev.contracts.filter((c) => c.clientId !== id),
            files: prev.files.filter((f) => f.clientId !== id),
            // Cascades through the client's projects.
            projectTasks: prev.projectTasks.filter((t) => !goneProjects.has(t.projectId)),
          };
        });
        persist(() => supabase.from('clients').delete().eq('id', id), 'delete client');
      },

      clientFor(item) {
        return item.clientId ? state.clients.find((c) => c.id === item.clientId) : undefined;
      },

      projectFor(item) {
        return item.projectId ? state.projects.find((p) => p.id === item.projectId) : undefined;
      },

      projectsForClient(clientId) {
        return state.projects.filter((p) => p.clientId === clientId);
      },

      clientByToken(token) {
        return state.clients.find((c) => c.portalToken === token);
      },
    };
  }, [state, loading, refresh, persist, patchProject, patchPhase]);

  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>;
}

export function useStudio() {
  const ctx = useContext(StudioContext);
  if (!ctx) throw new Error('useStudio must be used inside a <StudioProvider>');
  return ctx;
}
