-- Requested while checking tasks and milestones: general task creation/update/delete
-- (tasks_admin_insert/update/delete) required staff_may_coordinate_project (projects.manage AND
-- clients.manage), stricter than the conceptually equivalent milestone actions
-- (milestones_admin_insert/update/delete), which only ever required plain
-- staff_may_project(project_id, 'projects.manage'). Not currently reachable by
-- production-communicator staff in practice (AdminLayout redirects them away from
-- /admin/projects/:id to /team/projects/:id before ProjectTasksPanel's "Add Task" ever renders),
-- but confirmed as a real, deliberate design choice to align them for consistency -- and correct
-- if that redirect logic ever changes. tasks_update_assigned (a staff member updating their own
-- assigned task's status) is a separate, narrower policy, unaffected by this change.

drop policy if exists tasks_admin_insert on public.tasks;
create policy tasks_admin_insert on public.tasks
  for insert to authenticated
  with check (public.staff_may_project(project_id, 'projects.manage'));

drop policy if exists tasks_admin_update on public.tasks;
create policy tasks_admin_update on public.tasks
  for update to authenticated
  using (public.staff_may_project(project_id, 'projects.manage'))
  with check (public.staff_may_project(project_id, 'projects.manage'));

drop policy if exists tasks_admin_delete on public.tasks;
create policy tasks_admin_delete on public.tasks
  for delete to authenticated
  using (public.staff_may_project(project_id, 'projects.manage'));
