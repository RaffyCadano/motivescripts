-- Default estimated_hours per production task, so a normal staff member's
-- workload has a sensible planning number from the moment a task is
-- generated instead of every task starting blank. PM-entered estimates on
-- manually created/edited tasks are never overwritten by this -- these are
-- defaults for new/blank values only, not forced values.

create or replace function public.production_task_estimated_hours(p_title text)
returns numeric
language plpgsql
immutable
as $$
declare
  key text := public.production_task_title_key(p_title);
begin
  if key = '' then
    return null;
  end if;

  -- Exact, title-specific estimates.
  if key = 'review approved scope' then return 0.5; end if;
  if key = 'confirm sitemap and requirements' then return 1; end if;
  if key = 'collect/confirm client content and assets' then return 1; end if;
  if key = 'prepare contact information' then return 0.5; end if;
  if key = 'migrate approved content' then return 2; end if;
  if key = 'establish design direction' then return 3; end if;
  if key = 'design brand identity / logo' then return 4; end if;
  if key = 'design responsive/mobile layouts' then return 2; end if;
  if key = 'implement responsive layouts' then return 3; end if;
  if key = 'integrate approved content' then return 2; end if;
  if key = 'prepare/deploy staging' then return 1; end if;
  if key = 'prepare staging for client review' then return 0.5; end if;
  if key = 'address requested revisions' then return 2; end if;
  if key = 'test staging website' then return 1.5; end if;
  if key = 'test responsive layouts' then return 1; end if;
  if key = 'accessibility audit (ada/wcag)' then return 2; end if;
  if key = 'deploy production' then return 1; end if;
  if key = 'verify production website' then return 0.5; end if;
  if key = 'set up ad campaign' then return 2; end if;
  if key = 'set up social media & content calendar' then return 2; end if;
  if key = 'final qa' then return 1; end if;

  -- Per-page copy/design/build: homepage runs a bit longer than inner pages.
  if key = 'write homepage copy' then return 2; end if;
  if key like 'write % copy' then return 1.5; end if;

  if key = 'design homepage' then return 4; end if;
  if key like 'design %' then return 3; end if;

  if key = 'build homepage' then return 5; end if;
  if key like 'build %' then return 4; end if;

  -- Feature implementation: complexity varies a lot by feature.
  if key in ('implement e-commerce functionality', 'implement online store') then return 8; end if;
  if key = 'implement customer login' then return 4; end if;
  if key = 'implement online payments' then return 3; end if;
  if key = 'implement booking / appointment form' then return 2; end if;
  if key = 'implement quote request form' then return 1.5; end if;
  if key = 'implement contact form' then return 1; end if;
  if key like 'implement %' then return 2; end if;

  if key = 'set up seo' then return 2; end if;
  if key = 'set up hosting' then return 1; end if;
  if key = 'set up business email' then return 0.5; end if;
  if key like 'set up %' then return 1; end if;

  if key like 'install %' then return 0.5; end if;
  if key like 'connect %' then return 0.5; end if;

  if key = 'add newsletter signup' then return 1; end if;
  if key = 'add live chat' then return 1; end if;
  if key like 'add %' then return 0.5; end if;

  if key = 'performance optimization' then return 2; end if;
  if key = 'security setup' then return 1; end if;

  -- Any remaining "test X" is a single-feature QA pass.
  if key like 'test %' then return 0.5; end if;

  return null;
end;
$$;

comment on function public.production_task_estimated_hours(text) is
  'Default effort estimate (hours) for a known production task title. Null for unrecognized/custom titles -- never a forced value, only a default for blank estimated_hours.';

-- Extend the insert helper to accept an estimate. Trailing optional param --
-- both existing call sites (20260901180000, 20260901200000) still work
-- unchanged since they omit it (falls back to null, same as before).
create or replace function public.try_insert_production_task(
  p_project_id uuid,
  p_milestone_id uuid,
  p_title text,
  p_description text,
  p_position integer,
  p_estimated_hours numeric default null
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
    null,
    null,
    p_estimated_hours
  );
  return true;
end;
$$;

-- Redefine enqueue_production_task (same shape as 20260901200000's version)
-- to also compute and pass through the default estimate.
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
begin
  v_summary := public.production_scope_summary(public.project_accepted_production_keys(p_project_id));
  v_description := public.production_task_instructions(p_title, v_summary);
  if public.try_insert_production_task(
    p_project_id,
    p_milestone_id,
    p_title,
    coalesce(v_description, p_description),
    p_pos,
    public.production_task_estimated_hours(p_title)
  ) then
    p_inserted := coalesce(p_inserted, 0) + 1;
    p_pos := coalesce(p_pos, 0) + 1;
  end if;
end;
$$;

revoke all on function public.production_task_estimated_hours(text) from public, anon, authenticated;
revoke all on function public.try_insert_production_task(uuid, uuid, text, text, integer, numeric) from public, anon, authenticated;
revoke all on function public.enqueue_production_task(uuid, uuid, text, text, integer, integer) from public, anon, authenticated;

-- Backfill existing generated tasks that have no estimate yet. Never
-- overwrites a value someone already entered.
update public.tasks t
set estimated_hours = public.production_task_estimated_hours(t.title)
where t.estimated_hours is null
  and public.production_task_estimated_hours(t.title) is not null;
