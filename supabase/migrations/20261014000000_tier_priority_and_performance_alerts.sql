-- Two more Website Care tier promises that weren't actually enforced anywhere:
--
-- 1. "Priority support" -- care_requests.priority always defaulted to Medium regardless of which
--    tier the client was on; nothing read the plan at all. Now a new request's priority defaults
--    from the client's plan tier's own default_priority (admin-editable per tier), same as every
--    other tier detail. Staff can still change it by hand afterward, exactly as today.
--
-- 2. "Performance monitoring" -- response_time_ms was recorded on every health check (now every 15
--    minutes, see 20261012000000) but nothing ever looked at it. This adds sustained-slowdown
--    alerting (a single slow check is noise; several in a row, ~1 hour, is a real signal) using the
--    same state-change trigger and notification pattern the down/recovered alerts already use.

-- ---------------------------------------------------------------------------
-- 1. Tier-aware default priority
-- ---------------------------------------------------------------------------

alter table public.maintenance_plan_templates
  add column if not exists default_priority text not null default 'Medium'
    check (default_priority in ('Low', 'Medium', 'High', 'Urgent'));

comment on column public.maintenance_plan_templates.default_priority is
  'A new care request from a client on this tier starts at this priority (staff can still change it by hand). Not copied onto service_plans -- always read live from the template, so re-tiering the priority later applies to new requests going forward without needing to touch existing plans.';

-- Example tiers get a priority that scales with the tier, matching "Priority support" as it's
-- actually described on each -- fully editable, same as every other tier field.
update public.maintenance_plan_templates set default_priority = 'Medium' where name = 'Essential';
update public.maintenance_plan_templates set default_priority = 'High' where name = 'Business';
update public.maintenance_plan_templates set default_priority = 'Urgent' where name = 'Pro';

create or replace function public.care_requests_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_launched boolean;
  v_has_plan boolean;
  v_plan_id uuid;
  v_default_priority text;
begin
  select role into v_role from public.profiles where id = auth.uid();

  if not exists (select 1 from public.projects where id = new.project_id and client_id = new.client_id) then
    raise exception 'PROJECT_CLIENT_MISMATCH';
  end if;

  select sp.id into v_plan_id
    from public.service_plans sp
    where sp.plan_type = 'care'
      and sp.status in ('active', 'past_due')
      and (sp.project_id = new.project_id or (sp.project_id is null and sp.client_id = new.client_id))
    order by (sp.project_id = new.project_id) desc, sp.created_at desc
    limit 1;
  v_has_plan := v_plan_id is not null;

  if v_role = 'client' then
    new.submitted_by := auth.uid();
    select coalesce(pd.deployment_status = 'Production', false)
      into v_launched
      from public.project_development pd
      where pd.project_id = new.project_id;
    if not coalesce(v_launched, false) then
      raise exception 'NOT_LAUNCHED';
    end if;
    if not v_has_plan then
      raise exception 'NO_ACTIVE_PLAN';
    end if;
  end if;

  new.has_active_care_plan := v_has_plan;
  new.service_plan_id := v_plan_id;

  -- Priority support: default from the client's plan tier, if it's on one. A custom/legacy plan
  -- with no plan_template_id (or no plan at all) keeps the table's own Medium default.
  if v_plan_id is not null then
    select mpt.default_priority into v_default_priority
    from public.service_plans sp
    join public.maintenance_plan_templates mpt on mpt.id = sp.plan_template_id
    where sp.id = v_plan_id;
    if v_default_priority is not null then
      new.priority := v_default_priority;
    end if;
  end if;

  if new.status = 'Done' and new.resolved_at is null then
    new.resolved_at := now();
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Sustained-slowdown alerting
-- ---------------------------------------------------------------------------

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
    check (type = any (array[
      'new_message', 'feedback_received', 'changes_requested', 'version_ready_for_review',
      'version_approved', 'project_update', 'proposal_ready', 'proposal_viewed',
      'proposal_accepted', 'proposal_declined', 'contract_ready', 'contract_viewed',
      'contract_accepted', 'contract_declined', 'invoice_ready', 'invoice_viewed',
      'payment_recorded', 'payment_received', 'invoice_paid', 'invoice_overdue',
      'task_assigned', 'task_status_changed', 'project_assigned', 'milestone_updated',
      'task_info_requested', 'task_response_submitted', 'plan_past_due', 'plan_canceled',
      'task_comment_added', 'task_due_soon', 'task_overdue', 'payroll_paid',
      'domain_expiring_soon', 'domain_expired', 'ssl_expiring_soon', 'ssl_expired',
      'qa_failed', 'qa_passed', 'client_review_ready', 'launch_completed',
      'development_completed', 'project_completed', 'lead_submitted', 'care_request_submitted',
      'website_down', 'website_recovered', 'website_slow', 'website_speed_recovered'
    ]));

