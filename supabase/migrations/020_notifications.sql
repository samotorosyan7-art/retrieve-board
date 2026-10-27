-- ════════════════════════════════════════════════════════════════════════════
-- 020 · Notifications for assignees
--
--   • notifications — one row per member per event on a task they're assigned
--     to, made by someone else: a new comment, a new attached file, or changed
--     notes. Written by triggers; the app never inserts them.
--   • Repeated notes edits don't pile up: while a member hasn't seen the notes
--     notification for a task, later edits update that one row instead.
--   • Each member reads only their own, and marks them seen through
--     mark_notifications_seen() (some ids, or all when called without any).
--   • Live: a new or updated notification broadcasts { table, op, id } on the
--     member's own private channel 'live:member:<id>' (same pattern as 018).
--
-- Run once in Supabase → SQL Editor after 019. Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════
begin;

-- ── 1. Table ────────────────────────────────────────────────────────────────
create table if not exists public.notifications (
  id         bigint generated always as identity primary key,
  member_id  text not null references public.team_members(id) on delete cascade,
  project_id text not null references public.projects(id) on delete cascade,
  kind       text not null check (kind in ('comment', 'file', 'notes')),
  actor      text,
  detail     text not null default '',
  created_at timestamptz not null default now(),
  seen_at    timestamptz
);
create index if not exists notifications_member_idx on public.notifications (member_id, created_at desc);
create unique index if not exists notifications_unseen_notes_idx on public.notifications (member_id, project_id)
  where kind = 'notes' and seen_at is null;

alter table public.notifications enable row level security;
revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;

drop policy if exists "members read own notifications" on public.notifications;
create policy "members read own notifications" on public.notifications for select to authenticated
  using (member_id = public.current_member_id());

-- ── 2. Mark seen ────────────────────────────────────────────────────────────
create or replace function public.mark_notifications_seen(ids bigint[] default null) returns void
language sql volatile security definer set search_path = public as $$
  update public.notifications set seen_at = now()
  where member_id = public.current_member_id() and seen_at is null and (ids is null or id = any(ids))
$$;
revoke execute on function public.mark_notifications_seen(bigint[]) from public, anon;
grant execute on function public.mark_notifications_seen(bigint[]) to authenticated;

-- ── 3. Triggers: who gets notified ──────────────────────────────────────────
-- Everyone assigned to the task except the person who did it.
create or replace function public.task_assignees_except(pid text, actor text) returns setof text
language sql stable security definer set search_path = public as $$
  select a from public.projects p
  cross join lateral jsonb_array_elements_text(coalesce(to_jsonb(p.assignees), '[]'::jsonb)) a
  where p.id = pid and a is distinct from actor and exists (select 1 from public.team_members t where t.id = a)
$$;
revoke execute on function public.task_assignees_except(text, text) from public, anon, authenticated;

create or replace function public.notify_on_comment() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (member_id, project_id, kind, actor, detail)
  select m, new.project_id, 'comment', new.who, left(new.text, 280)
  from public.task_assignees_except(new.project_id, new.who) m;
  return null;
end $$;
revoke execute on function public.notify_on_comment() from public, anon, authenticated;

create or replace function public.notify_on_file() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (member_id, project_id, kind, actor, detail)
  select m, new.project_id, 'file', new.who, new.name
  from public.task_assignees_except(new.project_id, new.who) m;
  return null;
end $$;
revoke execute on function public.notify_on_file() from public, anon, authenticated;

create or replace function public.notify_on_notes() returns trigger
language plpgsql security definer set search_path = public as $$
declare me text := public.current_member_id();
begin
  if new.notes is distinct from old.notes and coalesce(btrim(new.notes), '') <> '' then
    insert into public.notifications (member_id, project_id, kind, actor, detail)
    select m, new.id, 'notes', me, left(new.notes, 280)
    from public.task_assignees_except(new.id, me) m
    on conflict (member_id, project_id) where kind = 'notes' and seen_at is null
    do update set actor = excluded.actor, detail = excluded.detail, created_at = now();
  end if;
  return null;
end $$;
revoke execute on function public.notify_on_notes() from public, anon, authenticated;

drop trigger if exists notify_on_comment on public.task_comments;
create trigger notify_on_comment after insert on public.task_comments
  for each row execute function public.notify_on_comment();
drop trigger if exists notify_on_file on public.task_files;
create trigger notify_on_file after insert on public.task_files
  for each row execute function public.notify_on_file();
drop trigger if exists notify_on_notes on public.projects;
create trigger notify_on_notes after update of notes on public.projects
  for each row execute function public.notify_on_notes();

-- ── 4. Live: each member's own channel ──────────────────────────────────────
create or replace function public.broadcast_notification() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform realtime.send(jsonb_build_object('table', 'notifications', 'op', tg_op, 'id', new.id),
    'change', 'live:member:' || new.member_id, true);
  return null;
end $$;
revoke execute on function public.broadcast_notification() from public, anon, authenticated;

drop trigger if exists live_broadcast on public.notifications;
create trigger live_broadcast after insert or update on public.notifications
  for each row execute function public.broadcast_notification();

drop policy if exists "members receive own notifications" on realtime.messages;
create policy "members receive own notifications" on realtime.messages for select to authenticated
  using (realtime.topic() = 'live:member:' || public.current_member_id()
    and realtime.messages.extension = 'broadcast');

commit;
