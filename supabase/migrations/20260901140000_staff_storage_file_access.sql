-- Restore staff access for private project-files objects.
-- Live can_access_project_file was still the Phase 12 admin-or-client helper,
-- so Storage INSERT/SELECT ignored files.view / files.manage + assignment.
-- Does not change bucket privacy or signed-URL access.

create or replace function public.can_access_project_file(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  parts text[];
  pid uuid;
  did uuid;
begin
  pid := public.storage_project_id(object_name);
  if pid is null then
    return false;
  end if;
  parts := string_to_array(object_name, '/');
  begin
    did := parts[4]::uuid;
  exception when invalid_text_representation then
    return false;
  end;

  if not exists (
    select 1 from public.deliverables d
    where d.id = did and d.project_id = pid
  ) then
    return false;
  end if;

  if public.is_admin() then
    return true;
  end if;

  if public.staff_may_project(pid, 'files.view') then
    return true;
  end if;

  return exists (
    select 1
    from public.deliverables d
    join public.projects p on p.id = d.project_id
    where d.id = did
      and d.project_id = pid
      and p.client_id = public.current_client_id()
  );
end;
$$;

comment on function public.can_access_project_file(text) is
  'Storage helper. Admin, assigned staff with files.view, or the owning client.';

revoke all on function public.can_access_project_file(text) from public, anon;
grant execute on function public.can_access_project_file(text) to authenticated;
