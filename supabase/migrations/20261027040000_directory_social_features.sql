-- Social features shared by the business directory and campus information.
-- Directory media is stored in a private bucket and only viewable by approved readers,
-- the uploader, or a site administrator.

alter table public.business_listings
  add column if not exists image_path text;
alter table public.campus_information
  add column if not exists image_path text;

create table if not exists public.business_listing_comments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.business_listings(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null default '' check (char_length(body) <= 1000),
  image_path text check (image_path is null or char_length(image_path) <= 500),
  created_at timestamptz not null default now(),
  constraint business_listing_comments_content_check
    check (length(trim(body)) > 0 or image_path is not null)
);
create index if not exists business_listing_comments_feed_idx
  on public.business_listing_comments(business_id, created_at asc);

create table if not exists public.business_listing_reactions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.business_listings(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null check (emoji = any (array['👍','❤️','😂','🔥','👏','😮','🙌','🎉','💯','🥰']::text[])),
  created_at timestamptz not null default now(),
  constraint business_listing_reactions_unique unique(business_id, user_id, emoji)
);
create index if not exists business_listing_reactions_feed_idx
  on public.business_listing_reactions(business_id, created_at desc);

create table if not exists public.campus_information_comments (
  id uuid primary key default gen_random_uuid(),
  campus_information_id uuid not null references public.campus_information(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null default '' check (char_length(body) <= 1000),
  image_path text check (image_path is null or char_length(image_path) <= 500),
  created_at timestamptz not null default now(),
  constraint campus_information_comments_content_check
    check (length(trim(body)) > 0 or image_path is not null)
);
create index if not exists campus_information_comments_feed_idx
  on public.campus_information_comments(campus_information_id, created_at asc);

create table if not exists public.campus_information_reactions (
  id uuid primary key default gen_random_uuid(),
  campus_information_id uuid not null references public.campus_information(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null check (emoji = any (array['👍','❤️','😂','🔥','👏','😮','🙌','🎉','💯','🥰']::text[])),
  created_at timestamptz not null default now(),
  constraint campus_information_reactions_unique unique(campus_information_id, user_id, emoji)
);
create index if not exists campus_information_reactions_feed_idx
  on public.campus_information_reactions(campus_information_id, created_at desc);

alter table public.business_listing_comments enable row level security;
alter table public.business_listing_reactions enable row level security;
alter table public.campus_information_comments enable row level security;
alter table public.campus_information_reactions enable row level security;

revoke all on public.business_listing_comments, public.business_listing_reactions,
  public.campus_information_comments, public.campus_information_reactions from anon, authenticated;
grant select on public.business_listing_comments, public.business_listing_reactions,
  public.campus_information_comments, public.campus_information_reactions to anon, authenticated;
grant insert, delete on public.business_listing_comments, public.business_listing_reactions,
  public.campus_information_comments, public.campus_information_reactions to authenticated;
-- These are column-level additions so the existing insert grants remain narrowly scoped.
grant insert (image_path) on public.business_listings to authenticated;
grant insert (image_path) on public.campus_information to authenticated;

-- Public visitors can read comments/reactions only when the parent item is approved.
drop policy if exists "Public can read comments on approved businesses" on public.business_listing_comments;
create policy "Public can read comments on approved businesses"
  on public.business_listing_comments for select to anon, authenticated
  using (exists (select 1 from public.business_listings b where b.id = business_listing_comments.business_id and b.status = 'approved'));
drop policy if exists "Signed in users can comment on approved businesses" on public.business_listing_comments;
create policy "Signed in users can comment on approved businesses"
  on public.business_listing_comments for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and (length(trim(body)) > 0 or image_path is not null)
    and (image_path is null or image_path like (select auth.uid())::text || '/business-comments/%')
    and exists (select 1 from public.business_listings b where b.id = business_listing_comments.business_id and b.status = 'approved')
  );
drop policy if exists "Authors and admins can delete business comments" on public.business_listing_comments;
create policy "Authors and admins can delete business comments"
  on public.business_listing_comments for delete to authenticated
  using (author_id = (select auth.uid()) or (select public.is_site_admin()));

drop policy if exists "Public can read reactions on approved businesses" on public.business_listing_reactions;
create policy "Public can read reactions on approved businesses"
  on public.business_listing_reactions for select to anon, authenticated
  using (exists (select 1 from public.business_listings b where b.id = business_listing_reactions.business_id and b.status = 'approved'));
drop policy if exists "Signed in users can react to approved businesses" on public.business_listing_reactions;
create policy "Signed in users can react to approved businesses"
  on public.business_listing_reactions for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.business_listings b where b.id = business_listing_reactions.business_id and b.status = 'approved'));
