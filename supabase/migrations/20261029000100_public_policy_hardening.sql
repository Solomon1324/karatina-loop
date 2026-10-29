-- Harden exposed helper functions and separate public read policies from authenticated/admin reads.

-- Public visitors should only see approved groups; signed-in users can additionally
-- see their own proposals and site admins can see all proposals.
drop policy if exists "Approved groups and own proposals are visible" on public.groups;
drop policy if exists "Public can read approved groups" on public.groups;
drop policy if exists "Signed-in users can read approved groups and own proposals" on public.groups;
create policy "Public can read approved groups"
  on public.groups for select to anon using (status = 'approved');
create policy "Signed-in users can read approved groups and own proposals"
  on public.groups for select to authenticated
  using (status = 'approved' or created_by = (select auth.uid()) or (select public.is_site_admin()));

-- Avoid requiring anonymous visitors to execute the admin helper just to read public listings.
drop policy if exists "Public can read approved businesses" on public.business_listings;
drop policy if exists "Public visitors can read approved businesses" on public.business_listings;
drop policy if exists "Signed-in users can read approved or own business listings" on public.business_listings;
create policy "Public visitors can read approved businesses"
  on public.business_listings for select to anon using (status = 'approved');
create policy "Signed-in users can read approved or own business listings"
  on public.business_listings for select to authenticated
  using (status = 'approved' or submitted_by = (select auth.uid()) or (select public.is_site_admin()));

drop policy if exists "Public can read approved campus information" on public.campus_information;
drop policy if exists "Public visitors can read approved campus information" on public.campus_information;
drop policy if exists "Signed-in users can read approved or own campus information" on public.campus_information;
create policy "Public visitors can read approved campus information"
  on public.campus_information for select to anon using (status = 'approved');
create policy "Signed-in users can read approved or own campus information"
  on public.campus_information for select to authenticated
  using (status = 'approved' or submitted_by = (select auth.uid()) or (select public.is_site_admin()));

-- These helper functions are needed by authenticated RLS policies, not anonymous clients.
revoke all on function public.is_site_admin() from public, anon;
grant execute on function public.is_site_admin() to authenticated;
revoke all on function public.is_group_admin(uuid) from public, anon;
grant execute on function public.is_group_admin(uuid) to authenticated;
revoke all on function public.is_approved_group_member(uuid) from public, anon;
grant execute on function public.is_approved_group_member(uuid) to authenticated;
