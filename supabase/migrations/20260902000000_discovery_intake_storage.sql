-- Discovery intake file storage in the private project-files bucket.
-- Path shape (from fileUploadConfig.discoveryIntakeStoragePath):
--   projects/{projectId}/discovery/{intakeId}/{fileId}.{ext}
--
-- Deliverable paths (7 segments) and contract signed-copy paths (4 segments) are unchanged.
-- Adds dedicated helpers + storage.objects policies; does not modify existing deliverable/contract policies.

-- ---------------------------------------------------------------------------
-- Resolve discovery intake from a storage object path (validates path + DB row)
-- ---------------------------------------------------------------------------

create or replace function public.discovery_intake_for_storage_path(object_name text)
returns public.discovery_intakes
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  parts text[];
  pid uuid;
  iid uuid;
  row public.discovery_intakes;
begin
  if object_name is null then
    return null;
  end if;

  parts := string_to_array(object_name, '/');
  if array_length(parts, 1) is distinct from 5 then
    return null;
  end if;
  if parts[1] <> 'projects' or parts[3] <> 'discovery' then
    return null;
  end if;
  if parts[5] is null
    or parts[5] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]+$'
  then
    return null;
  end if;

  begin
    pid := parts[2]::uuid;
    iid := parts[4]::uuid;
  exception
    when invalid_text_representation then
      return null;
  end;

  select di.* into row
  from public.discovery_intakes di
  where di.id = iid
    and di.project_id = pid;

  if not found then
    return null;
  end if;

  return row;
end;
$$;

comment on function public.discovery_intake_for_storage_path(text) is
  'Parse a discovery storage path and return the matching discovery_intakes row, or NULL when invalid.';

-- ---------------------------------------------------------------------------
-- Storage authorization helpers (mirror discovery_intake_files table RLS)
-- ---------------------------------------------------------------------------

create or replace function public.can_access_discovery_file(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  intake public.discovery_intakes;
begin
  intake := public.discovery_intake_for_storage_path(object_name);
  if intake is null then
    return false;
  end if;

  if public.is_admin() then
    return true;
  end if;

  if public.staff_may_project(intake.project_id, 'projects.view') then
    return true;
  end if;

  return public.is_client()
    and intake.client_id = public.current_client_id();
end;
$$;

comment on function public.can_access_discovery_file(text) is
  'Storage SELECT helper. Admin, assigned staff with projects.view, or the owning client.';

create or replace function public.can_upload_discovery_file(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  intake public.discovery_intakes;
begin
  intake := public.discovery_intake_for_storage_path(object_name);
  if intake is null then
    return false;
  end if;

  if public.is_client() then
    if intake.client_id is distinct from public.current_client_id() then
      return false;
    end if;
    return intake.status in ('awaiting_client', 'more_information_needed');
  end if;

  return public.staff_may_coordinate_project(intake.project_id);
end;
$$;

comment on function public.can_upload_discovery_file(text) is
  'Storage INSERT helper. Client during an open intake, or a coordinator (admin/PM) on the project.';

create or replace function public.can_delete_discovery_file(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  intake public.discovery_intakes;
begin
  intake := public.discovery_intake_for_storage_path(object_name);
  if intake is null then
    return false;
  end if;

  if public.is_client()
    and intake.client_id = public.current_client_id()
  then
    return true;
  end if;

  return public.staff_may_coordinate_project(intake.project_id);
end;
$$;

comment on function public.can_delete_discovery_file(text) is
  'Storage DELETE helper. Owning client or project coordinator (admin/PM).';

-- ---------------------------------------------------------------------------
-- storage.objects policies (additive; deliverable + contract policies unchanged)
-- ---------------------------------------------------------------------------

drop policy if exists discovery_storage_select on storage.objects;
create policy discovery_storage_select
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'project-files'
    and public.can_access_discovery_file(name)
  );

drop policy if exists discovery_storage_insert on storage.objects;
create policy discovery_storage_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'project-files'
    and public.can_upload_discovery_file(name)
  );

drop policy if exists discovery_storage_delete on storage.objects;
create policy discovery_storage_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'project-files'
    and public.can_delete_discovery_file(name)
  );

-- ---------------------------------------------------------------------------
-- Execute grants
-- ---------------------------------------------------------------------------

revoke all on function public.discovery_intake_for_storage_path(text) from public, anon;
revoke all on function public.can_access_discovery_file(text) from public, anon;
revoke all on function public.can_upload_discovery_file(text) from public, anon;
revoke all on function public.can_delete_discovery_file(text) from public, anon;

grant execute on function public.discovery_intake_for_storage_path(text) to authenticated;
grant execute on function public.can_access_discovery_file(text) to authenticated;
grant execute on function public.can_upload_discovery_file(text) to authenticated;
grant execute on function public.can_delete_discovery_file(text) to authenticated;
