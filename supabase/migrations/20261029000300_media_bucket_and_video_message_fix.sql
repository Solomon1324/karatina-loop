-- Align the group-media bucket with the chat video feature and allow video-only messages.
-- This follows 20261029000200_group_chat_video_attachments.sql.

alter table public.group_messages
  add column if not exists video_path text;

-- The original unnamed table-level constraint was generated as group_messages_check.
-- Replace it with a rule that accepts text, an image, or a video.
alter table public.group_messages
  drop constraint if exists group_messages_check;
alter table public.group_messages
  drop constraint if exists group_messages_content_nonempty;
alter table public.group_messages
  add constraint group_messages_content_nonempty
  check (char_length(body) > 0 or image_path is not null or video_path is not null);

-- Supabase Free projects currently cap the global upload size at 50 MiB.
-- The project Storage global limit must also be set to at least 50 MiB.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'group-media', 'group-media', true, 52428800,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'video/mp4', 'video/webm', 'video/quicktime'
  ]::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
