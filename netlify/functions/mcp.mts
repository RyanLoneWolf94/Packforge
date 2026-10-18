import { pgCount, pgFirst, pgInsert, pgSelect } from './mcp-db.mts';
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
 * Safety rails that matter more than features:
 *  - Quotes are always created as drafts. A model can propose pricing; only a
 *    human sends it to a client.
 *  - Packages can be created but never sent. A model can build the catalogue;
 *    putting a package in front of a client stays a human action.
 *  - There are no delete or update tools. The worst case is a stray draft.
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
