-- Turns care_requests into the full Website Care maintenance-request intake: the client-facing
-- category from the spec (request_type -- distinct from the existing `category`, which is the
-- include/billable self-classification), admin's final include/billable call (billing_decision),
-- links back to whatever the request turned into, and file attachments.

alter table public.care_requests
  add column if not exists request_type text not null default 'other'
    check (request_type in (
      'content_update', 'bug_fix', 'design_change', 'new_page',
      'new_feature', 'seo', 'technical', 'other'
    )),
  add column if not exists billing_decision text
    check (billing_decision is null or billing_decision in ('included', 'billable')),
  add column if not exists service_plan_id uuid references public.service_plans (id) on delete set null,
  add column if not exists resulting_task_id uuid references public.tasks (id) on delete set null,
  add column if not exists resulting_invoice_id uuid references public.invoices (id) on delete set null,
  add column if not exists resulting_project_id uuid references public.projects (id) on delete set null;

comment on column public.care_requests.request_type is
  'The client-picked category (Content Update / Bug Fix / Design Change / New Page / New Feature / SEO / Technical / Other), separate from `category` (the client''s own included-vs-new-addition guess).';
comment on column public.care_requests.billing_decision is
  'Staff''s final included-vs-billable call for this request. Null until reviewed; distinct from `category`, which is only the client''s own guess at submission time.';
comment on column public.care_requests.service_plan_id is
  'Which Website Care plan this request was made against, snapshotted at submission (a plan can change later).';

-- Snapshot service_plan_id at insert time too, same trigger that already sets has_active_care_plan.
create or replace function public.care_requests_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_launched boolean;
  v_has_plan boolean;
  v_plan_id uuid;
begin
  select role into v_role from public.profiles where id = auth.uid();

  if not exists (select 1 from public.projects where id = new.project_id and client_id = new.client_id) then
    raise exception 'PROJECT_CLIENT_MISMATCH';
  end if;

  select sp.id into v_plan_id
    from public.service_plans sp
    where sp.plan_type = 'care'
      and sp.status in ('active', 'past_due')
      and (sp.project_id = new.project_id or (sp.project_id is null and sp.client_id = new.client_id))
    order by (sp.project_id = new.project_id) desc, sp.created_at desc
    limit 1;
  v_has_plan := v_plan_id is not null;

  if v_role = 'client' then
    new.submitted_by := auth.uid();
    select coalesce(pd.deployment_status = 'Production', false)
      into v_launched
      from public.project_development pd
      where pd.project_id = new.project_id;
    if not coalesce(v_launched, false) then
      raise exception 'NOT_LAUNCHED';
    end if;
    if not v_has_plan then
      raise exception 'NO_ACTIVE_PLAN';
    end if;
  end if;

  new.has_active_care_plan := v_has_plan;
  new.service_plan_id := v_plan_id;

  if new.status = 'Done' and new.resolved_at is null then
    new.resolved_at := now();
  end if;

  return new;
end;
$$;

