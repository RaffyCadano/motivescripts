-- Same bug class as care_requests_convert_to_task (20261023000000), found in a wider audit sweep
-- of every table gated by staff_may_coordinate_project (projects.manage AND clients.manage).
-- Three other uses of that check carry an explicit comment confirming it's deliberately
-- Admin/PM-only for a major milestone action (enforce_launch_gate, the project-completion gate,
-- and domain/hosting delivery changes) -- those are untouched here. discovery_intakes and
-- task_client_requests have no such comment, and are reachable and actionable from pages built for
-- a broader staff audience:
--   - ProjectDiscoveryPanel.tsx renders on /admin/projects/:id (ProjectOverview.tsx), gated only on
--     projects.view -- held by Developer, Designer, Content Writer, and Team Member.
--   - TaskClientRequestPanel.tsx renders inside TaskWorkspace.tsx, shared by both the admin task
--     view and TeamTaskDetail.tsx -- a developer's own assigned-task page.
-- Neither component has any permission check of its own (same missing-gate pattern as the Care
-- Requests bug), so any of those four templates can reach and click these actions today, and would
-- hit a raw RLS permission-denied error -- confirmed live on Production: one active Developer, one
-- Designer, and one Content Writer currently have projects.manage without clients.manage.
--
-- Unlike `tasks` (shared with several PM/admin-only flows, hence a dedicated RPC), neither table
-- here has any other use case that needs the stricter check, so the fix is a direct, minimal RLS
-- policy change -- no RPC needed, no application-code change needed.

drop policy if exists discovery_intakes_insert on public.discovery_intakes;
create policy discovery_intakes_insert on public.discovery_intakes
  for insert to authenticated
  with check (public.staff_may_project(project_id, 'projects.manage'));

drop policy if exists discovery_intakes_update on public.discovery_intakes;
create policy discovery_intakes_update on public.discovery_intakes
  for update to authenticated
  using (
    (public.is_client() and client_id = public.current_client_id())
    or public.staff_may_project(project_id, 'projects.manage')
  )
  with check (
    (public.is_client() and client_id = public.current_client_id())
    or public.staff_may_project(project_id, 'projects.manage')
  );

drop policy if exists task_client_requests_insert on public.task_client_requests;
create policy task_client_requests_insert on public.task_client_requests
  for insert to authenticated
  with check (public.staff_may_project(project_id, 'projects.manage'));

drop policy if exists task_client_requests_update on public.task_client_requests;
create policy task_client_requests_update on public.task_client_requests
  for update to authenticated
  using (
    (public.is_client() and client_id = public.current_client_id())
    or public.staff_may_project(project_id, 'projects.manage')
  )
  with check (
    (public.is_client() and client_id = public.current_client_id())
    or public.staff_may_project(project_id, 'projects.manage')
  );

-- Same fix for the discovery-intake attachments table.
drop policy if exists discovery_intake_files_insert on public.discovery_intake_files;
create policy discovery_intake_files_insert on public.discovery_intake_files
  for insert to authenticated
  with check (
    (public.is_client() and client_id = public.current_client_id())
    or public.staff_may_project(project_id, 'projects.manage')
  );

drop policy if exists discovery_intake_files_delete on public.discovery_intake_files;
create policy discovery_intake_files_delete on public.discovery_intake_files
  for delete to authenticated
  using (
    (public.is_client() and client_id = public.current_client_id())
    or public.staff_may_project(project_id, 'projects.manage')
  );

-- The discovery-file storage helpers (20260902000000) delegate to staff_may_coordinate_project for
-- upload/delete too, mirroring these table policies -- same fix, same reasoning.
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

  return public.staff_may_project(intake.project_id, 'projects.manage');
end;
$$;

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

  return public.staff_may_project(intake.project_id, 'projects.manage');
end;
$$;

-- Same fix for the task-client-request attachments table and its storage helpers.
drop policy if exists task_client_request_files_insert on public.task_client_request_files;
create policy task_client_request_files_insert on public.task_client_request_files
  for insert to authenticated
  with check (
    (public.is_client() and client_id = public.current_client_id())
    or public.staff_may_project(project_id, 'projects.manage')
  );

drop policy if exists task_client_request_files_delete on public.task_client_request_files;
create policy task_client_request_files_delete on public.task_client_request_files
  for delete to authenticated
  using (
    (public.is_client() and client_id = public.current_client_id())
    or public.staff_may_project(project_id, 'projects.manage')
  );

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

  return public.staff_may_project(req.project_id, 'projects.manage');
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

  return public.staff_may_project(req.project_id, 'projects.manage');
end;
$$;
