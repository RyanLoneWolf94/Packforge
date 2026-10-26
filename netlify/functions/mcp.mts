import { pgCount, pgDelete, pgFirst, pgInsert, pgSelect, pgUpdate } from './mcp-db.mts';
import type { Config } from '@netlify/functions';

/**
 * Packforge MCP server — lets Claude (and any other MCP client) work with the
 * studio's data from a conversation.
 *
 * Deliberately exposes *intentions* rather than tables: "draft a quote from
 * this blueprint", not "insert into quotes". Every write goes through the same
 * rules the app applies — derived totals, blueprint copying, quote numbering —
 * so a record made from a chat is indistinguishable from one made by hand.
 *
 * Safety rails. These draw one line, and it is not "reads are safe, writes
 * are not" — it is **nothing reaches a client without a human**:
 *  - Quotes are always created as drafts and no tool can send one.
 *  - Packages can be created and edited, but no tool creates an offer, so a
 *    package cannot be put in front of a client from here.
 *  - Invoices default to draft.
 *  - Internal records are fully editable, including delete. The studio's own
 *    data is the model's to work with; the client's view of it is not.
 *  - Destructive calls must name their target. delete_project requires the
 *    project's exact name, so a mistyped or hallucinated id fails loudly
 *    instead of deleting the wrong project.
 *  - Everything created is stamped with its origin, so AI-made records are
 *    identifiable after the fact.
 *
 * Auth: a bearer token, supplied either as an Authorization header or as the
 * final path segment (`/mcp/<token>`) for clients that can't set headers.
 * The service-role key lives only here, server-side — never in the browser.
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MCP_TOKEN = process.env.MCP_TOKEN;

const SITE = 'https://portal.lonewolfdigitech.com';
const ORIGIN_NOTE = 'Created via MCP';



/* ------------------------------ JSON-RPC ------------------------------ */

type Json = Record<string, unknown>;

const rpcResult = (id: unknown, result: Json) => ({ jsonrpc: '2.0', id, result });
const rpcError = (id: unknown, code: number, message: string) => ({
  jsonrpc: '2.0',
  id,
  error: { code, message },
});

/** MCP tool results are content blocks; everything here is text. */
const text = (value: unknown) => ({
  content: [
    { type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) },
  ],
});

const fail = (message: string) => ({
  content: [{ type: 'text', text: message }],
  isError: true,
});

/* -------------------------------- Tools -------------------------------- */

