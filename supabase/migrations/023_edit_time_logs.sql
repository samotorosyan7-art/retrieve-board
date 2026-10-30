-- ════════════════════════════════════════════════════════════════════════════
-- 023 · Anyone who can see a task edits and deletes its time entries
--
--   • Replaces the time-entry rule from 003. Admins still change entries freely.
--   • Members may edit or remove any entry on a task they can see — the update
--     policy (017) already limits them to those tasks.
--   • New entries keep the 003 rule: members log only their own time, on tasks
--     they're assigned to. An edit can't move an entry to someone else, so it
--     counts as replacing an entry with one by the same person.
--   • The assignee rule from 003 is unchanged.
--
-- The app enforces the same rules in the UI; this stops them being bypassed via the API.
-- Run once in Supabase → SQL Editor after 022. Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════
begin;

create or replace function public.enforce_project_rules() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  me       text    := public.current_member_id();
  assigned boolean := coalesce(to_jsonb(old.assignees), '[]'::jsonb) ? me;
  old_logs jsonb   := coalesce(to_jsonb(old.time_logs), '[]'::jsonb);
  new_logs jsonb   := coalesce(to_jsonb(new.time_logs), '[]'::jsonb);
begin
  if public.is_admin() then return new; end if;

  if to_jsonb(new.assignees) is distinct from to_jsonb(old.assignees) then
    raise exception 'Only admins can change who a task is assigned to.' using errcode = '42501';
  end if;

  -- Per person: entries added beyond those removed are newly logged time, which must be
  -- the member's own on a task assigned to them. Removals alone are always allowed.
  if new_logs is distinct from old_logs and exists (
    select 1
    from (select e ->> 'who' as who, count(*) as n from jsonb_array_elements(new_logs) e
          where not (old_logs @> jsonb_build_array(e)) group by 1) added
    left join (select e ->> 'who' as who, count(*) as n from jsonb_array_elements(old_logs) e
               where not (new_logs @> jsonb_build_array(e)) group by 1) removed using (who)
    where added.n > coalesce(removed.n, 0)
      and not (added.who is not distinct from me and assigned)
  ) then
    raise exception 'You can only log your own time on tasks assigned to you, and can''t move an entry to someone else.' using errcode = '42501';
  end if;

  return new;
end $$;

drop trigger if exists enforce_project_rules on public.projects;
create trigger enforce_project_rules before update on public.projects
  for each row execute function public.enforce_project_rules();

commit;
