-- MotiveScripts Phase 12 — authentication, roles, ownership, RLS, Storage
-- Does not drop tables or seed data. Replaces temporary Phase 10/11 anon policies.

-- ---------------------------------------------------------------------------
-- Profile ownership
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists client_id uuid references public.clients (id) on delete set null;

alter table public.profiles
  alter column role set default 'client';

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('admin', 'client'));

alter table public.profiles drop constraint if exists profiles_admin_client_id_null;
alter table public.profiles
  add constraint profiles_admin_client_id_null check (role <> 'admin' or client_id is null);

create index if not exists profiles_client_id_idx on public.profiles (client_id);

comment on column public.profiles.role is
  'Authoritative app role. admin = agency staff. client = portal user. Never default new users to admin.';
comment on column public.profiles.client_id is
  'Owning clients.id for role=client. Null means the Auth user is not linked yet. Admins must be null.';

-- ---------------------------------------------------------------------------
-- Internal staff-only client fields (notes / activity / invoices / messages)
-- ---------------------------------------------------------------------------

create table if not exists public.client_staff_data (
  client_id uuid primary key references public.clients (id) on delete cascade,
  notes jsonb not null default '[]'::jsonb,
  activity jsonb not null default '[]'::jsonb,
  invoices jsonb not null default '[]'::jsonb,
  messages jsonb not null default '[]'::jsonb
);

comment on table public.client_staff_data is
  'Agency-private client JSON. Clients must never SELECT this table.';

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'clients'
      and column_name = 'notes'
  ) then
    insert into public.client_staff_data (client_id, notes, activity, invoices, messages)
    select
      id,
      coalesce(notes, '[]'::jsonb),
      coalesce(activity, '[]'::jsonb),
      coalesce(invoices, '[]'::jsonb),
      coalesce(messages, '[]'::jsonb)
    from public.clients
    on conflict (client_id) do update
      set notes = excluded.notes,
          activity = excluded.activity,
          invoices = excluded.invoices,
          messages = excluded.messages;

    alter table public.clients drop column if exists notes;
    alter table public.clients drop column if exists activity;
    alter table public.clients drop column if exists invoices;
    alter table public.clients drop column if exists messages;
  end if;
end $$;

create or replace function public.ensure_client_staff_data()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.client_staff_data (client_id)
  values (new.id)
  on conflict (client_id) do nothing;
  return new;
end;
$$;

drop trigger if exists clients_staff_data on public.clients;
create trigger clients_staff_data
  after insert on public.clients
  for each row execute function public.ensure_client_staff_data();

insert into public.client_staff_data (client_id)
select id from public.clients
on conflict (client_id) do nothing;

do $$
begin
  if not exists (
    select 1 from public.approvals group by version_id having count(*) > 1
  ) then
    create unique index if not exists approvals_one_per_version
      on public.approvals (version_id);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- New Auth users: safe default role
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_role text;
begin
  next_role := lower(coalesce(new.raw_app_meta_data->>'role', 'client'));
  if next_role = 'admin' then
    next_role := 'admin';
  else
    next_role := 'client';
  end if;

  insert into public.profiles (id, email, full_name, role, client_id)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    next_role,
    null
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- SECURITY DEFINER helpers (search_path pinned; used to avoid RLS recursion)
-- ---------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

create or replace function public.current_client_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select client_id
  from public.profiles
  where id = auth.uid()
    and role = 'client';
$$;

create or replace function public.is_client()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_client_id() is not null;
$$;

create or replace function public.own_profile_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.own_profile_client_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select client_id from public.profiles where id = auth.uid();
$$;

create or replace function public.owns_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.projects
    where id = p_project_id
      and client_id = public.current_client_id()
  );
$$;

create or replace function public.owns_deliverable(p_deliverable_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.deliverables d
    join public.projects p on p.id = d.project_id
    where d.id = p_deliverable_id
      and p.client_id = public.current_client_id()
  );
$$;

create or replace function public.storage_project_id(object_name text)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  parts text[];
  pid uuid;
