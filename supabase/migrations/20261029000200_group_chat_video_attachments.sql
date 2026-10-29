-- Group chat video attachments. Run this migration in Supabase before deploying
-- the frontend that selects and writes video_path.
alter table public.group_messages
  add column if not exists video_path text;

drop policy if exists "Approved group members can send chat messages" on public.group_messages;
create policy "Approved group members can send chat messages"
on public.group_messages for insert to authenticated
with check (
  author_id = (select auth.uid())
  and public.is_approved_group_member(group_id)
  and (image_path is null or image_path like group_id::text || '/' || (select auth.uid())::text || '/%')
  and (video_path is null or video_path like group_id::text || '/' || (select auth.uid())::text || '/%')
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

comment on column public.group_messages.video_path is
  'Storage path for a video attachment in the group-media bucket.';
