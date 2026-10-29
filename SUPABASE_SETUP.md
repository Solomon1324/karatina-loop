# Supabase project setup for Karatina Loop

This guide is for the first development project. Do not send passwords, OAuth client secrets, SMTP credentials, or Supabase secret/service-role keys in chat or commit them to GitHub.

## Create your Supabase account and project

1. Open the [Supabase dashboard](https://supabase.com/dashboard) and create or sign in to your own account. Complete any email confirmation, CAPTCHA, or terms acceptance yourself.
2. Create a project named **Karatina Loop**.
3. For users based at Karatina University in Kenya, choose **South Asia (Mumbai, `ap-south-1`)** from the current published region list. This is the closest listed region by geography; it is an estimate, not a measured latency result. Supabase recommends selecting a region close to users.
4. Choose the Free plan while developing. Before the public launch, review current Realtime, email and backup quotas against expected traffic.
5. Generate a unique database password and save it in your password manager. We do not need that password in the website code.

## Configure the application

1. In the project, open **Project Settings → API** and copy the project URL and publishable key (or legacy anon key).
2. Copy `.env.example` to `.env.local` and fill in:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY` (use the publishable key; a legacy anon key is also accepted by the client)
3. Keep `.env.local` private. It is excluded from Git. Never use the Supabase secret/service-role key in browser code.
4. For a brand-new project, apply these SQL migrations in this order, one at a time, waiting for Success after each:
   - `20261026000100_community_core.sql`
   - `20261027000100_business_and_campus.sql`
   - `20261027025642_allow_group_proposals.sql`
   - `20261027030648_social_interactions.sql`
   - `20261027040000_directory_social_features.sql`
   - `20261027040100_directory_social_image_guards.sql`
   - `20261027040200_directory_social_realtime.sql`
   - `20261027083456_advanced_group_chat.sql`
   - `20261027083951_advanced_chat_reply_index.sql`
   - `20261027090000_content_removal_controls.sql`
   - `20261027090500_group_content_delete_realtime.sql`
   - `20261028000100_full_workflows.sql`
   - `20261028093000_group_chat_presence.sql`
   - `20261029000100_public_policy_hardening.sql`
   - `20261029000200_group_chat_video_attachments.sql`
   - `20261029000300_media_bucket_and_video_message_fix.sql`
   - `20261029000400_profile_avatar_storage.sql`
   - `20261030000100_site_admin_helper_acl.sql`
   - `20261031000100_group_admin_handover.sql`

   For an existing project, first compare the actual database with each migration; apply only missing migrations. Do not rerun the core migration to fix a duplicate-policy error. The ZIP's notes are not proof of which migrations are installed in your project.
5. Enable email/password and Google providers under **Authentication → Providers**. Google sign-in needs a Google OAuth client ID and secret in Supabase's provider settings; keep the secret there, not in Git.
6. After your account has signed in once, add its Auth user ID to `public.site_admins` from the SQL Editor. This grants the initial site-admin role. Do not use editable profile metadata for admin roles.

## Email alerts

The migrations create a public `group-media` bucket that accepts JPEG, PNG, WebP and GIF images, plus MP4, WebM and MOV chat videos up to 50 MiB. The follow-up video migration allows video-only messages and updates bucket restrictions. Supabase Storage's global upload-size setting must also allow 50 MiB; the Free plan currently caps the global limit at 50 MB. Group media is publicly readable. The migrations also create a public `profile-avatars` bucket with owner-scoped uploads and deletes. The migration creates an in-app admin notification for each new group proposal. Email alerts still need an SMTP provider and a server-side notification function. Supabase's built-in/default SMTP may impose strict delivery and recipient limits; verify current limits before opening registration publicly.

## Business directory and campus information

The second migration adds the `business_listings` and `campus_information` tables. Public visitors can read approved entries. Signed-in users can submit businesses, notices, events, places and student resources for review. Entries are not publicly displayed until a site admin approves them. Later directory-social migrations add photo attachments, emoji/sticker text, comments with optional photos, emoji reactions, private media storage with signed viewing URLs, upload ownership checks, and Realtime updates for approved entries and social interactions. Real listings must be supplied by the campus community; the app intentionally does not invent business contacts, opening hours or official campus notices.

## Make the site-admin dashboard available

1. Create your account in Karatina Loop and verify your email if Supabase requires it.
2. In Supabase, open **Authentication → Users**, find your account, and copy its user UUID.
3. In the SQL Editor, run the following after replacing the placeholder with the exact UUID from your own account:

```sql
insert into public.site_admins (user_id)
values ('PASTE-YOUR-AUTH-USER-UUID-HERE')
on conflict (user_id) do nothing;
```

4. Reload the website and sign in again. The **Admin dashboard** control should appear if your account has the site-admin role. Do not add people as admins unless you trust them with moderation privileges.

## What the full-workflows updates add

- Group posts and chat load from Supabase and refresh when new activity is broadcast.
- Approved group members can publish text and images to posts/chat; images are limited to JPEG, PNG, WebP or GIF, max 8 MiB.
- Group admins can review membership requests inside their group.
- Site admins can review pending group proposals, business listings, campus information and group-membership requests in the dashboard.
- New RPC functions enforce admin-only approvals server-side, and approved group counts come from the database.
- The policy-hardening migration separates anonymous public reads from signed-in/admin reads and restricts helper-function execution.

Group membership/post/chat and directory-social flows still need end-to-end testing with more than one real account after the migrations are applied. The browser UI must never be treated as proof of authorization; Supabase row-level security and database functions are the enforcement layer. Email alerts to an external inbox still require a configured SMTP provider and server-side notification function. The in-app review dashboard does not automatically send email.
