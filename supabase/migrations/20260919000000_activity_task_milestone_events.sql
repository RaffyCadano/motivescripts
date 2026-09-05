-- The project Activity tab only ever showed document/messaging events
-- (proposals, contracts, invoices, feedback, files) -- task assignment, task
-- status changes, and milestone updates fired notifications but never wrote
-- to public.activity, even though the UI has "task"/"milestone"/"created"
-- icons already reserved and unused for exactly this. This widens the three
-- existing notification triggers to also log to the project timeline, and
-- adds one aggregate row (not one row per task) when a production plan is
-- first generated, so a project's day-one 15-30 auto-created tasks don't
-- flood the feed.

create or replace function public.tasks_notify_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  project_name text;
  assignee_name text;
begin
  if new.assigned_to is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.assigned_to is not distinct from old.assigned_to then
    return new;
  end if;

  select name into project_name from public.projects where id = new.project_id;
  select nullif(trim(full_name), '') into assignee_name from public.profiles where id = new.assigned_to;

  insert into public.activity (project_id, actor_id, activity_type, message, metadata)
  values (
    new.project_id,
    auth.uid(),
    'task_assigned',
    trim(new.title) || ' assigned to ' || coalesce(assignee_name, 'a team member'),
    jsonb_build_object('icon', 'task')
  );

  if new.assigned_to = auth.uid() then
    return new;
  end if;

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

  select name into project_name from public.projects where id = new.project_id;

  insert into public.activity (project_id, actor_id, activity_type, message, metadata)
  values (
    new.project_id,
    auth.uid(),
    'task_status_changed',
    trim(new.title) || ' moved to ' || new.status,
    jsonb_build_object('icon', 'task')
  );

  if new.assigned_to is null or new.assigned_to = auth.uid() then
    return new;
  end if;

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

  insert into public.activity (project_id, actor_id, activity_type, message, metadata)
  values (
    new.project_id,
    auth.uid(),
    'milestone_updated',
    coalesce(new.name, 'Milestone') ||
      case
        when new.status is distinct from old.status then ' is now ' || new.status
        when new.due_date is distinct from old.due_date then ' due date updated'
        else ' updated'
      end,
    jsonb_build_object('icon', 'milestone')
  );

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

-- One aggregate activity row when the production plan is first generated,
-- fired off projects.production_plan_generated_at flipping from null to set
-- (rather than logging inside prepare_project_production_from_paid_invoice
-- itself, which would mean redefining that ~500-line function just to add
-- one insert -- this reads back what it already committed instead).
create or replace function public.log_production_plan_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  task_count integer;
  milestone_count integer;
begin
  if new.production_plan_generated_at is null or old.production_plan_generated_at is not null then
    return new;
  end if;

  select count(*) into task_count from public.tasks where project_id = new.id;
  select count(distinct milestone_id) into milestone_count
  from public.tasks
  where project_id = new.id and milestone_id is not null;

  if task_count = 0 then
    return new;
  end if;

  insert into public.activity (project_id, actor_id, activity_type, message, metadata)
  values (
    new.id,
    auth.uid(),
    'production_plan_generated',
    'Production plan generated — ' || task_count || ' tasks across ' || milestone_count || ' milestones',
    jsonb_build_object('icon', 'created')
  );

  return new;
end;
$$;

drop trigger if exists projects_log_production_plan_activity on public.projects;
create trigger projects_log_production_plan_activity
  after update of production_plan_generated_at on public.projects
  for each row
  execute function public.log_production_plan_activity();

comment on function public.log_production_plan_activity() is
  'Logs one aggregate Activity row (task/milestone count) when a project''s production plan is first generated, instead of one row per auto-created task.';