-- How many of the most recent checks (most recent first, starting at/before p_before), for this
-- project+environment, are consecutively "slow" -- status is not down, and response_time_ms is at
-- or above the threshold. Stops at the first check that breaks the streak (down, missing response
-- time, or under threshold). Capped at 20 rows back, comfortably more than SLOW_STREAK needs.
create or replace function public.consecutive_slow_checks(
  p_project_id uuid,
  p_environment text,
  p_threshold_ms integer,
  p_before timestamptz
)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  v_row record;
begin
  for v_row in
    select status, response_time_ms
    from public.website_health_checks
    where project_id = p_project_id and environment = p_environment and checked_at <= p_before
    order by checked_at desc
    limit 20
  loop
    if v_row.status = 'down' or v_row.response_time_ms is null or v_row.response_time_ms < p_threshold_ms then
      exit;
    end if;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

comment on function public.consecutive_slow_checks(uuid, text, integer, timestamptz) is
  'How many consecutive most-recent checks (ending at/before p_before) are "slow" -- not down, response_time_ms >= p_threshold_ms. Used by website_health_checks_notify_state_change to alert on a sustained slowdown, not a single slow check.';

revoke all on function public.consecutive_slow_checks(uuid, text, integer, timestamptz) from public, anon, authenticated;

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
  v_slow_streak_count constant integer := 4;
  v_streak integer;
  v_previous_streak integer;
begin
  -- Staging checks don't page anyone -- only production reachability/performance is an incident.
  if new.environment <> 'production' then
    return new;
  end if;

  select status, checked_at into v_previous_status, v_previous_checked_at
  from public.website_health_checks
  where project_id = new.project_id
    and environment = new.environment
    and id <> new.id
    and checked_at <= new.checked_at
  order by checked_at desc
  limit 1;

  -- Alert only on a genuine transition into or out of "down" -- not on every consecutive down
  -- check (would spam every 15 minutes for the length of an outage), and not on "degraded": a
  -- single 4xx/5xx is deliberately not escalated, same reasoning as the per-check classification
  -- documented in check-website-health.
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

  -- Sustained slowdown: fire exactly once when the streak first reaches v_slow_streak_count (not
  -- on every slow check after that), and once on recovery -- mirrors the down/recovered dedup logic.
  if new.status <> 'down' then
    v_streak := public.consecutive_slow_checks(new.project_id, new.environment, v_slow_threshold_ms, new.checked_at);
    if v_streak = v_slow_streak_count then
      select p.id, p.name, p.client_id into v_project from public.projects p where p.id = new.project_id;
      if v_project.id is not null then
        perform public.notify_agency(
          'projects.view', v_project.client_id, 'website_slow',
          v_project.name || ' has been responding slowly',
          format(
            'The last %s checks (about an hour) have all been slower than %s seconds. Latest: %s ms.',
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
  'Notifies staff (projects.view) on a production check transitioning into/out of "down", and on a sustained slowdown (4+ consecutive checks, ~1 hour, at or above 3s response time) transitioning into/out of that state. Fires for both the manual Check Now and the scheduled sweep -- one alerting path for both.';
