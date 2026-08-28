-- MotiveScripts Phase 10 — core agency schema
-- Version metadata only. No Storage buckets. No billing tables.

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text not null default '',
  role text not null default 'admin' check (role in ('admin', 'client')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  contact_name text not null,
  business_name text not null,
  email text,
  phone text,
  industry text,
  website text not null default '',
  location text not null default '',
  status text not null default 'Active' check (status in ('Active', 'Inactive', 'Archived')),
  source text not null default 'Manual' check (source in ('Start a Project', 'Manual')),
  source_lead_id uuid,
  notes jsonb not null default '[]'::jsonb,
  activity jsonb not null default '[]'::jsonb,
  invoices jsonb not null default '[]'::jsonb,
  messages jsonb not null default '[]'::jsonb,
  created_by uuid references public.profiles (id) on delete set null,
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  business_name text not null,
  email text not null,
  phone text,
  industry text,
  request text not null default '',
  project_details text not null default '',
  status text not null default 'New' check (status in ('New', 'Contacted', 'Qualified', 'Proposal', 'Won', 'Lost')),
  source text not null default 'Manual' check (source in ('Start a Project', 'Manual')),
  notes jsonb not null default '[]'::jsonb,
  activity jsonb not null default '[]'::jsonb,
  client_id uuid references public.clients (id) on delete set null,
  converted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.clients
  add constraint clients_source_lead_id_fkey
  foreign key (source_lead_id) references public.leads (id) on delete set null;

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete restrict,
  name text not null,
  description text not null default '',
  type text not null default 'Website',
  status text not null default 'Planning'
    check (status in ('Planning', 'In Development', 'Client Review', 'On Hold', 'Completed')),
  start_date date,
  due_date date,
  archived boolean not null default false,
  approval_status text not null default 'Pending' check (approval_status in ('Pending', 'Approved')),
  created_by uuid references public.profiles (id) on delete set null,
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete restrict,
  name text not null,
  description text not null default '',
  status text not null default 'Not Started'
    check (status in ('Not Started', 'In Progress', 'Completed', 'On Hold')),
  position integer not null default 0,
  start_date date,
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete restrict,
  milestone_id uuid references public.milestones (id) on delete set null,
  title text not null,
  description text not null default '',
  status text not null default 'Todo' check (status in ('Todo', 'In Progress', 'Completed', 'Blocked')),
  priority text not null default 'Medium' check (priority in ('Low', 'Medium', 'High', 'Urgent')),
  assignee text not null default 'You',
  position integer not null default 0,
  due_date date,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.deliverables (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete restrict,
  name text not null,
  description text not null default '',
  category text not null default 'Other',
  status text not null default 'Draft'
    check (status in ('Draft', 'In Review', 'Needs Changes', 'Approved', 'Archived')),
  archived_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.file_versions (
  id uuid primary key default gen_random_uuid(),
  deliverable_id uuid not null references public.deliverables (id) on delete restrict,
  version_number integer not null,
  label text,
  description text not null default '',
  is_current boolean not null default false,
  file_name text not null default '',
  file_type text not null default 'Other',
  file_size bigint not null default 0,
  uploaded_by text not null default 'You',
  archived_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (deliverable_id, version_number)
);

create unique index file_versions_one_current
  on public.file_versions (deliverable_id)
  where is_current;

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete restrict,
  deliverable_id uuid not null references public.deliverables (id) on delete restrict,
  version_id uuid not null references public.file_versions (id) on delete restrict,
  client_id uuid not null references public.clients (id) on delete restrict,
  message text not null,
  status text not null default 'Open' check (status in ('Open', 'Resolved')),
  created_by uuid references public.profiles (id) on delete set null,
  created_by_name text not null default 'Client',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint feedback_message_not_blank check (length(trim(message)) > 0)
);

create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete restrict,
  deliverable_id uuid not null references public.deliverables (id) on delete restrict,
  version_id uuid not null references public.file_versions (id) on delete restrict,
  client_id uuid not null references public.clients (id) on delete restrict,
  status text not null default 'Approved' check (status = 'Approved'),
  approved_by uuid references public.profiles (id) on delete set null,
  approved_by_name text not null default 'Client',
  approved_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.activity (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete restrict,
  actor_id uuid references public.profiles (id) on delete set null,
  activity_type text not null,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index leads_status_idx on public.leads (status);
create index leads_email_idx on public.leads (email);
create index leads_client_id_idx on public.leads (client_id);
create index clients_email_idx on public.clients (email);
create index clients_status_idx on public.clients (status);
create index projects_client_id_idx on public.projects (client_id);
create index projects_status_idx on public.projects (status);
create index milestones_project_id_idx on public.milestones (project_id);
create index tasks_project_id_idx on public.tasks (project_id);
create index tasks_milestone_id_idx on public.tasks (milestone_id);
create index deliverables_project_id_idx on public.deliverables (project_id);
create index file_versions_deliverable_id_idx on public.file_versions (deliverable_id);
create index feedback_project_id_idx on public.feedback (project_id);
create index feedback_deliverable_id_idx on public.feedback (deliverable_id);
create index feedback_version_id_idx on public.feedback (version_id);
create index feedback_client_id_idx on public.feedback (client_id);
create index approvals_project_id_idx on public.approvals (project_id);
create index approvals_deliverable_id_idx on public.approvals (deliverable_id);
create index approvals_version_id_idx on public.approvals (version_id);
create index approvals_client_id_idx on public.approvals (client_id);
create index activity_project_id_idx on public.activity (project_id);
create index activity_created_at_idx on public.activity (created_at desc);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger leads_updated_at before update on public.leads
  for each row execute function public.set_updated_at();
create trigger clients_updated_at before update on public.clients
  for each row execute function public.set_updated_at();
create trigger projects_updated_at before update on public.projects
  for each row execute function public.set_updated_at();
create trigger milestones_updated_at before update on public.milestones
  for each row execute function public.set_updated_at();
create trigger tasks_updated_at before update on public.tasks
  for each row execute function public.set_updated_at();
create trigger deliverables_updated_at before update on public.deliverables
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_role text;
begin
  next_role := lower(coalesce(new.raw_app_meta_data->>'role', 'admin'));
  if next_role not in ('admin', 'client') then
    next_role := 'admin';
  end if;
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    next_role
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Atomically create the next version, make it current, and move the deliverable to Draft.
create or replace function public.create_file_version(
  p_deliverable_id uuid,
  p_file_name text,
  p_file_type text,
  p_file_size bigint,
  p_description text,
  p_uploaded_by text default 'You'
)
returns public.file_versions
language plpgsql
security invoker
set search_path = public
as $$
declare
  next_number integer;
  created public.file_versions;
  deliverable_status text;
  deliverable_name text;
  project uuid;
begin
  select status, name, project_id
    into deliverable_status, deliverable_name, project
  from public.deliverables
  where id = p_deliverable_id
  for update;

  if not found then
    raise exception 'Deliverable not found';
  end if;
  if deliverable_status = 'Archived' then
    raise exception 'Archived deliverables cannot receive versions';
  end if;

  select coalesce(max(version_number), 0) + 1
    into next_number
  from public.file_versions
  where deliverable_id = p_deliverable_id;

  update public.file_versions
    set is_current = false
  where deliverable_id = p_deliverable_id
    and is_current;

  insert into public.file_versions (
    deliverable_id,
    version_number,
    label,
    description,
    is_current,
    file_name,
    file_type,
    file_size,
    uploaded_by
  )
  values (
    p_deliverable_id,
    next_number,
    'v' || next_number,
    coalesce(p_description, ''),
    true,
    coalesce(p_file_name, ''),
    coalesce(p_file_type, 'Other'),
    coalesce(p_file_size, 0),
    coalesce(p_uploaded_by, 'You')
  )
  returning * into created;

  update public.deliverables
    set status = 'Draft',
        archived_at = null,
        updated_at = now()
  where id = p_deliverable_id;

  insert into public.activity (project_id, activity_type, message, metadata)
  values (
    project,
    'version_created',
    deliverable_name || ' v' || next_number || ' created.',
    jsonb_build_object('icon', 'file', 'deliverable_id', p_deliverable_id, 'version_id', created.id)
  );

  update public.projects set last_activity_at = now() where id = project;

  return created;
end;
$$;

create or replace function public.set_current_file_version(
  p_deliverable_id uuid,
  p_version_id uuid
)
returns public.file_versions
language plpgsql
security invoker
set search_path = public
as $$
declare
  selected public.file_versions;
  project uuid;
  deliverable_name text;
begin
  select * into selected
  from public.file_versions
  where id = p_version_id
    and deliverable_id = p_deliverable_id
  for update;

  if not found then
    raise exception 'Version not found';
  end if;

  update public.file_versions
    set is_current = false
  where deliverable_id = p_deliverable_id
    and is_current
    and id <> p_version_id;

  update public.file_versions
    set is_current = true,
        archived_at = null
  where id = p_version_id
  returning * into selected;

  select project_id, name into project, deliverable_name
  from public.deliverables
  where id = p_deliverable_id;

  insert into public.activity (project_id, activity_type, message, metadata)
  values (
    project,
    'version_set_current',
    'Version ' || selected.version_number || ' set as current',
    jsonb_build_object('icon', 'file', 'deliverable_id', p_deliverable_id, 'version_id', selected.id)
  );

  update public.projects set last_activity_at = now() where id = project;
  update public.deliverables set updated_at = now() where id = p_deliverable_id;

  return selected;
end;
$$;

-- TEMPORARY development policies.
-- The Client Portal is still previewable without auth, so anon must read/write
-- the same rows as authenticated admin users until real client auth exists.
-- These are not a production authorization model.
-- Do not expose a service-role key to the browser.

alter table public.profiles enable row level security;
alter table public.leads enable row level security;
alter table public.clients enable row level security;
alter table public.projects enable row level security;
alter table public.milestones enable row level security;
alter table public.tasks enable row level security;
alter table public.deliverables enable row level security;
alter table public.file_versions enable row level security;
alter table public.feedback enable row level security;
alter table public.approvals enable row level security;
alter table public.activity enable row level security;

create policy profiles_select_dev on public.profiles
  for select to anon, authenticated using (true);
create policy profiles_insert_own on public.profiles
  for insert to authenticated with check (id = auth.uid());
create policy profiles_update_own on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy leads_select_dev on public.leads for select to anon, authenticated using (true);
create policy leads_insert_dev on public.leads for insert to anon, authenticated with check (true);
create policy leads_update_dev on public.leads for update to anon, authenticated using (true) with check (true);

create policy clients_select_dev on public.clients for select to anon, authenticated using (true);
create policy clients_insert_dev on public.clients for insert to anon, authenticated with check (true);
create policy clients_update_dev on public.clients for update to anon, authenticated using (true) with check (true);

create policy projects_select_dev on public.projects for select to anon, authenticated using (true);
create policy projects_insert_dev on public.projects for insert to anon, authenticated with check (true);
create policy projects_update_dev on public.projects for update to anon, authenticated using (true) with check (true);

create policy milestones_select_dev on public.milestones for select to anon, authenticated using (true);
create policy milestones_insert_dev on public.milestones for insert to anon, authenticated with check (true);
create policy milestones_update_dev on public.milestones for update to anon, authenticated using (true) with check (true);
create policy milestones_delete_dev on public.milestones for delete to anon, authenticated using (true);

create policy tasks_select_dev on public.tasks for select to anon, authenticated using (true);
create policy tasks_insert_dev on public.tasks for insert to anon, authenticated with check (true);
create policy tasks_update_dev on public.tasks for update to anon, authenticated using (true) with check (true);
create policy tasks_delete_dev on public.tasks for delete to anon, authenticated using (true);

create policy deliverables_select_dev on public.deliverables for select to anon, authenticated using (true);
create policy deliverables_insert_dev on public.deliverables for insert to anon, authenticated with check (true);
create policy deliverables_update_dev on public.deliverables for update to anon, authenticated using (true) with check (true);

create policy file_versions_select_dev on public.file_versions for select to anon, authenticated using (true);
create policy file_versions_insert_dev on public.file_versions for insert to anon, authenticated with check (true);
create policy file_versions_update_dev on public.file_versions for update to anon, authenticated using (true) with check (true);

create policy feedback_select_dev on public.feedback for select to anon, authenticated using (true);
create policy feedback_insert_dev on public.feedback for insert to anon, authenticated with check (true);
create policy feedback_update_dev on public.feedback for update to anon, authenticated using (true) with check (true);

create policy approvals_select_dev on public.approvals for select to anon, authenticated using (true);
create policy approvals_insert_dev on public.approvals for insert to anon, authenticated with check (true);
create policy approvals_update_dev on public.approvals for update to anon, authenticated using (true) with check (true);

create policy activity_select_dev on public.activity for select to anon, authenticated using (true);
create policy activity_insert_dev on public.activity for insert to anon, authenticated with check (true);
create policy activity_update_dev on public.activity for update to anon, authenticated using (true) with check (true);

grant usage on schema public to anon, authenticated;
grant select, insert, update on public.profiles, public.leads, public.clients, public.projects,
  public.deliverables, public.file_versions, public.feedback, public.approvals, public.activity
  to anon, authenticated;
grant select, insert, update, delete on public.milestones, public.tasks to anon, authenticated;
grant execute on function public.create_file_version(uuid, text, text, bigint, text, text) to anon, authenticated;
grant execute on function public.set_current_file_version(uuid, uuid) to anon, authenticated;

comment on table public.file_versions is 'Version metadata only. Binary files belong to a later Storage phase.';
comment on policy leads_select_dev on public.leads is 'TEMPORARY: Client Portal is previewable without auth. Replace with profile/client-scoped policies when client auth ships.';
