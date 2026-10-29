-- Advanced Karatina Loop group chat: public replies and private replies.
alter table public.group_messages
  add column if not exists reply_to_message_id uuid references public.group_messages(id) on delete set null;

create index if not exists group_messages_reply_to_idx
  on public.group_messages(reply_to_message_id);

drop policy if exists "Approved group members can send chat messages" on public.group_messages;
create policy "Approved group members can send chat messages"
on public.group_messages for insert to authenticated
with check (
  author_id = (select auth.uid())
  and public.is_approved_group_member(group_id)
  and (image_path is null or image_path like group_id::text || '/' || (select auth.uid())::text || '/%')
  and (
    reply_to_message_id is null
    or exists (
      select 1
      from public.group_messages parent
      where parent.id = group_messages.reply_to_message_id
        and parent.group_id = group_messages.group_id
    )
  )
);

create table if not exists public.group_private_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  reply_to_message_id uuid not null references public.group_messages(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  constraint group_private_messages_not_self check (sender_id <> recipient_id)
);

create index if not exists group_private_messages_thread_idx
  on public.group_private_messages(group_id, reply_to_message_id, created_at asc);
create index if not exists group_private_messages_participants_idx
  on public.group_private_messages(sender_id, recipient_id, created_at desc);
create index if not exists group_private_messages_recipient_idx
  on public.group_private_messages(recipient_id, created_at desc);

alter table public.group_private_messages enable row level security;
revoke all on public.group_private_messages from anon, authenticated;
grant select, insert on public.group_private_messages to authenticated;

drop policy if exists "Participants can read their private group replies" on public.group_private_messages;
create policy "Participants can read their private group replies"
on public.group_private_messages for select to authenticated
using (
  sender_id = (select auth.uid())
  or recipient_id = (select auth.uid())
);

drop policy if exists "Approved members can send private replies to a group message" on public.group_private_messages;
create policy "Approved members can send private replies to a group message"
on public.group_private_messages for insert to authenticated
with check (
  sender_id = (select auth.uid())
  and sender_id <> recipient_id
  and public.is_approved_group_member(group_id)
  and exists (
    select 1
    from public.groups g
    join public.group_members gm on gm.group_id = g.id
    where g.id = group_private_messages.group_id
      and g.status = 'approved'
      and gm.user_id = group_private_messages.recipient_id
      and gm.status = 'approved'
  )
  and exists (
    select 1
    from public.group_messages root_message
    where root_message.id = group_private_messages.reply_to_message_id
      and root_message.group_id = group_private_messages.group_id
      and (
        root_message.author_id = group_private_messages.sender_id
        or root_message.author_id = group_private_messages.recipient_id
      )
  )
);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'group_private_messages'
     ) then
    alter publication supabase_realtime add table public.group_private_messages;
  end if;
end
$$;
