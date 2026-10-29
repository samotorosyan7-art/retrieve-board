-- ════════════════════════════════════════════════════════════════════════════
-- 021 · @mentions in task comments
--
--   • task_comments.mentions — ids of the members a comment mentions ("@Full Name",
--     picked from the list while typing). Sent by the app with the comment.
--   • A mentioned member gets a 'mention' notification (020) — as long as they can
--     see the task and didn't write the comment. An assignee who is mentioned gets
--     only the mention, not the usual 'comment' notification as well.
--
-- Run once in Supabase → SQL Editor after 020. Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════
begin;

-- ── 1. Mentions on comments ─────────────────────────────────────────────────
alter table public.task_comments add column if not exists mentions text[] not null default '{}';
alter table public.task_comments drop constraint if exists task_comments_mentions_check;
alter table public.task_comments add constraint task_comments_mentions_check check (cardinality(mentions) <= 50);

-- ── 2. New notification kind ────────────────────────────────────────────────
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('comment', 'file', 'notes', 'mention'));

-- ── 3. Can a given member see a task? ───────────────────────────────────────
-- Same rules as can_see_task (017), but for any member rather than the signed-in one.
create or replace function public.member_can_see_task(mid text, pid text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.projects p
    join public.team_members t on t.id = mid
    where p.id = pid and (t.is_admin or (
      (not p.is_private or p.created_by = mid or p.supervisor = mid)
      and case when t.is_administration
        then coalesce(to_jsonb(p.assignees), '[]'::jsonb) ? mid or p.created_by = mid or p.supervisor = mid
        else not public.is_administration_task(to_jsonb(p.assignees))
      end)))
$$;
revoke execute on function public.member_can_see_task(text, text) from public, anon, authenticated;

-- ── 4. Comment trigger: mentions first, then the remaining assignees ────────
create or replace function public.notify_on_comment() returns trigger
language plpgsql security definer set search_path = public as $$
declare mentioned text[];
begin
  select coalesce(array_agg(distinct m), '{}') into mentioned
  from unnest(new.mentions) m
  where m is distinct from new.who and public.member_can_see_task(m, new.project_id);

  insert into public.notifications (member_id, project_id, kind, actor, detail)
  select m, new.project_id, 'mention', new.who, left(new.text, 280)
  from unnest(mentioned) m;

  insert into public.notifications (member_id, project_id, kind, actor, detail)
  select m, new.project_id, 'comment', new.who, left(new.text, 280)
  from public.task_assignees_except(new.project_id, new.who) m
  where m <> all (mentioned);
  return null;
end $$;
revoke execute on function public.notify_on_comment() from public, anon, authenticated;

commit;
