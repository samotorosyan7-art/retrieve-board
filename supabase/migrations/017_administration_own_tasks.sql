-- ════════════════════════════════════════════════════════════════════════════
-- 017 · Administration members see only their own tasks
--
--   • An Administration member (016) sees a task only if it's assigned to them,
--     they created it, or they supervise it — not the rest of the board.
--   • Members still don't see tasks assigned to Administration; admins see everything.
--   • Private tasks keep their rules from 007.
--   • Activity feed: Administration members see only entries they wrote and entries
--     about administration tasks, so other tasks' titles don't reach them.
--
-- Run once in Supabase → SQL Editor after 016. Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════
begin;

-- Can the current member see a task with these fields? (visibility rules from 007 + 016 + 017)
create or replace function public.can_see_task(assignees jsonb, is_private boolean, created_by text, supervisor text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_member()
    and (public.is_admin() or (
      (not is_private or created_by = public.current_member_id() or supervisor = public.current_member_id())
      and case when public.is_administration()
        then coalesce(assignees, '[]'::jsonb) ? public.current_member_id()
          or created_by = public.current_member_id() or supervisor = public.current_member_id()
        else not public.is_administration_task(assignees)
      end))
$$;
revoke execute on function public.can_see_task(jsonb, boolean, text, text) from public, anon;
grant execute on function public.can_see_task(jsonb, boolean, text, text) to authenticated;

drop policy if exists "members read visible matters" on public.projects;
create policy "members read visible matters" on public.projects for select to authenticated
  using (public.can_see_task(to_jsonb(assignees), is_private, created_by, supervisor));

drop policy if exists "members update visible matters" on public.projects;
create policy "members update visible matters" on public.projects for update to authenticated
  using (public.can_see_task(to_jsonb(assignees), is_private, created_by, supervisor))
  with check (public.is_member());

drop policy if exists "members read activity" on public.activity;
create policy "members read activity" on public.activity for select to authenticated
  using (public.is_member() and (public.is_admin()
    or (public.is_administration() and (restricted or who = public.current_member_id()))
    or (not public.is_administration() and not restricted)));

commit;
