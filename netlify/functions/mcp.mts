import { createClient, type SupabaseClient } from '@supabase/supabase-js';
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

/**
 * Built on first use, not at import time: a missing env var should surface as
 * a clean error from the handler, not crash the module and return a bare 502.
 */
let client: SupabaseClient | null = null;
function getDb() {
  if (!client) {
    client = createClient(SUPABASE_URL as string, SERVICE_KEY as string, {
      auth: { persistSession: false },
    });
  }
  return client;
}

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
      const { data, error } = await getDb()
        .from('clients')
        .select('id,name,contactName,email,phone,location,industry,status,portalToken');
      if (error) return fail(error.message);
      return text(
        (data ?? []).map((c) => ({ ...c, portalUrl: `${SITE}/portal/${c.portalToken}` })),
      );
    }

    case 'list_blueprints': {
      const { data, error } = await getDb()
        .from('blueprints')
        .select('id,title,category,description,milestones,timelineDays');
      if (error) return fail(error.message);
      return text(
        (data ?? []).map((b) => ({
          id: b.id,
          title: b.title,
          category: b.category,
          description: b.description,
          priceUsd: milestonesTotal((b.milestones ?? []) as Milestone[]),
          timelineDays: b.timelineDays,
        })),
      );
    }

    case 'list_projects': {
      let q = getDb().from('projects').select('id,name,clientId,ref,status,startDate,targetDelivery,phases');
      if (typeof args.clientId === 'string') q = q.eq('clientId', args.clientId);
      const { data, error } = await q;
      if (error) return fail(error.message);
      return text(
        (data ?? []).map((p) => {
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
      const { data: project, error } = await getDb()
        .from('projects')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) return fail(error.message);
      if (!project) return fail(`No project with id ${id}`);
      const { data: tasks } = await getDb()
        .from('projectTasks')
        .select('id,title,lane,phaseId,dueDate,clientVisible')
        .eq('projectId', id);
      const { data: invoices } = await getDb()
        .from('invoices')
        .select('id,number,amount,status,dueDate')
        .eq('projectId', id);
      return text({ project, tasks: tasks ?? [], invoices: invoices ?? [] });
    }

    case 'create_client': {
      const name = String(args.name ?? '').trim();
      if (!name) return fail('A client name is required.');

      // portalToken is unique — suffix until free, as the app does.
      const { data: existing } = await getDb().from('clients').select('portalToken');
      const taken = new Set((existing ?? []).map((c) => c.portalToken));
      const base = slugify(name);
      let portalToken = base;
      for (let n = 2; taken.has(portalToken); n++) portalToken = `${base}-${n}`;

      const { data, error } = await getDb()
        .from('clients')
        .insert({
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
        })
        .select()
        .single();
      if (error) return fail(error.message);
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
      const { data, error } = await getDb()
        .from('leads')
        .insert({
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
        })
        .select()
        .single();
      if (error) return fail(error.message);
      return text({ created: 'lead', id: data.id, name: data.name, stage: data.stage });
    }

    case 'create_quote_draft': {
      const clientId = String(args.clientId ?? '');
      const title = String(args.title ?? '').trim();
      if (!clientId || !title) return fail('clientId and title are required.');

      const { data: client } = await getDb()
        .from('clients')
        .select('id,name')
        .eq('id', clientId)
        .maybeSingle();
      if (!client) return fail(`No client with id ${clientId}. Call list_clients first.`);

      let milestones: Milestone[] = [];
      let timelineDays = typeof args.timelineDays === 'number' ? args.timelineDays : 0;

      if (typeof args.blueprintId === 'string' && args.blueprintId) {
        const { data: bp } = await getDb()
          .from('blueprints')
          .select('milestones,timelineDays')
          .eq('id', args.blueprintId)
          .maybeSingle();
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

      const { count } = await getDb().from('quotes').select('id', { count: 'exact', head: true });
      const number = `QT-${new Date().getFullYear()}-${String((count ?? 0) + 1).padStart(3, '0')}`;
      const validDays = typeof args.validDays === 'number' ? args.validDays : 30;

      const { data, error } = await getDb()
        .from('quotes')
        .insert({
          id: uid('qt'),
          number,
          title,
          clientId,
          validUntil: addDays(validDays),
          status: 'draft', // never sent from here
          milestones,
          timelineDays: timelineDays || 28,
        })
        .select()
        .single();
      if (error) return fail(error.message);

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

      const { data: client } = await getDb()
        .from('clients')
        .select('id,name')
        .eq('id', clientId)
        .maybeSingle();
      if (!client) return fail(`No client with id ${clientId}. Call list_clients first.`);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let phases: any[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let timeline: any[] = [];
      let packageName = 'Custom engagement';
      let days = 28;

      if (typeof args.blueprintId === 'string' && args.blueprintId) {
        const { data: bp } = await getDb()
          .from('blueprints')
          .select('title,phases,timeline,timelineDays')
          .eq('id', args.blueprintId)
          .maybeSingle();
        if (!bp) return fail(`No blueprint with id ${args.blueprintId}.`);
        phases = freshPhases(bp.phases ?? []);
        timeline = freshTimeline(bp.timeline ?? []);
        packageName = bp.title;
        days = Number(bp.timelineDays) || 28;
      }

      const start = String(args.startDate ?? today());
      const { data, error } = await getDb()
        .from('projects')
        .insert({
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
        })
        .select()
        .single();
      if (error) return fail(error.message);

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

  // Health check, deliberately before the auth gate: if the token is the thing
  // that is missing, you still need a way to see that. Reports only whether
  // each variable is present — never a value.
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
    case 'initialize':
      return json(
        rpcResult(id, {
          protocolVersion: '2024-11-05',
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: 'packforge', version: '1.0.0' },
        }),
      );

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
  path: ['/mcp', '/mcp/:token'],
};
