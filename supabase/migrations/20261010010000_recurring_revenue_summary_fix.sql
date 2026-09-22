-- Fixes recurring_revenue_summary() (20261010000000): sum() over a bigint column returns numeric
-- in Postgres, not bigint, to avoid overflow -- so mrr_cents and billable_overages_cents_this_month
-- (both declared bigint, both built from sum(...cents)) failed with "structure of query does not
-- match function result type" on every real call. Confirmed live: the function applied without
-- error (DDL doesn't type-check the body until it actually runs), but every invocation failed,
-- which is exactly the "Unable to load recurring revenue" error reported from the admin page.
-- Explicit ::bigint casts on both sums fix it; nothing else about the function changes.

create or replace function public.recurring_revenue_summary()
returns table (
  mrr_cents bigint,
  active_count integer,
  past_due_count integer,
  paused_count integer,
  clients_with_plan integer,
  clients_without_plan integer,
  canceled_this_month integer,
  upcoming_renewals_30d integer,
  included_hours_this_month numeric,
  billable_overages_this_month integer,
  billable_overages_cents_this_month bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_month_start date := date_trunc('month', timezone('utc', now()))::date;
  v_today date := (timezone('utc', now()))::date;
begin
  if not public.has_grant('invoices.view') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  return query
  select
    coalesce((select sum(amount_cents) from public.service_plans where status in ('active', 'past_due')), 0)::bigint,
    (select count(*)::integer from public.service_plans where status = 'active'),
    (select count(*)::integer from public.service_plans where status = 'past_due'),
    (select count(*)::integer from public.service_plans where status = 'paused'),
    (select count(distinct client_id)::integer from public.service_plans where status in ('active', 'past_due', 'paused')),
    (
      select count(*)::integer from public.clients c
      where not exists (
        select 1 from public.service_plans sp
        where sp.client_id = c.id and sp.status in ('active', 'past_due', 'paused')
      )
    ),
    (
      select count(*)::integer from public.service_plans
      where status = 'canceled' and canceled_at >= v_month_start
    ),
    (
      select count(*)::integer from public.service_plans sp
      where sp.status = 'active'
        and exists (
          select 1 from public.service_plan_current_period(sp.id) p
          where p.period_end >= v_today and p.period_end <= v_today + interval '30 days'
        )
    ),
    coalesce(
      (
        select sum(hours) from public.time_entries
        where billing_type = 'included' and entry_date >= v_month_start and entry_date <= v_today
      ),
      0
    ),
    (
      select count(*)::integer from public.care_requests
      where billing_decision = 'billable' and created_at >= v_month_start
    ),
    coalesce(
      (
        select sum(i.total_cents) from public.care_requests cr
        join public.invoices i on i.id = cr.resulting_invoice_id
        where cr.billing_decision = 'billable' and cr.created_at >= v_month_start
      ),
      0
    )::bigint;
end;
$$;

comment on function public.recurring_revenue_summary() is
  'Dashboard aggregates for /admin/recurring-revenue: MRR, subscription counts, upcoming renewals, Care-plan usage and overages. Staff-only (invoices.view). Reads only already-synced local tables, no Stripe calls.';

revoke all on function public.recurring_revenue_summary() from public, anon;
grant execute on function public.recurring_revenue_summary() to authenticated;
