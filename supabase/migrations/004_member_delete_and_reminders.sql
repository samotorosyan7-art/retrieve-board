-- ════════════════════════════════════════════════════════════════════════════
-- 004 · Members delete their own tasks · deadline reminder bookkeeping
--
--   • Admins delete any task; members delete only tasks they created.
--   • projects.due_reminder_sent remembers which due date a "due within 48h" email
--     was sent for, so each deadline is reminded once (and again if the date moves).
--
-- Run once in Supabase → SQL Editor after 003. Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════
begin;

drop policy if exists "admins delete matters" on public.projects;
drop policy if exists "admins or creators delete matters" on public.projects;
create policy "admins or creators delete matters" on public.projects for delete to authenticated
  using (public.is_admin() or (public.is_member() and created_by = public.current_member_id()));

alter table public.projects add column if not exists due_reminder_sent date;

commit;