drop policy if exists "Users can remove own business reactions and admins can moderate" on public.business_listing_reactions;
create policy "Users can remove own business reactions and admins can moderate"
  on public.business_listing_reactions for delete to authenticated
  using (user_id = (select auth.uid()) or (select public.is_site_admin()));

drop policy if exists "Public can read comments on approved campus info" on public.campus_information_comments;
create policy "Public can read comments on approved campus info"
  on public.campus_information_comments for select to anon, authenticated
  using (exists (select 1 from public.campus_information c where c.id = campus_information_comments.campus_information_id and c.status = 'approved'));
drop policy if exists "Signed in users can comment on approved campus info" on public.campus_information_comments;
create policy "Signed in users can comment on approved campus info"
  on public.campus_information_comments for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and (length(trim(body)) > 0 or image_path is not null)
    and (image_path is null or image_path like (select auth.uid())::text || '/campus-comments/%')
    and exists (select 1 from public.campus_information c where c.id = campus_information_comments.campus_information_id and c.status = 'approved')
  );
drop policy if exists "Authors and admins can delete campus info comments" on public.campus_information_comments;
create policy "Authors and admins can delete campus info comments"
  on public.campus_information_comments for delete to authenticated
  using (author_id = (select auth.uid()) or (select public.is_site_admin()));

drop policy if exists "Public can read reactions on approved campus info" on public.campus_information_reactions;
create policy "Public can read reactions on approved campus info"
  on public.campus_information_reactions for select to anon, authenticated
  using (exists (select 1 from public.campus_information c where c.id = campus_information_reactions.campus_information_id and c.status = 'approved'));
drop policy if exists "Signed in users can react to approved campus info" on public.campus_information_reactions;
create policy "Signed in users can react to approved campus info"
  on public.campus_information_reactions for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.campus_information c where c.id = campus_information_reactions.campus_information_id and c.status = 'approved'));
drop policy if exists "Users can remove own campus reactions and admins can moderate" on public.campus_information_reactions;
create policy "Users can remove own campus reactions and admins can moderate"
  on public.campus_information_reactions for delete to authenticated
  using (user_id = (select auth.uid()) or (select public.is_site_admin()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('community-media', 'community-media', false, 8388608, array['image/jpeg','image/png','image/webp','image/gif']::text[])
on conflict (id) do update set public = false, file_size_limit = 8388608, allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif']::text[];

drop policy if exists "Public can read approved community media" on storage.objects;
create policy "Public can read approved community media"
  on storage.objects for select to anon
  using (
    bucket_id = 'community-media' and (
      exists (select 1 from public.business_listings b where b.image_path = storage.objects.name and b.status = 'approved')
      or exists (select 1 from public.campus_information c where c.image_path = storage.objects.name and c.status = 'approved')
      or exists (select 1 from public.business_listing_comments cm join public.business_listings b on b.id = cm.business_id where cm.image_path = storage.objects.name and b.status = 'approved')
      or exists (select 1 from public.campus_information_comments cm join public.campus_information c on c.id = cm.campus_information_id where cm.image_path = storage.objects.name and c.status = 'approved')
    )
  );
drop policy if exists "Signed in users can read relevant community media" on storage.objects;
create policy "Signed in users can read relevant community media"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'community-media' and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or (select public.is_site_admin())
      or exists (select 1 from public.business_listings b where b.image_path = storage.objects.name and b.status = 'approved')
      or exists (select 1 from public.campus_information c where c.image_path = storage.objects.name and c.status = 'approved')
      or exists (select 1 from public.business_listing_comments cm join public.business_listings b on b.id = cm.business_id where cm.image_path = storage.objects.name and b.status = 'approved')
      or exists (select 1 from public.campus_information_comments cm join public.campus_information c on c.id = cm.campus_information_id where cm.image_path = storage.objects.name and c.status = 'approved')
    )
  );
drop policy if exists "Signed in users can upload their own community media" on storage.objects;
create policy "Signed in users can upload their own community media"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'community-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (storage.foldername(name))[2] = any (array['businesses','campus','business-comments','campus-comments']::text[])
  );
drop policy if exists "Uploaders and site admins can delete community media" on storage.objects;
create policy "Uploaders and site admins can delete community media"
  on storage.objects for delete to authenticated
  using (bucket_id = 'community-media' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_site_admin())));

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='business_listing_comments') then
      execute 'alter publication supabase_realtime add table public.business_listing_comments';
    end if;
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='business_listing_reactions') then
      execute 'alter publication supabase_realtime add table public.business_listing_reactions';
    end if;
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='campus_information_comments') then
      execute 'alter publication supabase_realtime add table public.campus_information_comments';
    end if;
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='campus_information_reactions') then
      execute 'alter publication supabase_realtime add table public.campus_information_reactions';
    end if;
  end if;
end $$;
