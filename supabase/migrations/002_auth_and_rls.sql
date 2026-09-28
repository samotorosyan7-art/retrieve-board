-- ════════════════════════════════════════════════════════════════════════════
-- 002 · Supabase Auth + row-level security
--
-- After this runs, the database only answers signed-in team members.
-- The public (anon) key alone can no longer read or change anything.
--
-- Run once in Supabase → SQL Editor. Deploy the matching app version at the
-- same time: the old HTML page and older builds stop working after this.
-- Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════
begin;

-- ── 0. Columns from 001 (in case it wasn't run) ─────────────────────────────
alter table public.projects add column if not exists matter_type text;
alter table public.projects add column if not exists is_private  boolean not null default false;
alter table public.projects add column if not exists created_by  text;

-- ── 1. Team members (replaces the hard-coded list in the app) ───────────────
create table if not exists public.team_members (
  id           text primary key,
  name         text not null,
  init         text not null default '',
  role         text not null default '',
  color        text not null default '#7C6FF7',
  rate         numeric not null default 0,
  img          text not null default '',
  email        text not null unique,          -- must equal the person's Supabase Auth login email
  is_admin     boolean not null default false,
  is_billing   boolean not null default false,
  is_assistant boolean not null default false,
  created_at   timestamptz not null default now()
);

insert into public.team_members (id, name, init, role, color, img, email, is_admin, is_billing) values
  ('mh', 'Michael Hovhannesyan', 'MH', 'Senior Partner',   '#1B4F72', 'https://wp.retrieve.am/wp-content/uploads/2019/02/Maykl-scaled.jpg',              'michael@retrieve.am', true,  true),
  ('fh', 'Feliks Hovakimyan',    'FH', 'Managing Partner', '#C8A951', 'https://wp.retrieve.am/wp-content/uploads/2019/02/Feliks-Hovakimyan-scaled.jpg', 'feliks@retrieve.am',  true,  true),
  ('vs', 'Vache Simonyan',       'VS', 'Partner',          '#2E6DA4', 'https://wp.retrieve.am/wp-content/uploads/2019/02/Vache-Simonyan-scaled.jpg',    'vache@retrieve.am',   false, false),
  ('ln', 'Lia Nikoghosyan',      'LN', 'Senior Associate', '#3498DB', '', 'lia@retrieve.am',     false, false),
  ('md', 'Mariam Dovlatyan',     'MD', 'Senior Associate', '#5BA3D9', '', 'mariam@retrieve.am',  false, false),
  ('lp', 'Larisa Petrosyan',     'LP', 'Associate',        '#2980B9', '', 'larisa@retrieve.am',  false, false),
  ('ap', 'Anahit Petrosyan',     'AP', 'Associate',        '#7FB3D3', '', 'anahit@retrieve.am',  false, false),
  ('mn', 'Meline Nadaryan',      'MN', 'Associate',        '#2874A6', '', 'meline@retrieve.am',  false, false),
  ('pk', 'Papin Karapetyan',     'PK', 'Associate',        '#5499C7', '', 'papin@retrieve.am',   false, false)
on conflict (id) do nothing;

-- ── 2. Helpers used by the policies ─────────────────────────────────────────
-- security definer: policies can look up team_members without recursing into its own RLS.
create or replace function public.current_member_id() returns text
language sql stable security definer set search_path = public as $$
  select id from public.team_members where lower(email) = lower(auth.jwt() ->> 'email') limit 1
$$;

create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select public.current_member_id() is not null
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.team_members where id = public.current_member_id() and is_admin)
$$;

create or replace function public.is_billing() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.team_members where id = public.current_member_id() and (is_admin or is_billing))
$$;

-- Can the current member see this chat room? DMs are 'dm_<idA>__<idB>' (ids sorted).
create or replace function public.can_access_room(room text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_member() and case
    when room like 'dm\_%' then public.current_member_id() = any (string_to_array(substr(room, 4), '__'))
    when room = 'billing'  then public.is_billing()
    else true
  end
$$;

revoke execute on function public.current_member_id(), public.is_member(), public.is_admin(),
  public.is_billing(), public.can_access_room(text) from public, anon;
grant execute on function public.current_member_id(), public.is_member(), public.is_admin(),
  public.is_billing(), public.can_access_room(text) to authenticated;

-- ── 3. Direct messages: one shared room per pair ────────────────────────────
-- Old rooms were 'dm_<recipient>', so the two people in a DM were looking at different rooms.
update public.messages
set room_id = 'dm_' || least(sender_id collate "C", substr(room_id, 4) collate "C")
           || '__' || greatest(sender_id collate "C", substr(room_id, 4) collate "C")
where room_id like 'dm\_%' and room_id not like '%\_\_%';

-- ── 4. Remove every existing policy (the old ones let anyone in) ────────────
do $$
declare r record;
begin
  for r in
    select policyname, tablename from pg_policies
    where schemaname = 'public'
      and tablename in ('projects', 'tasks', 'clients', 'activity', 'messages', 'team_members')
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- ── 5. Lock the tables down ─────────────────────────────────────────────────
alter table public.projects     enable row level security;
alter table public.tasks        enable row level security;
alter table public.clients      enable row level security;
alter table public.activity     enable row level security;
alter table public.messages     enable row level security;
alter table public.team_members enable row level security;

revoke all on public.projects, public.tasks, public.clients, public.activity, public.messages, public.team_members from anon;
grant select, insert, update, delete on public.projects, public.tasks, public.clients, public.activity, public.messages, public.team_members to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- Matters: private ones are visible only to their creator and admins. Only admins delete.
create policy "members read visible matters" on public.projects for select to authenticated
  using (public.is_member() and (not is_private or created_by = public.current_member_id() or public.is_admin()));
create policy "members create matters" on public.projects for insert to authenticated
  with check (public.is_member());
create policy "members update visible matters" on public.projects for update to authenticated
  using (public.is_member() and (not is_private or created_by = public.current_member_id() or public.is_admin()))
  with check (public.is_member());
create policy "admins delete matters" on public.projects for delete to authenticated
  using (public.is_admin());

-- Tasks and clients: any team member.
create policy "members manage tasks" on public.tasks for all to authenticated
  using (public.is_member()) with check (public.is_member());
create policy "members manage clients" on public.clients for all to authenticated
  using (public.is_member()) with check (public.is_member());

-- Activity feed: everyone reads; you can only log entries as yourself.
create policy "members read activity" on public.activity for select to authenticated
  using (public.is_member());
create policy "members log own activity" on public.activity for insert to authenticated
  with check (who = public.current_member_id());

-- Chat: channel/DM access as above; you can only send as yourself.
create policy "members read their rooms" on public.messages for select to authenticated
  using (public.can_access_room(room_id));
create policy "members send as themselves" on public.messages for insert to authenticated
  with check (sender_id = public.current_member_id() and public.can_access_room(room_id));

-- Team: everyone reads; only admins change it.
create policy "members read team" on public.team_members for select to authenticated
  using (public.is_member());
create policy "admins manage team" on public.team_members for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ── 6. Realtime for the team table ──────────────────────────────────────────
do $$
begin
  alter publication supabase_realtime add table public.team_members;
exception when duplicate_object then null;
end $$;

commit;
