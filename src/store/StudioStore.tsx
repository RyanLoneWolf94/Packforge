import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { TierId } from '../brand';
import { phasesForTier, timelineForTier } from '../data/phaseTemplates';
import { SEED } from '../data/seed';
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
  PlanTemplate,
  Project,
  Quote,
  StudioSettings,
  TeamMember,
  TimeEntry,
} from '../types';

/**
 * Single source of truth for studio data, persisted to localStorage.
 *
 * Every page reads from here rather than holding its own hardcoded array, so a
 * project created in the admin workspace shows up in the client portal, the
 * dashboard rollups and the invoice list without any extra wiring. Swapping in
 * a real backend later means replacing the persistence in this file only.
 */

const STORAGE_KEY = 'packforge.studio.v2';

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
  emailTemplates: EmailTemplate[];
  planTemplates: PlanTemplate[];
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

interface StudioContextValue extends StudioState {
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
    tier: TierId;
    packageName: string;
    startDate: string;
    targetDelivery: string;
    summary: string;
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

  resetToSeed: () => void;
}

const StudioContext = createContext<StudioContextValue | null>(null);

let seq = 0;
const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(seq++).toString(36)}`;

/** Lowercase, hyphenated, URL-safe token for portal share links. */
function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'client'
  );
}

const EMPTY: Collections = {
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
  emailTemplates: [],
  planTemplates: [],
  campaigns: [],
  newsletters: [],
};

function loadState(): StudioState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StudioState>;
      // Guard against a truncated or hand-edited payload leaving the app blank,
      // and backfill collections added after the payload was written.
      if (Array.isArray(parsed.projects) && Array.isArray(parsed.clients)) {
        // Deep-merge settings so a payload written before a settings field
        // existed still gets the new defaults rather than a hole.
        return {
          ...EMPTY,
          ...SEED,
          ...parsed,
          settings: {
            ...SEED.settings,
            ...parsed.settings,
            notifications: {
              ...SEED.settings.notifications,
              ...parsed.settings?.notifications,
            },
            integrations: {
              ...SEED.settings.integrations,
              ...parsed.settings?.integrations,
            },
          },
        } as StudioState;
      }
    }
  } catch (err) {
    console.error('Could not read stored studio data, falling back to seed.', err);
  }
  return { ...SEED };
}

export function StudioProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<StudioState>(loadState);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      console.error('Could not persist studio data.', err);
    }
  }, [state]);

  /** Apply a change to one project, leaving the rest of the state untouched. */
  const patchProject = useCallback((projectId: string, fn: (project: Project) => Project) => {
    setState((prev) => ({
      ...prev,
      projects: prev.projects.map((p) => (p.id === projectId ? fn(p) : p)),
    }));
  }, []);

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

      add(key, item) {
        const created = { ...(item as object), id: uid(key.slice(0, 2)) } as Item<typeof key>;
        setState((prev) => ({ ...prev, [key]: [created, ...prev[key]] }) as StudioState);
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
      },

      remove(key, id) {
        setState(
          (prev) =>
            ({
              ...prev,
              [key]: (prev[key] as { id: string }[]).filter((row) => row.id !== id),
            }) as StudioState,
        );
      },

      updateSettings(patch) {
        setState((prev) => ({ ...prev, settings: { ...prev.settings, ...patch } }));
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
          packageTier: input.tier,
          packageName: input.packageName,
          startDate: input.startDate,
          targetDelivery: input.targetDelivery,
          summary: input.summary,
          phases: phasesForTier(input.tier),
          timeline: timelineForTier(input.tier),
          actionItems: [],
        };
        setState((prev) => ({ ...prev, projects: [project, ...prev.projects] }));
        return project;
      },

      deleteProject(id) {
        setState((prev) => ({
          ...prev,
          projects: prev.projects.filter((p) => p.id !== id),
          // Detach rather than delete: the money and paperwork outlive the project.
          invoices: prev.invoices.map((i) =>
            i.projectId === id ? { ...i, projectId: undefined } : i,
          ),
          contracts: prev.contracts.map((c) =>
            c.projectId === id ? { ...c, projectId: undefined } : c,
          ),
          files: prev.files.map((f) => (f.projectId === id ? { ...f, projectId: undefined } : f)),
        }));
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
          timeline: project.timeline.map((w) =>
            w.id === weekId ? { ...w, done: !w.done } : w,
          ),
        }));
      },

      createClient(input) {
        const client: Client = {
          ...input,
          id: uid('cl'),
          portalToken: slugify(input.name),
          createdAt: new Date().toISOString().slice(0, 10),
        };
        setState((prev) => ({ ...prev, clients: [client, ...prev.clients] }));
        return client;
      },

      deleteClient(id) {
        setState((prev) => ({
          ...prev,
          clients: prev.clients.filter((c) => c.id !== id),
          // Cascade: nothing below can be resolved without its client.
          projects: prev.projects.filter((p) => p.clientId !== id),
          invoices: prev.invoices.filter((i) => i.clientId !== id),
          quotes: prev.quotes.filter((q) => q.clientId !== id),
          contracts: prev.contracts.filter((c) => c.clientId !== id),
          files: prev.files.filter((f) => f.clientId !== id),
        }));
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

      resetToSeed() {
        setState({ ...SEED });
      },
    };
  }, [state, patchProject, patchPhase]);

  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>;
}

export function useStudio() {
  const ctx = useContext(StudioContext);
  if (!ctx) throw new Error('useStudio must be used inside a <StudioProvider>');
  return ctx;
}