-- Attachments on a maintenance request. Mirrors task_client_request_files (20260903000000_task_workspace.sql)
-- exactly, minus the task_id column (a care request isn't scoped to a task).
create table public.care_request_files (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.care_requests (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  file_name text not null,
  file_type text not null default 'Other',
  file_size bigint not null default 0,
  storage_path text not null,
  created_at timestamptz not null default now(),
  uploaded_by uuid references auth.users (id) on delete set null,
  constraint care_request_files_name_len check (char_length(file_name) between 1 and 300),
  constraint care_request_files_path_len check (char_length(storage_path) between 1 and 500)
);

create index care_request_files_request_id_idx on public.care_request_files (request_id);

alter table public.care_request_files enable row level security;

create policy care_request_files_client_select on public.care_request_files for select to authenticated
  using (public.is_client() and client_id = public.current_client_id());

create policy care_request_files_client_insert on public.care_request_files for insert to authenticated
  with check (
    public.is_client() and client_id = public.current_client_id()
    and exists (select 1 from public.care_requests cr where cr.id = request_id and cr.client_id = client_id)
  );

create policy care_request_files_staff_select on public.care_request_files for select to authenticated
  using (public.staff_may_project(project_id, 'projects.view'));

create policy care_request_files_staff_insert on public.care_request_files for insert to authenticated
  with check (public.staff_may_project(project_id, 'projects.manage'));

create policy care_request_files_staff_delete on public.care_request_files for delete to authenticated
  using (public.staff_may_project(project_id, 'projects.manage'));

revoke all on public.care_request_files from public, anon;
grant select, insert on public.care_request_files to authenticated;
grant delete on public.care_request_files to authenticated;
grant all on public.care_request_files to service_role;

comment on table public.care_request_files is
  'File attachments on a care_requests row. Same storage-path convention as task_client_request_files -- see fileUploadConfig.ts.';

-- Admin's included/billable decision, and linking a request to what it turned into. Staff-only
-- (projects.manage), separate from the general staff_update policy so the decision/linking fields
-- can't be touched by a lower grant that only manages request status/priority -- in practice the
-- same projects.manage grant already covers both, kept as one policy for simplicity, but named so
-- a future split is easy.
create or replace function public.care_requests_resolve(
  p_request_id uuid,
  p_billing_decision text,
  p_resulting_task_id uuid default null,
  p_resulting_invoice_id uuid default null,
  p_resulting_project_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  req public.care_requests;
begin
  select * into req from public.care_requests where id = p_request_id;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if not public.staff_may_project(req.project_id, 'projects.manage') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if p_billing_decision is not null and p_billing_decision not in ('included', 'billable') then
    raise exception 'INVALID_DECISION' using errcode = 'P0001';
  end if;

  update public.care_requests
    set billing_decision = coalesce(p_billing_decision, billing_decision),
        resulting_task_id = coalesce(p_resulting_task_id, resulting_task_id),
        resulting_invoice_id = coalesce(p_resulting_invoice_id, resulting_invoice_id),
        resulting_project_id = coalesce(p_resulting_project_id, resulting_project_id)
    where id = p_request_id;
end;
$$;
revoke all on function public.care_requests_resolve(uuid, text, uuid, uuid, uuid) from public, anon;
grant execute on function public.care_requests_resolve(uuid, text, uuid, uuid, uuid) to authenticated;

comment on function public.care_requests_resolve(uuid, text, uuid, uuid, uuid) is
  'Staff-only: records the included/billable call for a care request and/or links it to the task, invoice, or project it turned into.';

-- ---------------------------------------------------------------------------
-- Storage RLS for care_request_files, mirroring the task_client_request_files
-- pattern in 20260903000000_task_workspace.sql exactly, at the path shape
-- projects/<project_id>/care-requests/<request_id>/<file>.<ext> (see
-- careRequestStoragePath in src/data/fileUploadConfig.ts).
-- ---------------------------------------------------------------------------

create or replace function public.care_request_for_storage_path(object_name text)
returns public.care_requests
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  parts text[];
  pid uuid;
  rid uuid;
  row public.care_requests;
begin
  parts := string_to_array(object_name, '/');
  if array_length(parts, 1) is distinct from 5 then
    return null;
  end if;
  if parts[1] <> 'projects' or parts[3] <> 'care-requests' then
    return null;
  end if;
  if parts[5] is null
    or parts[5] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]+$'
  then
    return null;
  end if;

  begin
    pid := parts[2]::uuid;
    rid := parts[4]::uuid;
  exception
    when invalid_text_representation then
      return null;
  end;

  select r.* into row
  from public.care_requests r
  where r.id = rid and r.project_id = pid;

  if not found then
    return null;
  end if;

  return row;
end;
$$;

comment on function public.care_request_for_storage_path(text) is
  'Parse a care-request storage path and return the matching care_requests row, or NULL when invalid.';

create or replace function public.can_access_care_request_file(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  req public.care_requests;
begin
  req := public.care_request_for_storage_path(object_name);
  if req is null then
    return false;
  end if;
  if public.is_client() and req.client_id = public.current_client_id() then
    return true;
  end if;
  return public.staff_may_project(req.project_id, 'projects.view');
end;
$$;

create or replace function public.can_upload_care_request_file(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  req public.care_requests;
begin
  req := public.care_request_for_storage_path(object_name);
  if req is null then
    return false;
  end if;
  if public.is_client() then
    return req.client_id = public.current_client_id();
  end if;
  return public.staff_may_project(req.project_id, 'projects.manage');
end;
$$;

create or replace function public.can_delete_care_request_file(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  req public.care_requests;
begin
  req := public.care_request_for_storage_path(object_name);
  if req is null then
    return false;
  end if;
  if public.is_client() and req.client_id = public.current_client_id() then
    return true;
  end if;
  return public.staff_may_project(req.project_id, 'projects.manage');
end;
$$;

drop policy if exists care_request_storage_select on storage.objects;
create policy care_request_storage_select
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'project-files'
    and public.can_access_care_request_file(name)
  );

drop policy if exists care_request_storage_insert on storage.objects;
create policy care_request_storage_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'project-files'
    and public.can_upload_care_request_file(name)
  );

drop policy if exists care_request_storage_delete on storage.objects;
create policy care_request_storage_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'project-files'
    and public.can_delete_care_request_file(name)
  );

revoke all on function public.care_request_for_storage_path(text) from public, anon;
revoke all on function public.can_access_care_request_file(text) from public, anon;
revoke all on function public.can_upload_care_request_file(text) from public, anon;
revoke all on function public.can_delete_care_request_file(text) from public, anon;

grant execute on function public.care_request_for_storage_path(text) to authenticated;
grant execute on function public.can_access_care_request_file(text) to authenticated;
grant execute on function public.can_upload_care_request_file(text) to authenticated;
grant execute on function public.can_delete_care_request_file(text) to authenticated;