begin
  if object_name is null then
    return null;
  end if;
  parts := string_to_array(object_name, '/');
  if array_length(parts, 1) <> 7 then
    return null;
  end if;
  if parts[1] <> 'projects' or parts[3] <> 'deliverables' or parts[5] <> 'versions' then
    return null;
  end if;
  if parts[7] not like 'file.%' then
    return null;
  end if;
  begin
    pid := parts[2]::uuid;
  exception when invalid_text_representation then
    return null;
  end;
  return pid;
end;
$$;

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

  if public.is_admin() then
    return exists (
      select 1
      from public.deliverables d
      where d.id = did
        and d.project_id = pid
    );
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

comment on function public.is_admin() is 'True when profiles.role = admin for auth.uid().';
comment on function public.is_client() is 'True when the user is role=client and linked to a clients row.';
comment on function public.current_client_id() is 'Linked clients.id for the signed-in client user; null otherwise.';
comment on function public.can_access_project_file(text) is
  'Storage helper. Parses projects/{projectId}/deliverables/{deliverableId}/... and checks ownership.';

-- ---------------------------------------------------------------------------
-- Drop temporary Phase 10/11 policies
-- ---------------------------------------------------------------------------

drop policy if exists profiles_select_dev on public.profiles;
drop policy if exists profiles_insert_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;

drop policy if exists leads_select_dev on public.leads;
drop policy if exists leads_insert_dev on public.leads;
drop policy if exists leads_update_dev on public.leads;

drop policy if exists clients_select_dev on public.clients;
drop policy if exists clients_insert_dev on public.clients;
drop policy if exists clients_update_dev on public.clients;

drop policy if exists projects_select_dev on public.projects;
drop policy if exists projects_insert_dev on public.projects;
drop policy if exists projects_update_dev on public.projects;

drop policy if exists milestones_select_dev on public.milestones;
drop policy if exists milestones_insert_dev on public.milestones;
drop policy if exists milestones_update_dev on public.milestones;
drop policy if exists milestones_delete_dev on public.milestones;

drop policy if exists tasks_select_dev on public.tasks;
drop policy if exists tasks_insert_dev on public.tasks;
drop policy if exists tasks_update_dev on public.tasks;
drop policy if exists tasks_delete_dev on public.tasks;

drop policy if exists deliverables_select_dev on public.deliverables;
drop policy if exists deliverables_insert_dev on public.deliverables;
drop policy if exists deliverables_update_dev on public.deliverables;

drop policy if exists file_versions_select_dev on public.file_versions;
drop policy if exists file_versions_insert_dev on public.file_versions;
drop policy if exists file_versions_update_dev on public.file_versions;

drop policy if exists feedback_select_dev on public.feedback;
drop policy if exists feedback_insert_dev on public.feedback;
drop policy if exists feedback_update_dev on public.feedback;

drop policy if exists approvals_select_dev on public.approvals;
drop policy if exists approvals_insert_dev on public.approvals;
drop policy if exists approvals_update_dev on public.approvals;

drop policy if exists activity_select_dev on public.activity;
drop policy if exists activity_insert_dev on public.activity;
drop policy if exists activity_update_dev on public.activity;

drop policy if exists project_files_select_dev on storage.objects;
drop policy if exists project_files_insert_dev on storage.objects;
drop policy if exists project_files_delete_dev on storage.objects;

-- ---------------------------------------------------------------------------
-- Grants: anon has no agency table access
-- ---------------------------------------------------------------------------

revoke all on table
  public.profiles,
  public.leads,
  public.clients,
  public.client_staff_data,
  public.projects,
  public.milestones,
  public.tasks,
  public.deliverables,
  public.file_versions,
  public.feedback,
  public.approvals,
  public.activity
  from anon;

revoke all on table
  public.profiles,
  public.leads,
  public.clients,
  public.client_staff_data,
  public.projects,
  public.milestones,
  public.tasks,
  public.deliverables,
  public.file_versions,
  public.feedback,
  public.approvals,
  public.activity
  from authenticated;

