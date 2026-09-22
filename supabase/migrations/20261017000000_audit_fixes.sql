-- Two real findings from a global audit of the Website Care build:
--
-- 1. projects_due_for_website_check() had `limit 50` with no ORDER BY. Postgres gives no row-order
--    guarantee without one, so once there were ever more than 50 due projects, which ones got
--    dropped from a given sweep tick would be arbitrary -- possibly a fast_monitoring (Advanced
--    monitoring) project losing out to a throttled one, silently breaking the tier's own promise
--    under load. Fast-monitoring projects now always sort first, so they're never the ones cut.
-- 2. (Frontend-only, no DB change: ClientPlans.tsx picked the client's first active Care plan
--    across ALL their projects, not the one for the project actually being viewed -- wrong for any
--    client with more than one project. Fixed in the same commit as this migration.)

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
  order by (case when public.project_has_fast_monitoring(p.id) then 0 else 1 end), p.id
  limit 50;
$$;

comment on function public.projects_due_for_website_check() is
  'Every launched project due for a production health check this sweep tick: fast_monitoring (Advanced monitoring) projects every tick, others throttled to roughly their last ~15-minute cadence. Ordered fast_monitoring-first so the 50-project cap, if ever reached, never drops an Advanced-monitoring project in favor of a throttled one.';
