-- Let authenticated users submit group proposals while RLS enforces ownership and pending status.
grant insert (name, slug, category, description, created_by, status)
on public.groups to authenticated;
