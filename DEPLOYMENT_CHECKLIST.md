# Karatina Loop deployment checks

## Cloudflare Pages build settings

- Framework preset: **Vite** (or **None** with the same values below)
- Build command: `pnpm build`
- Build output directory: `dist`
- Root directory: `karatina-loop` only if the Git repository contains the project inside that subfolder; otherwise leave it blank.
- Node.js: use a supported current LTS version.

## Required production environment variables

Set these in Cloudflare Pages → Settings → Environment variables, for both Production and Preview as needed:

- `VITE_SUPABASE_URL` — the Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` — the Supabase publishable key (starts with `sb_publishable_`)

After changing environment variables, trigger a **new deployment**. Vite embeds `VITE_` variables at build time.

Never add a Supabase secret/service-role key to `VITE_` variables or browser code.

## Verify the deployment

1. Open the latest deployment's build log and confirm `pnpm build` completes successfully.
2. Confirm the deployed HTML loads JavaScript and CSS assets successfully (no 404s in Developer Tools → Network).
3. Open Developer Tools → Console and check for the first red error if the page is still blank.
4. Confirm the Supabase URL and publishable key are present in the Pages environment settings without copying the values into public chat.

`public/_redirects` enables client-side route fallback on Cloudflare Pages. `src/ErrorBoundary.jsx` displays a diagnostic fallback if React throws while rendering, instead of showing a completely blank page.

## Current implementation status

- Business directory: reads approved rows from `business_listings`; signed-in users can submit listings with photo attachments and emoji/sticker text for review. Approved listings expose emoji reactions and a comments panel; comments can include photos.
- Campus information: reads approved notices, events, places and resources from `campus_information`; signed-in users can submit entries with photo attachments and emoji/sticker text. Approved entries expose emoji reactions and a comments panel; comments can include photos.
- Group proposals and memberships use Supabase RPCs; approved members can publish text and image posts and chat messages.
- Group chat subscribes to the group broadcast topic and reloads activity when new messages/posts arrive.
- Group admins can review join requests, and site admins can review group proposals, businesses, campus information and membership requests. Business/campus image attachments are stored in a private bucket and are shown using signed URLs only when row-level access rules allow it.
- Realtime subscriptions refresh business/campus cards when items, comments or reactions change. The fresh project copy's production build completed successfully on 2026-10-29.


## Group chat video update

- Apply `supabase/migrations/20261029000200_group_chat_video_attachments.sql` and `20261029000300_media_bucket_and_video_message_fix.sql` before deploying this frontend.
- Ensure the Supabase global upload limit and `group-media` bucket both permit 50 MiB, and that upload policies remain scoped to approved group members' own group/user path.
- Apply `20261029000400_profile_avatar_storage.sql` before testing profile-picture uploads.
- Test video upload and playback with two approved group accounts. If the chat reports a missing `video_path` column, the migration has not been applied.
