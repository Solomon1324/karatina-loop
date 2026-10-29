-- Group admin handover and safe recovery when the current group admin leaves.
-- Only an active group admin may transfer the role while one is in the group.
-- A site admin may appoint or replace the group admin at any time, including
-- when the group has no active group admin.

create or replace function public.assign_group_admin(target_group_id uuid, target_user_id uuid)
returns public.group_members
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_group_status text;
  selected_member public.group_members;
  assigned_member public.group_members;
  caller_is_site_admin boolean;
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in before assigning a group admin.' using errcode = '28000';
  end if;

  -- Serialize role changes and prevent two concurrent assignments from racing.
  select g.status into selected_group_status
  from public.groups g
  where g.id = target_group_id
  for update;

  if not found or selected_group_status <> 'approved' then
    raise exception 'This group is not available for admin assignment.' using errcode = '22023';
  end if;

  caller_is_site_admin := public.is_site_admin();
  if not caller_is_site_admin and not public.is_group_admin(target_group_id) then
    raise exception 'Only the current group admin or the main site admin can appoint a group admin.' using errcode = '42501';
  end if;

  select gm.* into selected_member
  from public.group_members gm
  where gm.group_id = target_group_id
    and gm.user_id = target_user_id
    and gm.status = 'approved'
  for update;

  if not found then
    raise exception 'The selected person must already be an approved member of this group.' using errcode = '22023';
  end if;

  if not caller_is_site_admin and target_user_id = (select auth.uid()) then
    raise exception 'Choose another approved member to take over the group admin role.' using errcode = '22023';
  end if;

  -- There is one active group admin at a time. The selected member takes over;
  -- the previous admin becomes a regular member if still in the group.
  update public.group_members gm
  set role = 'member'
  where gm.group_id = target_group_id
    and gm.status = 'approved'
    and gm.role = 'admin';

  update public.group_members gm
  set role = 'admin', reviewed_at = now()
  where gm.group_id = target_group_id
    and gm.user_id = target_user_id
    and gm.status = 'approved'
  returning gm.* into assigned_member;

  update public.groups g
  set owner_id = target_user_id
  where g.id = target_group_id;

  return assigned_member;
end;
$$;

create or replace function public.leave_group(target_group_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_group_status text;
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in before leaving a group.' using errcode = '28000';
  end if;

  select g.status into selected_group_status
  from public.groups g
  where g.id = target_group_id
  for update;

  if not found or selected_group_status <> 'approved' then
    raise exception 'This group is not available.' using errcode = '22023';
  end if;

  delete from public.group_members gm
  where gm.group_id = target_group_id
    and gm.user_id = (select auth.uid())
    and gm.status = 'approved';

  if not found then
    raise exception 'You are not an approved member of this group.' using errcode = 'P0002';
  end if;

  -- If the departing member was the only group admin, no one is automatically
  -- promoted. Only public.is_site_admin() can assign the next admin via RPC.
end;
$$;

revoke all on function public.assign_group_admin(uuid, uuid) from public, anon;
revoke all on function public.leave_group(uuid) from public, anon;
grant execute on function public.assign_group_admin(uuid, uuid) to authenticated;
grant execute on function public.leave_group(uuid) to authenticated;
