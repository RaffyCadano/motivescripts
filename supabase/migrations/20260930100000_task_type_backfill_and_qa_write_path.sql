-- Fixes a gap the previous migration's gates depend on: task_type is null for
-- every task created after the one-time 20260903000000_task_workspace.sql
-- backfill, because try_insert_production_task (the function that generates
-- every production task from a paid invoice) never sets it. The frontend
-- already papers over this with a client-side fallback (classifyTaskTitle()
-- in src/data/taskTypes.ts, used by effectiveTaskType()) so QA/Client Review
-- tasks already *display* correctly -- but the new workflow-gate triggers
-- check the real task_type column, so without this fix they would silently
-- never recognize any generated QA/Client Review task. This migration makes
-- task_type authoritative going forward (as 20260903000000's own comment
-- already intended: "replaces title-string matching") using the exact same
-- classification the frontend already trusts -- nothing about how these
-- tasks display or behave changes, since the UI already showed this result.

create or replace function public.classify_task_type(p_title text)
returns text
language sql
immutable
as $$
  select case lower(trim(coalesce(p_title, '')))
    when 'review approved scope' then 'discovery'
    when 'confirm sitemap and requirements' then 'discovery'
    when 'collect/confirm client content and assets' then 'content_collection'
    when 'prepare contact information' then 'content_collection'
    when 'migrate approved content' then 'content_collection'
    when 'establish design direction' then 'design'
    when 'design homepage' then 'design'
    when 'design responsive/mobile layouts' then 'design'
    when 'prepare/deploy staging' then 'client_review'
    when 'prepare staging for client review' then 'client_review'
    when 'address requested revisions' then 'client_review'
    when 'test staging website' then 'qa'
    when 'test responsive layouts' then 'qa'
    when 'final qa' then 'qa'
    else case
      when lower(trim(coalesce(p_title, ''))) ~ '^design ' then 'design'
      when lower(trim(coalesce(p_title, ''))) ~ '^test ' then 'qa'
      when lower(trim(coalesce(p_title, ''))) ~ '^write .* copy$' then 'production'
      when lower(trim(coalesce(p_title, ''))) ~ '^build ' then 'production'
      when lower(trim(coalesce(p_title, ''))) ~ '^implement ' then 'production'
      when lower(trim(coalesce(p_title, ''))) ~ '^add ' then 'production'
      when lower(trim(coalesce(p_title, ''))) ~ '^set up ' then 'production'
      when lower(trim(coalesce(p_title, ''))) ~ '^install ' then 'production'
      when lower(trim(coalesce(p_title, ''))) ~ '^connect ' then 'production'
      else 'internal'
    end
  end;
$$;

comment on function public.classify_task_type(text) is
  'Server-side mirror of classifyTaskTitle() in src/data/taskTypes.ts. Kept in sync manually -- if that catalog changes, update this function in a new migration.';

create or replace function public.tasks_default_task_type()
returns trigger
language plpgsql
as $$
begin
  if new.task_type is null then
    new.task_type := public.classify_task_type(new.title);
  end if;
  return new;
end;
$$;

drop trigger if exists tasks_default_task_type on public.tasks;
create trigger tasks_default_task_type
  before insert on public.tasks
  for each row execute function public.tasks_default_task_type();

-- One-time backfill for rows inserted between the two migrations (identical
-- effect to what effectiveTaskType() already displays for these rows today
-- -- this does not change any task's title, status, milestone, or any other
-- field, and never touches a row that already has a task_type).
update public.tasks
set task_type = public.classify_task_type(title)
where task_type is null;

-- ---------------------------------------------------------------------------
-- update_my_task_status: add the QA verdict parameter so an assigned QA
-- reviewer can actually satisfy the "set qa_result before completing a QA
-- task" gate from 20260930090000_production_workflow_gates.sql. Same shape
-- as the existing p_blocked_reason parameter.
-- ---------------------------------------------------------------------------

create or replace function public.update_my_task_status(
  p_task_id uuid,
  p_status text,
  p_blocked_reason text default null,
  p_qa_result text default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
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
  if p_status = 'Blocked' and p_blocked_reason is not null and p_blocked_reason not in (
    'waiting_on_client', 'waiting_on_pm', 'waiting_on_designer', 'waiting_on_content',
    'technical_issue', 'external_dependency', 'other'
  ) then
    raise exception 'INVALID_STATUS';
  end if;
  if p_qa_result is not null and p_qa_result not in ('pass', 'fail') then
    raise exception 'INVALID_STATUS';
  end if;

  update public.tasks
  set
    status = p_status,
    blocked_reason = case when p_status = 'Blocked' then p_blocked_reason else null end,
    qa_result = case when p_status = 'Completed' then p_qa_result else null end,
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
$function$;

revoke all on function public.classify_task_type(text) from public, anon;
revoke all on function public.tasks_default_task_type() from public, anon;
