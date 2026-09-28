-- Adds matter type + privacy fields to projects. Run once in Supabase → SQL Editor.
-- The app works without this (values are kept per-browser), but they won't be shared until it runs.
alter table public.projects add column if not exists matter_type text;
alter table public.projects add column if not exists is_private  boolean not null default false;
alter table public.projects add column if not exists created_by  text;
