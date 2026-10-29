-- Complete the client-facing workflows: secure moderation RPCs and group totals.
-- Apply after the core community and business/campus migrations.

-- These permissions are paired with the existing row-level security policies.
-- Public visitors may read approved content/activity; only signed-in users can insert,
-- and RLS limits write access to approved members/admins as defined in the core migration.
grant select on public.group_posts, public.group_messages to anon, authenticated;
revoke all on public.business_listings, public.campus_information from anon, authenticated;
grant select on public.business_listings, public.campus_information to anon, authenticated;
grant insert (name, category, description, location, contact_phone, contact_email, website_url, submitted_by, status)
  on public.business_listings to authenticated;
grant insert (kind, title, summary, location, starts_at, ends_at, contact, link_url, submitted_by, status)
  on public.campus_information to authenticated;
grant update on public.business_listings, public.campus_information to authenticated;
grant execute on function public.is_site_admin() to anon, authenticated;

create or replace function public.get_approved_group_counts()
returns table(group_id uuid, member_count bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in to view group member counts' using errcode = '42501';
  end if;

  return query
    select g.id, count(gm.id)::bigint
    from public.groups g
    left join public.group_members gm
      on gm.group_id = g.id and gm.status = 'approved'
    where g.status = 'approved'
    group by g.id;
end;
$$;
revoke all on function public.get_approved_group_counts() from public, anon;
grant execute on function public.get_approved_group_counts() to authenticated;

create or replace function public.review_business_listing(target_listing_id uuid, approve boolean)
returns public.business_listings
language plpgsql
security definer
set search_path = ''
as $$
declare
  reviewed_listing public.business_listings;
begin
  if not public.is_site_admin() then
    raise exception 'Only a site admin can review business listings' using errcode = '42501';
  end if;

  update public.business_listings b
  set status = case when approve then 'approved' else 'rejected' end,
      reviewed_by = (select auth.uid()),
      reviewed_at = now()
  where b.id = target_listing_id and b.status = 'pending'
  returning b.* into reviewed_listing;

  if not found then
    raise exception 'Business listing was not found or has already been reviewed';
  end if;

  update public.admin_notifications
  set read_at = coalesce(read_at, now())
  where entity_id = reviewed_listing.id and event_type = 'business_submission';

  return reviewed_listing;
end;
$$;
revoke all on function public.review_business_listing(uuid, boolean) from public, anon;
grant execute on function public.review_business_listing(uuid, boolean) to authenticated;

create or replace function public.review_campus_information(target_information_id uuid, approve boolean)
returns public.campus_information
language plpgsql
security definer
set search_path = ''
as $$
declare
  reviewed_information public.campus_information;
begin
  if not public.is_site_admin() then
    raise exception 'Only a site admin can review campus information' using errcode = '42501';
  end if;

  update public.campus_information c
  set status = case when approve then 'approved' else 'rejected' end,
      reviewed_by = (select auth.uid()),
      reviewed_at = now()
  where c.id = target_information_id and c.status = 'pending'
  returning c.* into reviewed_information;

  if not found then
    raise exception 'Campus information was not found or has already been reviewed';
  end if;

  update public.admin_notifications
  set read_at = coalesce(read_at, now())
  where entity_id = reviewed_information.id and event_type = 'campus_information_submission';

  return reviewed_information;
end;
$$;
revoke all on function public.review_campus_information(uuid, boolean) from public, anon;
grant execute on function public.review_campus_information(uuid, boolean) to authenticated;

-- Trigger entry points are invoked by PostgreSQL triggers, not by browser RPCs.
-- Remove their default function EXECUTE grants so clients cannot call them directly.
revoke all on function public.handle_new_auth_user() from public, anon, authenticated;
revoke all on function public.notify_admin_new_group() from public, anon, authenticated;
revoke all on function public.broadcast_group_chat_message() from public, anon, authenticated;
revoke all on function public.broadcast_group_post() from public, anon, authenticated;
revoke all on function public.notify_admin_new_business() from public, anon, authenticated;
revoke all on function public.notify_admin_new_campus_info() from public, anon, authenticated;