grant select, update on table public.profiles to authenticated;
grant select, insert, update on table
  public.leads,
  public.clients,
  public.client_staff_data,
  public.projects,
  public.deliverables,
  public.file_versions,
  public.feedback,
  public.approvals,
  public.activity
  to authenticated;
grant select, insert, update, delete on table public.milestones, public.tasks to authenticated;

alter table public.client_staff_data enable row level security;

-- ---------------------------------------------------------------------------
-- RLS: profiles
-- ---------------------------------------------------------------------------

drop policy if exists profiles_select_own_or_admin on public.profiles;
create policy profiles_select_own_or_admin
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid() and not public.is_admin())
  with check (
    id = auth.uid()
    and role = public.own_profile_role()
    and client_id is not distinct from public.own_profile_client_id()
  );

drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin
  on public.profiles
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- RLS: leads (admin only)
-- ---------------------------------------------------------------------------

drop policy if exists leads_admin_select on public.leads;
drop policy if exists leads_admin_insert on public.leads;
drop policy if exists leads_admin_update on public.leads;
create policy leads_admin_select on public.leads for select to authenticated using (public.is_admin());
create policy leads_admin_insert on public.leads for insert to authenticated with check (public.is_admin());
create policy leads_admin_update on public.leads for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- RLS: clients
-- ---------------------------------------------------------------------------

drop policy if exists clients_admin_select on public.clients;
drop policy if exists clients_admin_insert on public.clients;
drop policy if exists clients_admin_update on public.clients;
drop policy if exists clients_select_own on public.clients;
create policy clients_admin_select on public.clients for select to authenticated using (public.is_admin());
create policy clients_admin_insert on public.clients for insert to authenticated with check (public.is_admin());
create policy clients_admin_update on public.clients for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy clients_select_own
  on public.clients
  for select
  to authenticated
  using (id = public.current_client_id());

drop policy if exists client_staff_admin_select on public.client_staff_data;
drop policy if exists client_staff_admin_insert on public.client_staff_data;
drop policy if exists client_staff_admin_update on public.client_staff_data;
create policy client_staff_admin_select on public.client_staff_data for select to authenticated using (public.is_admin());
create policy client_staff_admin_insert on public.client_staff_data for insert to authenticated with check (public.is_admin());
create policy client_staff_admin_update on public.client_staff_data for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- RLS: projects and children
-- ---------------------------------------------------------------------------

drop policy if exists projects_admin_select on public.projects;
drop policy if exists projects_admin_insert on public.projects;
drop policy if exists projects_admin_update on public.projects;
drop policy if exists projects_select_own on public.projects;
create policy projects_admin_select on public.projects for select to authenticated using (public.is_admin());
create policy projects_admin_insert on public.projects for insert to authenticated with check (public.is_admin());
create policy projects_admin_update on public.projects for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy projects_select_own
  on public.projects
  for select
  to authenticated
  using (public.owns_project(id));

drop policy if exists milestones_admin_all on public.milestones;
drop policy if exists milestones_admin_select on public.milestones;
drop policy if exists milestones_admin_insert on public.milestones;
drop policy if exists milestones_admin_update on public.milestones;
drop policy if exists milestones_admin_delete on public.milestones;
drop policy if exists milestones_select_own on public.milestones;
create policy milestones_admin_select on public.milestones for select to authenticated using (public.is_admin());
create policy milestones_admin_insert on public.milestones for insert to authenticated with check (public.is_admin());
create policy milestones_admin_update on public.milestones for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy milestones_admin_delete on public.milestones for delete to authenticated using (public.is_admin());
create policy milestones_select_own
  on public.milestones
  for select
  to authenticated
  using (public.owns_project(project_id));

