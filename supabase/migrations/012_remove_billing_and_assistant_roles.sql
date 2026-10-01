-- ════════════════════════════════════════════════════════════════════════════
-- 012 · Remove the "Billing access" and "Admin Assistant" roles
--
--   • Access levels are now just Member and Admin. Billing (the Billing chat room,
--     Billing & Invoices) is for admins only.
--   • Members who had Billing access or Admin Assistant become plain members.
--   • The columns stay (older app versions still send them) but always follow is_admin.
--
-- Run once in Supabase → SQL Editor after 011. Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════
begin;

update public.team_members set is_billing = is_admin, is_assistant = false
where is_billing is distinct from is_admin or is_assistant;

-- Used by the Billing chat room policy (can_access_room, migration 002).
create or replace function public.is_billing() returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin()
$$;

commit;
