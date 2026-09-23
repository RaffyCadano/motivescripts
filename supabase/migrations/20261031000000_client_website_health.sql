-- Client-safe website health status, following the exact pattern
-- client_project_delivery_status already established (20261009000000): website_health_checks
-- has no client-facing RLS policy at all (see 20260928000000's own comment -- "No client-facing
-- policy is added -- clients cannot select this table at all in v1"), so this exposes only the
-- latest status per environment for the caller's own project, computed server-side and
-- ownership-checked, rather than relaxing RLS on the underlying table. Never returns
-- http_status, error_message, or checked_by.
create or replace function public.client_website_health(p_project_id uuid)
returns table (
  environment text,
  status text,
  checked_at timestamptz
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
  select distinct on (whc.environment)
    whc.environment, whc.status, whc.checked_at
  from public.website_health_checks whc
  where whc.project_id = p_project_id
  order by whc.environment, whc.checked_at desc;
end;
$$;

comment on function public.client_website_health(uuid) is
  'Client-safe latest health status (healthy/degraded/down) per environment for the caller''s own project. Status and checked_at only -- see website_health_checks for the full staff-only row.';

revoke all on function public.client_website_health(uuid) from public, anon;
grant execute on function public.client_website_health(uuid) to authenticated;