drop policy if exists tasks_admin_select on public.tasks;
drop policy if exists tasks_admin_insert on public.tasks;
drop policy if exists tasks_admin_update on public.tasks;
drop policy if exists tasks_admin_delete on public.tasks;
drop policy if exists tasks_select_own on public.tasks;
create policy tasks_admin_select on public.tasks for select to authenticated using (public.is_admin());
create policy tasks_admin_insert on public.tasks for insert to authenticated with check (public.is_admin());
create policy tasks_admin_update on public.tasks for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy tasks_admin_delete on public.tasks for delete to authenticated using (public.is_admin());
create policy tasks_select_own
  on public.tasks
  for select
  to authenticated
  using (public.owns_project(project_id));

drop policy if exists deliverables_admin_select on public.deliverables;
drop policy if exists deliverables_admin_insert on public.deliverables;
drop policy if exists deliverables_admin_update on public.deliverables;
drop policy if exists deliverables_select_own on public.deliverables;
create policy deliverables_admin_select on public.deliverables for select to authenticated using (public.is_admin());
create policy deliverables_admin_insert on public.deliverables for insert to authenticated with check (public.is_admin());
create policy deliverables_admin_update on public.deliverables for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy deliverables_select_own
  on public.deliverables
  for select
  to authenticated
  using (public.owns_project(project_id));

drop policy if exists file_versions_admin_select on public.file_versions;
drop policy if exists file_versions_admin_insert on public.file_versions;
drop policy if exists file_versions_admin_update on public.file_versions;
drop policy if exists file_versions_select_own on public.file_versions;
create policy file_versions_admin_select on public.file_versions for select to authenticated using (public.is_admin());
create policy file_versions_admin_insert on public.file_versions for insert to authenticated with check (public.is_admin());
create policy file_versions_admin_update on public.file_versions for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy file_versions_select_own
  on public.file_versions
  for select
  to authenticated
  using (public.owns_deliverable(deliverable_id));

-- ---------------------------------------------------------------------------
-- RLS: feedback / approvals / activity
-- ---------------------------------------------------------------------------

drop policy if exists feedback_admin_select on public.feedback;
drop policy if exists feedback_select_own on public.feedback;
drop policy if exists feedback_insert_own on public.feedback;
drop policy if exists feedback_admin_update on public.feedback;
create policy feedback_admin_select on public.feedback for select to authenticated using (public.is_admin());
create policy feedback_select_own
  on public.feedback
  for select
  to authenticated
  using (public.owns_project(project_id));
create policy feedback_insert_own
  on public.feedback
  for insert
  to authenticated
  with check (
    public.is_client()
    and client_id = public.current_client_id()
    and status = 'Open'
    and created_by = auth.uid()
    and exists (
      select 1
      from public.file_versions fv
      join public.deliverables d on d.id = fv.deliverable_id
      join public.projects p on p.id = d.project_id
      where fv.id = version_id
        and fv.is_current
        and d.id = deliverable_id
        and p.id = project_id
        and p.client_id = public.current_client_id()
        and d.status in ('In Review', 'Needs Changes')
    )
  );
create policy feedback_admin_update
  on public.feedback
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists approvals_admin_select on public.approvals;
drop policy if exists approvals_select_own on public.approvals;
drop policy if exists approvals_insert_own on public.approvals;
create policy approvals_admin_select on public.approvals for select to authenticated using (public.is_admin());
create policy approvals_select_own
  on public.approvals
  for select
  to authenticated
  using (public.owns_project(project_id));
create policy approvals_insert_own
  on public.approvals
  for insert
  to authenticated
  with check (
    public.is_client()
    and client_id = public.current_client_id()
    and status = 'Approved'
    and approved_by = auth.uid()
    and exists (
      select 1
      from public.file_versions fv
      join public.deliverables d on d.id = fv.deliverable_id
      join public.projects p on p.id = d.project_id
      where fv.id = version_id
        and fv.is_current
        and d.id = deliverable_id
        and p.id = project_id
        and p.client_id = public.current_client_id()
        and d.status = 'In Review'
    )
  );

drop policy if exists activity_admin_select on public.activity;
drop policy if exists activity_admin_insert on public.activity;
drop policy if exists activity_select_own on public.activity;
create policy activity_admin_select on public.activity for select to authenticated using (public.is_admin());
create policy activity_admin_insert on public.activity for insert to authenticated with check (public.is_admin());
create policy activity_select_own
  on public.activity
  for select
  to authenticated
  using (public.owns_project(project_id));

