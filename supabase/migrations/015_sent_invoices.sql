-- ════════════════════════════════════════════════════════════════════════════
-- 015 · Sent invoices
--
--   • Every invoice emailed from Billing & Invoices is saved here exactly as it was
--     sent (the invoice and the firm details at that moment), so it can be viewed
--     and sent again later with the same content.
--   • sends lists each email: [{ "to", "at", "by" }], newest last.
--   • Admins only (Billing & Invoices is admin-only).
--
-- Run once in Supabase → SQL Editor after 014. Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════
begin;

create table if not exists public.invoices (
  id         uuid primary key default gen_random_uuid(),
  inv_num    text not null,
  client     text not null,
  kind       text not null check (kind in ('time', 'amount')),
  currency   text not null,
  total      numeric not null default 0,
  doc        jsonb not null,
  firm       jsonb not null,
  sends      jsonb not null default '[]'::jsonb,
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists invoices_created_idx on public.invoices (created_at desc);

alter table public.invoices enable row level security;
revoke all on public.invoices from anon;
grant select, insert, update on public.invoices to authenticated;

drop policy if exists "admins manage invoices" on public.invoices;
create policy "admins manage invoices" on public.invoices for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

commit;
