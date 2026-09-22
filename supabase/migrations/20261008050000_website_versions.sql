-- Whole-site version history (v1.0, v1.1, v2.0, ...) distinct from the existing per-deliverable
-- file_versions -- this tracks the live website as a whole, tying each bump back to the
-- maintenance request that caused it (a minor bump for included work, a major bump for a billable
-- redesign, per the Website Care workflow). v1.0 is auto-seeded the moment a project first
-- launches, reusing the same "just became Production" check notify_launch_completed already uses.

create table public.website_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  version_major integer not null check (version_major >= 1),
  version_minor integer not null default 0 check (version_minor >= 0),
  summary text not null default '',
  care_request_id uuid references public.care_requests (id) on delete set null,
  is_major boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  unique (project_id, version_major, version_minor)
);

create index website_versions_project_idx on public.website_versions (project_id, version_major desc, version_minor desc);

alter table public.website_versions enable row level security;

create policy website_versions_client_select on public.website_versions for select to authenticated
  using (
    public.is_client()
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.client_id = public.current_client_id()
    )
  );

create policy website_versions_staff_select on public.website_versions for select to authenticated
  using (public.staff_may_project(project_id, 'projects.view'));

create policy website_versions_staff_write on public.website_versions for all to authenticated
  using (public.staff_may_project(project_id, 'projects.manage'))
  with check (public.staff_may_project(project_id, 'projects.manage'));

revoke all on public.website_versions from public, anon;
grant select on public.website_versions to authenticated;
grant insert, update, delete on public.website_versions to authenticated;
grant all on public.website_versions to service_role;

comment on table public.website_versions is
  'Whole-site version history. v1.0 auto-seeds on first launch; later rows are added when a maintenance request (care_requests) ships, minor for included work, major for a billable redesign.';

-- Records the next version for a project, minor-bumping the latest row unless p_major is true (in
-- which case it becomes X.0 of the next major). Staff-only, same grant as writing the table.
create or replace function public.record_website_version(
  p_project_id uuid,
  p_summary text,
  p_is_major boolean default false,
  p_care_request_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  latest public.website_versions;
  next_major integer;
  next_minor integer;
  new_id uuid;
begin
  if not public.staff_may_project(p_project_id, 'projects.manage') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select * into latest from public.website_versions
    where project_id = p_project_id
    order by version_major desc, version_minor desc
    limit 1;

  if latest is null then
    next_major := 1;
    next_minor := 0;
  elsif p_is_major then
    next_major := latest.version_major + 1;
    next_minor := 0;
  else
    next_major := latest.version_major;
    next_minor := latest.version_minor + 1;
  end if;

  insert into public.website_versions (project_id, version_major, version_minor, summary, care_request_id, is_major, created_by)
  values (p_project_id, next_major, next_minor, coalesce(trim(p_summary), ''), p_care_request_id, p_is_major, auth.uid())
  returning id into new_id;

  return new_id;
end;
$$;
revoke all on function public.record_website_version(uuid, text, boolean, uuid) from public, anon;
grant execute on function public.record_website_version(uuid, text, boolean, uuid) to authenticated;

comment on function public.record_website_version(uuid, text, boolean, uuid) is
  'Adds the next version for a project -- minor bump by default, major bump (X.0) when p_is_major. Staff-only (projects.manage).';

-- Auto-seed v1.0 the moment a project's deployment_status first becomes Production. Same
-- "just became launched" condition as notify_launch_completed (20260930090000_production_workflow_gates.sql),
-- kept as its own trigger function so it can't interfere with that notification.
create or replace function public.website_versions_seed_on_launch()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.deployment_status <> 'Production' or old.deployment_status is not distinct from 'Production' then
    return new;
  end if;
  if exists (select 1 from public.website_versions where project_id = new.project_id) then
    return new;
  end if;
  insert into public.website_versions (project_id, version_major, version_minor, summary, is_major)
  values (new.project_id, 1, 0, 'Website launched.', true);
  return new;
end;
$$;

drop trigger if exists project_development_seed_version on public.project_development;
create trigger project_development_seed_version
  after insert or update on public.project_development
  for each row execute function public.website_versions_seed_on_launch();

revoke all on function public.website_versions_seed_on_launch() from public, anon, authenticated;
