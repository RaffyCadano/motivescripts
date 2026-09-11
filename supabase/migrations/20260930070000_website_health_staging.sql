-- Phase 18: Website Health v1 only ever checked production_url. Adds an
-- `environment` column so the same history table and edge function can also
-- record a staging_url check, without turning this into a new/duplicate
-- monitoring system -- same table, same RLS, same classification rules.
-- Existing rows default to 'production' (what they always were).

alter table public.website_health_checks
  add column if not exists environment text not null default 'production'
  check (environment in ('production', 'staging'));

comment on column public.website_health_checks.environment is
  'Which URL this check was against: production (projects.production_url) or staging (projects.staging_url).';

create index if not exists website_health_checks_project_env_checked_idx
  on public.website_health_checks (project_id, environment, checked_at desc);
