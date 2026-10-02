-- ════════════════════════════════════════════════════════════════════════════
-- 013 · Attachments on tasks and in chat (Supabase Storage)
--
--   • Private bucket "attachments": max 5 MB per file, documents and images only.
--     Paths: tasks/<project_id>/<uuid>.<ext> and chat/<room_id>/<uuid>.<ext>.
--   • task_files lists each task's files. Anyone who can see the task sees and adds
--     them; the uploader and admins delete them.
--   • messages.attachment holds a chat message's file ({path, name, size, mime}).
--   • Storage access follows the same rules: task files need access to the task
--     (private tasks stay private), chat files need access to the room (002).
--
-- The 5 MB limit is enforced by the bucket, by task_files and by the app.
-- Run once in Supabase → SQL Editor after 012. Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════
begin;

-- ── 1. Bucket ───────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('attachments', 'attachments', false, 5242880, array[
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/rtf',
  'text/plain',
  'text/csv',
  'application/zip',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/heic'
])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ── 2. Who may read, upload and delete files in the bucket ──────────────────
-- The projects subquery runs under the projects policies (007), so a private task's
-- files are only reachable by people who can see that task.
create or replace function public.can_access_attachment(path text) returns boolean
language sql stable set search_path = public as $$
  select public.is_member() and case (storage.foldername(path))[1]
    when 'tasks' then exists (select 1 from public.projects p where p.id = (storage.foldername(path))[2])
    when 'chat'  then public.can_access_room((storage.foldername(path))[2])
    else false
  end
$$;
revoke execute on function public.can_access_attachment(text) from public, anon;
grant execute on function public.can_access_attachment(text) to authenticated;

drop policy if exists "members read attachments" on storage.objects;
drop policy if exists "members upload attachments" on storage.objects;
drop policy if exists "uploaders and admins delete attachments" on storage.objects;
create policy "members read attachments" on storage.objects for select to authenticated
  using (bucket_id = 'attachments' and public.can_access_attachment(name));
create policy "members upload attachments" on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments' and public.can_access_attachment(name));
create policy "uploaders and admins delete attachments" on storage.objects for delete to authenticated
  using (bucket_id = 'attachments' and (owner = auth.uid() or public.is_admin()));

-- ── 3. Task files ───────────────────────────────────────────────────────────
create table if not exists public.task_files (
  id         uuid primary key default gen_random_uuid(),
  project_id text not null references public.projects(id) on delete cascade,
  path       text not null unique,
  name       text not null check (length(name) between 1 and 255),
  size       integer not null check (size between 1 and 5242880),
  mime       text not null,
  who        text not null,
  created_at timestamptz not null default now(),
  check (path like 'tasks/' || project_id || '/%')
);
create index if not exists task_files_project_idx on public.task_files (project_id, created_at);

alter table public.task_files enable row level security;
revoke all on public.task_files from anon;
grant select, insert, delete on public.task_files to authenticated;

drop policy if exists "members read files on visible tasks" on public.task_files;
drop policy if exists "members add files as themselves" on public.task_files;
drop policy if exists "uploaders and admins delete files" on public.task_files;
create policy "members read files on visible tasks" on public.task_files for select to authenticated
  using (public.is_member() and exists (select 1 from public.projects p where p.id = project_id));
create policy "members add files as themselves" on public.task_files for insert to authenticated
  with check (who = public.current_member_id() and exists (select 1 from public.projects p where p.id = project_id));
create policy "uploaders and admins delete files" on public.task_files for delete to authenticated
  using (who = public.current_member_id() or public.is_admin());

do $$
begin
  alter publication supabase_realtime add table public.task_files;
exception when duplicate_object then null;
end $$;

-- ── 4. Chat attachments ─────────────────────────────────────────────────────
alter table public.messages add column if not exists attachment jsonb;
alter table public.messages drop constraint if exists messages_attachment_in_room;
alter table public.messages add constraint messages_attachment_in_room check (
  attachment is null or (
    attachment ->> 'path' like 'chat/' || room_id || '/%'
    and (attachment ->> 'size')::bigint between 1 and 5242880
  )
);

commit;
