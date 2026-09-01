-- Website delivery metadata. MotiveScripts stores links and status only.
-- GitHub, Vercel, source code, tokens, and deployment logs stay outside this database.
--
-- Staging/production URLs live on projects so the client portal can show them.
-- Repository, branch, hosting, and deployment status cannot live on projects:
-- clients SELECT project rows, and Postgres RLS is row-level, not column-level.

alter table public.projects
  add column if not exists staging_url text,
  add column if not exists production_url text;

alter table public.projects
  drop constraint if exists projects_staging_url_http,
  drop constraint if exists projects_production_url_http;

alter table public.projects
  add constraint projects_staging_url_http
    check (staging_url is null or staging_url ~* '^https?://[^[:space:]]+$'),
  add constraint projects_production_url_http
    check (production_url is null or production_url ~* '^https?://[^[:space:]]+$');

comment on column public.projects.staging_url is
  'Client-visible staging website URL. Manual metadata. Not a hosting integration.';
comment on column public.projects.production_url is
  'Client-visible production website URL. Manual metadata. Not a hosting integration.';

create table if not exists public.project_development (
  project_id uuid primary key references public.projects (id) on delete cascade,
  repository_url text,
  repository_branch text,
  hosting_provider text,
  deployment_status text not null default 'Not deployed',
  last_deployed_at timestamptz,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  constraint project_development_repository_url_http
    check (repository_url is null or repository_url ~* '^https?://[^[:space:]]+$'),
  constraint project_development_branch_len
    check (repository_branch is null or char_length(repository_branch) <= 200),
  constraint project_development_hosting_len
    check (hosting_provider is null or char_length(hosting_provider) <= 80),
  constraint project_development_status_allowed
    check (deployment_status in (
      'Not deployed',
      'Development',
      'Staging',
      'Production',
      'Deployment issue'
    ))
);

comment on table public.project_development is
  'Staff-only website delivery metadata. No client policy. No source code, tokens, or deployment history.';

create or replace function public.project_development_normalize()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.repository_url := nullif(trim(coalesce(new.repository_url, '')), '');
  new.repository_branch := nullif(trim(coalesce(new.repository_branch, '')), '');
  new.hosting_provider := nullif(trim(coalesce(new.hosting_provider, '')), '');
  new.deployment_status := coalesce(nullif(trim(coalesce(new.deployment_status, '')), ''), 'Not deployed');
  new.updated_by := auth.uid();
  return new;
end;
$$;

drop trigger if exists project_development_normalize on public.project_development;
create trigger project_development_normalize
  before insert or update on public.project_development
  for each row execute function public.project_development_normalize();

drop trigger if exists project_development_updated_at on public.project_development;
create trigger project_development_updated_at
  before update on public.project_development
  for each row execute function public.set_updated_at();

alter table public.project_development enable row level security;

drop policy if exists project_development_select on public.project_development;
drop policy if exists project_development_insert on public.project_development;
drop policy if exists project_development_update on public.project_development;

create policy project_development_select on public.project_development
  for select to authenticated
  using (public.staff_may_project(project_id, 'projects.view'));

create policy project_development_insert on public.project_development
  for insert to authenticated
  with check (public.staff_may_project(project_id, 'projects.manage'));

create policy project_development_update on public.project_development
  for update to authenticated
  using (public.staff_may_project(project_id, 'projects.manage'))
  with check (public.staff_may_project(project_id, 'projects.manage'));

revoke all on table public.project_development from public, anon;
grant select, insert, update on table public.project_development to authenticated;
revoke all on function public.project_development_normalize() from public, anon;
