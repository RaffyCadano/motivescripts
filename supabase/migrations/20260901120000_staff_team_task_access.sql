-- Staff /team workspace: SELECT assigned projects (and related rows) via
-- staff_may_project / staff_may_client. Assigning a task also upserts
-- project_staff_assignments so the assignee can see the parent project.
-- Does not auto-unassign from the project on task reassign or unassign.
-- Paid-invoice production tasks stay unassigned (assigned_to is null).

-- ---------------------------------------------------------------------------
-- SELECT: replace admin-only policies. Keep client own-row policies.
-- INSERT/UPDATE/DELETE stay as they are (admin writes tasks today).
-- ---------------------------------------------------------------------------

drop policy if exists clients_admin_select on public.clients;
create policy clients_admin_select on public.clients
  for select to authenticated
  using (public.staff_may_client(id, 'clients.view'));

drop policy if exists projects_admin_select on public.projects;
create policy projects_admin_select on public.projects
  for select to authenticated
  using (public.staff_may_project(id, 'projects.view'));

drop policy if exists milestones_admin_select on public.milestones;
create policy milestones_admin_select on public.milestones
  for select to authenticated
  using (public.staff_may_project(project_id, 'projects.view'));

drop policy if exists tasks_admin_select on public.tasks;
create policy tasks_admin_select on public.tasks
  for select to authenticated
  using (public.staff_may_project(project_id, 'projects.view'));

drop policy if exists activity_admin_select on public.activity;
create policy activity_admin_select on public.activity
  for select to authenticated
  using (
    public.staff_may_project(project_id, 'activity.view')
    or public.staff_may_project(project_id, 'projects.view')
  );

drop policy if exists deliverables_admin_select on public.deliverables;
create policy deliverables_admin_select on public.deliverables
  for select to authenticated
  using (
    public.staff_may_project(project_id, 'files.view')
    or public.staff_may_project(project_id, 'projects.view')
  );

drop policy if exists file_versions_admin_select on public.file_versions;
create policy file_versions_admin_select on public.file_versions
  for select to authenticated
  using (exists (
    select 1 from public.deliverables d
    where d.id = deliverable_id
      and (
        public.staff_may_project(d.project_id, 'files.view')
        or public.staff_may_project(d.project_id, 'projects.view')
      )
  ));

drop policy if exists feedback_admin_select on public.feedback;
create policy feedback_admin_select on public.feedback
  for select to authenticated
  using (
    public.staff_may_project(project_id, 'feedback.manage')
    or public.staff_may_project(project_id, 'files.view')
  );

drop policy if exists approvals_admin_select on public.approvals;
create policy approvals_admin_select on public.approvals
  for select to authenticated
  using (
    public.staff_may_project(project_id, 'files.view')
    or public.staff_may_project(project_id, 'feedback.manage')
  );

-- ---------------------------------------------------------------------------
-- Task assignee → project assignment (idempotent, never removes)
-- ---------------------------------------------------------------------------

create or replace function public.tasks_ensure_assignee_project_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.assigned_to is null or new.project_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE'
     and new.assigned_to is not distinct from old.assigned_to
     and new.project_id is not distinct from old.project_id then
    return new;
  end if;
  -- Assignees can UPDATE their own task row (status). Do not let that
  -- path create project access, including a project_id change.
  if auth.uid() is not distinct from new.assigned_to then
    return new;
  end if;
  if not exists (
    select 1
    from public.staff_profiles s
    join public.profiles p on p.id = s.user_id
    where s.user_id = new.assigned_to
      and p.role = 'staff'
  ) then
    return new;
  end if;

  insert into public.project_staff_assignments (project_id, user_id, assigned_by)
  values (new.project_id, new.assigned_to, auth.uid())
  on conflict (project_id, user_id) do nothing;

  return new;
end;
$$;

revoke all on function public.tasks_ensure_assignee_project_assignment() from public, anon, authenticated;

drop trigger if exists tasks_ensure_assignee_project_assignment on public.tasks;
create trigger tasks_ensure_assignee_project_assignment
  after insert or update of assigned_to, project_id
  on public.tasks
  for each row
  execute function public.tasks_ensure_assignee_project_assignment();

-- Existing assigned tasks that never received a project row.
insert into public.project_staff_assignments (project_id, user_id, assigned_by)
select distinct t.project_id, t.assigned_to, null::uuid
from public.tasks t
join public.profiles p on p.id = t.assigned_to
join public.staff_profiles s on s.user_id = t.assigned_to
join public.projects pr on pr.id = t.project_id
where t.assigned_to is not null
  and t.project_id is not null
  and p.role = 'staff'
  and (
    not exists (
      select 1 from public.client_staff_assignments a where a.user_id = t.assigned_to
    )
    or exists (
      select 1
      from public.client_staff_assignments a
      where a.user_id = t.assigned_to and a.client_id = pr.client_id
    )
  )
on conflict (project_id, user_id) do nothing;

comment on function public.tasks_ensure_assignee_project_assignment() is
  'When a task is assigned to staff, upsert project_staff_assignments so /team can SELECT the parent project. Does not remove project assignment on unassign or reassign.';
