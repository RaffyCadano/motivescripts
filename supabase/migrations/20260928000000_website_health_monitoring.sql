-- Website Health Monitoring v1. Server-side checks against a project's
-- already-configured production_url (see 20260921000000_domain_ssl_renewal_tracking.sql
-- and 20260901160000_project_website_delivery.sql for how staging/production
-- URLs and project_development already work). This adds a monitoring-only
-- history table -- it does not touch project_development, which keeps
-- representing deployment/domain/hosting *delivery* status, a separate
-- concept from live reachability.
--
-- Current health is deliberately NOT stored as a column anywhere: it is
-- derived in the frontend from the latest row here, so there is exactly one
-- place a health check's result lives.

create table public.website_health_checks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  checked_at timestamptz not null default now(),
  status text not null check (status in ('healthy', 'degraded', 'down')),
  http_status integer,
  response_time_ms integer,
  error_message text not null default '',
  checked_by uuid references auth.users (id) on delete set null,
  constraint website_health_checks_error_message_len check (char_length(error_message) <= 500)
);

comment on table public.website_health_checks is
  'Website Health Monitoring v1 history. One row per server-side HTTP check of a project''s production_url, written only by the check-website-health edge function. No response bodies, no source code, no client data.';
comment on column public.website_health_checks.status is
  'healthy = request completed with a 2xx/3xx response. degraded = request completed but returned a 4xx/5xx (site is reachable, response is a problem). down = the request never got an HTTP response at all (timeout, DNS failure, connection refused, TLS failure).';
comment on column public.website_health_checks.checked_by is
  'Staff member who triggered a manual Check Now. Null once/if scheduled automated checks are added later -- see function comment for how.';

create index website_health_checks_project_checked_idx
  on public.website_health_checks (project_id, checked_at desc);

alter table public.website_health_checks enable row level security;

-- Same read audience as project_development itself (see
-- project_development_select in 20260901160000_project_website_delivery.sql):
-- admin, or staff assigned to the project holding projects.view. Sales and
-- accounting templates never get projects.view, so they never gain access
-- here either. No client-facing policy is added -- clients cannot select
-- this table at all in v1.
create policy website_health_checks_select on public.website_health_checks
  for select to authenticated
  using (public.staff_may_project(project_id, 'projects.view'));

revoke all on table public.website_health_checks from public, anon;
grant select on table public.website_health_checks to authenticated;

-- Deliberately no insert/update/delete grant to authenticated, and no write
-- policy: rows are written only by the check-website-health edge function,
-- using the service-role key, after it independently verifies
-- staff_may_project(project_id, 'projects.manage') for the calling user and
-- reads production_url itself from the projects row. An authenticated client
-- can never insert a fabricated check directly against this table.