const TOOLS = [
  {
    name: 'list_clients',
    description:
      'List the studio\'s clients with their id, contact details and client portal link. Use this to find the clientId needed by other tools.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'list_blueprints',
    description:
      'List reusable engagement blueprints (templates) across every business line — branding, software, web, marketing, ads. Each has a priced breakdown, a delivery workflow and a timeline. Use one to create a quote or project that matches how the studio actually sells and delivers that kind of work.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'list_packages',
    description:
      'List the package catalogue: named groups of priced tiers a client chooses between while the work is still being discussed (for example a Branding Package holding The Pup, The Wolf and Alpha Pack). Returns every tier with its price and inclusions. Check this before create_package so you do not duplicate one.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'create_package',
    description:
      'Create a package: a named group of priced tiers a client picks between. Supply all the tiers in one call. The package is added to the catalogue only; sending it to a client is a human action, so nothing here reaches a client. Use list_blueprints first if a tier should seed a delivery plan when chosen.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Package name, e.g. "Event Package".' },
        description: {
          type: 'string',
          description: 'One or two sentences. Shown above the tiers in the client portal.',
        },
        category: { type: 'string', description: 'e.g. Branding, Digital Marketing, Software.' },
        active: {
          type: 'boolean',
          description: 'Whether it can be included in new offers. Defaults to true.',
        },
        tiers: {
          type: 'array',
          description: 'The priced cards, cheapest first. Three is the usual number.',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Tier name, e.g. "The Day Pack".' },
              tagline: { type: 'string', description: 'One line on who it is for.' },
              price: { type: 'number', description: 'Price in USD.' },
              period: { type: 'string', description: '"one-off" or "per month". Default one-off.' },
              features: {
                type: 'array',
                items: { type: 'string' },
                description: 'What is included, one bullet per entry, as the client reads it.',
              },
              badge: { type: 'string', description: 'Ribbon text such as "Best Value". Optional.' },
              accent: {
                type: 'string',
                enum: ['plain', 'outlined', 'featured'],
                description:
                  'Card styling. Use "featured" on the one tier being steered towards, "plain" otherwise.',
              },
              timelineDays: { type: 'number', description: 'Delivery time in days.' },
              blueprintId: {
                type: 'string',
                description:
                  'Optional. If set, choosing this tier seeds the project with that blueprint\'s phases.',
              },
            },
            required: ['name', 'price'],
            additionalProperties: false,
          },
        },
      },
      required: ['name', 'tiers'],
      additionalProperties: false,
    },
  },
  {
    name: 'list_projects',
    description:
      'List projects with their client, status, progress and target delivery date.',
    inputSchema: {
      type: 'object',
      properties: {
        clientId: { type: 'string', description: 'Optional — only this client\'s projects.' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'get_project',
    description:
      'Full detail for one project: phases, deliverables, the task board and its invoices.',
    inputSchema: {
      type: 'object',
      properties: { projectId: { type: 'string' } },
      required: ['projectId'],
      additionalProperties: false,
    },
  },
  {
    name: 'create_client',
    description:
      'Add a client. Returns the client id and their portal link. Check list_clients first so you do not create a duplicate.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Business name.' },
        contactName: { type: 'string' },
        email: { type: 'string' },
        phone: { type: 'string' },
        location: { type: 'string' },
        industry: { type: 'string' },
      },
      required: ['name'],
      additionalProperties: false,
    },
  },
  {
    name: 'create_lead',
    description: 'Record a prospective client in the pipeline.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        contactName: { type: 'string' },
        email: { type: 'string' },
        phone: { type: 'string' },
        source: { type: 'string', description: 'Where they came from.' },
        value: { type: 'number', description: 'Estimated value in USD.' },
        notes: { type: 'string' },
      },
      required: ['name'],
      additionalProperties: false,
    },
  },
  {
    name: 'create_quote_draft',
    description:
      'Draft a quote for a client. Always saved as a DRAFT and never sent — a human reviews and sends it. Either pass blueprintId to use a standard priced breakdown, or supply milestones to price custom work. The total is derived from the line items.',
    inputSchema: {
      type: 'object',
      properties: {
        clientId: { type: 'string', description: 'From list_clients.' },
        title: { type: 'string', description: 'What the engagement is called.' },
        blueprintId: {
          type: 'string',
          description: 'Optional — copy this blueprint\'s priced breakdown.',
        },
        milestones: {
          type: 'array',
          description:
            'Custom breakdown, used when no blueprint fits. Each milestone is a phase of work containing priced line items.',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              tasks: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    title: { type: 'string' },
                    price: { type: 'number', description: 'USD.' },
                  },
                  required: ['title', 'price'],
                },
              },
            },
            required: ['title', 'tasks'],
          },
        },
        timelineDays: { type: 'number', description: 'Delivery estimate in days.' },
        validDays: { type: 'number', description: 'How long the quote stands. Defaults to 30.' },
      },
      required: ['clientId', 'title'],
      additionalProperties: false,
    },
  },
  {
    name: 'create_project',
    description:
      'Start a project for a client. Pass blueprintId to seed its phases, deliverables and client-facing timeline; omit it for a blank project that phases get added to later.',
    inputSchema: {
      type: 'object',
      properties: {
        clientId: { type: 'string' },
        name: { type: 'string' },
        blueprintId: { type: 'string', description: 'Optional — seeds the delivery plan.' },
        summary: { type: 'string', description: 'Shown at the top of the client portal.' },
        startDate: { type: 'string', description: 'YYYY-MM-DD. Defaults to today.' },
        targetDelivery: { type: 'string', description: 'YYYY-MM-DD.' },
      },
      required: ['clientId', 'name'],
      additionalProperties: false,
    },
  },
  /* ----------------------------- reading ----------------------------- */
  {
    name: 'list_invoices',
    description:
      'List invoices with their client, project, amount, dates and status. Filter by client, project or status.',
    inputSchema: {
      type: 'object',
      properties: {
        clientId: { type: 'string' },
        projectId: { type: 'string' },
        status: {
          type: 'string',
          enum: ['draft', 'sent', 'paid', 'partially-paid', 'overdue', 'cancelled'],
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'list_quotes',
    description: 'List quotes with their client, total, status and whether they became a project.',
    inputSchema: {
      type: 'object',
      properties: {
        clientId: { type: 'string' },
        status: { type: 'string', description: 'e.g. draft, sent, accepted, rejected.' },
      },
      additionalProperties: false,
    },
  },

  /* ------------------------- projects: editing ------------------------ */
  {
    name: 'update_project',
    description:
      'Change a project\'s details: name, status, summary, dates, package name or owning client. Only the fields you pass are touched. Setting status to "archived" hides it from the client portal without deleting anything, which is usually what is wanted instead of a delete.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        name: { type: 'string' },
        status: {
          type: 'string',
          enum: ['planning', 'active', 'review', 'completed', 'archived'],
        },
        summary: { type: 'string' },
        startDate: { type: 'string', description: 'YYYY-MM-DD.' },
        targetDelivery: { type: 'string', description: 'YYYY-MM-DD.' },
        packageName: { type: 'string' },
        clientId: { type: 'string', description: 'Move the project to another client.' },
      },
      required: ['projectId'],
      additionalProperties: false,
    },
  },
  {
    name: 'delete_project',
    description:
      'Permanently delete a project and its task board. Invoices, contracts, files, expenses and time entries survive but are unlinked from it. This cannot be undone — prefer update_project with status "archived" unless the project is genuinely junk. You must pass confirmName exactly matching the project name, so call get_project or list_projects first.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        confirmName: {
          type: 'string',
          description: 'The project\'s exact current name. The delete is refused if it differs.',
        },
      },
      required: ['projectId', 'confirmName'],
      additionalProperties: false,
    },
  },

  /* ---------------------- tracker: phases & work ---------------------- */
  {
    name: 'add_phase',
    description:
      'Add a delivery phase to a project. Phases carry the budget and the client-facing deliverables, and the project total is the sum of phase budgets.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        name: { type: 'string' },
        budget: { type: 'number', description: 'Phase budget in USD.' },
        deliverables: {
          type: 'array',
          description: 'Optional starting deliverables.',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              description: { type: 'string' },
            },
            required: ['title'],
            additionalProperties: false,
          },
        },
      },
      required: ['projectId', 'name'],
      additionalProperties: false,
    },
  },
  {
    name: 'update_phase',
    description: 'Rename a phase, change its budget, or set its shared file link.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        phaseId: { type: 'string' },
        name: { type: 'string' },
        budget: { type: 'number' },
        link: { type: 'string', description: 'Shared folder or doc URL shown to the client.' },
      },
      required: ['projectId', 'phaseId'],
      additionalProperties: false,
    },
  },
  {
    name: 'delete_phase',
    description: 'Remove a phase and its deliverables from a project.',
    inputSchema: {
      type: 'object',
      properties: { projectId: { type: 'string' }, phaseId: { type: 'string' } },
      required: ['projectId', 'phaseId'],
      additionalProperties: false,
    },
  },
  {
    name: 'add_deliverable',
    description:
      'Add a deliverable to a phase. Deliverables are the client-facing promise and drive the progress percentage shown in the portal.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        phaseId: { type: 'string' },
        title: { type: 'string' },
        description: { type: 'string' },
      },
      required: ['projectId', 'phaseId', 'title'],
      additionalProperties: false,
    },
  },
  {
    name: 'update_deliverable',
    description:
      'Edit a deliverable or tick it off. Setting done to true updates the client portal immediately.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        phaseId: { type: 'string' },
        deliverableId: { type: 'string' },
        title: { type: 'string' },
        description: { type: 'string' },
        done: { type: 'boolean' },
      },
      required: ['projectId', 'phaseId', 'deliverableId'],
      additionalProperties: false,
    },
  },
  {
    name: 'delete_deliverable',
    description: 'Remove a deliverable from a phase.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        phaseId: { type: 'string' },
        deliverableId: { type: 'string' },
      },
      required: ['projectId', 'phaseId', 'deliverableId'],
      additionalProperties: false,
    },
  },
  {
    name: 'update_timeline_week',
    description:
      'Edit a timeline stage or mark it complete. The timeline is the week-by-week view the client sees alongside the phases.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        weekId: { type: 'string' },
        label: { type: 'string', description: 'e.g. "Week 1".' },
        title: { type: 'string' },
        points: { type: 'array', items: { type: 'string' } },
        done: { type: 'boolean' },
      },
      required: ['projectId', 'weekId'],
      additionalProperties: false,
    },
  },

  /* --------------------------- the task board -------------------------- */
  {
    name: 'create_task',
    description:
      'Add a task to a project\'s board. Tasks are how the studio delivers, separate from the client-facing deliverables. Set clientVisible false for internal scratch work.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        title: { type: 'string' },
        lane: { type: 'string', enum: ['Todo', 'In Progress', 'Done'] },
        tags: { type: 'array', items: { type: 'string' }, description: 'e.g. ["High"].' },
        dueDate: { type: 'string', description: 'YYYY-MM-DD.' },
        assignee: { type: 'string' },
        phaseId: { type: 'string', description: 'Optional phase to file it under.' },
        clientVisible: { type: 'boolean', description: 'Defaults to true.' },
      },
      required: ['projectId', 'title'],
      additionalProperties: false,
    },
  },
  {
    name: 'update_task',
    description:
      'Change a task: move it between lanes, retitle it, re-file it under a phase, or hide it from the client.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string' },
        title: { type: 'string' },
        lane: { type: 'string', enum: ['Todo', 'In Progress', 'Done'] },
        tags: { type: 'array', items: { type: 'string' } },
        dueDate: { type: 'string' },
        assignee: { type: 'string' },
        phaseId: { type: 'string' },
        clientVisible: { type: 'boolean' },
      },
      required: ['taskId'],
      additionalProperties: false,
    },
  },
  {
    name: 'delete_task',
    description: 'Remove a task from a board.',
    inputSchema: {
      type: 'object',
      properties: { taskId: { type: 'string' } },
      required: ['taskId'],
      additionalProperties: false,
    },
  },

  /* ----------------------------- invoices ------------------------------ */
  {
    name: 'create_invoice',
    description:
      'Raise an invoice. Saved as a DRAFT unless you pass another status, and nothing is emailed from here. The number is generated if you do not supply one.',
    inputSchema: {
      type: 'object',
      properties: {
        clientId: { type: 'string' },
        projectId: { type: 'string' },
        amount: { type: 'number', description: 'Total in USD.' },
        issueDate: { type: 'string', description: 'YYYY-MM-DD. Defaults to today.' },
        dueDate: { type: 'string', description: 'YYYY-MM-DD. Defaults to 14 days out.' },
        number: { type: 'string', description: 'e.g. MH-INV-001. Generated if omitted.' },
        notes: { type: 'string' },
        status: {
          type: 'string',
          enum: ['draft', 'sent', 'paid', 'partially-paid', 'overdue', 'cancelled'],
        },
      },
      required: ['clientId', 'amount'],
      additionalProperties: false,
    },
  },
  {
    name: 'update_invoice',
    description:
      'Change an invoice: amount, dates, notes, linked project, or status. Setting status to "paid" stamps the paid date unless you give one.',
    inputSchema: {
      type: 'object',
      properties: {
        invoiceId: { type: 'string' },
        amount: { type: 'number' },
        issueDate: { type: 'string' },
        dueDate: { type: 'string' },
        notes: { type: 'string' },
        projectId: { type: 'string' },
        paidAt: { type: 'string', description: 'YYYY-MM-DD.' },
        status: {
          type: 'string',
          enum: ['draft', 'sent', 'paid', 'partially-paid', 'overdue', 'cancelled'],
        },
      },
      required: ['invoiceId'],
      additionalProperties: false,
    },
  },
  {
    name: 'delete_invoice',
    description:
      'Delete an invoice. Prefer status "cancelled" for anything that was ever sent, so the record survives.',
    inputSchema: {
      type: 'object',
      properties: { invoiceId: { type: 'string' } },
      required: ['invoiceId'],
      additionalProperties: false,
    },
  },

  /* ------------------------- clients & packages ------------------------ */
  {
    name: 'update_client',
    description: 'Correct or complete a client\'s details. Only the fields you pass are touched.',
    inputSchema: {
      type: 'object',
      properties: {
        clientId: { type: 'string' },
        name: { type: 'string' },
        contactName: { type: 'string' },
        email: { type: 'string' },
        phone: { type: 'string' },
        location: { type: 'string' },
        industry: { type: 'string' },
        status: { type: 'string', description: 'e.g. active, dormant.' },
      },
      required: ['clientId'],
      additionalProperties: false,
    },
  },
  {
    name: 'update_package',
    description:
      'Edit a package: its name, description, category, whether it is active, or replace its tiers wholesale. Passing tiers replaces every tier, so send the full set. Offers already sent keep their own snapshot and are unaffected.',
    inputSchema: {
      type: 'object',
      properties: {
        packageId: { type: 'string' },
        name: { type: 'string' },
        description: { type: 'string' },
        category: { type: 'string' },
        active: { type: 'boolean' },
        tiers: {
          type: 'array',
          description: 'Replaces all tiers. Omit to leave them alone.',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              tagline: { type: 'string' },
              price: { type: 'number' },
              period: { type: 'string' },
              features: { type: 'array', items: { type: 'string' } },
              badge: { type: 'string' },
              accent: { type: 'string', enum: ['plain', 'outlined', 'featured'] },
              timelineDays: { type: 'number' },
              blueprintId: { type: 'string' },
            },
            required: ['name', 'price'],
            additionalProperties: false,
          },
        },
      },
      required: ['packageId'],
      additionalProperties: false,
    },
  },
] as const;

