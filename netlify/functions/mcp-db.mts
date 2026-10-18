/**
 * Minimal PostgREST client for the MCP function.
 *
 * Deliberately not @supabase/supabase-js: that constructs a realtime client
 * which needs a global WebSocket, and the function then dies on its first
 * query with a message that reads like an MCP transport fault. All this needs
 * is authenticated HTTP against PostgREST, so plain fetch is both correct and
 * a much smaller cold start.
 *
 * Uses the service-role key, so every row is reachable — row-level security
 * does not apply here. The MCP layer's own rules are what keep it safe.
 */

const URL_BASE = (process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '').replace(
  /\/+$/,
  '',
);
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

const headers = (extra: Record<string, string> = {}) => ({
  apikey: KEY,
  authorization: `Bearer ${KEY}`,
  'content-type': 'application/json',
  ...extra,
});

/** PostgREST surfaces errors as a JSON body; bubble up something readable. */
async function readError(res: Response): Promise<string> {
  const body = await res.text();
  try {
    const parsed = JSON.parse(body) as { message?: string; hint?: string };
    return parsed.message ?? parsed.hint ?? body;
  } catch {
    return body || `${res.status} ${res.statusText}`;
  }
}

export interface SelectOptions {
  /** Columns to return. Defaults to everything. */
  select?: string;
  /** Simple equality filters. */
  eq?: Record<string, string | undefined>;
  limit?: number;
}

export async function pgSelect<T = Record<string, unknown>>(
  table: string,
  options: SelectOptions = {},
): Promise<T[]> {
  const params = new URLSearchParams();
  params.set('select', options.select ?? '*');
  for (const [column, value] of Object.entries(options.eq ?? {})) {
    if (value !== undefined && value !== null && value !== '') {
      params.set(column, `eq.${value}`);
    }
  }
  if (options.limit) params.set('limit', String(options.limit));

  const res = await fetch(`${URL_BASE}/rest/v1/${encodeURIComponent(table)}?${params}`, {
    headers: headers(),
  });
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as T[];
}

/** First match, or null — the equivalent of `.maybeSingle()`. */
export async function pgFirst<T = Record<string, unknown>>(
  table: string,
  options: SelectOptions = {},
): Promise<T | null> {
  const rows = await pgSelect<T>(table, { ...options, limit: 1 });
  return rows[0] ?? null;
}

/** Insert one row and return it as stored. */
export async function pgInsert<T = Record<string, unknown>>(
  table: string,
  row: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(`${URL_BASE}/rest/v1/${encodeURIComponent(table)}`, {
    method: 'POST',
    headers: headers({ prefer: 'return=representation' }),
    body: JSON.stringify(row),
  });
  if (!res.ok) throw new Error(await readError(res));
  const rows = (await res.json()) as T[];
  return rows[0];
}

/** Row count without transferring the rows. */
export async function pgCount(table: string): Promise<number> {
  const res = await fetch(`${URL_BASE}/rest/v1/${encodeURIComponent(table)}?select=id`, {
    method: 'HEAD',
    headers: headers({ prefer: 'count=exact', range: '0-0' }),
  });
  const range = res.headers.get('content-range') ?? '';
  const total = Number(range.split('/')[1]);
  return Number.isFinite(total) ? total : 0;
}
