-- ════════════════════════════════════════════════════════════════════════════
-- 016 · "Administration" access level
--
--   • team_members.is_administration marks people who handle the firm's
--     administrative work. They aren't admins (no Billing, Settings, Logs…).
--   • A task assigned to an Administration member is an administration task:
--     only admins and Administration members can see it, its comments and files.
--   • Administration members see every other task too, except private ones
--     (private tasks keep their rules from 007).
--   • Only admins and Administration members can create a task assigned to an
--     Administration member (after creation only admins reassign, see 003).
--   • activity.restricted hides feed entries about administration tasks the same way.
--
-- Run once in Supabase → SQL Editor after 015. Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════
begin;

alter table public.team_members add column if not exists is_administration boolean not null default false;
alter table public.activity     add column if not exists restricted        boolean not null default false;

create or replace function public.is_administration() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.team_members where id = public.current_member_id() and is_administration)
$$;

-- Is any of these assignees an Administration member? (assignees as jsonb, e.g. to_jsonb(projects.assignees))
create or replace function public.is_administration_task(assignees jsonb) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(assignees, '[]'::jsonb) ?| array(select id from public.team_members where is_administration)
$$;

revoke execute on function public.is_administration(), public.is_administration_task(jsonb) from public, anon;
grant execute on function public.is_administration(), public.is_administration_task(jsonb) to authenticated;

-- ── Tasks ───────────────────────────────────────────────────────────────────
drop policy if exists "members read visible matters" on public.projects;
create policy "members read visible matters" on public.projects for select to authenticated
  using (public.is_member()
    and (not is_private or created_by = public.current_member_id()
      or supervisor = public.current_member_id() or public.is_admin())
    and (public.is_admin() or public.is_administration() or not public.is_administration_task(to_jsonb(assignees))));

drop policy if exists "members update visible matters" on public.projects;
create policy "members update visible matters" on public.projects for update to authenticated
  using (public.is_member()
    and (not is_private or created_by = public.current_member_id()
      or supervisor = public.current_member_id() or public.is_admin())
    and (public.is_admin() or public.is_administration() or not public.is_administration_task(to_jsonb(assignees))))
  with check (public.is_member());

create or replace function public.enforce_administration_assignees() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.is_administration_task(to_jsonb(new.assignees))
     and not (public.is_admin() or public.is_administration()) then
    raise exception 'Only admins and Administration can assign a task to Administration.' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists enforce_administration_assignees on public.projects;
create trigger enforce_administration_assignees before insert on public.projects
  for each row execute function public.enforce_administration_assignees();

-- ── Activity feed ───────────────────────────────────────────────────────────
drop policy if exists "members read activity" on public.activity;
create policy "members read activity" on public.activity for select to authenticated
  using (public.is_member() and (not restricted or public.is_admin() or public.is_administration()));

commit;
