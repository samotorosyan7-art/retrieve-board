-- ════════════════════════════════════════════════════════════════════════════
-- 008 · Only admins make tasks private
--
--   • Non-admins can't create a private task or switch a public one to private.
--   • A member who already owns a private task may still make it public.
--
-- The app enforces the same rule in the UI; this stops it being bypassed via the API.
-- Run once in Supabase → SQL Editor after 007. Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════
begin;

create or replace function public.enforce_private_admin_only() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.is_private and not public.is_admin()
     and (tg_op = 'INSERT' or not coalesce(old.is_private, false)) then
    raise exception 'Only admins can make a task private.' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists enforce_private_admin_only on public.projects;
create trigger enforce_private_admin_only before insert or update on public.projects
  for each row execute function public.enforce_private_admin_only();

commit;
