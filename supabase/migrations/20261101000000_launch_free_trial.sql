-- Automatic 30-day Care Requests grace period starting the moment a project launches --
-- distinct from the Stripe-billed trial on a client's first paid Website Care plan
-- (manage-service-plan's createCheckout): this one needs no card and no plan at all. During the
-- window, a client with no active plan can still submit Care Requests; once it expires, the
-- existing plan gate (care_requests_before_insert's NO_ACTIVE_PLAN check) applies exactly as it
-- did before this migration.

alter table public.project_development
  add column if not exists launch_trial_ends_at timestamptz;

comment on column public.project_development.launch_trial_ends_at is
  'Set once, automatically, the moment deployment_status first becomes Production: now() + 30 days. Care Requests remain open with no active plan until this passes (care_requests_before_insert). Null for a project that launched before this column existed.';

-- Same "just became Production" condition website_versions_seed_on_launch already uses
-- (20261008050000), kept as its own trigger function for the same reason that one is: so it can't
-- interfere with the other launch-time side effects. This one is BEFORE (it sets a column on the
-- row being written), not AFTER like the version-seeding one.
create or replace function public.project_development_start_launch_trial()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.deployment_status = 'Production'
    and old.deployment_status is distinct from 'Production'
    and new.launch_trial_ends_at is null
  then
    new.launch_trial_ends_at := now() + interval '30 days';
  end if;
  return new;
end;
$$;

drop trigger if exists project_development_start_launch_trial on public.project_development;
create trigger project_development_start_launch_trial
  before insert or update on public.project_development
  for each row execute function public.project_development_start_launch_trial();

revoke all on function public.project_development_start_launch_trial() from public, anon, authenticated;

-- One-time backfill: a project that was ALREADY live before this migration would otherwise never
-- get a launch_trial_ends_at at all (the trigger only fires on a NEW transition into Production).
-- Starting their 30 days from right now, rather than leaving them permanently excluded from a
-- benefit every future launch gets automatically.
update public.project_development
set launch_trial_ends_at = now() + interval '30 days'
where deployment_status = 'Production'
  and launch_trial_ends_at is null;

-- Tracks, on the request row itself, whether the launch trial (rather than an actual paid plan)
-- was what let this submission through -- so staff aren't confused by a "no active plan" flag on
-- a request that was always expected to succeed.
alter table public.care_requests
  add column if not exists in_launch_trial boolean not null default false;

comment on column public.care_requests.in_launch_trial is
  'True when this request was submitted during the automatic post-launch grace period (project_development.launch_trial_ends_at) with no active Care plan -- expected, not a gate failure.';

-- Re-point of care_requests_before_insert (20261014000000): the only change is the plan gate
-- itself now also passes during the launch trial window, and in_launch_trial is recorded. Every
-- other line is unchanged from the version this replaces.
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
  v_trial_ends_at timestamptz;
  v_in_trial boolean;
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

  select coalesce(pd.deployment_status = 'Production', false), pd.launch_trial_ends_at
    into v_launched, v_trial_ends_at
    from public.project_development pd
    where pd.project_id = new.project_id;
  v_in_trial := coalesce(v_launched, false) and v_trial_ends_at is not null and now() < v_trial_ends_at;

  if v_role = 'client' then
    new.submitted_by := auth.uid();
    if not coalesce(v_launched, false) then
      raise exception 'NOT_LAUNCHED';
    end if;
    if not v_has_plan and not v_in_trial then
      raise exception 'NO_ACTIVE_PLAN';
    end if;
  end if;

  new.has_active_care_plan := v_has_plan;
  new.service_plan_id := v_plan_id;
  new.in_launch_trial := v_in_trial and not v_has_plan;

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

-- client_project_delivery_status (20261009000000) gains launch_trial_ends_at so the client portal
-- can show a countdown and know whether it's still in the grace window -- same ownership-checked,
-- staff-safe-subset pattern as the rest of that function, just one more column from the same row.
drop function if exists public.client_project_delivery_status(uuid);
create or replace function public.client_project_delivery_status(p_project_id uuid)
returns table (
  domain_name text,
  domain_status text,
  hosting_status text,
  deployment_status text,
  launch_trial_ends_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.owns_project(p_project_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  return query
  select pd.domain_name, pd.domain_status, pd.hosting_status, pd.deployment_status, pd.launch_trial_ends_at
  from public.project_development pd
  where pd.project_id = p_project_id;
end;
$$;

comment on function public.client_project_delivery_status(uuid) is
  'Client-safe domain/hosting/deployment status labels, plus the post-launch Care Requests grace period end, for the caller''s own project. No repository, provider, or credential detail -- see project_development for the full staff-only row.';

revoke all on function public.client_project_delivery_status(uuid) from public, anon;
grant execute on function public.client_project_delivery_status(uuid) to authenticated;
