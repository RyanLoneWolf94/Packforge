/**
 * One-off: emit INSERT SQL for the whole SEED dataset so it can be loaded into
 * the Packforge Supabase project via the DB owner (bypassing RLS). Run with:
 *   npx tsx scripts/gen-seed-sql.mts > scripts/seed.generated.sql
 *
 * Column names in the schema are quoted camelCase matching src/types.ts, so a
 * row's own keys are the column list — no field mapping needed.
 */
import { SEED } from '../src/data/seed';

/** Collection key -> physical table name (identical; camelCase ones are quoted). */
const TABLES: { key: keyof typeof SEED; table: string }[] = [
  { key: 'clients', table: 'clients' },
  { key: 'projects', table: 'projects' },
  { key: 'invoices', table: 'invoices' },
  { key: 'quotes', table: 'quotes' },
  { key: 'contracts', table: 'contracts' },
  { key: 'files', table: 'files' },
  { key: 'expenses', table: 'expenses' },
  { key: 'leads', table: 'leads' },
  { key: 'team', table: 'team' },
  { key: 'timeEntries', table: 'timeEntries' },
  { key: 'emailTemplates', table: 'emailTemplates' },
  { key: 'campaigns', table: 'campaigns' },
  { key: 'newsletters', table: 'newsletters' },
];

function sqlValue(v: unknown): string {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'string') return `'${v.replace(/'/g, "''")}'`;
  // object / array -> jsonb literal
  return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
}

function ident(name: string): string {
  return `"${name}"`;
}

function insertRows(table: string, rows: Record<string, unknown>[]): string {
  if (!rows.length) return `-- ${table}: (no rows)\n`;
  // Union of keys across all rows: an optional field missing on the first row
  // (brandSnapshot, archived, signedBy, …) must still become a column.
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const colList = cols.map(ident).join(', ');
  const valueLists = rows
    .map((r) => `  (${cols.map((c) => sqlValue(r[c])).join(', ')})`)
    .join(',\n');
  return `insert into public.${ident(table)} (${colList}) values\n${valueLists};\n`;
}

const out: string[] = [];
out.push('-- Generated seed data for Packforge. Applied via DB owner (bypasses RLS).');
out.push('begin;');

// Order matters for FKs: clients & projects before their dependents. The TABLES
// order already places clients first and projects second.
for (const { key, table } of TABLES) {
  const rows = SEED[key] as unknown as Record<string, unknown>[];
  out.push(insertRows(table, rows));
}

// Settings is a single pinned row.
const s = SEED.settings as unknown as Record<string, unknown>;
const settingsRow = { id: 'studio', ...s };
out.push(insertRows('settings', [settingsRow]));

out.push('commit;');
console.log(out.join('\n'));
