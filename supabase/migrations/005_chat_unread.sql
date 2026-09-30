-- ════════════════════════════════════════════════════════════════════════════
-- 005 · Unread chat counts
--
--   • chat_reads remembers when each member last opened each room (channel or DM),
--     so unread counts survive reloads and follow people across devices.
--   • chat_unread_counts() returns, per room, how many messages from others arrived
--     since the caller last read it. It runs as the caller, so the messages RLS from
--     002 limits it to rooms they can see.
--   • Existing members start with everything marked read, so nobody opens the app
--     to hundreds of old "unread" messages.
--
-- Run once in Supabase → SQL Editor after 004. Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════
begin;

create table if not exists public.chat_reads (
  member_id    text not null references public.team_members(id) on delete cascade,
  room_id      text not null,
  last_read_at timestamptz not null default now(),
  primary key (member_id, room_id)
);

alter table public.chat_reads enable row level security;
revoke all on public.chat_reads from anon;
grant select, insert, update on public.chat_reads to authenticated;

drop policy if exists "members read own chat reads" on public.chat_reads;
drop policy if exists "members write own chat reads" on public.chat_reads;
drop policy if exists "members update own chat reads" on public.chat_reads;
create policy "members read own chat reads" on public.chat_reads for select to authenticated
  using (member_id = public.current_member_id());
create policy "members write own chat reads" on public.chat_reads for insert to authenticated
  with check (member_id = public.current_member_id());
create policy "members update own chat reads" on public.chat_reads for update to authenticated
  using (member_id = public.current_member_id()) with check (member_id = public.current_member_id());

-- Start everyone at "all read" for rooms that already have messages.
insert into public.chat_reads (member_id, room_id, last_read_at)
select t.id, r.room_id, now()
from public.team_members t cross join (select distinct room_id from public.messages) r
on conflict (member_id, room_id) do nothing;

create index if not exists messages_room_created_idx on public.messages (room_id, created_at);

create or replace function public.chat_unread_counts() returns table (room_id text, unread bigint)
language sql stable set search_path = public as $$
  select m.room_id, count(*)
  from public.messages m
  left join public.chat_reads r on r.room_id = m.room_id and r.member_id = public.current_member_id()
  where m.sender_id is distinct from public.current_member_id()
    and m.created_at > coalesce(r.last_read_at, '-infinity'::timestamptz)
  group by m.room_id
$$;

create or replace function public.mark_chat_read(room text) returns void
language sql volatile set search_path = public as $$
  insert into public.chat_reads (member_id, room_id, last_read_at)
  values (public.current_member_id(), room, now())
  on conflict (member_id, room_id) do update set last_read_at = excluded.last_read_at
$$;

revoke execute on function public.chat_unread_counts(), public.mark_chat_read(text) from public, anon;
grant execute on function public.chat_unread_counts(), public.mark_chat_read(text) to authenticated;

commit;
