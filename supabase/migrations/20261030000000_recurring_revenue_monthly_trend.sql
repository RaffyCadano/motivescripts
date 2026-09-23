-- Backs the new charts on /admin/recurring-revenue: a 12-month MRR trend and a new-vs-canceled
-- subscription count per month. Reconstructed retroactively from service_plans' own timestamps
-- (created_at, canceled_at) -- no new tracking/snapshot table needed, since every service_plans
-- row already carries what's needed to know its state as of any past month-end.
--
-- Known simplification, documented rather than silently assumed: a plan's pause history isn't
-- fully reconstructable (paused_at exists, but there's no resumed_at to know how long a pause
-- lasted), so "status <> 'paused'" is applied uniformly to every month, not just the current one --
-- a plan that's paused today is excluded from its own historical months here too, even for months
-- before it was ever paused. Pausing is rare enough that this doesn't meaningfully skew the trend,
-- but it's not a perfect historical reconstruction.

create or replace function public.recurring_revenue_monthly_trend()
returns table (
  month_start date,
  mrr_cents bigint,
  active_count integer,
  new_count integer,
  canceled_count integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.has_grant('invoices.view') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  return query
  with months as (
    select date_trunc('month', timezone('utc', now()) - (n || ' months')::interval)::date as m_start
    from generate_series(0, 11) as n
  ),
  month_ends as (
    select m_start, (m_start + interval '1 month' - interval '1 day')::date as m_end
    from months
  )
  select
    me.m_start,
    coalesce((
      select sum(sp.amount_cents) from public.service_plans sp
      where sp.created_at::date <= me.m_end
        and (sp.canceled_at is null or sp.canceled_at::date > me.m_end)
        and sp.status <> 'paused'
    ), 0)::bigint as mrr_cents,
    (
      select count(*)::integer from public.service_plans sp
      where sp.created_at::date <= me.m_end
        and (sp.canceled_at is null or sp.canceled_at::date > me.m_end)
        and sp.status <> 'paused'
    ) as active_count,
    (
      select count(*)::integer from public.service_plans sp
      where date_trunc('month', sp.created_at) = me.m_start
    ) as new_count,
    (
      select count(*)::integer from public.service_plans sp
      where sp.canceled_at is not null and date_trunc('month', sp.canceled_at) = me.m_start
    ) as canceled_count
  from month_ends me
  order by me.m_start asc;
end;
$$;

comment on function public.recurring_revenue_monthly_trend() is
  'MRR and subscription counts reconstructed per month for the last 12 months, from service_plans'' own created_at/canceled_at timestamps. Same invoices.view gate as recurring_revenue_summary(). See the migration comment for the one documented simplification (paused plans excluded from every month, not just the current one).';

revoke all on function public.recurring_revenue_monthly_trend() from public, anon;
grant execute on function public.recurring_revenue_monthly_trend() to authenticated;
