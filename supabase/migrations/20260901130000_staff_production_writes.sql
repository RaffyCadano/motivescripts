-- Staff production writes: apply the existing staff_may_project / staff_may_client /
-- has_grant model to INSERT/UPDATE/DELETE and Storage. SELECT policies from
-- 20260901120000 stay as they are.
--
-- Coordinators (Admin, Project Manager, catch-all Staff) have clients.manage.
-- Production templates have projects.manage + files.manage but not clients.manage,
-- so they can work assigned files/milestones/own tasks without assigning teammates
-- or rewriting other people's tasks.
-- Sales/Accounting still lack projects.view / files.manage.

-- ---------------------------------------------------------------------------
-- Coordinator helper (existing grants only)
-- ---------------------------------------------------------------------------

create or replace function public.staff_may_coordinate_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin()
    or (
      public.staff_may_project(p_project_id, 'projects.manage')
      and public.has_grant('clients.manage')
    );
$$;

revoke all on function public.staff_may_coordinate_project(uuid) from public, anon;
grant execute on function public.staff_may_coordinate_project(uuid) to authenticated;

comment on function public.staff_may_coordinate_project(uuid) is
  'Admin, or assigned staff with both projects.manage and clients.manage (Project Manager). Production templates do not have clients.manage.';

-- ---------------------------------------------------------------------------
-- Project staff assignment: Admin or coordinator on that project
-- ---------------------------------------------------------------------------

