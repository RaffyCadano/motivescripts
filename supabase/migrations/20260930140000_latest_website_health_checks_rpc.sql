-- Bug fix: fetchLatestWebsiteHealthByProject() fetched the N most recent
-- checks GLOBALLY across all requested projects (order by checked_at desc,
-- limit ~5 per project), then kept the first row seen per project_id. If one
-- project had been checked many times recently, its rows could fill the
-- entire limited window and silently push a less-frequently-checked
-- project's only recent row out of the result set entirely -- that project
-- would then show as "never checked" even though it has history. A real
-- per-project DISTINCT ON, done in the database, is the only way to get
-- "the latest check per project" right regardless of how skewed check
-- frequency is across projects.
--
-- Not SECURITY DEFINER: runs as the calling user so the existing
-- website_health_checks_select RLS policy (staff_may_project(project_id,
-- 'projects.view')) still applies row-by-row, exactly as if the caller had
-- queried the table directly.

create or replace function public.latest_website_health_checks(p_project_ids uuid[], p_environment text default 'production')
returns setof public.website_health_checks
language sql
stable
as $$
  select distinct on (project_id) *
  from public.website_health_checks
  where project_id = any(p_project_ids)
    and environment = p_environment
  order by project_id, checked_at desc;
$$;

comment on function public.latest_website_health_checks(uuid[], text) is
  'The single most recent website_health_checks row per project in p_project_ids for the given environment. Not SECURITY DEFINER -- relies on the caller''s own RLS, same as a direct SELECT.';
