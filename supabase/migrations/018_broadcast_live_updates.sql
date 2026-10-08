-- ════════════════════════════════════════════════════════════════════════════
-- 018 · Live updates via Realtime Broadcast instead of Postgres Changes
--
--   • Postgres Changes made Realtime poll the database's change log non-stop
--     (realtime.list_changes ≈ 90% of all database time) and used up the
--     project's Disk IO budget.
--   • Now a trigger broadcasts a tiny notice — { table, op, id } — on a private
--     channel: 'live:board' (tasks, clients, team, activity, comments, files)
--     or 'live:chat' (messages). No row data is sent; the app reads the row
--     itself through the API, so row-level security still decides who sees what.
--   • Only signed-in team members can join those channels.
--   • The tables leave the supabase_realtime publication, which stops the polling.
--
-- Run once in Supabase → SQL Editor after 017, together with the matching app
-- version (open tabs need a reload to get live updates again). Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════
begin;

-- ── 1. Broadcast a notice for each changed row (topic = trigger argument) ────
create or replace function public.broadcast_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform realtime.send(
    jsonb_build_object('table', tg_table_name, 'op', tg_op,
      'id', case when tg_op = 'DELETE' then to_jsonb(old) -> 'id' else to_jsonb(new) -> 'id' end),
    'change', tg_argv[0], true);
  return null;
end $$;
revoke execute on function public.broadcast_change() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['team_members', 'projects', 'clients', 'activity', 'task_comments', 'task_files', 'messages'] loop
    execute format('drop trigger if exists live_broadcast on public.%I', t);
    execute format('create trigger live_broadcast after insert or update or delete on public.%I
      for each row execute function public.broadcast_change(%L)', t, case t when 'messages' then 'live:chat' else 'live:board' end);
  end loop;
end $$;

-- ── 2. Only team members can listen ──────────────────────────────────────────
drop policy if exists "members receive live updates" on realtime.messages;
create policy "members receive live updates" on realtime.messages for select to authenticated
  using (realtime.topic() in ('live:board', 'live:chat')
    and realtime.messages.extension = 'broadcast'
    and public.is_member());

-- ── 3. Stop Postgres Changes ─────────────────────────────────────────────────
do $$
declare t text;
begin
  for t in
    select tablename from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public'
  loop
    execute format('alter publication supabase_realtime drop table public.%I', t);
  end loop;
end $$;

commit;
