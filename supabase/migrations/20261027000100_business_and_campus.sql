-- Student business directory and campus information for Karatina Loop.
-- Public visitors can read approved entries. Signed-in users can submit entries for review.

create table if not exists public.business_listings (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 100),
  category text not null check (char_length(category) between 2 and 40),
  description text not null check (char_length(description) between 10 and 1200),
  location text not null default 'Karatina University area' check (char_length(location) between 2 and 160),
  contact_phone text check (contact_phone is null or char_length(contact_phone) <= 30),
  contact_email text check (contact_email is null or char_length(contact_email) <= 254),
  website_url text check (website_url is null or char_length(website_url) <= 500),
  submitted_by uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending','approved','rejected','archived')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create table if not exists public.campus_information (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('notice','event','place','resource')),
  title text not null check (char_length(title) between 3 and 140),
  summary text not null check (char_length(summary) between 10 and 2000),
  location text check (location is null or char_length(location) <= 200),
  starts_at timestamptz,
  ends_at timestamptz,
  contact text check (contact is null or char_length(contact) <= 254),
  link_url text check (link_url is null or char_length(link_url) <= 500),
  submitted_by uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending','approved','rejected','archived')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  check (ends_at is null or starts_at is null or ends_at >= starts_at)
);

create index if not exists business_listings_status_category_idx on public.business_listings(status, category, created_at desc);
create index if not exists campus_information_status_kind_idx on public.campus_information(status, kind, starts_at, created_at desc);

alter table public.business_listings enable row level security;
alter table public.campus_information enable row level security;

create policy "Public can read approved businesses" on public.business_listings
  for select to anon, authenticated using (status = 'approved' or submitted_by = (select auth.uid()) or (select public.is_site_admin()));
create policy "Signed-in users can submit businesses" on public.business_listings
  for insert to authenticated with check (submitted_by = (select auth.uid()) and status = 'pending' and reviewed_by is null and reviewed_at is null);
create policy "Site admins can review businesses" on public.business_listings
  for update to authenticated using ((select public.is_site_admin())) with check ((select public.is_site_admin()));
create policy "Public can read approved campus information" on public.campus_information
  for select to anon, authenticated using (status = 'approved' or submitted_by = (select auth.uid()) or (select public.is_site_admin()));
create policy "Signed-in users can submit campus information" on public.campus_information
  for insert to authenticated with check (submitted_by = (select auth.uid()) and status = 'pending' and reviewed_by is null and reviewed_at is null);
create policy "Site admins can review campus information" on public.campus_information
  for update to authenticated using ((select public.is_site_admin())) with check ((select public.is_site_admin()));

-- Notifications are visible only to site admins; avoid storing unverified contact information in public rows.
create or replace function public.notify_admin_new_business()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.admin_notifications(event_type, entity_id, actor_id, summary)
  values ('business_submission', new.id, new.submitted_by, 'New business submission: ' || new.name);
  return new;
end; $$;
drop trigger if exists on_business_submission_notify_admin on public.business_listings;
create trigger on_business_submission_notify_admin after insert on public.business_listings
  for each row when (new.status = 'pending') execute function public.notify_admin_new_business();

create or replace function public.notify_admin_new_campus_info()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.admin_notifications(event_type, entity_id, actor_id, summary)
  values ('campus_information_submission', new.id, new.submitted_by, 'New ' || new.kind || ' submission: ' || new.title);
  return new;
end; $$;
drop trigger if exists on_campus_information_notify_admin on public.campus_information;
create trigger on_campus_information_notify_admin after insert on public.campus_information
  for each row when (new.status = 'pending') execute function public.notify_admin_new_campus_info();
