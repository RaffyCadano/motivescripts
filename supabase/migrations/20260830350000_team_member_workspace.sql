-- Team member workspace: production job templates, task assignees, and assignment notifications.

-- ---------------------------------------------------------------------------
-- Staff templates: developer, designer, content_writer, team_member
-- ---------------------------------------------------------------------------

do $$
begin
  alter table public.staff_templates drop constraint staff_templates_key_check;
exception
  when undefined_object then null;
end $$;

alter table public.staff_templates
  add constraint staff_templates_key_check
  check (key in (
    'admin',
    'staff',
    'project_manager',
    'sales',
    'accounting',
    'developer',
    'designer',
    'content_writer',
    'team_member'
  ));

insert into public.staff_templates (key, label, profile_role) values
  ('developer', 'Developer', 'staff'),
  ('designer', 'Designer', 'staff'),
  ('content_writer', 'Content Writer', 'staff'),
  ('team_member', 'Team Member', 'staff')
on conflict (key) do nothing;

insert into public.staff_template_permissions (template_key, permission_code)
select templates.key, perms.code
from (values
  ('developer'),
  ('designer'),
  ('content_writer'),
  ('team_member')
) as templates(key)
cross join (values
  ('clients.view'),
  ('projects.view'),
  ('projects.manage'),
  ('files.view'),
  ('files.manage'),
  ('feedback.manage'),
  ('messages.view'),
  ('messages.manage'),
  ('activity.view')
) as perms(code)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Tasks: user assignment + In Review
-- ---------------------------------------------------------------------------

alter table public.tasks
  add column if not exists assigned_to uuid references public.profiles (id) on delete set null;

create index if not exists tasks_assigned_to_idx on public.tasks (assigned_to);

do $$
begin
  alter table public.tasks drop constraint tasks_status_check;
exception
  when undefined_object then null;
end $$;

alter table public.tasks
  add constraint tasks_status_check
  check (status in ('Todo', 'In Progress', 'In Review', 'Completed', 'Blocked'));

-- ---------------------------------------------------------------------------
-- Notifications for assignment events
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
    'milestone_updated'
  ));

-- ---------------------------------------------------------------------------
-- RLS: assignees can read and update their own tasks
-- ---------------------------------------------------------------------------

drop policy if exists tasks_select_assigned on public.tasks;
create policy tasks_select_assigned on public.tasks
  for select to authenticated
  using (
    assigned_to = auth.uid()
    and (public.is_admin() or public.is_active_staff())
  );

drop policy if exists tasks_update_assigned on public.tasks;
create policy tasks_update_assigned on public.tasks
  for update to authenticated
  using (
    assigned_to = auth.uid()
    and (public.is_admin() or public.is_active_staff())
  )
  with check (
    assigned_to = auth.uid()
    and (public.is_admin() or public.is_active_staff())
  );

create or replace function public.update_my_task_status(p_task_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if not (public.is_admin() or public.is_active_staff()) then
    raise exception 'NOT_ALLOWED';
  end if;
  if p_status not in ('Todo', 'In Progress', 'In Review', 'Completed', 'Blocked') then
    raise exception 'INVALID_STATUS';
  end if;

  update public.tasks
  set
    status = p_status,
    completed_at = case
      when p_status = 'Completed' then coalesce(completed_at, now())
      else null
    end,
    updated_at = now()
  where id = p_task_id
    and assigned_to = uid;

  if not found then
    raise exception 'NOT_ALLOWED';
  end if;
end;
$$;

revoke all on function public.update_my_task_status(uuid, text) from public, anon;
grant execute on function public.update_my_task_status(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Notify the assignee when a task is assigned
-- ---------------------------------------------------------------------------

create or replace function public.tasks_notify_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  project_name text;
begin
  if new.assigned_to is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.assigned_to is not distinct from old.assigned_to then
    return new;
  end if;
  if new.assigned_to = auth.uid() then
    return new;
  end if;

  select name into project_name from public.projects where id = new.project_id;

  insert into public.notifications (user_id, type, title, body, project_id)
  values (
    new.assigned_to,
    'task_assigned',
    'New task assigned',
    trim(new.title) || coalesce(' · ' || project_name, ''),
    new.project_id
  );

  return new;
end;
$$;

drop trigger if exists tasks_notify_assignment on public.tasks;
create trigger tasks_notify_assignment
  after insert or update of assigned_to on public.tasks
  for each row
  execute function public.tasks_notify_assignment();

create or replace function public.tasks_notify_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  project_name text;
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return new;
  end if;
  if new.assigned_to is null or new.assigned_to = auth.uid() then
    return new;
  end if;

  select name into project_name from public.projects where id = new.project_id;

  insert into public.notifications (user_id, type, title, body, project_id)
  values (
    new.assigned_to,
    'task_status_changed',
    'Task status updated',
    trim(new.title) || ' is now ' || new.status || coalesce(' · ' || project_name, ''),
    new.project_id
  );

  return new;
end;
$$;

drop trigger if exists tasks_notify_status on public.tasks;
create trigger tasks_notify_status
  after update of status on public.tasks
  for each row
  execute function public.tasks_notify_status();

create or replace function public.project_staff_notify_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  project_name text;
begin
  if new.user_id = auth.uid() then
    return new;
  end if;

  select name into project_name from public.projects where id = new.project_id;

  insert into public.notifications (user_id, type, title, body, project_id)
  values (
    new.user_id,
    'project_assigned',
    'Added to a project',
    coalesce(project_name, 'A project') || ' was assigned to you.',
    new.project_id
  );

  return new;
end;
$$;

drop trigger if exists project_staff_notify_assignment on public.project_staff_assignments;
create trigger project_staff_notify_assignment
  after insert on public.project_staff_assignments
  for each row
  execute function public.project_staff_notify_assignment();

create or replace function public.milestones_notify_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  client_uuid uuid;
  project_name text;
begin
  if tg_op = 'UPDATE'
    and new.status is not distinct from old.status
    and new.name is not distinct from old.name
    and new.due_date is not distinct from old.due_date
  then
    return new;
  end if;

  select pr.client_id, pr.name into client_uuid, project_name
  from public.projects pr
  where pr.id = new.project_id;

  perform public.notify_agency(
    'projects.view',
    client_uuid,
    'milestone_updated',
    'Project milestone update',
    coalesce(new.name, 'A milestone') || ' · ' || coalesce(project_name, 'Project'),
    null, null, new.project_id, null, null, null, null
  );

  return new;
end;
$$;

drop trigger if exists milestones_notify_update on public.milestones;
create trigger milestones_notify_update
  after update on public.milestones
  for each row
  execute function public.milestones_notify_update();
