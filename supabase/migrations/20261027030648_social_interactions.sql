-- Social features for Karatina Loop: post comments and emoji reactions.
create table if not exists public.group_post_comments (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  post_id uuid not null references public.group_posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null default '' check (char_length(body) <= 1000),
  image_path text check (image_path is null or char_length(image_path) <= 500),
  created_at timestamptz not null default now(),
  constraint group_post_comments_content_check check (length(trim(body)) > 0 or image_path is not null)
);
create index if not exists group_post_comments_feed_idx
  on public.group_post_comments(group_id, post_id, created_at asc);
create table if not exists public.group_post_reactions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  post_id uuid not null references public.group_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null check (emoji = any (array['👍','❤️','😂','🔥','👏','😮','🙌','🎉','💯','🥰']::text[])),
  created_at timestamptz not null default now(),
  constraint group_post_reactions_unique unique(post_id, user_id, emoji)
);
create index if not exists group_post_reactions_feed_idx
  on public.group_post_reactions(group_id, post_id, created_at desc);
alter table public.group_post_comments enable row level security;
alter table public.group_post_reactions enable row level security;
revoke all on public.group_post_comments, public.group_post_reactions from anon, authenticated;
grant select on public.group_post_comments, public.group_post_reactions to anon, authenticated;
grant insert, delete on public.group_post_comments to authenticated;
grant insert, delete on public.group_post_reactions to authenticated;
drop policy if exists "Anyone can read comments on approved group posts" on public.group_post_comments;
create policy "Anyone can read comments on approved group posts"
on public.group_post_comments for select to anon, authenticated
using (exists (select 1 from public.groups g where g.id = group_post_comments.group_id and g.status = 'approved'));
drop policy if exists "Approved group members can comment on posts" on public.group_post_comments;
create policy "Approved group members can comment on posts"
on public.group_post_comments for insert to authenticated
with check (
  author_id = (select auth.uid())
  and (length(trim(body)) > 0 or image_path is not null)
  and (image_path is null or image_path like group_id::text || '/' || (select auth.uid())::text || '/%')
  and exists (
    select 1 from public.group_posts gp join public.groups g on g.id = gp.group_id
    where gp.id = group_post_comments.post_id and gp.group_id = group_post_comments.group_id
      and g.status = 'approved' and public.is_approved_group_member(g.id)
  )
);
drop policy if exists "Comment authors and group admins can delete comments" on public.group_post_comments;
create policy "Comment authors and group admins can delete comments"
on public.group_post_comments for delete to authenticated
using (author_id = (select auth.uid()) or public.is_group_admin(group_id) or (select public.is_site_admin()));
drop policy if exists "Anyone can read reactions on approved group posts" on public.group_post_reactions;
create policy "Anyone can read reactions on approved group posts"
on public.group_post_reactions for select to anon, authenticated
using (exists (select 1 from public.groups g where g.id = group_post_reactions.group_id and g.status = 'approved'));
drop policy if exists "Approved group members can react to posts" on public.group_post_reactions;
create policy "Approved group members can react to posts"
on public.group_post_reactions for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.group_posts gp join public.groups g on g.id = gp.group_id
    where gp.id = group_post_reactions.post_id and gp.group_id = group_post_reactions.group_id
      and g.status = 'approved' and public.is_approved_group_member(g.id)
  )
);
drop policy if exists "Users can remove their own reactions and admins can moderate" on public.group_post_reactions;
create policy "Users can remove their own reactions and admins can moderate"
on public.group_post_reactions for delete to authenticated
using (user_id = (select auth.uid()) or public.is_group_admin(group_id) or (select public.is_site_admin()));
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='group_post_comments') then
      execute 'alter publication supabase_realtime add table public.group_post_comments';
    end if;
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='group_post_reactions') then
      execute 'alter publication supabase_realtime add table public.group_post_reactions';
    end if;
  end if;
end $$;
