-- Tracks the third-party accounts a client needs for their project (Vercel, GitHub, Supabase, their business email,
-- domain registrar) and whether they have been invited yet. Deliberately holds no password: the guidance is to add
-- the client as a collaborator on each service under their own email, never to share a login. This table is just
-- the checklist -- who to invite where, and whether it's done.
--
-- Staff only, scoped like every other project record: projects.view to see the list, projects.manage to change it.
-- The client never sees this table; it is an internal tracking list for the agency.

create table public.client_project_accounts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  service text not null check (service in ('vercel', 'github', 'supabase', 'email', 'domain', 'other')),
  -- Free-form name for the "other" service, or an override label for a named one (e.g. "GitHub -- design repo").
  label text not null default '' check (char_length(label) <= 120),
  login_url text not null default '' check (char_length(login_url) <= 500),
  username text not null default '' check (char_length(username) <= 200),
  status text not null default 'needs_invite' check (status in ('needs_invite', 'invited', 'active')),
  notes text not null default '' check (char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  constraint client_project_accounts_needs_a_pointer check (login_url <> '' or username <> '' or label <> '')
);

create index client_project_accounts_project_idx on public.client_project_accounts (project_id);

create trigger client_project_accounts_touch_updated_at
  before update on public.client_project_accounts
  for each row execute function public.set_updated_at();

alter table public.client_project_accounts enable row level security;

create policy client_project_accounts_select on public.client_project_accounts
  for select to authenticated
  using (public.staff_may_project(project_id, 'projects.view'));

create policy client_project_accounts_insert on public.client_project_accounts
  for insert to authenticated
  with check (public.staff_may_project(project_id, 'projects.manage'));

create policy client_project_accounts_update on public.client_project_accounts
  for update to authenticated
  using (public.staff_may_project(project_id, 'projects.manage'))
  with check (public.staff_may_project(project_id, 'projects.manage'));

create policy client_project_accounts_delete on public.client_project_accounts
  for delete to authenticated
  using (public.staff_may_project(project_id, 'projects.manage'));

revoke all on public.client_project_accounts from public, anon;
grant select, insert, update, delete on public.client_project_accounts to authenticated;

comment on table public.client_project_accounts is
  'Checklist of third-party accounts (Vercel, GitHub, Supabase, email, domain) a client needs for their project, and whether they''ve been invited. No password is ever stored here -- invite the client as a collaborator on each service instead.';
