-- Two Pro-tier promises that weren't actually distinguishing Pro from anything: monitoring was
-- identical across every tier, and there was no recurring review at all.
--
-- 1. "Advanced monitoring" -- Pro projects are now checked every 5 minutes (others stay on the
--    existing ~15-minute cadence) and alert on a sustained slowdown after 2 consecutive slow
--    checks (~10 minutes) instead of 4 (~1 hour). Same sweep/trigger, tier-aware instead of
--    uniform.
-- 2. "Monthly maintenance review" -- a real recurring task, auto-created once a month for every
--    plan on a tier that includes it, using the same pg_cron pattern every other scheduled job
--    here already uses.
--
-- Both flags live on maintenance_plan_templates (fast_monitoring, review_included), admin-editable
-- like every other tier detail -- not hardcoded to the tier name "Pro", so renaming or restructuring
-- tiers later doesn't silently break either behavior.

alter table public.maintenance_plan_templates
  add column if not exists fast_monitoring boolean not null default false,
  add column if not exists review_included boolean not null default false;

comment on column public.maintenance_plan_templates.fast_monitoring is
  '"Advanced monitoring": a plan on this tier is checked every 5 minutes instead of ~15, and alerts on a sustained slowdown after 2 consecutive slow checks instead of 4.';
comment on column public.maintenance_plan_templates.review_included is
  '"Monthly maintenance review": a plan on this tier gets a recurring task auto-created on the 1st of each month (create_monthly_maintenance_review_tasks).';

update public.maintenance_plan_templates set fast_monitoring = true, review_included = true where name = 'Pro';

-- ---------------------------------------------------------------------------
-- 1. Advanced monitoring: which projects get the fast cadence, and a shared lookup both the sweep
--    and the alert trigger use so the two stay in agreement about which projects are "advanced".
-- ---------------------------------------------------------------------------

create or replace function public.project_has_fast_monitoring(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select mpt.fast_monitoring
      from public.projects p
      join public.service_plans sp
        on sp.plan_type = 'care' and sp.status in ('active', 'past_due')
        and (sp.project_id = p.id or (sp.project_id is null and sp.client_id = p.client_id))
      join public.maintenance_plan_templates mpt on mpt.id = sp.plan_template_id
      where p.id = p_project_id
      order by (sp.project_id = p_project_id) desc, sp.created_at desc
      limit 1
    ),
    false
  );
$$;

comment on function public.project_has_fast_monitoring(uuid) is
  '"Advanced monitoring" eligibility -- true when the project''s active/past-due Care plan is on a fast_monitoring tier. Same plan-matching precedence (project-specific, then client-level) as care_requests_before_insert.';

revoke all on function public.project_has_fast_monitoring(uuid) from public, anon, authenticated;
grant execute on function public.project_has_fast_monitoring(uuid) to service_role;

