-- Stream inserts, image removals and deletions to open group dialogs.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'group_posts') then
      alter publication supabase_realtime add table public.group_posts;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'group_messages') then
      alter publication supabase_realtime add table public.group_messages;
    end if;
  end if;
end
$$;
