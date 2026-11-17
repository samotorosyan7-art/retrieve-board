-- ════════════════════════════════════════════════════════════════════════════
-- 025 · Cut database load: per-query RLS checks + missing indexes
--
--   • Row-level security called public.is_member() / is_admin() /
--     is_administration() / current_member_id() once PER ROW. Each of those
--     looks up team_members again, so loading the board ran ~10 extra
--     sub-queries per task, and comments / files / status history re-ran the
--     whole task check for every row too (the Report page reads up to 5000).
--     Wrapping them in (select …) makes Postgres run each one once per query
--     (an "initPlan") — the rules themselves are unchanged.
--   • team_members gets an index on lower(email), which is how
--     current_member_id() finds the signed-in member.
--   • activity gets an index on created_at, so "latest 20" stops reading the
--     whole table on every load.
--   • chat_unread_counts() resolves the caller once instead of per message.
--
-- Run once in Supabase → SQL Editor after 024. No app change needed. Safe to re-run.
-- Afterwards, run on its own (not inside a transaction):  vacuum analyze;
-- ════════════════════════════════════════════════════════════════════════════
begin;

-- ── 1. Indexes ──────────────────────────────────────────────────────────────
create index if not exists team_members_email_lower_idx on public.team_members (lower(email));
create index if not exists activity_created_idx on public.activity (created_at desc);

-- ── 2. Administration member ids, read once per query ───────────────────────
create or replace function public.administration_member_ids() returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(id), '{}') from public.team_members where is_administration
$$;
revoke execute on function public.administration_member_ids() from public, anon;
grant execute on function public.administration_member_ids() to authenticated;

-- ── 3. Tasks: same rules as can_see_task (017), member facts resolved once ──
drop policy if exists "members read visible matters" on public.projects;
create policy "members read visible matters" on public.projects for select to authenticated
  using ((select public.is_admin()) or ((select public.is_member())
    and (not is_private or created_by = (select public.current_member_id()) or supervisor = (select public.current_member_id()))
    and case when (select public.is_administration())
      then coalesce(to_jsonb(assignees), '[]'::jsonb) ? (select public.current_member_id())
        or created_by = (select public.current_member_id()) or supervisor = (select public.current_member_id())
      else not (coalesce(to_jsonb(assignees), '[]'::jsonb) ?| (select public.administration_member_ids()))
    end));

drop policy if exists "members update visible matters" on public.projects;
create policy "members update visible matters" on public.projects for update to authenticated
  using ((select public.is_admin()) or ((select public.is_member())
    and (not is_private or created_by = (select public.current_member_id()) or supervisor = (select public.current_member_id()))
    and case when (select public.is_administration())
      then coalesce(to_jsonb(assignees), '[]'::jsonb) ? (select public.current_member_id())
        or created_by = (select public.current_member_id()) or supervisor = (select public.current_member_id())
      else not (coalesce(to_jsonb(assignees), '[]'::jsonb) ?| (select public.administration_member_ids()))
    end))
  with check ((select public.is_member()));

-- ── 4. Rows that hang off a task (the exists() still applies the task rules) ─
drop policy if exists "members read comments on visible tasks" on public.task_comments;
create policy "members read comments on visible tasks" on public.task_comments for select to authenticated
  using ((select public.is_member()) and exists (select 1 from public.projects p where p.id = project_id));

drop policy if exists "members read files on visible tasks" on public.task_files;
create policy "members read files on visible tasks" on public.task_files for select to authenticated
  using ((select public.is_member()) and exists (select 1 from public.projects p where p.id = project_id));

drop policy if exists "members read history of visible tasks" on public.task_status_changes;
create policy "members read history of visible tasks" on public.task_status_changes for select to authenticated
  using ((select public.is_member()) and exists (select 1 from public.projects p where p.id = project_id));

-- ── 5. Activity feed (rules from 017) ───────────────────────────────────────
drop policy if exists "members read activity" on public.activity;
create policy "members read activity" on public.activity for select to authenticated
  using ((select public.is_member()) and ((select public.is_admin())
    or ((select public.is_administration()) and (restricted or who = (select public.current_member_id())))
    or (not (select public.is_administration()) and not restricted)));

-- ── 6. Chat: same as can_access_room (002), member facts resolved once ──────
drop policy if exists "members read their rooms" on public.messages;
create policy "members read their rooms" on public.messages for select to authenticated
  using ((select public.is_member()) and case
    when room_id like 'dm\_%' then (select public.current_member_id()) = any (string_to_array(substr(room_id, 4), '__'))
    when room_id = 'billing'  then (select public.is_billing())
    else true
  end);

drop policy if exists "members read own chat reads" on public.chat_reads;
create policy "members read own chat reads" on public.chat_reads for select to authenticated
  using (member_id = (select public.current_member_id()));

create or replace function public.chat_unread_counts() returns table (room_id text, unread bigint)
language sql stable set search_path = public as $$
  select m.room_id, count(*)
  from public.messages m
  left join public.chat_reads r on r.room_id = m.room_id and r.member_id = (select public.current_member_id())
  where m.sender_id is distinct from (select public.current_member_id())
    and m.deleted_at is null
    and m.created_at > coalesce(r.last_read_at, '-infinity'::timestamptz)
  group by m.room_id
$$;

-- ── 7. Notifications, clients, team ─────────────────────────────────────────
drop policy if exists "members read own notifications" on public.notifications;
create policy "members read own notifications" on public.notifications for select to authenticated
  using (member_id = (select public.current_member_id()));

drop policy if exists "members manage clients" on public.clients;
create policy "members manage clients" on public.clients for all to authenticated
  using ((select public.is_member())) with check ((select public.is_member()));

drop policy if exists "members read team" on public.team_members;
create policy "members read team" on public.team_members for select to authenticated
  using ((select public.is_member()));

commit;

-- ── Optional: keep the activity feed small ──────────────────────────────────
-- The app only ever shows the latest 20 entries. If the table has grown large,
-- old rows can be pruned (this permanently deletes them — run deliberately):
--   delete from public.activity where created_at < now() - interval '180 days';
