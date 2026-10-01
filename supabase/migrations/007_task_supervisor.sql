-- ════════════════════════════════════════════════════════════════════════════
-- 007 · Task supervisor
--
--   • projects.supervisor is the team member (id) who reviews the task in
--     "Supervisor Review". Any member can set it; it's asked for whenever a
--     task is moved to that status.
--   • A private task is also visible to its supervisor, so they can review it.
--
-- Run once in Supabase → SQL Editor after 006. Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════
begin;

alter table public.projects add column if not exists supervisor text;

drop policy if exists "members read visible matters" on public.projects;
create policy "members read visible matters" on public.projects for select to authenticated
  using (public.is_member() and (not is_private or created_by = public.current_member_id()
    or supervisor = public.current_member_id() or public.is_admin()));

drop policy if exists "members update visible matters" on public.projects;
create policy "members update visible matters" on public.projects for update to authenticated
  using (public.is_member() and (not is_private or created_by = public.current_member_id()
    or supervisor = public.current_member_id() or public.is_admin()))
  with check (public.is_member());

commit;
