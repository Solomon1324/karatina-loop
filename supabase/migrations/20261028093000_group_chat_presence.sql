-- Allow approved members to publish and receive online presence only while
-- their group is approved and their group_members row remains approved.
-- The application joins the private topic group-chat-presence:<group UUID>.

drop policy if exists "Approved group members can listen to group chat presence" on realtime.messages;
create policy "Approved group members can listen to group chat presence"
on realtime.messages
for select to authenticated
using (
  extension = 'presence'
  and exists (
    select 1
    from public.groups g
    join public.group_members gm on gm.group_id = g.id
    where g.status = 'approved'
      and gm.status = 'approved'
      and gm.user_id = (select auth.uid())
      and realtime.topic() = 'group-chat-presence:' || g.id::text
  )
);

drop policy if exists "Approved group members can publish group chat presence" on realtime.messages;
create policy "Approved group members can publish group chat presence"
on realtime.messages
for insert to authenticated
with check (
  extension = 'presence'
  and exists (
    select 1
    from public.groups g
    join public.group_members gm on gm.group_id = g.id
    where g.status = 'approved'
      and gm.status = 'approved'
      and gm.user_id = (select auth.uid())
      and realtime.topic() = 'group-chat-presence:' || g.id::text
  )
);
