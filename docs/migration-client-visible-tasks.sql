-- Packforge — let clients see the task board
-- Paste into Supabase → SQL Editor → Run. Safe to run more than once.
--
-- Tasks were studio-internal by design, which is why nothing from the Kanban
-- ever reached the portal. This makes them client-visible by default, with a
-- per-task switch so scratch work can still be kept private — the same pattern
-- files already use.

-- 1. Per-task visibility. Defaults to true so existing boards show up at once.
alter table public."projectTasks"
  add column if not exists "clientVisible" boolean not null default true;

-- 2. The portal snapshot gains a `tasks` key: only tasks belonging to this
--    client's non-archived projects, and only those marked visible. Anonymous
--    visitors still have no direct table access — this RPC stays the only path.
create or replace function public.portal_snapshot(p_token text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select case when c.id is null then null else jsonb_build_object(
    'client',    to_jsonb(c),
    'projects',  coalesce((select jsonb_agg(to_jsonb(p))  from projects  p  where p."clientId"  = c.id and p.status <> 'archived'), '[]'::jsonb),
    'invoices',  coalesce((select jsonb_agg(to_jsonb(i))  from invoices  i  where i."clientId"  = c.id), '[]'::jsonb),
    'quotes',    coalesce((select jsonb_agg(to_jsonb(q))  from quotes    q  where q."clientId"  = c.id), '[]'::jsonb),
    'contracts', coalesce((select jsonb_agg(to_jsonb(ct)) from contracts ct where ct."clientId" = c.id), '[]'::jsonb),
    'files',     coalesce((select jsonb_agg(to_jsonb(f))  from files     f  where f."clientId"  = c.id and f."sharedWithClient" = true), '[]'::jsonb),
    'tasks',     coalesce((
                   select jsonb_agg(to_jsonb(t) order by t."sortOrder")
                   from "projectTasks" t
                   join projects p2 on p2.id = t."projectId"
                   where p2."clientId" = c.id
                     and p2.status <> 'archived'
                     and t."clientVisible" = true
                 ), '[]'::jsonb),
    'settings',  (select to_jsonb(s) from settings s limit 1)
  ) end
  from clients c
  where c."portalToken" = p_token;
$$;

revoke all on function public.portal_snapshot(text) from public;
grant execute on function public.portal_snapshot(text) to anon, authenticated;

-- 3. Sanity check — should list the Cakes & Bakes board.
select jsonb_array_length(public.portal_snapshot('cakes-and-bakes') -> 'tasks') as visible_tasks;
