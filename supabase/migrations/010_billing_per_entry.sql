-- ════════════════════════════════════════════════════════════════════════════
-- 010 · Invoices are chosen per time entry, not per task
--
--   • Drops projects.billable from 009. Each billable time entry now has an "inInvoice"
--     flag inside time_logs instead (no schema change). Only admins edit existing entries
--     (migration 003), so only they choose what goes on an invoice.
--   • Keeps the 009 rename rule: admins rename any task; members only tasks they created.
--
-- The app enforces the same rule in the UI; this stops it being bypassed via the API.
-- Run once in Supabase → SQL Editor after 009 (or instead of it, if 009 never ran). Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════
begin;

drop trigger if exists enforce_title_and_billing_rules on public.projects;
drop function if exists public.enforce_title_and_billing_rules();
alter table public.projects drop column if exists billable;

create or replace function public.enforce_title_rules() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin()
     and new.title is distinct from old.title
     and old.created_by is distinct from public.current_member_id() then
    raise exception 'Only admins and the person who created this task can rename it.' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists enforce_title_rules on public.projects;
create trigger enforce_title_rules before update on public.projects
  for each row execute function public.enforce_title_rules();

commit;
