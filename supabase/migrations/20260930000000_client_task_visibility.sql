-- Audit finding: the client-facing tasks_select_own policy returns every
-- task on the client's project, including agency-internal production tasks
-- (staff assignee, internal task_type like 'internal'/'qa', reference_url).
-- The client UI only ever reads origin='client' tasks (ClientSupportRequest.tsx
-- filters to that), so the RLS predicate should match that -- not rely on the
-- frontend filter as the only boundary.
--
-- Staff visibility (tasks_admin_select, tasks_select_assigned) is untouched;
-- this policy only governs what a client (owns_project) can read.

drop policy if exists tasks_select_own on public.tasks;

create policy tasks_select_own
  on public.tasks
  for select
  to authenticated
  using (public.owns_project(project_id) and origin = 'client');
