-- Task due dates were exactly like estimated_hours before it: no default
-- anywhere. Auto-generated tasks always got due_date = null, and the default
-- milestones (Discovery/Design/Development/Review/Launch) never got dates
-- either -- so the whole "Overdue"/"Due Soon" system stayed silent even on a
-- badly-behind project, since nothing had a deadline to be behind on.
--
-- Fix: when a project has a target launch date (projects.due_date), split
-- that span across the 5 milestones (10/20/40/20/10 -- a standard web-project
-- weighting) and give every task in a milestone that milestone's due date.
-- Only fills blanks -- a milestone or task with a date already set (PM- or
-- previously-computed) is never touched. Never invents a deadline when there
-- is no target launch date to anchor to.

create or replace function public.sync_project_milestone_dates(p_project_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start date;
  v_target date;
  v_total_days integer;
  v_discovery_end date;
  v_design_end date;
  v_development_end date;
  v_review_end date;
  v_launch_end date;
begin
  select coalesce(p.start_date, p.created_at::date), p.due_date
    into v_start, v_target
  from public.projects p
  where p.id = p_project_id;

  if v_target is null or v_start is null or v_target <= v_start then
    return;
  end if;

  v_total_days := greatest(v_target - v_start, 5);
  v_discovery_end := v_start + round(v_total_days * 0.10)::int;
  v_design_end := v_start + round(v_total_days * 0.30)::int;
  v_development_end := v_start + round(v_total_days * 0.70)::int;
  v_review_end := v_start + round(v_total_days * 0.90)::int;
  v_launch_end := v_target;

  update public.milestones
    set start_date = v_start, due_date = v_discovery_end
    where project_id = p_project_id and lower(name) = 'discovery'
      and start_date is null and due_date is null;
  update public.milestones
    set start_date = v_discovery_end, due_date = v_design_end
    where project_id = p_project_id and lower(name) = 'design'
      and start_date is null and due_date is null;
  update public.milestones
    set start_date = v_design_end, due_date = v_development_end
    where project_id = p_project_id and lower(name) = 'development'
      and start_date is null and due_date is null;
  update public.milestones
    set start_date = v_development_end, due_date = v_review_end
    where project_id = p_project_id
      and lower(trim(name)) in ('client review', 'review', 'qa & client review', 'qa and client review')
      and start_date is null and due_date is null;
  update public.milestones
    set start_date = v_review_end, due_date = v_launch_end
    where project_id = p_project_id and lower(name) = 'launch'
      and start_date is null and due_date is null;

  -- Any task with no due date yet inherits its (now-dated) milestone's due date.
  update public.tasks t
    set due_date = m.due_date
  from public.milestones m
  where t.milestone_id = m.id
    and t.project_id = p_project_id
    and t.due_date is null
    and m.due_date is not null;
end;
$$;

revoke all on function public.sync_project_milestone_dates(uuid) from public, anon, authenticated;
grant execute on function public.sync_project_milestone_dates(uuid) to service_role;

comment on function public.sync_project_milestone_dates(uuid) is
  'Fills blank milestone/task dates from the project''s own start_date/due_date (target launch), split 10/20/40/20/10 across Discovery/Design/Development/Review/Launch. Never overwrites a date already set.';

create or replace function public.projects_sync_milestone_dates_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_project_milestone_dates(new.id);
  return new;
end;
$$;

drop trigger if exists projects_sync_milestone_dates on public.projects;
create trigger projects_sync_milestone_dates
  after insert or update of due_date, start_date on public.projects
  for each row
  when (new.due_date is not null)
  execute function public.projects_sync_milestone_dates_trigger();

-- Extend the insert helper to also accept a due date. Trailing optional
-- param -- existing callers that omit it keep getting null, same as before.
create or replace function public.try_insert_production_task(
  p_project_id uuid,
  p_milestone_id uuid,
  p_title text,
  p_description text,
  p_position integer,
  p_estimated_hours numeric default null,
  p_due_date date default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.tasks
    where project_id = p_project_id
      and lower(trim(title)) = lower(trim(p_title))
  ) then
    return false;
  end if;

  insert into public.tasks (
    project_id,
    milestone_id,
    title,
    description,
    status,
    priority,
    assignee,
    assigned_to,
    position,
    due_date,
    completed_at,
    estimated_hours
  )
  values (
    p_project_id,
    p_milestone_id,
    p_title,
    coalesce(p_description, ''),
    'Todo',
    'Medium',
    '',
    null,
    p_position,
    p_due_date,
    null,
    p_estimated_hours
  );
  return true;
end;
$$;

-- Redefine enqueue_production_task (same shape as 20260915000000's version)
-- to also look up its milestone's due date and pass it through.
create or replace function public.enqueue_production_task(
  p_project_id uuid,
  p_milestone_id uuid,
  p_title text,
  p_description text,
  inout p_pos integer,
  inout p_inserted integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_description text;
  v_summary text;
  v_due_date date;
begin
  v_summary := public.production_scope_summary(public.project_accepted_production_keys(p_project_id));
  v_description := public.production_task_instructions(p_title, v_summary);
  select due_date into v_due_date from public.milestones where id = p_milestone_id;
  if public.try_insert_production_task(
    p_project_id,
    p_milestone_id,
    p_title,
    coalesce(v_description, p_description),
    p_pos,
    public.production_task_estimated_hours(p_title),
    v_due_date
  ) then
    p_inserted := coalesce(p_inserted, 0) + 1;
    p_pos := coalesce(p_pos, 0) + 1;
  end if;
end;
$$;

revoke all on function public.try_insert_production_task(uuid, uuid, text, text, integer, numeric, date) from public, anon, authenticated;
revoke all on function public.enqueue_production_task(uuid, uuid, text, text, integer, integer) from public, anon, authenticated;
revoke all on function public.projects_sync_milestone_dates_trigger() from public, anon, authenticated;

-- One-time backfill: existing projects that already have a target launch
-- date but blank milestone/task dates (created before this migration).
do $$
declare
  r record;
begin
  for r in
    select id from public.projects
    where due_date is not null and coalesce(archived, false) = false
  loop
    perform public.sync_project_milestone_dates(r.id);
  end loop;
end;
$$;
