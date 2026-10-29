-- Allow users to remove their own uploaded photos and moderate content safely.
-- Regular users may update only image_path and the UI uses this to set it to NULL.

grant update (image_path) on public.group_posts to authenticated;
grant update (image_path) on public.group_messages to authenticated;
grant update (image_path) on public.group_post_comments to authenticated;
grant update (image_path) on public.business_listings to authenticated;
grant update (image_path) on public.campus_information to authenticated;
grant update (image_path) on public.business_listing_comments to authenticated;
grant update (image_path) on public.campus_information_comments to authenticated;

-- An uploaded post image must belong to the post author. Users may detach an image;
-- group admins and site admins may remove images for moderation purposes.
drop policy if exists "Authors and admins can edit posts" on public.group_posts;
create policy "Authors and admins can edit posts"
on public.group_posts for update to authenticated
using (
  author_id = (select auth.uid())
  or public.is_group_admin(group_id)
  or (select public.is_site_admin())
)
with check (
  (
    author_id = (select auth.uid())
    or public.is_group_admin(group_id)
    or (select public.is_site_admin())
  )
  and (
    image_path is null
    or image_path like group_id::text || '/' || author_id::text || '/%'
  )
);

drop policy if exists "Authors and group admins can remove photos from chat messages" on public.group_messages;
create policy "Authors and group admins can remove photos from chat messages"
on public.group_messages for update to authenticated
using (
  author_id = (select auth.uid())
  or public.is_group_admin(group_id)
  or (select public.is_site_admin())
)
with check (
  (
    author_id = (select auth.uid())
    or public.is_group_admin(group_id)
    or (select public.is_site_admin())
  )
  and image_path is null
  and length(trim(body)) > 0
);

drop policy if exists "Comment authors and group admins can remove comment photos" on public.group_post_comments;
create policy "Comment authors and group admins can remove comment photos"
on public.group_post_comments for update to authenticated
using (
  author_id = (select auth.uid())
  or public.is_group_admin(group_id)
  or (select public.is_site_admin())
)
with check (
  (
    author_id = (select auth.uid())
    or public.is_group_admin(group_id)
    or (select public.is_site_admin())
  )
  and image_path is null
  and length(trim(body)) > 0
);

drop policy if exists "Submitters and site admins can remove listing photos" on public.business_listings;
create policy "Submitters and site admins can remove listing photos"
on public.business_listings for update to authenticated
using (
  submitted_by = (select auth.uid())
  or (select public.is_site_admin())
)
with check (
  image_path is null
  and (
    submitted_by = (select auth.uid())
    or (select public.is_site_admin())
  )
);

drop policy if exists "Submitters and site admins can remove campus photos" on public.campus_information;
create policy "Submitters and site admins can remove campus photos"
on public.campus_information for update to authenticated
using (
  submitted_by = (select auth.uid())
  or (select public.is_site_admin())
)
with check (
  image_path is null
  and (
    submitted_by = (select auth.uid())
    or (select public.is_site_admin())
  )
);

drop policy if exists "Authors and admins can remove business comment photos" on public.business_listing_comments;
create policy "Authors and admins can remove business comment photos"
on public.business_listing_comments for update to authenticated
using (
  author_id = (select auth.uid())
  or (select public.is_site_admin())
)
with check (
  (
    author_id = (select auth.uid())
    or (select public.is_site_admin())
  )
  and image_path is null
  and length(trim(body)) > 0
);

drop policy if exists "Authors and admins can remove campus comment photos" on public.campus_information_comments;
create policy "Authors and admins can remove campus comment photos"
on public.campus_information_comments for update to authenticated
using (
  author_id = (select auth.uid())
  or (select public.is_site_admin())
)
with check (
  (
    author_id = (select auth.uid())
    or (select public.is_site_admin())
  )
  and image_path is null
  and length(trim(body)) > 0
);
