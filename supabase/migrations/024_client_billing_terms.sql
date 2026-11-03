-- ════════════════════════════════════════════════════════════════════════════
-- 024 · Billing terms per client
--
--   • Hourly rates move from the Billing page (typed per invoice) to the client:
--     each client can have an hourly rate, regular hours and a monthly fee, in
--     one currency.
--   • A month's time invoice = monthly fee + hours above the regular hours ×
--     hourly rate. With no regular hours / fee, every hour is billed at the rate.
--   • Kept apart from `clients` (which every member can read) so rates and fees
--     stay admin only.
--
-- Run once in Supabase → SQL Editor after 023. Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════
begin;

create table if not exists public.client_billing (
  client_id     text primary key references public.clients(id) on delete cascade,
  currency      text not null default 'AMD' check (currency in ('AMD', 'USD', 'EUR')),
  hourly_rate   numeric not null default 0 check (hourly_rate >= 0),
  regular_hours numeric not null default 0 check (regular_hours >= 0),
  monthly_fee   numeric not null default 0 check (monthly_fee >= 0),
  updated_at    timestamptz not null default now()
);

alter table public.client_billing enable row level security;
revoke all on public.client_billing from anon;
grant select, insert, update, delete on public.client_billing to authenticated;

drop policy if exists "admins manage client billing" on public.client_billing;
create policy "admins manage client billing" on public.client_billing for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

commit;