create or replace function public.assign_staff_to_project(p_project_id uuid, p_user_id uuid, p_label text default '')
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.staff_may_coordinate_project(p_project_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if not exists (select 1 from public.projects where id = p_project_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if not exists (
    select 1
    from public.staff_profiles s
    join public.profiles p on p.id = s.user_id
    where s.user_id = p_user_id and p.role in ('admin', 'staff')
  ) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  insert into public.project_staff_assignments (project_id, user_id, label, assigned_by)
  values (p_project_id, p_user_id, coalesce(trim(p_label), ''), auth.uid())
  on conflict (project_id, user_id) do update set label = excluded.label;
end;
$$;

create or replace function public.unassign_staff_from_project(p_project_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.staff_may_coordinate_project(p_project_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  delete from public.project_staff_assignments
  where project_id = p_project_id and user_id = p_user_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Leads (Sales catalog already has leads.view / leads.manage)
-- ---------------------------------------------------------------------------

drop policy if exists leads_admin_select on public.leads;
drop policy if exists leads_admin_insert on public.leads;
drop policy if exists leads_admin_update on public.leads;
create policy leads_admin_select on public.leads
  for select to authenticated
  using (public.has_grant('leads.view'));
create policy leads_admin_insert on public.leads
  for insert to authenticated
  with check (public.has_grant('leads.manage'));
create policy leads_admin_update on public.leads
  for update to authenticated
  using (public.has_grant('leads.manage'))
  with check (public.has_grant('leads.manage'));

-- ---------------------------------------------------------------------------
-- Clients (PM/Sales clients.manage). Do not open client_staff_data to clients.view.
-- ---------------------------------------------------------------------------

drop policy if exists clients_admin_insert on public.clients;
drop policy if exists clients_admin_update on public.clients;
create policy clients_admin_insert on public.clients
  for insert to authenticated
  with check (public.has_grant('clients.manage'));
create policy clients_admin_update on public.clients
  for update to authenticated
  using (public.staff_may_client(id, 'clients.manage'))
  with check (public.staff_may_client(id, 'clients.manage'));

drop policy if exists client_staff_admin_select on public.client_staff_data;
drop policy if exists client_staff_admin_insert on public.client_staff_data;
drop policy if exists client_staff_admin_update on public.client_staff_data;
create policy client_staff_admin_select on public.client_staff_data
  for select to authenticated
  using (public.staff_may_client(client_id, 'clients.manage'));
create policy client_staff_admin_insert on public.client_staff_data
  for insert to authenticated
  with check (public.staff_may_client(client_id, 'clients.manage'));
create policy client_staff_admin_update on public.client_staff_data
  for update to authenticated
  using (public.staff_may_client(client_id, 'clients.manage'))
  with check (public.staff_may_client(client_id, 'clients.manage'));

-- ---------------------------------------------------------------------------
-- Projects / milestones / tasks
-- ---------------------------------------------------------------------------

drop policy if exists projects_admin_insert on public.projects;
drop policy if exists projects_admin_update on public.projects;
create policy projects_admin_insert on public.projects
  for insert to authenticated
  with check (
    public.has_grant('projects.manage')
    and public.has_grant('clients.manage')
    and public.staff_may_client(client_id, 'projects.manage')
  );
create policy projects_admin_update on public.projects
  for update to authenticated
  using (public.staff_may_project(id, 'projects.manage'))
  with check (public.staff_may_project(id, 'projects.manage'));

drop policy if exists milestones_admin_insert on public.milestones;
drop policy if exists milestones_admin_update on public.milestones;
drop policy if exists milestones_admin_delete on public.milestones;
create policy milestones_admin_insert on public.milestones
  for insert to authenticated
  with check (public.staff_may_project(project_id, 'projects.manage'));
create policy milestones_admin_update on public.milestones
  for update to authenticated
  using (public.staff_may_project(project_id, 'projects.manage'))
  with check (public.staff_may_project(project_id, 'projects.manage'));
create policy milestones_admin_delete on public.milestones
  for delete to authenticated
  using (public.staff_may_project(project_id, 'projects.manage'));

drop policy if exists tasks_admin_insert on public.tasks;
drop policy if exists tasks_admin_update on public.tasks;
drop policy if exists tasks_admin_delete on public.tasks;
create policy tasks_admin_insert on public.tasks
  for insert to authenticated
  with check (public.staff_may_coordinate_project(project_id));
create policy tasks_admin_update on public.tasks
  for update to authenticated
  using (public.staff_may_coordinate_project(project_id))
  with check (public.staff_may_coordinate_project(project_id));
create policy tasks_admin_delete on public.tasks
  for delete to authenticated
  using (public.staff_may_coordinate_project(project_id));

-- tasks_update_assigned (own row) is unchanged.

-- ---------------------------------------------------------------------------
-- Deliverables / versions / feedback
-- ---------------------------------------------------------------------------

drop policy if exists deliverables_admin_insert on public.deliverables;
drop policy if exists deliverables_admin_update on public.deliverables;
create policy deliverables_admin_insert on public.deliverables
  for insert to authenticated
  with check (public.staff_may_project(project_id, 'files.manage'));
create policy deliverables_admin_update on public.deliverables
  for update to authenticated
  using (public.staff_may_project(project_id, 'files.manage'))
  with check (public.staff_may_project(project_id, 'files.manage'));

drop policy if exists file_versions_admin_insert on public.file_versions;
drop policy if exists file_versions_admin_update on public.file_versions;
create policy file_versions_admin_insert on public.file_versions
  for insert to authenticated
  with check (exists (
    select 1 from public.deliverables d
    where d.id = deliverable_id
      and public.staff_may_project(d.project_id, 'files.manage')
  ));
create policy file_versions_admin_update on public.file_versions
  for update to authenticated
  using (exists (
    select 1 from public.deliverables d
    where d.id = deliverable_id
      and public.staff_may_project(d.project_id, 'files.manage')
  ))
  with check (exists (
    select 1 from public.deliverables d
    where d.id = deliverable_id
      and public.staff_may_project(d.project_id, 'files.manage')
  ));

drop policy if exists feedback_admin_update on public.feedback;
create policy feedback_admin_update on public.feedback
  for update to authenticated
  using (public.staff_may_project(project_id, 'feedback.manage'))
  with check (public.staff_may_project(project_id, 'feedback.manage'));

-- ---------------------------------------------------------------------------
-- File version RPCs were still is_admin()
-- ---------------------------------------------------------------------------

create or replace function public.create_file_version(
  p_deliverable_id uuid,
  p_file_name text,
  p_file_type text,
  p_file_size bigint,
  p_description text,
  p_uploaded_by text default 'You',
  p_version_id uuid default null,
  p_storage_path text default null,
  p_mime_type text default ''
)
returns public.file_versions
language plpgsql
security invoker
set search_path = public
as $$
declare
  next_number integer;
  created public.file_versions;
  deliverable_status text;
  deliverable_name text;
  project uuid;
begin
  select status, name, project_id
    into deliverable_status, deliverable_name, project
  from public.deliverables
  where id = p_deliverable_id
  for update;

  if not found then
    raise exception 'Deliverable not found';
  end if;
  if not public.staff_may_project(project, 'files.manage') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if deliverable_status = 'Archived' then
    raise exception 'Archived deliverables cannot receive versions';
  end if;

  select coalesce(max(version_number), 0) + 1
    into next_number
  from public.file_versions
  where deliverable_id = p_deliverable_id;

  update public.file_versions
    set is_current = false
  where deliverable_id = p_deliverable_id
    and is_current;

  insert into public.file_versions (
    id,
    deliverable_id,
    version_number,
    label,
    description,
    is_current,
    file_name,
    file_type,
    file_size,
    uploaded_by,
    storage_path,
    mime_type
  )
  values (
    coalesce(p_version_id, gen_random_uuid()),
    p_deliverable_id,
    next_number,
    'v' || next_number,
    coalesce(p_description, ''),
    true,
    coalesce(p_file_name, ''),
    coalesce(p_file_type, 'Other'),
    coalesce(p_file_size, 0),
    coalesce(p_uploaded_by, 'You'),
    p_storage_path,
    coalesce(p_mime_type, '')
  )
  returning * into created;

  update public.deliverables
    set status = 'Draft',
        archived_at = null,
        updated_at = now()
  where id = p_deliverable_id;

  insert into public.activity (project_id, activity_type, message, metadata)
  values (
    project,
    'version_created',
    deliverable_name || ' v' || next_number || ' created.',
    jsonb_build_object(
      'icon', 'file',
      'deliverable_id', p_deliverable_id,
      'version_id', created.id,
      'storage_path', created.storage_path
    )
  );

  update public.projects set last_activity_at = now() where id = project;

  return created;
end;
$$;

create or replace function public.set_current_file_version(
  p_deliverable_id uuid,
  p_version_id uuid
)
returns public.file_versions
language plpgsql
security invoker
set search_path = public
as $$
declare
  selected public.file_versions;
  project uuid;
  deliverable_name text;
begin
  select project_id, name into project, deliverable_name
  from public.deliverables
  where id = p_deliverable_id;

  if project is null then
    raise exception 'Deliverable not found';
  end if;
  if not public.staff_may_project(project, 'files.manage') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select * into selected
  from public.file_versions
  where id = p_version_id
    and deliverable_id = p_deliverable_id
  for update;

  if not found then
    raise exception 'Version not found';
  end if;

  update public.file_versions
    set is_current = false
  where deliverable_id = p_deliverable_id
    and is_current
    and id <> p_version_id;

  update public.file_versions
    set is_current = true,
        archived_at = null
  where id = p_version_id
  returning * into selected;

  insert into public.activity (project_id, activity_type, message, metadata)
  values (
    project,
    'version_set_current',
    'Version ' || selected.version_number || ' set as current',
    jsonb_build_object('icon', 'file', 'deliverable_id', p_deliverable_id, 'version_id', selected.id)
  );

  update public.projects set last_activity_at = now() where id = project;
  update public.deliverables set updated_at = now() where id = p_deliverable_id;

  return selected;
end;
$$;

-- ---------------------------------------------------------------------------
-- Storage: private bucket, files.manage on assigned projects
-- ---------------------------------------------------------------------------

drop policy if exists project_files_insert on storage.objects;
drop policy if exists project_files_delete on storage.objects;
create policy project_files_insert
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'project-files'
    and public.staff_may_project(public.storage_project_id(name), 'files.manage')
    and public.can_access_project_file(name)
  );
create policy project_files_delete
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'project-files'
    and public.staff_may_project(public.storage_project_id(name), 'files.manage')
    and public.can_access_project_file(name)
  );
