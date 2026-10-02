-- ════════════════════════════════════════════════════════════════════════════
-- 014 · Delete chat messages
--
--   • A member can delete their own chat messages. The row stays as a placeholder
--     ("This message was deleted") for everyone in the room; its text and file are wiped.
--   • The only allowed change to a message is deleting it — enforced by a trigger, so the
--     text can't be edited and nobody can delete someone else's message.
--   • Deleted messages no longer count as unread (chat_unread_counts from 005).
--
-- Run once in Supabase → SQL Editor after 013. Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════
begin;

alter table public.messages add column if not exists deleted_at timestamptz;

drop policy if exists "members delete own messages" on public.messages;
create policy "members delete own messages" on public.messages for update to authenticated
  using (sender_id = public.current_member_id() and public.can_access_room(room_id))
  with check (sender_id = public.current_member_id());

create or replace function public.enforce_message_delete_only() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.sender_id is distinct from public.current_member_id() then
    raise exception 'You can only delete your own messages.' using errcode = '42501';
  end if;
  if new.deleted_at is null then
    raise exception 'Messages can only be deleted, not edited.' using errcode = '42501';
  end if;
  -- Keep who/where/when; wipe what was said.
  new.id := old.id; new.room_id := old.room_id; new.sender_id := old.sender_id; new.created_at := old.created_at;
  new.content := ''; new.attachment := null;
  new.deleted_at := coalesce(old.deleted_at, now());
  return new;
end $$;

drop trigger if exists enforce_message_delete_only on public.messages;
create trigger enforce_message_delete_only before update on public.messages
  for each row execute function public.enforce_message_delete_only();

create or replace function public.chat_unread_counts() returns table (room_id text, unread bigint)
language sql stable set search_path = public as $$
  select m.room_id, count(*)
  from public.messages m
  left join public.chat_reads r on r.room_id = m.room_id and r.member_id = public.current_member_id()
  where m.sender_id is distinct from public.current_member_id()
    and m.deleted_at is null
    and m.created_at > coalesce(r.last_read_at, '-infinity'::timestamptz)
  group by m.room_id
$$;

commit;
