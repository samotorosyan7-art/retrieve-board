-- ════════════════════════════════════════════════════════════════════════════
-- 019 · Status history (Report) and last seen
--
--   • task_status_changes — one row each time a task's status changes (or a task
--     is created), written by a trigger: who moved it, from/to, and when. The
--     Report page reads it to list tasks moved to Completed in a date range.
--     Rows are visible to whoever can see the task (projects policies, 017).
--   • Earlier "moved … to <status>" / "sent … for supervisor review" activity
--     entries are copied in once, so there is history from before this migration.
--   • projects.status_changed_at — when the task entered its current status, set
--     by the database. Kanban shows the most recently moved tasks on top.
--   • team_last_login() only knew Supabase Auth's last_sign_in_at, which changes
--     on a password sign-in but not when a saved session is reused — someone
--     using the app daily could show "last login 4d ago". The app now records
--     when each member was last seen (touch_last_seen(), at most once a minute)
--     and team_last_login() returns the later of the two.
--
-- Run once in Supabase → SQL Editor after 018. Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════
begin;

-- ── 1. Status history ───────────────────────────────────────────────────────
create table if not exists public.task_status_changes (
  id          bigint generated always as identity primary key,
  project_id  text not null references public.projects(id) on delete cascade,
  from_status text,
  to_status   text not null,
  who         text,
  created_at  timestamptz not null default now()
);
create index if not exists task_status_changes_to_idx on public.task_status_changes (to_status, created_at desc);
create index if not exists task_status_changes_project_idx on public.task_status_changes (project_id);

alter table public.task_status_changes enable row level security;
revoke all on public.task_status_changes from anon, authenticated;
grant select on public.task_status_changes to authenticated;

-- The subquery runs under the projects policies, so private and administration tasks stay hidden here too.
drop policy if exists "members read history of visible tasks" on public.task_status_changes;
create policy "members read history of visible tasks" on public.task_status_changes for select to authenticated
  using (public.is_member() and exists (select 1 from public.projects p where p.id = project_id));

create or replace function public.log_status_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.task_status_changes (project_id, from_status, to_status, who)
    values (new.id, case when tg_op = 'UPDATE' then old.status end, new.status, public.current_member_id());
  end if;
  return null;
end $$;
revoke execute on function public.log_status_change() from public, anon, authenticated;

drop trigger if exists log_status_change on public.projects;
create trigger log_status_change after insert or update of status on public.projects
  for each row execute function public.log_status_change();

-- ── 2. Backfill: status moves already in the activity feed ──────────────────
-- Matched by title; entries whose title fits no task, or several, are skipped.
with moves as (
  select a.who, a.created_at, m[1] as title, s.id as to_status
  from public.activity a
  cross join lateral regexp_match(a.text, '^moved <b>(.*)</b> to (.*)$') m
  join (values ('intake', 'Intake'), ('inprogress', 'In Progress'), ('backlog', 'Client Input / Backlog'),
               ('review', 'Supervisor Review'), ('done', 'Completed'), ('billing', 'Billing'), ('archive', 'Archive'))
    s(id, label) on s.label = m[2]
  union all
  select a.who, a.created_at, m[1], 'review'
  from public.activity a
  cross join lateral regexp_match(a.text, '^sent <b>(.*)</b> to .* for supervisor review$') m
)
insert into public.task_status_changes (project_id, to_status, who, created_at)
select p.id, mv.to_status, mv.who, mv.created_at
from moves mv
join public.projects p on p.title = mv.title
where (select count(*) from public.projects q where q.title = p.title) = 1
  and not exists (select 1 from public.task_status_changes c
                  where c.project_id = p.id and c.to_status = mv.to_status and c.created_at = mv.created_at);

-- ── 3. When each task entered its current status ────────────────────────────
alter table public.projects add column if not exists status_changed_at timestamptz;
drop trigger if exists stamp_status_change on public.projects; -- re-created below; it would undo the backfill on a re-run
-- Existing tasks: their last recorded move into the current status, else when they were created.
update public.projects p set status_changed_at = coalesce(
  (select max(c.created_at) from public.task_status_changes c where c.project_id = p.id and c.to_status = p.status),
  p.created_at)
where p.status_changed_at is null;
alter table public.projects alter column status_changed_at set default now();

-- The app never sends this column; the database stamps it.
create or replace function public.stamp_status_change() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then new.status_changed_at := now();
  else new.status_changed_at := old.status_changed_at;
  end if;
  return new;
end $$;

create trigger stamp_status_change before insert or update on public.projects
  for each row execute function public.stamp_status_change();

-- ── 4. Last seen ────────────────────────────────────────────────────────────
create table if not exists public.member_last_seen (
  member_id text primary key references public.team_members(id) on delete cascade,
  seen_at   timestamptz not null default now()
);
-- Only reached through the functions below.
alter table public.member_last_seen enable row level security;
revoke all on public.member_last_seen from anon, authenticated;

create or replace function public.touch_last_seen() returns void
language sql volatile security definer set search_path = public as $$
  insert into public.member_last_seen (member_id, seen_at)
  select public.current_member_id(), now() where public.current_member_id() is not null
  on conflict (member_id) do update set seen_at = excluded.seen_at
    where member_last_seen.seen_at < now() - interval '1 minute'
$$;
revoke execute on function public.touch_last_seen() from public, anon;
grant execute on function public.touch_last_seen() to authenticated;

create or replace function public.team_last_login() returns table (member_id text, last_login timestamptz)
language sql stable security definer set search_path = public, auth as $$
  select t.id, greatest(max(u.last_sign_in_at), max(s.seen_at))
  from public.team_members t
  left join auth.users u on lower(u.email) = lower(t.email)
  left join public.member_last_seen s on s.member_id = t.id
  where public.is_admin()
  group by t.id
$$;

commit;
