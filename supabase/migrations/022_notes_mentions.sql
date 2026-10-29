-- ════════════════════════════════════════════════════════════════════════════
-- 022 · @mentions in task notes
--
--   • projects.notes_mentions — ids of the members the notes mention ("@Full Name",
--     picked from the list while typing). Sent by the app with the notes.
--   • A member newly mentioned by a save — in the new list but not the old one —
--     gets a 'notes_mention' notification (020), as long as they can see the task
--     (member_can_see_task, 021) and didn't make the edit. Saving again doesn't
--     notify the members who were already mentioned.
--   • An assignee who is newly mentioned gets only the mention, not the usual
--     'notes' notification as well.
--
-- Run once in Supabase → SQL Editor after 021. Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════
begin;

-- ── 1. Mentions on notes ────────────────────────────────────────────────────
alter table public.projects add column if not exists notes_mentions text[] not null default '{}';
alter table public.projects drop constraint if exists projects_notes_mentions_check;
alter table public.projects add constraint projects_notes_mentions_check check (cardinality(notes_mentions) <= 50);

-- ── 2. New notification kind ────────────────────────────────────────────────
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('comment', 'file', 'notes', 'mention', 'notes_mention'));

-- ── 3. Notes trigger: new mentions first, then the remaining assignees ──────
create or replace function public.notify_on_notes() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  me text := public.current_member_id();
  mentioned text[];
begin
  select coalesce(array_agg(distinct m), '{}') into mentioned
  from unnest(new.notes_mentions) m
  where m is distinct from me and m <> all (old.notes_mentions) and public.member_can_see_task(m, new.id);

  insert into public.notifications (member_id, project_id, kind, actor, detail)
  select m, new.id, 'notes_mention', me, left(new.notes, 280)
  from unnest(mentioned) m;

  if new.notes is distinct from old.notes and coalesce(btrim(new.notes), '') <> '' then
    insert into public.notifications (member_id, project_id, kind, actor, detail)
    select m, new.id, 'notes', me, left(new.notes, 280)
    from public.task_assignees_except(new.id, me) m
    where m <> all (mentioned)
    on conflict (member_id, project_id) where kind = 'notes' and seen_at is null
    do update set actor = excluded.actor, detail = excluded.detail, created_at = now();
  end if;
  return null;
end $$;
revoke execute on function public.notify_on_notes() from public, anon, authenticated;

drop trigger if exists notify_on_notes on public.projects;
create trigger notify_on_notes after update of notes, notes_mentions on public.projects
  for each row execute function public.notify_on_notes();

commit;
