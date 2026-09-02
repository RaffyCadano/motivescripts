-- Task Workspace: classify tasks by type, and add a generic per-task client
-- request/response flow for content-collection-style tasks.
-- Does not modify discovery_intakes, client_scope_briefs, deliverables, or feedback.
-- Additive only; existing tasks keep working unchanged.

-- ---------------------------------------------------------------------------
-- 1. task_type classification column (replaces title-string matching)
-- ---------------------------------------------------------------------------

alter table public.tasks add column if not exists task_type text;

alter table public.tasks drop constraint if exists tasks_task_type_check;
alter table public.tasks
  add constraint tasks_task_type_check check (
    task_type is null or task_type in (
      'discovery',
      'content_collection',
      'design',
      'production',
      'client_review',
      'qa',
      'internal'
    )
  );

comment on column public.tasks.task_type is
  'Classifies which Task Workspace view/actions apply. Null = not yet classified (treated as internal).';

-- Backfill existing tasks from the known seeded catalog. Anything unmatched -> internal.
-- Never overwrites a task_type that was already set.
update public.tasks
set task_type = case
  when lower(trim(title)) in (
    'review approved scope',
    'confirm sitemap and requirements',
    'collect/confirm client content and assets'
  ) then 'discovery'
  when lower(trim(title)) in (
    'prepare contact information',
    'migrate approved content'
  ) then 'content_collection'
  when lower(trim(title)) in (
    'establish design direction',
    'design homepage',
    'design responsive/mobile layouts'
  ) or lower(trim(title)) like 'design %' then 'design'
  when lower(trim(title)) in (
    'prepare/deploy staging',
    'prepare staging for client review',
    'address requested revisions'
  ) then 'client_review'
  when lower(trim(title)) in (
    'test staging website',
    'test responsive layouts',
    'final qa'
  ) or lower(trim(title)) like 'test %' then 'qa'
  when lower(trim(title)) in (
    'write homepage copy',
    'write services page copy',
    'build homepage',
    'implement responsive layouts',
    'integrate approved content',
    'deploy production',
    'verify production website'
  )
    or lower(trim(title)) like 'write % copy'
    or lower(trim(title)) like 'build %'
    or lower(trim(title)) like 'implement %'
    or lower(trim(title)) like 'add %'
    or lower(trim(title)) like 'set up %'
    or lower(trim(title)) like 'install %'
    or lower(trim(title)) like 'connect %'
    or lower(trim(title)) in ('performance optimization', 'security setup')
  then 'production'
  else 'internal'
end
where task_type is null;

-- ---------------------------------------------------------------------------
-- 2. task_client_requests: generic per-task "PM asks, client responds" flow.
--    Discovery keeps its own singleton-per-project table; this is per-task
--    and reused by any task_type = 'content_collection'.
-- ---------------------------------------------------------------------------

