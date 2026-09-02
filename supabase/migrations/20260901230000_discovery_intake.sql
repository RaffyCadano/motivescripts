-- Project Discovery Intake: production onboarding after project creation.
-- Separate from client_scope_briefs (commercial scope). One intake per project.

create table public.discovery_intakes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.projects (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  status text not null default 'not_started'
    check (status in (
      'not_started',
      'awaiting_client',
      'submitted',
      'under_review',
      'more_information_needed',
      'complete'
    )),
  form_data jsonb not null default '{}'::jsonb,
  section_review jsonb not null default '{}'::jsonb,
  scope_flags jsonb not null default '[]'::jsonb,
  follow_up jsonb not null default '{}'::jsonb,
  internal_notes text not null default '',
  sent_at timestamptz,
  submitted_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  constraint discovery_intakes_internal_notes_len check (char_length(internal_notes) <= 8000)
);

comment on table public.discovery_intakes is
  'Production discovery intake per project. Client fills after PM sends; PM reviews and approves.';

create index discovery_intakes_client_id_idx on public.discovery_intakes (client_id);
create index discovery_intakes_status_idx on public.discovery_intakes (status);

create table public.discovery_intake_files (
  id uuid primary key default gen_random_uuid(),
  intake_id uuid not null references public.discovery_intakes (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  category text not null default 'asset'
    check (category in ('logo', 'brand_guidelines', 'photo', 'video', 'document', 'marketing', 'other')),
  file_name text not null,
  file_type text not null default 'Other',
  file_size bigint not null default 0,
  storage_path text not null,
  created_at timestamptz not null default now(),
  uploaded_by uuid references auth.users (id) on delete set null,
  constraint discovery_intake_files_name_len check (char_length(file_name) between 1 and 300),
  constraint discovery_intake_files_path_len check (char_length(storage_path) between 1 and 500)
);

create index discovery_intake_files_intake_id_idx on public.discovery_intake_files (intake_id);

-- Seed intake row when a website project is created.
create or replace function public.projects_seed_discovery_intake()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(trim(coalesce(new.type, ''))) like '%website%' then
    insert into public.discovery_intakes (project_id, client_id, status)
    values (new.id, new.client_id, 'not_started')
    on conflict (project_id) do nothing;
  end if;
  return new;
end;
$$;

revoke all on function public.projects_seed_discovery_intake() from public, anon;

drop trigger if exists projects_seed_discovery_intake on public.projects;
create trigger projects_seed_discovery_intake
  after insert on public.projects
  for each row
  execute function public.projects_seed_discovery_intake();

-- Backfill for existing website projects.
insert into public.discovery_intakes (project_id, client_id, status)
select p.id, p.client_id, 'not_started'
from public.projects p
where lower(trim(coalesce(p.type, ''))) like '%website%'
on conflict (project_id) do nothing;

create trigger discovery_intakes_updated_at
  before update on public.discovery_intakes
  for each row execute function public.set_updated_at();

-- Notify assigned project staff on client submit / follow-up response.
create or replace function public.discovery_intake_notify_staff()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  project_name text;
  notify_title text;
  notify_body text;
begin
  if tg_op = 'UPDATE' then
    if new.status = 'submitted' and (old.status is distinct from 'submitted') then
      notify_title := 'Discovery intake submitted';
      notify_body := 'The client submitted project discovery information.';
    elsif new.status = 'submitted' and old.status = 'more_information_needed' then
      notify_title := 'Discovery intake updated';
      notify_body := 'The client responded to your discovery follow-up request.';
    else
      return new;
    end if;
  else
    return new;
  end if;

  select name into project_name from public.projects where id = new.project_id;

  insert into public.notifications (user_id, type, title, body, project_id)
  select distinct psa.user_id, 'project_update', notify_title,
    coalesce(project_name, 'A project') || ' · ' || notify_body,
    new.project_id
  from public.project_staff_assignments psa
  where psa.project_id = new.project_id
    and psa.user_id is not null;

  return new;
end;
$$;

revoke all on function public.discovery_intake_notify_staff() from public, anon;

drop trigger if exists discovery_intake_notify_staff on public.discovery_intakes;
create trigger discovery_intake_notify_staff
  after update of status on public.discovery_intakes
  for each row
  execute function public.discovery_intake_notify_staff();

-- Notify client portal account when PM sends intake or requests more info.
create or replace function public.discovery_intake_notify_client()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  project_name text;
  notify_title text;
  notify_body text;
  portal_user uuid;
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if new.status = 'awaiting_client' and old.status is distinct from 'awaiting_client' then
    notify_title := 'Complete project discovery';
    notify_body := 'Your project manager sent a discovery form. Please complete it in your client portal.';
  elsif new.status = 'more_information_needed' and old.status is distinct from 'more_information_needed' then
    notify_title := 'Discovery: more information needed';
    notify_body := 'Your project manager needs a few additional details before production can begin.';
  else
    return new;
  end if;

  select name into project_name from public.projects where id = new.project_id;

  select p.id into portal_user
  from public.profiles p
  where p.client_id = new.client_id and p.role = 'client'
  limit 1;

  if portal_user is not null then
    insert into public.notifications (user_id, type, title, body, project_id)
    values (
      portal_user,
      'project_update',
      notify_title,
      coalesce(project_name, 'Your project') || ' · ' || notify_body,
      new.project_id
    );
  end if;

  return new;
end;
$$;

revoke all on function public.discovery_intake_notify_client() from public, anon;

drop trigger if exists discovery_intake_notify_client on public.discovery_intakes;
create trigger discovery_intake_notify_client
  after update of status on public.discovery_intakes
  for each row
  execute function public.discovery_intake_notify_client();

alter table public.discovery_intakes enable row level security;
alter table public.discovery_intake_files enable row level security;

create policy discovery_intakes_select on public.discovery_intakes
  for select to authenticated
  using (
    (public.is_client() and client_id = public.current_client_id())
    or public.staff_may_project(project_id, 'projects.view')
  );

create policy discovery_intakes_insert on public.discovery_intakes
  for insert to authenticated
  with check (public.staff_may_coordinate_project(project_id));

create policy discovery_intakes_update on public.discovery_intakes
  for update to authenticated
  using (
    (public.is_client() and client_id = public.current_client_id())
    or public.staff_may_coordinate_project(project_id)
  )
  with check (
    (public.is_client() and client_id = public.current_client_id())
    or public.staff_may_coordinate_project(project_id)
  );

create policy discovery_intake_files_select on public.discovery_intake_files
  for select to authenticated
  using (
    (public.is_client() and client_id = public.current_client_id())
    or public.staff_may_project(project_id, 'projects.view')
  );

create policy discovery_intake_files_insert on public.discovery_intake_files
  for insert to authenticated
  with check (
    (public.is_client() and client_id = public.current_client_id())
    or public.staff_may_coordinate_project(project_id)
  );

create policy discovery_intake_files_delete on public.discovery_intake_files
  for delete to authenticated
  using (
    (public.is_client() and client_id = public.current_client_id())
    or public.staff_may_coordinate_project(project_id)
  );

revoke all on table public.discovery_intakes, public.discovery_intake_files from public, anon;
grant select, insert, update on table public.discovery_intakes to authenticated;
grant select, insert, delete on table public.discovery_intake_files to authenticated;