-- ---------------------------------------------------------------------------
-- Admin file RPCs: require admin (invoker + explicit check)
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
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select status, name, project_id
    into deliverable_status, deliverable_name, project
  from public.deliverables
  where id = p_deliverable_id
  for update;

  if not found then
    raise exception 'Deliverable not found';
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
  if not public.is_admin() then
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

  select project_id, name into project, deliverable_name
  from public.deliverables
  where id = p_deliverable_id;

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
-- Client review RPCs (SECURITY DEFINER; ownership checked inside)
-- ---------------------------------------------------------------------------

create or replace function public.client_submit_feedback(
  p_deliverable_id uuid,
  p_message text,
  p_request_changes boolean default false
)
returns public.feedback
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  owned_client uuid := public.current_client_id();
  deliverable public.deliverables;
  project public.projects;
  version public.file_versions;
  actor_name text;
  created public.feedback;
  activity_type text;
  activity_message text;
begin
  if not public.is_client() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if p_message is null or length(trim(p_message)) = 0 then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select * into deliverable
  from public.deliverables
  where id = p_deliverable_id
  for update;

  if not found then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select * into project from public.projects where id = deliverable.project_id;
  if not found or project.client_id is distinct from owned_client then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  if deliverable.status not in ('In Review', 'Needs Changes') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select * into version
  from public.file_versions
  where deliverable_id = deliverable.id
    and is_current
  for update;

  if not found then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select coalesce(nullif(trim(full_name), ''), 'Client')
    into actor_name
  from public.profiles
  where id = uid;

  insert into public.feedback (
    project_id,
    deliverable_id,
    version_id,
    client_id,
    message,
    status,
    created_by,
    created_by_name
  )
  values (
    project.id,
    deliverable.id,
    version.id,
    owned_client,
    trim(p_message),
    'Open',
    uid,
    actor_name
  )
  returning * into created;

  update public.deliverables
    set status = 'Needs Changes',
        archived_at = null,
        updated_at = now()
  where id = deliverable.id;

  if p_request_changes then
    activity_type := 'changes_requested';
    activity_message := 'Client requested changes on ' || deliverable.name || ' v' || version.version_number || '.';
  else
    activity_type := 'feedback_submitted';
    activity_message := 'Client submitted feedback on ' || deliverable.name || ' v' || version.version_number || '.';
  end if;

  insert into public.activity (project_id, actor_id, activity_type, message, metadata)
  values (
    project.id,
    uid,
    activity_type,
    activity_message,
    jsonb_build_object('icon', 'review', 'deliverable_id', deliverable.id, 'version_id', version.id)
  );

  update public.projects set last_activity_at = now() where id = project.id;

  return created;
end;
$$;

create or replace function public.client_approve_current_version(p_deliverable_id uuid)
returns public.approvals
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  owned_client uuid := public.current_client_id();
  deliverable public.deliverables;
  project public.projects;
  version public.file_versions;
  actor_name text;
  created public.approvals;
