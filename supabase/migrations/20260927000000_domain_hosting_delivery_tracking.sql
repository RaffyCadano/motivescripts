-- Domain & hosting delivery tracking. MotiveScripts only records the agency's
-- own delivery status for a project's domain and hosting -- the domain
-- registrar and hosting provider stay fully external, exactly like the
-- rest of project_development (see 20260901160000_project_website_delivery.sql).
-- No registrar/hosting credentials, API keys, or DNS data are stored here.

alter table public.project_development
  add column if not exists domain_name text,
  add column if not exists domain_status text not null default 'Not configured',
  add column if not exists hosting_status text not null default 'Not configured';

alter table public.project_development
  drop constraint if exists project_development_domain_name_len,
  drop constraint if exists project_development_domain_status_allowed,
  drop constraint if exists project_development_hosting_status_allowed;

alter table public.project_development
  add constraint project_development_domain_name_len
    check (domain_name is null or char_length(domain_name) <= 253),
  add constraint project_development_domain_status_allowed
    check (domain_status in ('Not configured', 'In progress', 'Configured', 'Issue')),
  add constraint project_development_hosting_status_allowed
    check (hosting_status in ('Not configured', 'In progress', 'Configured', 'Issue'));

comment on column public.project_development.domain_name is
  'Reference domain name for this project, tracked manually by the agency for coordination. Not a registrar integration -- no DNS data or credentials.';
comment on column public.project_development.domain_status is
  'Agency-tracked domain delivery status (Not configured / In progress / Configured / Issue). Manually maintained -- nothing here purchases or configures a domain.';
comment on column public.project_development.hosting_status is
  'Agency-tracked hosting delivery status (Not configured / In progress / Configured / Issue). Manually maintained -- nothing here provisions hosting. Pairs with the existing hosting_provider column.';

-- Extend the existing normalize trigger so the new fields follow the same
-- trim/default conventions already applied to hosting_provider and
-- deployment_status.
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
  new.domain_name := nullif(trim(coalesce(new.domain_name, '')), '');
  new.domain_status := coalesce(nullif(trim(coalesce(new.domain_status, '')), ''), 'Not configured');
  new.hosting_status := coalesce(nullif(trim(coalesce(new.hosting_status, '')), ''), 'Not configured');
  new.updated_by := auth.uid();
  return new;
end;
$$;

-- Domain/hosting delivery status is agency-coordinator territory (admin, or
-- an assigned PM) -- unlike the rest of this table (repository, staging,
-- hosting provider, deployment status), which assigned developers/designers/
-- content writers/team members already maintain themselves through the team
-- workspace, and which the base project_development_update policy
-- (staff_may_project(project_id, 'projects.manage')) already allows for all
-- of those templates. Postgres RLS is row-level, not column-level, so that
-- policy alone can't hold domain/hosting status to a stricter audience than
-- the rest of the row. This trigger adds that missing column-level check: it
-- only requires staff_may_coordinate_project (admin, or assigned staff
-- holding both projects.manage and clients.manage -- true for the
-- project_manager template, not for production-team templates) when
-- domain_name/domain_status/hosting_status actually changes, so every other
-- production-team edit to this table is unaffected.
--
-- Deliberately looks up the current row by project_id (`v_current`) instead
-- of trusting tg_op/OLD: upsertProjectDevelopment() always upserts via
-- INSERT ... ON CONFLICT (project_id) DO UPDATE, and Postgres fires a row's
-- BEFORE INSERT trigger first even when that row will end up taking the
-- ON CONFLICT UPDATE path (OLD does not exist yet at that point). Comparing
-- against a lookup rather than tg_op/OLD means the "did domain/hosting
-- actually change" check is correct on every path -- true INSERT, true
-- UPDATE, and the INSERT-then-fall-back-to-UPDATE upsert path alike -- so a
-- developer's unrelated save (e.g. repository URL) is never blocked just
-- because a PM had already set a non-default domain/hosting status earlier.
create or replace function public.project_development_domain_hosting_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_domain_name text := nullif(trim(coalesce(new.domain_name, '')), '');
  v_new_domain_status text := coalesce(nullif(trim(coalesce(new.domain_status, '')), ''), 'Not configured');
  v_new_hosting_status text := coalesce(nullif(trim(coalesce(new.hosting_status, '')), ''), 'Not configured');
  v_current public.project_development%rowtype;
begin
  select * into v_current from public.project_development where project_id = new.project_id;

  if (v_new_domain_name is distinct from v_current.domain_name)
     or (v_new_domain_status is distinct from coalesce(v_current.domain_status, 'Not configured'))
     or (v_new_hosting_status is distinct from coalesce(v_current.hosting_status, 'Not configured'))
  then
    if not public.staff_may_coordinate_project(new.project_id) then
      raise exception 'Not allowed' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists project_development_domain_hosting_guard on public.project_development;
create trigger project_development_domain_hosting_guard
  before insert or update on public.project_development
  for each row execute function public.project_development_domain_hosting_guard();

revoke all on function public.project_development_domain_hosting_guard() from public, anon;
