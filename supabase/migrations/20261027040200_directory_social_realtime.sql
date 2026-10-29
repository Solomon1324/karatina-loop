-- Live refresh for business/campus publication approvals and social activity.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='business_listings') then
      execute 'alter publication supabase_realtime add table public.business_listings';
    end if;
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='campus_information') then
      execute 'alter publication supabase_realtime add table public.campus_information';
    end if;
  end if;
end $$;