begin
  if not public.is_client() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select * into deliverable
  from public.deliverables
  where id = p_deliverable_id
  for update;

  if not found then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select * into project from public.projects where id = deliverable.project_id;
  if not found or project.client_id is distinct from owned_client then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  if deliverable.status <> 'In Review' then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select * into version
  from public.file_versions
  where deliverable_id = deliverable.id
    and is_current
  for update;

  if not found then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  if exists (select 1 from public.approvals where version_id = version.id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select coalesce(nullif(trim(full_name), ''), 'Client')
    into actor_name
  from public.profiles
  where id = uid;

  insert into public.approvals (
    project_id,
    deliverable_id,
    version_id,
    client_id,
    status,
    approved_by,
    approved_by_name,
    approved_at
  )
  values (
    project.id,
    deliverable.id,
    version.id,
    owned_client,
    'Approved',
    uid,
    actor_name,
    now()
  )
  returning * into created;

  update public.deliverables
    set status = 'Approved',
        archived_at = null,
        updated_at = now()
  where id = deliverable.id;

  insert into public.activity (project_id, actor_id, activity_type, message, metadata)
  values (
    project.id,
    uid,
    'version_approved',
    deliverable.name || ' v' || version.version_number || ' approved.',
    jsonb_build_object('icon', 'review', 'deliverable_id', deliverable.id, 'version_id', version.id)
  );

  update public.projects set last_activity_at = now() where id = project.id;

  return created;
end;
$$;

create or replace function public.admin_link_client_account(p_client_id uuid, p_email text)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized text;
  target public.profiles;
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  normalized := lower(trim(coalesce(p_email, '')));
  if normalized = '' then
    raise exception 'NO_PROFILE' using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.clients where id = p_client_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select * into target
  from public.profiles
  where lower(coalesce(email, '')) = normalized;

  if not found then
    raise exception 'NO_PROFILE' using errcode = 'P0001';
  end if;

  if target.role = 'admin' then
    raise exception 'IS_ADMIN' using errcode = 'P0001';
  end if;

  if target.client_id is not null and target.client_id is distinct from p_client_id then
    raise exception 'ALREADY_LINKED' using errcode = 'P0001';
  end if;

  update public.profiles
    set client_id = p_client_id,
        role = 'client'
  where id = target.id
  returning * into target;

  return target;
end;
$$;

-- ---------------------------------------------------------------------------
-- Storage: authenticated ownership only; bucket stays private
-- ---------------------------------------------------------------------------

drop policy if exists project_files_select on storage.objects;
drop policy if exists project_files_insert on storage.objects;
drop policy if exists project_files_delete on storage.objects;
drop policy if exists project_files_update on storage.objects;

create policy project_files_select
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'project-files'
    and public.can_access_project_file(name)
  );

create policy project_files_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'project-files'
    and public.is_admin()
    and public.can_access_project_file(name)
  );

create policy project_files_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'project-files'
    and public.is_admin()
    and public.can_access_project_file(name)
  );

-- ---------------------------------------------------------------------------
-- Execute grants
-- ---------------------------------------------------------------------------

revoke all on function public.is_admin() from public, anon;
revoke all on function public.is_client() from public, anon;
revoke all on function public.current_client_id() from public, anon;
revoke all on function public.own_profile_role() from public, anon;
revoke all on function public.own_profile_client_id() from public, anon;
revoke all on function public.owns_project(uuid) from public, anon;
revoke all on function public.owns_deliverable(uuid) from public, anon;
revoke all on function public.storage_project_id(text) from public, anon;
revoke all on function public.can_access_project_file(text) from public, anon;
revoke all on function public.create_file_version(uuid, text, text, bigint, text, text, uuid, text, text) from public, anon;
revoke all on function public.set_current_file_version(uuid, uuid) from public, anon;
revoke all on function public.client_submit_feedback(uuid, text, boolean) from public, anon;
revoke all on function public.client_approve_current_version(uuid) from public, anon;
revoke all on function public.admin_link_client_account(uuid, text) from public, anon;
revoke all on function public.ensure_client_staff_data() from public, anon;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_client() to authenticated;
grant execute on function public.current_client_id() to authenticated;
grant execute on function public.own_profile_role() to authenticated;
grant execute on function public.own_profile_client_id() to authenticated;
grant execute on function public.owns_project(uuid) to authenticated;
grant execute on function public.owns_deliverable(uuid) to authenticated;
grant execute on function public.storage_project_id(text) to authenticated;
grant execute on function public.can_access_project_file(text) to authenticated;
grant execute on function public.create_file_version(uuid, text, text, bigint, text, text, uuid, text, text) to authenticated;
grant execute on function public.set_current_file_version(uuid, uuid) to authenticated;
grant execute on function public.client_submit_feedback(uuid, text, boolean) to authenticated;
grant execute on function public.client_approve_current_version(uuid) to authenticated;
grant execute on function public.admin_link_client_account(uuid, text) to authenticated;
