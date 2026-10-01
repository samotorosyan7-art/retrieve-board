-- ════════════════════════════════════════════════════════════════════════════
-- 011 · Due time, task comments, last login
--
--   • projects.due_time — optional time of day ('HH:MM', firm time) for the due date.
--   • task_comments — comments on a task. Anyone who can see the task reads and adds
--     them (as themselves); authors and admins delete them.
--   • team_last_login() — when each member last signed in (from Supabase Auth).
--     Admins only; shown in the dashboard's Team Utilisation.
--
-- Run once in Supabase → SQL Editor after 010. Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════
begin;

-- ── 1. Due time ─────────────────────────────────────────────────────────────
alter table public.projects add column if not exists due_time text;

-- ── 2. Task comments ────────────────────────────────────────────────────────
create table if not exists public.task_comments (
  id         uuid primary key default gen_random_uuid(),
  project_id text not null references public.projects(id) on delete cascade,
  who        text not null,
  text       text not null check (length(text) between 1 and 5000),
  created_at timestamptz not null default now()
);
create index if not exists task_comments_project_idx on public.task_comments (project_id, created_at);

alter table public.task_comments enable row level security;
revoke all on public.task_comments from anon;
grant select, insert, delete on public.task_comments to authenticated;

-- The subqueries run under the projects policies (007), so private tasks stay private here too.
drop policy if exists "members read comments on visible tasks" on public.task_comments;
drop policy if exists "members comment as themselves" on public.task_comments;
drop policy if exists "authors and admins delete comments" on public.task_comments;
create policy "members read comments on visible tasks" on public.task_comments for select to authenticated
  using (public.is_member() and exists (select 1 from public.projects p where p.id = project_id));
create policy "members comment as themselves" on public.task_comments for insert to authenticated
  with check (who = public.current_member_id() and exists (select 1 from public.projects p where p.id = project_id));
create policy "authors and admins delete comments" on public.task_comments for delete to authenticated
  using (who = public.current_member_id() or public.is_admin());

do $$
begin
  alter publication supabase_realtime add table public.task_comments;
exception when duplicate_object then null;
end $$;

-- ── 3. Last login ───────────────────────────────────────────────────────────
create or replace function public.team_last_login() returns table (member_id text, last_login timestamptz)
language sql stable security definer set search_path = public, auth as $$
  select t.id, max(u.last_sign_in_at)
  from public.team_members t
  join auth.users u on lower(u.email) = lower(t.email)
  where public.is_admin()
  group by t.id
$$;

revoke execute on function public.team_last_login() from public, anon;
grant execute on function public.team_last_login() to authenticated;

commit;
