-- ════════════════════════════════════════════════════════════════════════════
-- 003 · Who may reassign tasks and log time
--
--   • Only admins change a task's assignees once it exists (anyone picks them when creating it).
--   • Non-admins may only add time entries for themselves, on tasks they're assigned to,
--     and may not edit or remove existing entries.
--
-- The app enforces the same rules in the UI; this stops them being bypassed via the API.
-- Run once in Supabase → SQL Editor after 002. Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════
begin;

create or replace function public.enforce_project_rules() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  me       text  := public.current_member_id();
  old_logs jsonb := coalesce(to_jsonb(old.time_logs), '[]'::jsonb);
  new_logs jsonb := coalesce(to_jsonb(new.time_logs), '[]'::jsonb);
begin
  if public.is_admin() then return new; end if;

  if to_jsonb(new.assignees) is distinct from to_jsonb(old.assignees) then
    raise exception 'Only admins can change who a task is assigned to.' using errcode = '42501';
  end if;

  if new_logs is distinct from old_logs then
    if not (new_logs @> old_logs) then
      raise exception 'Only admins can edit or remove time entries.' using errcode = '42501';
    end if;
    if exists (
      select 1 from jsonb_array_elements(new_logs) e
      where not (old_logs @> jsonb_build_array(e))
        and (e ->> 'who' is distinct from me or not coalesce(to_jsonb(old.assignees), '[]'::jsonb) ? me)
    ) then
      raise exception 'You can only log your own time on tasks assigned to you.' using errcode = '42501';
    end if;
  end if;

  return new;
end $$;

drop trigger if exists enforce_project_rules on public.projects;
create trigger enforce_project_rules before update on public.projects
  for each row execute function public.enforce_project_rules();

commit;
