-- Karatina Loop community core: profiles, groups, approvals, public feeds/chat and moderation.
-- Apply with the Supabase SQL editor or CLI after creating the project.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Member' check (char_length(display_name) between 1 and 80),
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.site_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  category text not null check (char_length(category) between 2 and 40),
  description text not null check (char_length(description) between 10 and 600),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'archived')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  owner_id uuid references public.profiles(id) on delete restrict,
  approved_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  check ((status <> 'approved') or (owner_id is not null and approved_by is not null))
);

create table if not exists public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  unique (group_id, user_id)
);

create table if not exists public.group_posts (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete restrict,
  body text not null default '' check (char_length(body) <= 5000),
  image_path text,
  check (char_length(body) > 0 or image_path is not null),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.group_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete restrict,
  body text not null default '' check (char_length(body) <= 2000),
  image_path text,
  check (char_length(body) > 0 or image_path is not null),
  created_at timestamptz not null default now()
);

create table if not exists public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  entity_id uuid not null,
  actor_id uuid references public.profiles(id) on delete set null,
  summary text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  group_id uuid references public.groups(id) on delete cascade,
  target_type text not null check (target_type in ('group', 'post', 'message', 'business')),
  target_id uuid not null,
  reason text not null check (char_length(reason) between 5 and 1000),
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'dismissed')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists groups_status_created_idx on public.groups(status, created_at desc);
create index if not exists groups_created_by_idx on public.groups(created_by);
create index if not exists group_members_user_status_idx on public.group_members(user_id, status);
create index if not exists group_members_group_status_idx on public.group_members(group_id, status);
create index if not exists group_posts_feed_idx on public.group_posts(group_id, created_at desc);
create index if not exists group_messages_feed_idx on public.group_messages(group_id, created_at desc);
create index if not exists admin_notifications_unread_idx on public.admin_notifications(created_at desc) where read_at is null;
create index if not exists content_reports_pending_idx on public.content_reports(created_at desc) where status = 'pending';

create or replace function public.is_site_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.site_admins sa
    where sa.user_id = (select auth.uid())
  );
$$;

create or replace function public.is_group_admin(target_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.group_members gm
    join public.groups g on g.id = gm.group_id
    where gm.group_id = target_group_id
      and g.status = 'approved'
      and gm.user_id = (select auth.uid())
      and gm.role = 'admin'
      and gm.status = 'approved'
  );
$$;

create or replace function public.is_approved_group_member(target_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.group_members gm
    join public.groups g on g.id = gm.group_id
    where gm.group_id = target_group_id
      and g.status = 'approved'
      and gm.user_id = (select auth.uid())
      and gm.status = 'approved'
  );
$$;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), left(split_part(coalesce(new.email, 'member'), '@', 1), 80))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function public.handle_new_auth_user();

create or replace function public.notify_admin_new_group()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.admin_notifications (event_type, entity_id, actor_id, summary)
  values ('group_proposal', new.id, new.created_by, 'New group proposal: ' || new.name);
  return new;
end;
$$;

drop trigger if exists on_group_proposal_notify_admin on public.groups;
create trigger on_group_proposal_notify_admin
after insert on public.groups
for each row when (new.status = 'pending')
execute function public.notify_admin_new_group();

create or replace function public.review_group_proposal(target_group_id uuid, approve boolean)
returns public.groups
language plpgsql
security definer
set search_path = ''
as $$
declare
  reviewed_group public.groups;
begin
  if not public.is_site_admin() then
    raise exception 'Only a site admin can review group proposals' using errcode = '42501';
  end if;

  update public.groups g
  set status = case when approve then 'approved' else 'rejected' end,
      owner_id = case when approve then g.created_by else null end,
      approved_by = case when approve then (select auth.uid()) else null end,
      reviewed_at = now()
  where g.id = target_group_id and g.status = 'pending'
  returning g.* into reviewed_group;

  if not found then
    raise exception 'Group proposal was not found or has already been reviewed';
  end if;

  if approve then
    insert into public.group_members (group_id, user_id, role, status, reviewed_at)
    values (reviewed_group.id, reviewed_group.created_by, 'admin', 'approved', now())
    on conflict (group_id, user_id) do update
      set role = 'admin', status = 'approved', reviewed_at = now();
  end if;

  update public.admin_notifications
  set read_at = coalesce(read_at, now())
  where entity_id = reviewed_group.id and event_type = 'group_proposal';

  return reviewed_group;
