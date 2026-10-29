# Karatina Loop — group chat video attachments

This update adds MP4, WebM and MOV video attachments to group chat. Videos are limited to 50 MB in the browser UI. Image attachments remain supported. The existing chat reply/private reply and group membership checks remain in place.

## Required Supabase step before deploying

1. Check whether `20261029000200_group_chat_video_attachments.sql` is already installed. If not, apply it first.
2. Apply `supabase/migrations/20261029000300_media_bucket_and_video_message_fix.sql`. It updates the `group-media` bucket's accepted MIME types and 50 MiB limit, and lets a video-only chat message satisfy the database content check.
3. In Supabase → Storage settings, confirm the global upload limit is at least 50 MiB. The Free plan currently permits a global limit up to 50 MB.
4. Keep `group-media` upload policies limited to approved group members' own `group-id/user-id/...` path. The bucket is public for reads, so anyone with a media URL can view its contents.
5. Build and deploy the project again. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in the hosting provider, then create a fresh production deployment.

## Important

- The ZIP deliberately excludes `.env`. Create a local `.env` from `.env.example` only if needed, and fill it with your own Supabase project URL and publishable key.
- Never put a Supabase secret/service-role key in browser variables or upload it to GitHub.
- The chat frontend selects `video_path`, so both video migrations must be installed before deploying it. Without the follow-up fix, video-only messages fail the existing database check and Storage rejects videos under the original image-only bucket limit.
- The project build could not be run in this environment because package installation timed out. Run `pnpm install` and `pnpm build` in the inner `karatina-loop` folder on your Windows laptop before deployment.
