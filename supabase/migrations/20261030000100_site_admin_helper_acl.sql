-- Ensure anonymous users cannot invoke the site-admin predicate directly.
-- Authenticated clients may call it to decide whether to display the admin link;
-- the database still enforces permissions on every protected operation.
revoke all on function public.is_site_admin() from public, anon;
grant execute on function public.is_site_admin() to authenticated;
