-- Tracks which starter-template repo (e.g. a per-industry GitHub boilerplate
-- for landscaping/contractor/restaurant sites) a project's own repository was
-- scaffolded from. Manual metadata only, same as repository_url/hosting_provider
-- on this table -- MotiveScripts does not clone or manage the template itself.

alter table public.project_development
  add column if not exists template_repository_url text;

alter table public.project_development
  drop constraint if exists project_development_template_url_http;

alter table public.project_development
  add constraint project_development_template_url_http
    check (template_repository_url is null or template_repository_url ~* '^https?://[^[:space:]]+$');

comment on column public.project_development.template_repository_url is
  'The starter-template repo this project was scaffolded from, if any. Manual link, not a hosting/VCS integration.';

create or replace function public.project_development_normalize()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.repository_url := nullif(trim(coalesce(new.repository_url, '')), '');
  new.repository_branch := nullif(trim(coalesce(new.repository_branch, '')), '');
  new.template_repository_url := nullif(trim(coalesce(new.template_repository_url, '')), '');
  new.hosting_provider := nullif(trim(coalesce(new.hosting_provider, '')), '');
  new.deployment_status := coalesce(nullif(trim(coalesce(new.deployment_status, '')), ''), 'Not deployed');
  new.updated_by := auth.uid();
  return new;
end;
$$;