/* ------------------------------- Helpers ------------------------------- */

let seq = 0;
const uid = (p: string) => `${p}-${Date.now().toString(36)}-${(seq++).toString(36)}`;
const today = () => new Date().toISOString().slice(0, 10);
const addDays = (days: number) =>
  new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

const slugify = (v: string) =>
  v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'client';

interface PackageTier {
  name: string;
  tagline?: string;
  price: number;
  period?: string;
  features?: string[];
  badge?: string;
  accent?: string;
  timelineDays?: number;
  blueprintId?: string;
}

const ACCENTS = new Set(['plain', 'outlined', 'featured']);
const LANES = new Set(['Todo', 'In Progress', 'Done']);
const INVOICE_STATUSES = new Set([
  'draft',
  'sent',
  'paid',
  'partially-paid',
  'overdue',
  'cancelled',
]);

interface Milestone {
  id: string;
  title: string;
  tasks: { id: string; title: string; price: number }[];
}

const milestonesTotal = (ms: Milestone[]) =>
  ms.reduce((s, m) => s + m.tasks.reduce((t, x) => t + (Number(x.price) || 0), 0), 0);

/** Fresh ids so a template's content never aliases the project made from it. */
const cloneMilestones = (ms: Milestone[]): Milestone[] =>
  ms.map((m) => ({
    ...m,
    id: uid('qm'),
    tasks: m.tasks.map((t) => ({ ...t, id: uid('qt') })),
  }));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const freshPhases = (phases: any[]) =>
  (phases ?? []).map((ph) => ({
    ...ph,
    id: uid('ph'),
    link: '',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    deliverables: (ph.deliverables ?? []).map((d: any) => ({
      ...d,
      id: uid('dl'),
      done: false,
    })),
  }));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const freshTimeline = (timeline: any[]) =>
  (timeline ?? []).map((w) => ({ ...w, id: uid('wk'), done: false }));

/* -------------------------- Project JSON helpers ------------------------- */

