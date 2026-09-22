-- Two client-safe reads for the Website Care portal, following the exact pattern
-- client_project_delivery_gates already established (20260930240000/20260930280000): RLS
-- correctly hides all of project_development and time_entries from a client session, so these
-- expose only the specific safe subset a client needs, computed server-side and ownership-checked,
-- rather than relaxing RLS on the underlying tables.

-- Domain/hosting delivery status for the client's own project -- status labels only (Not
-- configured/In progress/Configured/Issue), never repository_url, hosting_provider, or anything
-- that identifies infrastructure/credentials.
create or replace function public.client_project_delivery_status(p_project_id uuid)
returns table (
  domain_name text,
  domain_status text,
  hosting_status text,
  deployment_status text
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
  select pd.domain_name, pd.domain_status, pd.hosting_status, pd.deployment_status
  from public.project_development pd
  where pd.project_id = p_project_id;
end;
$$;

comment on function public.client_project_delivery_status(uuid) is
  'Client-safe domain/hosting/deployment status labels for the caller''s own project. No repository, provider, or credential detail -- see project_development for the full staff-only row.';

revoke all on function public.client_project_delivery_status(uuid) from public, anon;
grant execute on function public.client_project_delivery_status(uuid) to authenticated;

-- Included-hours usage for a Website Care plan this billing period. time_entries has no client
-- SELECT policy at all (staff/admin only), so this is the only way a client can see "how many
-- hours have we used" -- it never returns the underlying time_entries rows, just the aggregate.
create or replace function public.service_plan_usage(p_plan_id uuid)
returns table (
  included_hours_monthly numeric,
  used_hours numeric,
  remaining_hours numeric,
  period_start date,
  period_end date
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  sp public.service_plans;
  v_period record;
  v_used numeric;
begin
  select * into sp from public.service_plans where id = p_plan_id;
  if not found then
    return;
  end if;
  if not (
    (public.is_client() and sp.client_id = public.current_client_id())
    or (sp.project_id is not null and public.staff_may_project(sp.project_id, 'invoices.view'))
    or public.has_grant('invoices.view')
  ) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select * into v_period from public.service_plan_current_period(p_plan_id);

  select coalesce(sum(te.hours), 0) into v_used
  from public.time_entries te
  where te.service_plan_id = p_plan_id
    and te.billing_type = 'included'
    and te.entry_date >= v_period.period_start
    and te.entry_date <= v_period.period_end;

  return query
  select
    sp.included_hours_monthly,
    v_used,
    greatest(sp.included_hours_monthly - v_used, 0),
    v_period.period_start,
    v_period.period_end;
end;
$$;

comment on function public.service_plan_usage(uuid) is
  'Included-hours usage for a Website Care plan''s current billing period (from service_plan_current_period). SECURITY DEFINER with its own ownership check -- time_entries has no client-facing RLS at all.';

revoke all on function public.service_plan_usage(uuid) from public, anon;
grant execute on function public.service_plan_usage(uuid) to authenticated;