-- Every launched project with a production_url, but throttled: a non-fast-monitoring project is
-- only due if its last production check was 14+ minutes ago (so on a 5-minute sweep cadence it
-- still lands on roughly the old ~15-minute rhythm), while a fast-monitoring project is due every
-- tick. Replaces check-website-health's own two-step project_development/projects lookup so both
-- the throttling and the fast-tier exemption live in one place.
create or replace function public.projects_due_for_website_check()
returns table (project_id uuid, production_url text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.production_url
  from public.projects p
  join public.project_development pd on pd.project_id = p.id
  where pd.deployment_status = 'Production'
    and p.production_url is not null
    and (
      public.project_has_fast_monitoring(p.id)
      or not exists (
        select 1 from public.website_health_checks whc
        where whc.project_id = p.id
          and whc.environment = 'production'
          and whc.checked_at > now() - interval '14 minutes'
      )
    )
  limit 50;
$$;

comment on function public.projects_due_for_website_check() is
  'Every launched project due for a production health check this sweep tick: fast_monitoring (Advanced monitoring) projects every tick, others throttled to roughly their last ~15-minute cadence regardless of the sweep''s own (now 5-minute) frequency.';

revoke all on function public.projects_due_for_website_check() from public, anon, authenticated;
grant execute on function public.projects_due_for_website_check() to service_role;

-- Faster cadence for the sweep itself -- projects_due_for_website_check() is what actually decides
-- whether a given project is checked on a given tick, so non-advanced projects are unaffected.
select cron.unschedule(jobid) from cron.job where jobname = 'check-website-uptime';
select cron.schedule(
  'check-website-uptime',
  '*/5 * * * *',
  $$ do $do$ begin perform public.run_scheduled_website_health_checks(); exception when others then raise warning 'run_scheduled_website_health_checks failed: %', sqlerrm; end $do$; $$
);

-- Tier-aware slow-alert threshold: 2 consecutive slow checks for a fast_monitoring project
-- (~10 minutes at the new 5-minute cadence), 4 for everyone else (~1 hour, unchanged).
create or replace function public.website_health_checks_notify_state_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_previous_status text;
  v_previous_checked_at timestamptz;
  v_project record;
  v_slow_threshold_ms constant integer := 3000;
  v_slow_streak_count integer;
  v_streak integer;
  v_previous_streak integer;
begin
  if new.environment <> 'production' then
    return new;
  end if;

  v_slow_streak_count := case when public.project_has_fast_monitoring(new.project_id) then 2 else 4 end;

  select status, checked_at into v_previous_status, v_previous_checked_at
  from public.website_health_checks
  where project_id = new.project_id
    and environment = new.environment
    and id <> new.id
    and checked_at <= new.checked_at
  order by checked_at desc
  limit 1;

  if new.status = 'down' and coalesce(v_previous_status, '') <> 'down' then
    select p.id, p.name, p.client_id into v_project from public.projects p where p.id = new.project_id;
    if v_project.id is not null then
      perform public.notify_agency(
        'projects.view', v_project.client_id, 'website_down',
        v_project.name || ' appears to be down',
        coalesce(nullif(new.error_message, ''), 'The production site stopped responding.'),
        p_project_id => new.project_id
      );
    end if;
    return new;
  elsif new.status = 'healthy' and v_previous_status = 'down' then
    select p.id, p.name, p.client_id into v_project from public.projects p where p.id = new.project_id;
    if v_project.id is not null then
      perform public.notify_agency(
        'projects.view', v_project.client_id, 'website_recovered',
        v_project.name || ' is back up',
        'The production site is responding again.',
        p_project_id => new.project_id
      );
    end if;
    return new;
  end if;

  if new.status <> 'down' then
    v_streak := public.consecutive_slow_checks(new.project_id, new.environment, v_slow_threshold_ms, new.checked_at);
    if v_streak = v_slow_streak_count then
      select p.id, p.name, p.client_id into v_project from public.projects p where p.id = new.project_id;
      if v_project.id is not null then
        perform public.notify_agency(
          'projects.view', v_project.client_id, 'website_slow',
          v_project.name || ' has been responding slowly',
          format(
            'The last %s checks have all been slower than %s seconds. Latest: %s ms.',
            v_slow_streak_count, v_slow_threshold_ms / 1000, new.response_time_ms
          ),
          p_project_id => new.project_id
        );
      end if;
    elsif new.response_time_ms is not null and new.response_time_ms < v_slow_threshold_ms and v_previous_checked_at is not null then
      v_previous_streak := public.consecutive_slow_checks(new.project_id, new.environment, v_slow_threshold_ms, v_previous_checked_at);
      if v_previous_streak >= v_slow_streak_count then
        select p.id, p.name, p.client_id into v_project from public.projects p where p.id = new.project_id;
        if v_project.id is not null then
          perform public.notify_agency(
            'projects.view', v_project.client_id, 'website_speed_recovered',
            v_project.name || ' is responding normally again',
            format('Response time is back under %s seconds (latest: %s ms).', v_slow_threshold_ms / 1000, new.response_time_ms),
            p_project_id => new.project_id
          );
        end if;
      end if;
    end if;
  end if;

  return new;
end;
$$;

comment on function public.website_health_checks_notify_state_change() is
  'Notifies staff (projects.view) on a production check transitioning into/out of "down", and on a sustained slowdown transitioning into/out of that state -- 2 consecutive slow checks for an Advanced-monitoring (fast_monitoring) project, 4 for everyone else. Fires for both the manual Check Now and the scheduled sweep.';

-- ---------------------------------------------------------------------------
-- 2. Monthly maintenance review: a real recurring task, not a promise with nothing behind it.
-- ---------------------------------------------------------------------------

create or replace function public.create_monthly_maintenance_review_tasks()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month_start date := date_trunc('month', (timezone('utc', now()))::date)::date;
  v_plan record;
  v_title text;
begin
  v_title := 'Monthly maintenance review — ' || to_char(v_month_start, 'FMMonth YYYY');

  for v_plan in
    select sp.id as plan_id, sp.project_id, sp.client_id, sp.label
    from public.service_plans sp
    join public.maintenance_plan_templates mpt on mpt.id = sp.plan_template_id
    where sp.plan_type = 'care'
      and sp.status in ('active', 'past_due')
      and mpt.review_included
      and sp.project_id is not null
  loop
    begin
      -- Idempotent per project per month: skip if this month's review task already exists (a
      -- second cron run on the same day, or a manual re-run, never creates a duplicate).
      if exists (
        select 1 from public.tasks
        where project_id = v_plan.project_id
          and title = v_title
          and created_at >= v_month_start
      ) then
        continue;
      end if;

      insert into public.tasks (project_id, title, description, status, priority)
      values (
        v_plan.project_id,
        v_title,
        'Scheduled monthly review for the ' || v_plan.label || ' Website Care plan: check site health, review recent Care requests, and confirm nothing needs proactive attention.',
        'Todo',
        'Medium'
      );
    exception
      when others then
        raise warning 'create_monthly_maintenance_review_tasks: failed for plan %: %', v_plan.plan_id, sqlerrm;
    end;
  end loop;
end;
$$;

comment on function public.create_monthly_maintenance_review_tasks() is
  'Scheduled via pg_cron (create-monthly-maintenance-reviews, 1st of each month). Creates one "Monthly maintenance review" task per project on a review_included tier (Pro, by default) -- idempotent per project per month.';

revoke all on function public.create_monthly_maintenance_review_tasks() from public, anon, authenticated;

select cron.schedule(
  'create-monthly-maintenance-reviews',
  '0 13 1 * *',
  $$ do $do$ begin perform public.create_monthly_maintenance_review_tasks(); exception when others then raise warning 'create_monthly_maintenance_review_tasks failed: %', sqlerrm; end $do$; $$
);
