-- ════════════════════════════════════════════════════════════════════════════
-- 009 · Task titles and billing inclusion
--
--   • projects.billable — whether the task's billable time goes to Billing & Invoices.
--     Defaults to true; only admins change it.
--   • Admins rename any task; members only tasks they created.
--   • Each time entry carries "billable" (true/false) in time_logs; entries without
--     it (logged before this migration) count as billable.
--
-- The app enforces the same rules in the UI; this stops them being bypassed via the API.
-- Run once in Supabase → SQL Editor after 008. Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════
begin;

alter table public.projects add column if not exists billable boolean not null default true;

create or replace function public.enforce_title_and_billing_rules() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() then return new; end if;

  if tg_op = 'INSERT' then
    if not new.billable then
      raise exception 'Only admins can exclude a task from billing.' using errcode = '42501';
    end if;
    return new;
  end if;

  if new.title is distinct from old.title and old.created_by is distinct from public.current_member_id() then
    raise exception 'Only admins and the person who created this task can rename it.' using errcode = '42501';
  end if;

  if new.billable is distinct from old.billable then
    raise exception 'Only admins can choose which tasks are billed.' using errcode = '42501';
  end if;

  return new;
end $$;

drop trigger if exists enforce_title_and_billing_rules on public.projects;
create trigger enforce_title_and_billing_rules before insert or update on public.projects
  for each row execute function public.enforce_title_and_billing_rules();

commit;
