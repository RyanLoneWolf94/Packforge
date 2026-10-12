-- Packforge — organise tasks into phases, real file uploads, drop demo files
-- Paste into Supabase → SQL Editor → Run. Safe to run more than once.

-- ============================================================
-- 1. Tasks can belong to a phase
-- ============================================================
-- Phases live inside projects.phases (jsonb), so this is a plain id reference
-- rather than a foreign key. Null means "not yet organised into a phase",
-- which is where every existing task starts.
alter table public."projectTasks"
  add column if not exists "phaseId" text;

-- ============================================================
-- 2. Files uploaded from your computer
-- ============================================================
-- Where the object lives in storage, so a file can be re-signed or deleted
-- properly. External links (Drive etc.) keep using `url` with no storagePath.
alter table public.files
  add column if not exists "storagePath" text;

-- Private bucket: nothing is world-readable. The app mints a long-lived
-- signed URL at upload time and stores it on the file record, which is what
-- the client portal opens.
insert into storage.buckets (id, name, public, file_size_limit)
values ('project-files', 'project-files', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = 52428800;

-- Only allow-listed studio admins touch the bucket. Clients never hit storage
-- directly — they follow the signed URL on the file record.
drop policy if exists "packforge admins read files"   on storage.objects;
drop policy if exists "packforge admins write files"  on storage.objects;
drop policy if exists "packforge admins update files" on storage.objects;
drop policy if exists "packforge admins delete files" on storage.objects;

create policy "packforge admins read files" on storage.objects for select to authenticated
  using (
    bucket_id = 'project-files'
    and (select auth.jwt() ->> 'email') in (select email from public.app_admins)
  );

create policy "packforge admins write files" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'project-files'
    and (select auth.jwt() ->> 'email') in (select email from public.app_admins)
  );

create policy "packforge admins update files" on storage.objects for update to authenticated
  using (
    bucket_id = 'project-files'
    and (select auth.jwt() ->> 'email') in (select email from public.app_admins)
  );

create policy "packforge admins delete files" on storage.objects for delete to authenticated
  using (
    bucket_id = 'project-files'
    and (select auth.jwt() ->> 'email') in (select email from public.app_admins)
  );

-- ============================================================
-- 3. Remove the seeded demo files
-- ============================================================
-- Only the originals shipped with the demo (ids fl-1 … fl-7). Anything you
-- have added since is untouched.
delete from public.files where id like 'fl-%';

-- ============================================================
-- 4. Check
-- ============================================================
select
  (select count(*) from public.files)                                as files_remaining,
  (select count(*) from storage.buckets where id = 'project-files')  as bucket_ready,
  (select count(*) from information_schema.columns
     where table_name = 'projectTasks' and column_name = 'phaseId')  as phase_column_ready;