create table public.task_client_requests (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null unique references public.tasks (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  status text not null default 'not_requested'
    check (status in ('not_requested', 'awaiting_client', 'submitted', 'under_review', 'complete')),
  message text not null default '',
  client_response text not null default '',
  requested_at timestamptz,
  submitted_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  constraint task_client_requests_message_len check (char_length(message) <= 4000),
  constraint task_client_requests_response_len check (char_length(client_response) <= 4000)
);

comment on table public.task_client_requests is
  'Per-task client information/file request. PM requests, client responds; separate from the per-project discovery_intakes singleton.';

create index task_client_requests_project_id_idx on public.task_client_requests (project_id);
create index task_client_requests_client_id_idx on public.task_client_requests (client_id);

create trigger task_client_requests_updated_at
  before update on public.task_client_requests
  for each row execute function public.set_updated_at();

create table public.task_client_request_files (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.task_client_requests (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  file_name text not null,
  file_type text not null default 'Other',
  file_size bigint not null default 0,
  storage_path text not null,
  created_at timestamptz not null default now(),
  uploaded_by uuid references auth.users (id) on delete set null,
  constraint task_client_request_files_name_len check (char_length(file_name) between 1 and 300),
  constraint task_client_request_files_path_len check (char_length(storage_path) between 1 and 500)
);

create index task_client_request_files_request_id_idx on public.task_client_request_files (request_id);

-- ---------------------------------------------------------------------------
-- 3. Notifications: reuse the existing in-portal mechanism (no email), same
--    pattern as discovery_intake_notify_client / discovery_intake_notify_staff.
-- ---------------------------------------------------------------------------

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check check (type in (
    'new_message',
    'feedback_received',
    'changes_requested',
    'version_ready_for_review',
    'version_approved',
    'project_update',
    'proposal_ready',
    'proposal_viewed',
    'proposal_accepted',
    'proposal_declined',
    'contract_ready',
    'contract_viewed',
    'contract_accepted',
    'contract_declined',
    'invoice_ready',
    'invoice_viewed',
    'payment_recorded',
    'payment_received',
    'invoice_paid',
    'invoice_overdue',
    'task_assigned',
    'task_status_changed',
    'project_assigned',
    'milestone_updated',
    'task_info_requested',
    'task_response_submitted'
  ));

create or replace function public.task_client_requests_notify_client()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  project_name text;
  task_title text;
  portal_user uuid;
begin
  if tg_op <> 'UPDATE' or new.status <> 'awaiting_client' or old.status = 'awaiting_client' then
    return new;
  end if;

  select p.name, t.title into project_name, task_title
  from public.projects p
  join public.tasks t on t.id = new.task_id
  where p.id = new.project_id;

  select pr.id into portal_user
  from public.profiles pr
  where pr.client_id = new.client_id and pr.role = 'client'
  limit 1;

  if portal_user is not null then
    insert into public.notifications (user_id, type, title, body, project_id)
    values (
      portal_user,
      'task_info_requested',
      'Information requested',
      coalesce(project_name, 'Your project') || ' · ' || coalesce(task_title, 'A task') || ': please respond in your client portal.',
      new.project_id
    );
  end if;

  return new;
end;
$$;

revoke all on function public.task_client_requests_notify_client() from public, anon;

drop trigger if exists task_client_requests_notify_client on public.task_client_requests;
create trigger task_client_requests_notify_client
  after update of status on public.task_client_requests
  for each row
  execute function public.task_client_requests_notify_client();

create or replace function public.task_client_requests_notify_staff()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  project_name text;
  task_title text;
begin
  if tg_op <> 'UPDATE' or new.status <> 'submitted' or old.status = 'submitted' then
    return new;
  end if;

  select p.name, t.title into project_name, task_title
  from public.projects p
  join public.tasks t on t.id = new.task_id
  where p.id = new.project_id;

  insert into public.notifications (user_id, type, title, body, project_id)
  select distinct psa.user_id, 'task_response_submitted', 'Client responded to a request',
    coalesce(project_name, 'A project') || ' · ' || coalesce(task_title, 'A task') || ': the client submitted a response.',
    new.project_id
  from public.project_staff_assignments psa
  where psa.project_id = new.project_id
    and psa.user_id is not null;

  return new;
end;
$$;

revoke all on function public.task_client_requests_notify_staff() from public, anon;

drop trigger if exists task_client_requests_notify_staff on public.task_client_requests;
create trigger task_client_requests_notify_staff
  after update of status on public.task_client_requests
  for each row
  execute function public.task_client_requests_notify_staff();

-- ---------------------------------------------------------------------------
-- 4. RLS (mirrors discovery_intakes / discovery_intake_files exactly)
-- ---------------------------------------------------------------------------

alter table public.task_client_requests enable row level security;
alter table public.task_client_request_files enable row level security;

create policy task_client_requests_select on public.task_client_requests
  for select to authenticated
  using (
    (public.is_client() and client_id = public.current_client_id())
    or public.staff_may_project(project_id, 'projects.view')
  );

create policy task_client_requests_insert on public.task_client_requests
  for insert to authenticated
  with check (public.staff_may_coordinate_project(project_id));

create policy task_client_requests_update on public.task_client_requests
  for update to authenticated
  using (
    (public.is_client() and client_id = public.current_client_id())
    or public.staff_may_coordinate_project(project_id)
  )
  with check (
    (public.is_client() and client_id = public.current_client_id())
    or public.staff_may_coordinate_project(project_id)
  );

create policy task_client_request_files_select on public.task_client_request_files
  for select to authenticated
  using (
    (public.is_client() and client_id = public.current_client_id())
    or public.staff_may_project(project_id, 'projects.view')
  );

create policy task_client_request_files_insert on public.task_client_request_files
  for insert to authenticated
  with check (
    (public.is_client() and client_id = public.current_client_id())
    or public.staff_may_coordinate_project(project_id)
  );

create policy task_client_request_files_delete on public.task_client_request_files
  for delete to authenticated
  using (
    (public.is_client() and client_id = public.current_client_id())
    or public.staff_may_coordinate_project(project_id)
  );

revoke all on table public.task_client_requests, public.task_client_request_files from public, anon;
grant select, insert, update on table public.task_client_requests to authenticated;
grant select, insert, delete on table public.task_client_request_files to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Storage: task-request files in the existing private project-files bucket.
--    Path shape (from fileUploadConfig.taskRequestStoragePath):
--      projects/{projectId}/tasks/requests/{requestId}/{fileId}.{ext}
--    The request row itself carries task_id, so the path only needs project_id
--    and request_id. Distinct segment count/shape from deliverable, contract,
--    and discovery paths; those policies are unchanged.
-- ---------------------------------------------------------------------------

create or replace function public.task_request_for_storage_path(object_name text)
returns public.task_client_requests
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  parts text[];
  pid uuid;
  tid uuid;
  rid uuid;
  row public.task_client_requests;
begin
  if object_name is null then
    return null;
  end if;

  parts := string_to_array(object_name, '/');
  if array_length(parts, 1) is distinct from 6 then
    return null;
  end if;
  if parts[1] <> 'projects' or parts[3] <> 'tasks' or parts[4] <> 'requests' then
    return null;
  end if;
  if parts[6] is null
    or parts[6] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]+$'
  then
    return null;
  end if;

  begin
    pid := parts[2]::uuid;
    rid := parts[5]::uuid;
  exception
    when invalid_text_representation then
      return null;
  end;

  select r.* into row
  from public.task_client_requests r
  where r.id = rid
    and r.project_id = pid;

  if not found then
    return null;
  end if;

  tid := row.task_id;
  return row;
end;
$$;

comment on function public.task_request_for_storage_path(text) is
  'Parse a task-request storage path and return the matching task_client_requests row, or NULL when invalid.';

create or replace function public.can_access_task_request_file(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  req public.task_client_requests;
begin
  req := public.task_request_for_storage_path(object_name);
  if req is null then
    return false;
  end if;

  if public.is_admin() then
    return true;
  end if;

  if public.staff_may_project(req.project_id, 'projects.view') then
    return true;
  end if;

  return public.is_client() and req.client_id = public.current_client_id();
end;
$$;

create or replace function public.can_upload_task_request_file(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  req public.task_client_requests;
begin
  req := public.task_request_for_storage_path(object_name);
  if req is null then
    return false;
  end if;

  if public.is_client() then
    if req.client_id is distinct from public.current_client_id() then
      return false;
    end if;
    return req.status in ('awaiting_client');
  end if;

  return public.staff_may_coordinate_project(req.project_id);
end;
$$;

create or replace function public.can_delete_task_request_file(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  req public.task_client_requests;
begin
  req := public.task_request_for_storage_path(object_name);
  if req is null then
    return false;
  end if;

  if public.is_client() and req.client_id = public.current_client_id() then
    return true;
  end if;

  return public.staff_may_coordinate_project(req.project_id);
end;
$$;

drop policy if exists task_request_storage_select on storage.objects;
create policy task_request_storage_select
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'project-files'
    and public.can_access_task_request_file(name)
  );

drop policy if exists task_request_storage_insert on storage.objects;
create policy task_request_storage_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'project-files'
    and public.can_upload_task_request_file(name)
  );

drop policy if exists task_request_storage_delete on storage.objects;
create policy task_request_storage_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'project-files'
    and public.can_delete_task_request_file(name)
  );

revoke all on function public.task_request_for_storage_path(text) from public, anon;
revoke all on function public.can_access_task_request_file(text) from public, anon;
revoke all on function public.can_upload_task_request_file(text) from public, anon;
revoke all on function public.can_delete_task_request_file(text) from public, anon;

grant execute on function public.task_request_for_storage_path(text) to authenticated;
grant execute on function public.can_access_task_request_file(text) to authenticated;
grant execute on function public.can_upload_task_request_file(text) to authenticated;
grant execute on function public.can_delete_task_request_file(text) to authenticated;