/**
 * Phases, the timeline and action items live as jsonb on the project row, so
 * editing one is a read, a change in memory, and a write back. Every caller
 * goes through here to keep that pattern in one place.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ProjectRow = Record<string, any>;

async function loadProject(projectId: string): Promise<ProjectRow | null> {
  return await pgFirst<ProjectRow>('projects', { eq: { id: projectId } });
}

/** Resolve a phase by id, with a message naming what was actually there. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function findPhase(project: ProjectRow, phaseId: string): any | undefined {
  return (project.phases ?? []).find((p: { id: string }) => p.id === phaseId);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const phaseList = (project: ProjectRow) =>
  (project.phases ?? []).map((p: any) => `${p.id} (${p.name})`).join(', ') || 'none';

/** Only copy through the keys the caller actually supplied. */
function pick(args: Json, keys: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of keys) if (args[k] !== undefined) out[k] = args[k];
  return out;
}

/* ----------------------------- Tool runner ----------------------------- */

async function runTool(name: string, args: Json) {
  switch (name) {
    case 'list_clients': {
      const rows = await pgSelect<{ portalToken: string }>('clients', {
        select: 'id,name,contactName,email,phone,location,industry,status,portalToken',
      });
      return text(rows.map((c) => ({ ...c, portalUrl: `${SITE}/portal/${c.portalToken}` })));
    }

    case 'list_blueprints': {
      const rows = await pgSelect<{
        id: string;
        title: string;
        category: string;
        description: string;
        milestones: Milestone[];
        timelineDays: number;
      }>('blueprints', { select: 'id,title,category,description,milestones,timelineDays' });
      return text(
        rows.map((b) => ({
          id: b.id,
          title: b.title,
          category: b.category,
          description: b.description,
          priceUsd: milestonesTotal((b.milestones ?? []) as Milestone[]),
          timelineDays: b.timelineDays,
        })),
      );
    }

    case 'list_packages': {
      const rows = await pgSelect<{
        id: string;
        name: string;
        description: string;
        category: string;
        active: boolean;
        tiers: PackageTier[];
      }>('packages', { select: 'id,name,description,category,active,tiers,sortOrder' });
      return text(
        rows.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          category: p.category,
          active: p.active,
          tiers: (p.tiers ?? []).map((t) => ({
            name: t.name,
            priceUsd: t.price,
            period: t.period,
            tagline: t.tagline,
            features: t.features,
            timelineDays: t.timelineDays,
            blueprintId: t.blueprintId,
          })),
        })),
      );
    }

    case 'create_package': {
      const name = String(args.name ?? '').trim();
      if (!name) return fail('A package name is required.');
      if (!Array.isArray(args.tiers) || args.tiers.length === 0) {
        return fail('At least one tier is required. A package is the group; tiers are the cards.');
      }

      // Any blueprint a tier points at must exist, or choosing that tier would
      // silently create a project with no phases.
      const referenced = [
        ...new Set(
          (args.tiers as PackageTier[])
            .map((t) => String(t.blueprintId ?? '').trim())
            .filter(Boolean),
        ),
      ];
      if (referenced.length) {
        const found = await pgSelect<{ id: string }>('blueprints', { select: 'id' });
        const known = new Set(found.map((b) => b.id));
        const missing = referenced.filter((id) => !known.has(id));
        if (missing.length) {
          return fail(
            `No blueprint with id ${missing.join(', ')}. Call list_blueprints, or omit blueprintId.`,
          );
        }
      }

      const tiers = (args.tiers as PackageTier[]).map((t) => ({
        id: uid('tr'),
        name: String(t.name ?? '').trim() || 'Tier',
        tagline: String(t.tagline ?? ''),
        price: Number(t.price) || 0,
        period: String(t.period ?? 'one-off'),
        features: Array.isArray(t.features) ? t.features.map((f) => String(f)) : [],
        badge: String(t.badge ?? ''),
        accent: ACCENTS.has(String(t.accent)) ? String(t.accent) : 'plain',
        timelineDays: Number(t.timelineDays) || 28,
        blueprintId: String(t.blueprintId ?? '').trim() || undefined,
      }));

      const data = await pgInsert<{ id: string; name: string }>('packages', {
        id: uid('pk'),
        name,
        // No origin stamp here: description is client-facing copy, unlike a
        // lead's internal notes.
        description: String(args.description ?? ''),
        category: String(args.category ?? 'Other'),
        tiers,
        active: args.active === false ? false : true,
        sortOrder: (await pgCount('packages')) + 1,
        createdAt: today(),
      });

      return text({
        created: 'package',
        id: data.id,
        name: data.name,
        tiers: tiers.map((t) => ({ name: t.name, priceUsd: t.price })),
        editUrl: `${SITE}/admin/packages/${data.id}`,
        note: 'In the catalogue only. Sending it to a client is done by hand in Packforge.',
      });
    }

    case 'list_projects': {
      const rows = await pgSelect<Record<string, unknown>>('projects', {
        select: 'id,name,clientId,ref,status,startDate,targetDelivery,phases',
        eq: { clientId: typeof args.clientId === 'string' ? args.clientId : undefined },
      });
      return text(
        rows.map((p) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const phases = (p.phases ?? []) as any[];
          const all = phases.flatMap((ph) => ph.deliverables ?? []);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const done = all.filter((d: any) => d.done).length;
          return {
            id: p.id,
            name: p.name,
            clientId: p.clientId,
            ref: p.ref,
            status: p.status,
            startDate: p.startDate,
            targetDelivery: p.targetDelivery,
            deliverables: `${done}/${all.length}`,
            budgetUsd: phases.reduce((s, ph) => s + (Number(ph.budget) || 0), 0),
          };
        }),
      );
    }

    case 'get_project': {
      const id = String(args.projectId ?? '');
      const project = await pgFirst('projects', { eq: { id } });
      if (!project) return fail(`No project with id ${id}`);
      const tasks = await pgSelect('projectTasks', {
        select: 'id,title,lane,phaseId,dueDate,clientVisible',
        eq: { projectId: id },
      });
      const invoices = await pgSelect('invoices', {
        select: 'id,number,amount,status,dueDate',
        eq: { projectId: id },
      });
      return text({ project, tasks, invoices });
    }

    case 'create_client': {
      const name = String(args.name ?? '').trim();
      if (!name) return fail('A client name is required.');

      // portalToken is unique — suffix until free, as the app does.
      const existing = await pgSelect<{ portalToken: string }>('clients', {
        select: 'portalToken',
      });
      const taken = new Set(existing.map((c) => c.portalToken));
      const base = slugify(name);
      let portalToken = base;
      for (let n = 2; taken.has(portalToken); n++) portalToken = `${base}-${n}`;

      const data = await pgInsert<{ id: string; name: string; portalToken: string }>(
        'clients',
        {
          id: uid('cl'),
          name,
          contactName: String(args.contactName ?? ''),
          email: String(args.email ?? ''),
          phone: String(args.phone ?? ''),
          location: String(args.location ?? ''),
          industry: String(args.industry ?? ''),
          status: 'active',
          portalToken,
          createdAt: today(),
        },
      );
      return text({
        created: 'client',
        id: data.id,
        name: data.name,
        portalUrl: `${SITE}/portal/${data.portalToken}`,
      });
    }

    case 'create_lead': {
      const name = String(args.name ?? '').trim();
      if (!name) return fail('A lead name is required.');
      const data = await pgInsert<{ id: string; name: string; stage: string }>('leads', {
        id: uid('ld'),
        name,
        contactName: String(args.contactName ?? ''),
        email: String(args.email ?? ''),
        phone: String(args.phone ?? ''),
        source: String(args.source ?? 'Referral'),
        stage: 'new',
        value: typeof args.value === 'number' ? args.value : null,
        notes: [String(args.notes ?? ''), ORIGIN_NOTE].filter(Boolean).join(' — '),
        createdAt: today(),
      });
      return text({ created: 'lead', id: data.id, name: data.name, stage: data.stage });
    }

    case 'create_quote_draft': {
      const clientId = String(args.clientId ?? '');
      const title = String(args.title ?? '').trim();
      if (!clientId || !title) return fail('clientId and title are required.');

      const client = await pgFirst<{ id: string; name: string }>('clients', {
        select: 'id,name',
        eq: { id: clientId },
      });
      if (!client) return fail(`No client with id ${clientId}. Call list_clients first.`);

      let milestones: Milestone[] = [];
      let timelineDays = typeof args.timelineDays === 'number' ? args.timelineDays : 0;

      if (typeof args.blueprintId === 'string' && args.blueprintId) {
        const bp = await pgFirst<{ milestones: Milestone[]; timelineDays: number }>(
          'blueprints',
          { select: 'milestones,timelineDays', eq: { id: args.blueprintId } },
        );
        if (!bp) return fail(`No blueprint with id ${args.blueprintId}.`);
        milestones = cloneMilestones((bp.milestones ?? []) as Milestone[]);
        if (!timelineDays) timelineDays = Number(bp.timelineDays) || 28;
      } else if (Array.isArray(args.milestones)) {
        milestones = (args.milestones as Milestone[]).map((m) => ({
          id: uid('qm'),
          title: String(m.title ?? 'Phase'),
          tasks: (m.tasks ?? []).map((t) => ({
            id: uid('qt'),
            title: String(t.title ?? ''),
            price: Number(t.price) || 0,
          })),
        }));
      } else {
        return fail('Provide either a blueprintId or a milestones breakdown.');
      }

      if (milestonesTotal(milestones) <= 0) {
        return fail('The breakdown has no priced line items.');
      }

      const count = await pgCount('quotes');
      const number = `QT-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`;
      const validDays = typeof args.validDays === 'number' ? args.validDays : 30;

      const data = await pgInsert<{ id: string; number: string; validUntil: string }>('quotes', {
        id: uid('qt'),
        number,
        title,
        clientId,
        validUntil: addDays(validDays),
        status: 'draft', // never sent from here
        milestones,
        timelineDays: timelineDays || 28,
      });

      return text({
        created: 'quote',
        status: 'draft',
        id: data.id,
        number: data.number,
        client: client.name,
        totalUsd: milestonesTotal(milestones),
        validUntil: data.validUntil,
        review: `${SITE}/admin/quotations`,
        note: 'Saved as a draft. Review it in Packforge and send it from there.',
      });
    }

    case 'create_project': {
      const clientId = String(args.clientId ?? '');
      const name = String(args.name ?? '').trim();
      if (!clientId || !name) return fail('clientId and name are required.');

      const client = await pgFirst<{ id: string; name: string }>('clients', {
        select: 'id,name',
        eq: { id: clientId },
      });
      if (!client) return fail(`No client with id ${clientId}. Call list_clients first.`);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let phases: any[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let timeline: any[] = [];
      let packageName = 'Custom engagement';
      let days = 28;

      if (typeof args.blueprintId === 'string' && args.blueprintId) {
        const bp = await pgFirst<{
          title: string;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          phases: any[];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          timeline: any[];
          timelineDays: number;
        }>('blueprints', {
          select: 'title,phases,timeline,timelineDays',
          eq: { id: args.blueprintId },
        });
        if (!bp) return fail(`No blueprint with id ${args.blueprintId}.`);
        phases = freshPhases(bp.phases ?? []);
        timeline = freshTimeline(bp.timeline ?? []);
        packageName = bp.title;
        days = Number(bp.timelineDays) || 28;
      }

      const start = String(args.startDate ?? today());
      const data = await pgInsert<{ id: string; name: string; status: string }>('projects', {
        id: uid('pr'),
          name,
          clientId,
          ref: `${slugify(name).slice(0, 3).toUpperCase()}-${new Date()
            .toISOString()
            .slice(2, 7)
            .replace('-', '')}`,
          status: 'planning',
          packageTier: 'custom',
          packageName,
          startDate: start,
          targetDelivery: String(args.targetDelivery ?? addDays(days)),
          summary: String(args.summary ?? ''),
          phases,
          timeline,
        actionItems: [],
        blueprintId: typeof args.blueprintId === 'string' ? args.blueprintId : null,
      });

      return text({
        created: 'project',
        id: data.id,
        name: data.name,
        client: client.name,
        status: data.status,
        phases: phases.length,
        tracker: `${SITE}/admin/tracker/${data.id}`,
        note: phases.length
          ? 'Phases and timeline seeded from the blueprint.'
          : 'Blank project — add phases in the tracker.',
      });
    }

    /* ------------------------------ reading ----------------------------- */

    case 'list_invoices': {
      const rows = await pgSelect<Record<string, unknown>>('invoices', {
        select: 'id,number,clientId,projectId,amount,issueDate,dueDate,status,notes,paidAt',
        eq: {
          clientId: typeof args.clientId === 'string' ? args.clientId : undefined,
          projectId: typeof args.projectId === 'string' ? args.projectId : undefined,
          status: typeof args.status === 'string' ? args.status : undefined,
        },
      });
      return text(rows);
    }

    case 'list_quotes': {
      const rows = await pgSelect<{ milestones: Milestone[] } & Record<string, unknown>>('quotes', {
        select: 'id,number,clientId,title,status,milestones,createdAt,validUntil,convertedProjectId',
        eq: {
          clientId: typeof args.clientId === 'string' ? args.clientId : undefined,
          status: typeof args.status === 'string' ? args.status : undefined,
        },
      });
      return text(
        rows.map((q) => ({
          id: q.id,
          number: q.number,
          clientId: q.clientId,
          title: q.title,
          status: q.status,
          totalUsd: milestonesTotal((q.milestones ?? []) as Milestone[]),
          createdAt: q.createdAt,
          validUntil: q.validUntil,
          convertedProjectId: q.convertedProjectId,
        })),
      );
    }

    /* --------------------------- projects: edit -------------------------- */

    case 'update_project': {
      const projectId = String(args.projectId ?? '');
      const patch = pick(args, [
        'name',
        'status',
        'summary',
        'startDate',
        'targetDelivery',
        'packageName',
        'clientId',
      ]);
      if (Object.keys(patch).length === 0) return fail('Nothing to change — pass a field.');

      if (typeof patch.clientId === 'string') {
        const client = await pgFirst('clients', { select: 'id', eq: { id: patch.clientId } });
        if (!client) return fail(`No client with id ${patch.clientId}.`);
      }

      const row = await pgUpdate<ProjectRow>('projects', projectId, patch);
      if (!row) return fail(`No project with id ${projectId}.`);
      return text({
        updated: 'project',
        id: row.id,
        name: row.name,
        status: row.status,
        changed: Object.keys(patch),
        note:
          patch.status === 'archived'
            ? 'Archived — it stays in your records but no longer appears in the client portal.'
            : undefined,
      });
    }

    case 'delete_project': {
      const projectId = String(args.projectId ?? '');
      const confirmName = String(args.confirmName ?? '');
      const project = await loadProject(projectId);
      if (!project) return fail(`No project with id ${projectId}.`);

      // Naming the target is what makes this safe: a wrong id cannot delete a
      // project the caller never looked at.
      if (project.name !== confirmName) {
        return fail(
          `confirmName does not match. That project is called "${project.name}". Pass it exactly, or use update_project with status "archived" instead.`,
        );
      }

      const gone = await pgDelete('projects', projectId);
      if (!gone) return fail(`Could not delete project ${projectId}.`);
      return text({
        deleted: 'project',
        id: projectId,
        name: project.name,
        note: 'Its task board went with it. Invoices, contracts, files, expenses and time entries survive, unlinked.',
      });
    }

    /* ----------------------- tracker: phases & work ---------------------- */

    case 'add_phase': {
      const projectId = String(args.projectId ?? '');
      const project = await loadProject(projectId);
      if (!project) return fail(`No project with id ${projectId}.`);

      const phase = {
        id: uid('ph'),
        name: String(args.name ?? 'Phase'),
        budget: Number(args.budget) || 0,
        link: '',
        deliverables: Array.isArray(args.deliverables)
          ? (args.deliverables as { title?: string; description?: string }[]).map((d) => ({
              id: uid('dl'),
              title: String(d.title ?? ''),
              description: String(d.description ?? ''),
              done: false,
            }))
          : [],
      };
      await pgUpdate('projects', projectId, { phases: [...(project.phases ?? []), phase] });
      return text({ added: 'phase', projectId, phaseId: phase.id, name: phase.name });
    }

    case 'update_phase': {
      const projectId = String(args.projectId ?? '');
      const phaseId = String(args.phaseId ?? '');
      const project = await loadProject(projectId);
      if (!project) return fail(`No project with id ${projectId}.`);
      if (!findPhase(project, phaseId)) {
        return fail(`No phase ${phaseId} on that project. Phases: ${phaseList(project)}.`);
      }

      const patch = pick(args, ['name', 'budget', 'link']);
      if (Object.keys(patch).length === 0) return fail('Nothing to change — pass a field.');

      const phases = (project.phases ?? []).map((p: { id: string }) =>
        p.id === phaseId ? { ...p, ...patch } : p,
      );
      await pgUpdate('projects', projectId, { phases });
      return text({ updated: 'phase', projectId, phaseId, changed: Object.keys(patch) });
    }

    case 'delete_phase': {
      const projectId = String(args.projectId ?? '');
      const phaseId = String(args.phaseId ?? '');
      const project = await loadProject(projectId);
      if (!project) return fail(`No project with id ${projectId}.`);
      const phase = findPhase(project, phaseId);
      if (!phase) return fail(`No phase ${phaseId}. Phases: ${phaseList(project)}.`);

      const phases = (project.phases ?? []).filter((p: { id: string }) => p.id !== phaseId);
      await pgUpdate('projects', projectId, { phases });
      return text({
        deleted: 'phase',
        projectId,
        phaseId,
        name: phase.name,
        deliverablesRemoved: (phase.deliverables ?? []).length,
      });
    }

    case 'add_deliverable': {
      const projectId = String(args.projectId ?? '');
      const phaseId = String(args.phaseId ?? '');
      const project = await loadProject(projectId);
      if (!project) return fail(`No project with id ${projectId}.`);
      if (!findPhase(project, phaseId)) {
        return fail(`No phase ${phaseId}. Phases: ${phaseList(project)}.`);
      }

      const deliverable = {
        id: uid('dl'),
        title: String(args.title ?? ''),
        description: String(args.description ?? ''),
        done: false,
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const phases = (project.phases ?? []).map((p: any) =>
        p.id === phaseId ? { ...p, deliverables: [...(p.deliverables ?? []), deliverable] } : p,
      );
      await pgUpdate('projects', projectId, { phases });
      return text({ added: 'deliverable', projectId, phaseId, deliverableId: deliverable.id });
    }

    case 'update_deliverable': {
      const projectId = String(args.projectId ?? '');
      const phaseId = String(args.phaseId ?? '');
      const deliverableId = String(args.deliverableId ?? '');
      const project = await loadProject(projectId);
      if (!project) return fail(`No project with id ${projectId}.`);
      const phase = findPhase(project, phaseId);
      if (!phase) return fail(`No phase ${phaseId}. Phases: ${phaseList(project)}.`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (!(phase.deliverables ?? []).some((d: any) => d.id === deliverableId)) {
        return fail(`No deliverable ${deliverableId} in phase "${phase.name}".`);
      }

      const patch = pick(args, ['title', 'description', 'done']);
      if (Object.keys(patch).length === 0) return fail('Nothing to change — pass a field.');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const phases = (project.phases ?? []).map((p: any) =>
        p.id !== phaseId
          ? p
          : {
              ...p,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              deliverables: (p.deliverables ?? []).map((d: any) =>
                d.id === deliverableId ? { ...d, ...patch } : d,
              ),
            },
      );
      await pgUpdate('projects', projectId, { phases });
      return text({
        updated: 'deliverable',
        projectId,
        phaseId,
        deliverableId,
        changed: Object.keys(patch),
        note: patch.done === true ? 'Ticked off — the client portal shows this immediately.' : undefined,
      });
    }

    case 'delete_deliverable': {
      const projectId = String(args.projectId ?? '');
      const phaseId = String(args.phaseId ?? '');
      const deliverableId = String(args.deliverableId ?? '');
      const project = await loadProject(projectId);
      if (!project) return fail(`No project with id ${projectId}.`);
      const phase = findPhase(project, phaseId);
      if (!phase) return fail(`No phase ${phaseId}. Phases: ${phaseList(project)}.`);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const phases = (project.phases ?? []).map((p: any) =>
        p.id !== phaseId
          ? p
          : {
              ...p,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              deliverables: (p.deliverables ?? []).filter((d: any) => d.id !== deliverableId),
            },
      );
      await pgUpdate('projects', projectId, { phases });
      return text({ deleted: 'deliverable', projectId, phaseId, deliverableId });
    }

    case 'update_timeline_week': {
      const projectId = String(args.projectId ?? '');
      const weekId = String(args.weekId ?? '');
      const project = await loadProject(projectId);
      if (!project) return fail(`No project with id ${projectId}.`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (!(project.timeline ?? []).some((w: any) => w.id === weekId)) {
        const ids =
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (project.timeline ?? []).map((w: any) => `${w.id} (${w.label})`).join(', ') || 'none';
        return fail(`No timeline stage ${weekId}. Stages: ${ids}.`);
      }

      const patch = pick(args, ['label', 'title', 'points', 'done']);
      if (Object.keys(patch).length === 0) return fail('Nothing to change — pass a field.');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const timeline = (project.timeline ?? []).map((w: any) =>
        w.id === weekId ? { ...w, ...patch } : w,
      );
      await pgUpdate('projects', projectId, { timeline });
      return text({ updated: 'timelineWeek', projectId, weekId, changed: Object.keys(patch) });
    }

    /* ---------------------------- the board ------------------------------ */

    case 'create_task': {
      const projectId = String(args.projectId ?? '');
      const title = String(args.title ?? '').trim();
      if (!title) return fail('A task title is required.');
      const project = await loadProject(projectId);
      if (!project) return fail(`No project with id ${projectId}.`);

      const existing = await pgSelect<{ id: string }>('projectTasks', {
        select: 'id',
        eq: { projectId },
      });

      const data = await pgInsert<{ id: string; title: string; lane: string }>('projectTasks', {
        id: uid('tk'),
        projectId,
        title,
        lane: LANES.has(String(args.lane)) ? String(args.lane) : 'Todo',
        tags: Array.isArray(args.tags) ? args.tags.map((t) => String(t)) : [],
        dueDate: String(args.dueDate ?? ''),
        assignee: String(args.assignee ?? ''),
        subtasks: [],
        clientVisible: args.clientVisible === false ? false : true,
        phaseId: typeof args.phaseId === 'string' && args.phaseId ? args.phaseId : null,
        sortOrder: existing.length + 1,
        createdAt: today(),
      });
      return text({ created: 'task', id: data.id, title: data.title, lane: data.lane });
    }

    case 'update_task': {
      const taskId = String(args.taskId ?? '');
      const patch = pick(args, [
        'title',
        'lane',
        'tags',
        'dueDate',
        'assignee',
        'phaseId',
        'clientVisible',
      ]);
      if (Object.keys(patch).length === 0) return fail('Nothing to change — pass a field.');
      if (patch.lane !== undefined && !LANES.has(String(patch.lane))) {
        return fail('lane must be Todo, In Progress or Done.');
      }

      const row = await pgUpdate<{ id: string; title: string; lane: string }>(
        'projectTasks',
        taskId,
        patch,
      );
      if (!row) return fail(`No task with id ${taskId}.`);
      return text({ updated: 'task', id: row.id, title: row.title, lane: row.lane, changed: Object.keys(patch) });
    }

    case 'delete_task': {
      const taskId = String(args.taskId ?? '');
      const gone = await pgDelete('projectTasks', taskId);
      if (!gone) return fail(`No task with id ${taskId}.`);
      return text({ deleted: 'task', id: taskId });
    }

    /* ----------------------------- invoices ------------------------------ */

    case 'create_invoice': {
      const clientId = String(args.clientId ?? '');
      const client = await pgFirst<{ id: string; name: string }>('clients', {
        select: 'id,name',
        eq: { id: clientId },
      });
      if (!client) return fail(`No client with id ${clientId}. Call list_clients first.`);

      const amount = Number(args.amount);
      if (!Number.isFinite(amount) || amount <= 0) return fail('amount must be a positive number.');

      let number = String(args.number ?? '').trim();
      if (!number) {
        const n = (await pgCount('invoices')) + 1;
        number = `INV-${String(n).padStart(4, '0')}`;
      }

      const data = await pgInsert<{ id: string; number: string; status: string }>('invoices', {
        id: uid('in'),
        number,
        clientId,
        projectId: typeof args.projectId === 'string' && args.projectId ? args.projectId : null,
        amount,
        issueDate: String(args.issueDate ?? today()),
        dueDate: String(args.dueDate ?? addDays(14)),
        status: INVOICE_STATUSES.has(String(args.status)) ? String(args.status) : 'draft',
        notes: [String(args.notes ?? ''), ORIGIN_NOTE].filter(Boolean).join(' — '),
      });
      return text({
        created: 'invoice',
        id: data.id,
        number: data.number,
        status: data.status,
        clientName: client.name,
        amountUsd: amount,
      });
    }

    case 'update_invoice': {
      const invoiceId = String(args.invoiceId ?? '');
      const patch = pick(args, [
        'amount',
        'issueDate',
        'dueDate',
        'notes',
        'projectId',
        'paidAt',
        'status',
      ]);
      if (Object.keys(patch).length === 0) return fail('Nothing to change — pass a field.');
      if (patch.status !== undefined && !INVOICE_STATUSES.has(String(patch.status))) {
        return fail('status must be one of draft, sent, paid, partially-paid, overdue, cancelled.');
      }
      // Marking it paid without a date would leave the record half-finished.
      if (patch.status === 'paid' && patch.paidAt === undefined) patch.paidAt = today();

      const row = await pgUpdate<{ id: string; number: string; status: string }>(
        'invoices',
        invoiceId,
        patch,
      );
      if (!row) return fail(`No invoice with id ${invoiceId}.`);
      return text({
        updated: 'invoice',
        id: row.id,
        number: row.number,
        status: row.status,
        changed: Object.keys(patch),
      });
    }

    case 'delete_invoice': {
      const invoiceId = String(args.invoiceId ?? '');
      const gone = await pgDelete('invoices', invoiceId);
      if (!gone) return fail(`No invoice with id ${invoiceId}.`);
      return text({ deleted: 'invoice', id: invoiceId });
    }

    /* -------------------------- clients & packages ----------------------- */

    case 'update_client': {
      const clientId = String(args.clientId ?? '');
      const patch = pick(args, [
        'name',
        'contactName',
        'email',
        'phone',
        'location',
        'industry',
        'status',
      ]);
      if (Object.keys(patch).length === 0) return fail('Nothing to change — pass a field.');

      const row = await pgUpdate<{ id: string; name: string; portalToken: string }>(
        'clients',
        clientId,
        patch,
      );
      if (!row) return fail(`No client with id ${clientId}.`);
      return text({
        updated: 'client',
        id: row.id,
        name: row.name,
        changed: Object.keys(patch),
        portalUrl: `${SITE}/portal/${row.portalToken}`,
      });
    }

    case 'update_package': {
      const packageId = String(args.packageId ?? '');
      const patch = pick(args, ['name', 'description', 'category', 'active']);

      if (Array.isArray(args.tiers)) {
        const referenced = [
          ...new Set(
            (args.tiers as PackageTier[]).map((t) => String(t.blueprintId ?? '').trim()).filter(Boolean),
          ),
        ];
        if (referenced.length) {
          const found = await pgSelect<{ id: string }>('blueprints', { select: 'id' });
          const known = new Set(found.map((b) => b.id));
          const missing = referenced.filter((id) => !known.has(id));
          if (missing.length) return fail(`No blueprint with id ${missing.join(', ')}.`);
        }
        patch.tiers = (args.tiers as PackageTier[]).map((t) => ({
          id: uid('tr'),
          name: String(t.name ?? '').trim() || 'Tier',
          tagline: String(t.tagline ?? ''),
          price: Number(t.price) || 0,
          period: String(t.period ?? 'one-off'),
          features: Array.isArray(t.features) ? t.features.map((f) => String(f)) : [],
          badge: String(t.badge ?? ''),
          accent: ACCENTS.has(String(t.accent)) ? String(t.accent) : 'plain',
          timelineDays: Number(t.timelineDays) || 28,
          blueprintId: String(t.blueprintId ?? '').trim() || undefined,
        }));
      }

      if (Object.keys(patch).length === 0) return fail('Nothing to change — pass a field.');

      const row = await pgUpdate<{ id: string; name: string }>('packages', packageId, patch);
      if (!row) return fail(`No package with id ${packageId}.`);
      return text({
        updated: 'package',
        id: row.id,
        name: row.name,
        changed: Object.keys(patch),
        editUrl: `${SITE}/admin/packages/${row.id}`,
        note: Array.isArray(args.tiers)
          ? 'Tiers replaced. Offers already sent keep their own snapshot and are unchanged.'
          : undefined,
      });
    }

    default:
      return fail(`Unknown tool: ${name}`);
  }
}

/* ------------------------------- Handler ------------------------------- */

function authorise(req: Request, url: URL): boolean {
  if (!MCP_TOKEN) return false;
  const header = req.headers.get('authorization') ?? '';
  if (header.replace(/^Bearer\s+/i, '').trim() === MCP_TOKEN) return true;
  // Clients that can't set headers put the token in the path instead.
  const last = url.pathname.split('/').filter(Boolean).pop();
  return last === MCP_TOKEN;
}

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: {
        'content-type': 'application/json',
        'access-control-allow-origin': '*',
        'access-control-allow-headers': 'authorization, content-type, mcp-protocol-version',
        'access-control-allow-methods': 'POST, GET, OPTIONS',
      },
    });

  if (req.method === 'OPTIONS') return json({}, 204);

  /*
   * OAuth discovery must 404.
   *
   * The SPA catch-all answers every unknown path with index.html and a 200,
   * so a client probing /.well-known/oauth-authorization-server sees HTML,
   * concludes there is a sign-in service, and fails trying to register with
   * it. This server authenticates with a bearer token, not OAuth, so the
   * honest answer to those probes is "no such thing here".
   */
  if (url.pathname.startsWith('/.well-known/')) {
    return json({ error: 'This server uses bearer token auth, not OAuth.' }, 404);
  }

  /*
   * A GET asking for an event stream is a client looking for the legacy
   * HTTP+SSE transport. Answering it with JSON makes the client think the
   * old transport is available and fall back to SSE/WebSocket, which this
   * server does not speak. 405 tells it to stay on Streamable HTTP (POST).
   */
  if (req.method === 'GET' && (req.headers.get('accept') ?? '').includes('text/event-stream')) {
    return new Response('Method Not Allowed — this server is POST-only (Streamable HTTP).', {
      status: 405,
      headers: { allow: 'POST', 'access-control-allow-origin': '*' },
    });
  }

  // Plain GET is a health check, deliberately before the auth gate: if the
  // token is the thing that is missing, you still need a way to see that.
  // Reports only whether each variable is present — never a value.
  if (req.method === 'GET') {
    const configured = {
      supabaseUrl: Boolean(SUPABASE_URL),
      serviceRoleKey: Boolean(SERVICE_KEY),
      mcpToken: Boolean(MCP_TOKEN),
    };
    const ready = Object.values(configured).every(Boolean);
    return json({
      name: 'packforge',
      status: ready ? 'ok' : 'misconfigured',
      configured,
      tools: ready ? TOOLS.map((t) => t.name) : [],
      hint: ready
        ? undefined
        : 'Set the missing Netlify environment variables, then redeploy.',
    });
  }

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return json({ error: 'Server is missing Supabase credentials.' }, 500);
  }
  if (!authorise(req, url)) {
    return json({ error: 'Unauthorised.' }, 401);
  }

  let body: Json;
  try {
    body = (await req.json()) as Json;
  } catch {
    return json(rpcError(null, -32700, 'Parse error'), 400);
  }

  const { id, method, params } = body as {
    id?: unknown;
    method?: string;
    params?: Json;
  };

  // Notifications expect no response body.
  if (typeof method === 'string' && method.startsWith('notifications/')) {
    return new Response(null, { status: 202 });
  }

  switch (method) {
    case 'initialize': {
      /*
       * Echo the client's protocol version. Pinning an old one made clients
       * negotiate down to the pre-Streamable-HTTP transport and then fail
       * looking for a WebSocket. This server is plain JSON-RPC over POST, so
       * any recent revision works.
       */
      const asked = (params as Json)?.protocolVersion;
      const protocolVersion =
        typeof asked === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(asked) ? asked : '2025-06-18';
      return json(
        rpcResult(id, {
          protocolVersion,
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: 'packforge', version: '1.0.0' },
        }),
      );
    }

    case 'ping':
      return json(rpcResult(id, {}));

    case 'tools/list':
      return json(rpcResult(id, { tools: TOOLS }));

    case 'tools/call': {
      const name = String((params as Json)?.name ?? '');
      const args = ((params as Json)?.arguments ?? {}) as Json;
      try {
        return json(rpcResult(id, await runTool(name, args)));
      } catch (err) {
        return json(
          rpcResult(id, fail(err instanceof Error ? err.message : 'Tool failed')),
        );
      }
    }

    default:
      return json(rpcError(id, -32601, `Method not found: ${method}`));
  }
}

export const config: Config = {
  path: [
    '/mcp',
    '/mcp/:token',
    // Claimed so the SPA catch-all cannot answer OAuth probes with HTML.
    '/.well-known/oauth-authorization-server',
    '/.well-known/oauth-authorization-server/*',
    '/.well-known/oauth-protected-resource',
    '/.well-known/oauth-protected-resource/*',
    '/.well-known/openid-configuration',
    '/.well-known/openid-configuration/*',
  ],
};