end;
$$;

create or replace function public.request_group_membership(target_group_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected integer;
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in before requesting group membership' using errcode = '42501';
  end if;
  if not exists (select 1 from public.groups g where g.id = target_group_id and g.status = 'approved') then
    raise exception 'Group is not available for membership requests';
  end if;

  insert into public.group_members (group_id, user_id, role, status)
  values (target_group_id, (select auth.uid()), 'member', 'pending')
  on conflict (group_id, user_id) do update
    set status = 'pending', requested_at = now(), reviewed_at = null
    where public.group_members.status = 'rejected'
      and public.group_members.role = 'member';

  get diagnostics affected = row_count;
  return affected > 0;
end;
$$;

create or replace function public.review_group_membership(target_group_id uuid, target_user_id uuid, approve boolean)
returns public.group_members
language plpgsql
security definer
set search_path = ''
as $$
declare
  reviewed_member public.group_members;
begin
  if not public.is_site_admin() and not public.is_group_admin(target_group_id) then
    raise exception 'Only this group admin can review membership requests' using errcode = '42501';
  end if;

  update public.group_members gm
  set status = case when approve then 'approved' else 'rejected' end,
      reviewed_at = now()
  where gm.group_id = target_group_id
    and gm.user_id = target_user_id
    and gm.role = 'member'
    and gm.status = 'pending'
  returning gm.* into reviewed_member;

  if not found then
    raise exception 'Membership request was not found or has already been reviewed';
  end if;
  return reviewed_member;
end;
$$;

alter table public.profiles enable row level security;
alter table public.site_admins enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_posts enable row level security;
alter table public.group_messages enable row level security;
alter table public.admin_notifications enable row level security;
alter table public.content_reports enable row level security;

revoke all on public.profiles, public.site_admins, public.groups, public.group_members,
  public.group_posts, public.group_messages, public.admin_notifications, public.content_reports
from anon, authenticated;

grant select on public.profiles to anon, authenticated;
grant update (display_name, avatar_url) on public.profiles to authenticated;
grant select on public.groups to anon, authenticated;
grant insert (name, slug, category, description, created_by) on public.groups to authenticated;
grant select on public.group_members to authenticated;
grant select, insert, delete on public.group_posts to authenticated;
grant update (body) on public.group_posts to authenticated;
grant select, insert, delete on public.group_messages to authenticated;
grant select, update (read_at) on public.admin_notifications to authenticated;
grant select, insert, update on public.content_reports to authenticated;

create policy "Public profiles show display names"
on public.profiles for select to anon, authenticated using (true);
create policy "Users update their own profile"
on public.profiles for update to authenticated
using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "Approved groups and own proposals are visible"
on public.groups for select to anon, authenticated
using (status = 'approved' or created_by = (select auth.uid()) or (select public.is_site_admin()));
create policy "Signed-in users can submit group proposals"
on public.groups for insert to authenticated
with check (
  created_by = (select auth.uid()) and status = 'pending'
  and owner_id is null and approved_by is null
);

create policy "Members and relevant admins can view memberships"
on public.group_members for select to authenticated
using (user_id = (select auth.uid()) or (select public.is_site_admin()) or public.is_group_admin(group_id));

create policy "Anyone can read posts in approved groups"
on public.group_posts for select to anon, authenticated
using (exists (select 1 from public.groups g where g.id = group_id and g.status = 'approved'));
create policy "Approved group members can write posts"
on public.group_posts for insert to authenticated
with check (author_id = (select auth.uid()) and public.is_approved_group_member(group_id) and (image_path is null or image_path like group_id::text || '/' || (select auth.uid())::text || '/%'));
create policy "Authors and admins can edit posts"
on public.group_posts for update to authenticated
using (author_id = (select auth.uid()) or public.is_group_admin(group_id) or (select public.is_site_admin()))
with check (author_id = (select auth.uid()) or public.is_group_admin(group_id) or (select public.is_site_admin()));
create policy "Authors and admins can remove posts"
on public.group_posts for delete to authenticated
using (author_id = (select auth.uid()) or public.is_group_admin(group_id) or (select public.is_site_admin()));

create policy "Anyone can read chat in approved groups"
on public.group_messages for select to anon, authenticated
using (exists (select 1 from public.groups g where g.id = group_id and g.status = 'approved'));
create policy "Approved group members can send chat messages"
on public.group_messages for insert to authenticated
with check (author_id = (select auth.uid()) and public.is_approved_group_member(group_id) and (image_path is null or image_path like group_id::text || '/' || (select auth.uid())::text || '/%'));
create policy "Authors and admins can remove chat messages"
on public.group_messages for delete to authenticated
using (author_id = (select auth.uid()) or public.is_group_admin(group_id) or (select public.is_site_admin()));

create policy "Site admins can read proposal notifications"
on public.admin_notifications for select to authenticated
using ((select public.is_site_admin()));
create policy "Site admins can mark notifications read"
on public.admin_notifications for update to authenticated
using ((select public.is_site_admin())) with check ((select public.is_site_admin()));

create policy "Signed-in users can report content"
on public.content_reports for insert to authenticated
with check (reporter_id = (select auth.uid()) and status = 'pending' and reviewed_at is null);
create policy "Site admins can review reports"
on public.content_reports for select to authenticated
using ((select public.is_site_admin()));
create policy "Site admins can update reports"
on public.content_reports for update to authenticated
using ((select public.is_site_admin())) with check ((select public.is_site_admin()));

revoke all on function public.review_group_proposal(uuid, boolean) from public, anon;
revoke all on function public.request_group_membership(uuid) from public, anon;
revoke all on function public.review_group_membership(uuid, uuid, boolean) from public, anon;
grant execute on function public.review_group_proposal(uuid, boolean) to authenticated;
grant execute on function public.request_group_membership(uuid) to authenticated;
grant execute on function public.review_group_membership(uuid, uuid, boolean) to authenticated;

-- Use private Realtime Broadcast topics. Anyone may receive broadcasts for approved groups;
-- clients still cannot broadcast directly. New chat messages are inserted through the RLS-protected table.
create policy "Anyone can receive approved group chat broadcasts"
on realtime.messages for select to anon, authenticated
using (
  extension = 'broadcast'
  and exists (
    select 1 from public.groups g
    where g.status = 'approved'
      and realtime.topic() = 'group:' || g.id::text
  )
);

create or replace function public.broadcast_group_chat_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.broadcast_changes(
    'group:' || new.group_id::text,
    'INSERT', 'INSERT', 'group_messages', 'public', new, null
  );
  return new;
end;
$$;

drop trigger if exists on_group_message_broadcast on public.group_messages;
create trigger on_group_message_broadcast
after insert on public.group_messages
for each row execute function public.broadcast_group_chat_message();



-- Publicly readable group photos; only approved members can upload.
-- One photo per post or chat message; max 8 MiB; image formats only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'group-media', 'group-media', true, 8388608,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Approved members can upload group photos"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'group-media'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and (storage.foldername(name))[2] = (select auth.uid())::text
  and public.is_approved_group_member(((storage.foldername(name))[1])::uuid)
);

create policy "Uploader or group admins can remove group photos"
on storage.objects for delete to authenticated
using (
  bucket_id = 'group-media'
  and (
    (storage.foldername(name))[2] = (select auth.uid())::text
    or (select public.is_site_admin())
    or (
      (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and public.is_group_admin(((storage.foldername(name))[1])::uuid)
    )
  )
);




create or replace function public.broadcast_group_post()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.broadcast_changes(
    'group:' || new.group_id::text,
    'INSERT', 'INSERT', 'group_posts', 'public', new, null
  );
  return new;
end;
$$;

drop trigger if exists on_group_post_broadcast on public.group_posts;
create trigger on_group_post_broadcast
after insert on public.group_posts
for each row execute function public.broadcast_group_post();
