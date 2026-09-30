-- ════════════════════════════════════════════════════════════════════════════
-- 006 · Firm settings
--
--   • firm_settings holds one row ('firm') with the firm profile and billing
--     configuration edited in Settings: name, address, TIN, bank details,
--     VAT rate, payment terms, exchange rates. Invoices read from it.
--   • Every member can read it (invoices show it); only admins can change it.
--
-- Run once in Supabase → SQL Editor after 005. Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════
begin;

create table if not exists public.firm_settings (
  id         text primary key default 'firm' check (id = 'firm'),
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.firm_settings enable row level security;
revoke all on public.firm_settings from anon;
grant select, insert, update on public.firm_settings to authenticated;

drop policy if exists "members read firm settings" on public.firm_settings;
drop policy if exists "admins insert firm settings" on public.firm_settings;
drop policy if exists "admins update firm settings" on public.firm_settings;
create policy "members read firm settings" on public.firm_settings for select to authenticated
  using (public.is_member());
create policy "admins insert firm settings" on public.firm_settings for insert to authenticated
  with check (public.is_admin());
create policy "admins update firm settings" on public.firm_settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

insert into public.firm_settings (id) values ('firm') on conflict (id) do nothing;

commit;
