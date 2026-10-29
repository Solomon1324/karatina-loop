-- Ensure a user can attach only a community-media image uploaded under their own user folder.
drop policy if exists "Signed in users can submit businesses" on public.business_listings;
create policy "Signed in users can submit businesses" on public.business_listings
  for insert to authenticated
  with check (
    submitted_by = (select auth.uid())
    and status = 'pending'
    and reviewed_by is null
    and reviewed_at is null
    and (image_path is null or image_path like (select auth.uid())::text || '/businesses/%')
  );

drop policy if exists "Signed in users can submit campus information" on public.campus_information;
create policy "Signed in users can submit campus information" on public.campus_information
  for insert to authenticated
  with check (
    submitted_by = (select auth.uid())
    and status = 'pending'
    and reviewed_by is null
    and reviewed_at is null
    and (image_path is null or image_path like (select auth.uid())::text || '/campus/%')
  );
