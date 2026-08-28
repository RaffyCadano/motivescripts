-- Phase 20: Team Management & Staff Permissions
-- Additive. Does not rewrite historical activity. Does not change client ownership.

-- ---------------------------------------------------------------------------
-- Profiles: add staff role
-- ---------------------------------------------------------------------------

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('admin', 'staff', 'client'));

alter table public.profiles drop constraint if exists profiles_admin_client_id_null;
alter table public.profiles add constraint profiles_agency_client_id_null
  check (role = 'client' or client_id is null);

-- ---------------------------------------------------------------------------
-- Catalog + staff metadata
-- ---------------------------------------------------------------------------

create table public.staff_permission_catalog (
  code text primary key
    check (code ~ '^[a-z]+[.][a-z]+$'),
  label text not null,
  sort_order integer not null default 0
);

insert into public.staff_permission_catalog (code, label, sort_order) values
  ('leads.view', 'View leads', 10),
  ('leads.manage', 'Manage leads', 11),
  ('clients.view', 'View clients', 20),
  ('clients.manage', 'Manage clients', 21),
  ('projects.view', 'View projects', 30),
  ('projects.manage', 'Manage projects', 31),
  ('files.view', 'View files', 40),
  ('files.manage', 'Manage files', 41),
  ('feedback.manage', 'Manage feedback', 50),
  ('proposals.view', 'View proposals', 60),
  ('proposals.manage', 'Manage proposals', 61),
  ('contracts.view', 'View contracts', 70),
  ('contracts.manage', 'Manage contracts', 71),
  ('invoices.view', 'View invoices', 80),
  ('invoices.manage', 'Manage invoices', 81),
  ('messages.view', 'View messages', 90),
  ('messages.manage', 'Manage messages', 91),
  ('team.view', 'View team', 100),
  ('team.manage', 'Manage team', 101),
  ('activity.view', 'View activity', 110);

create table public.staff_templates (
  key text primary key
    check (key in ('admin', 'staff', 'project_manager', 'sales', 'accounting')),
  label text not null,
  profile_role text not null check (profile_role in ('admin', 'staff'))
);

insert into public.staff_templates (key, label, profile_role) values
  ('admin', 'Admin', 'admin'),
  ('staff', 'Staff', 'staff'),
  ('project_manager', 'Project Manager', 'staff'),
  ('sales', 'Sales', 'staff'),
  ('accounting', 'Accounting', 'staff');

create table public.staff_template_permissions (
  template_key text not null references public.staff_templates (key) on delete cascade,
  permission_code text not null references public.staff_permission_catalog (code) on delete cascade,
  primary key (template_key, permission_code)
);

insert into public.staff_template_permissions (template_key, permission_code)
select 'admin', code from public.staff_permission_catalog;

insert into public.staff_template_permissions (template_key, permission_code)
select 'staff', code from public.staff_permission_catalog
where code not in ('team.view', 'team.manage');

insert into public.staff_template_permissions (template_key, permission_code) values
  ('project_manager', 'clients.view'),
  ('project_manager', 'clients.manage'),
  ('project_manager', 'projects.view'),
  ('project_manager', 'projects.manage'),
  ('project_manager', 'files.view'),
  ('project_manager', 'files.manage'),
  ('project_manager', 'feedback.manage'),
  ('project_manager', 'messages.view'),
  ('project_manager', 'messages.manage'),
  ('project_manager', 'activity.view'),
  ('sales', 'leads.view'),
  ('sales', 'leads.manage'),
  ('sales', 'clients.view'),
  ('sales', 'clients.manage'),
  ('sales', 'proposals.view'),
  ('sales', 'proposals.manage'),
  ('sales', 'contracts.view'),
  ('sales', 'contracts.manage'),
  ('sales', 'messages.view'),
  ('sales', 'messages.manage'),
  ('accounting', 'clients.view'),
  ('accounting', 'invoices.view'),
  ('accounting', 'invoices.manage');

create table public.staff_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  job_title text not null default '',
  template_key text not null references public.staff_templates (key),
  is_active boolean not null default true,
  deactivated_at timestamptz,
  last_active_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  check (not is_active or deactivated_at is null)
);

create index staff_profiles_active_idx on public.staff_profiles (is_active);

create table public.staff_grants (
  user_id uuid not null references public.staff_profiles (user_id) on delete cascade,
  permission_code text not null references public.staff_permission_catalog (code) on delete cascade,
  granted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, permission_code)
);

create table public.client_staff_assignments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  user_id uuid not null references public.staff_profiles (user_id) on delete cascade,
  label text not null default '',
  assigned_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (client_id, user_id)
);

create index client_staff_assignments_user_idx on public.client_staff_assignments (user_id);

create table public.project_staff_assignments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references public.staff_profiles (user_id) on delete cascade,
  label text not null default '',
  assigned_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (project_id, user_id)
);

create index project_staff_assignments_user_idx on public.project_staff_assignments (user_id);

create table public.staff_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  invitee_name text not null default '',
  job_title text not null default '',
  template_key text not null references public.staff_templates (key),
  permission_codes text[] not null default '{}',
  token_hash text not null check (token_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'expired', 'revoked')),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  revoked_at timestamptz,
  check (status <> 'accepted' or accepted_at is not null),
  check (status <> 'revoked' or revoked_at is not null)
);

create unique index staff_invitations_pending_email
  on public.staff_invitations (email)
  where status = 'pending';

create index staff_invitations_token_hash_idx on public.staff_invitations (token_hash);
create index staff_invitations_status_idx on public.staff_invitations (status);

alter table public.leads
  add column if not exists assigned_to uuid references public.profiles (id) on delete set null;

create index if not exists leads_assigned_to_idx on public.leads (assigned_to);

-- Backfill existing admins so they keep access after is_admin() also checks staff_profiles.
insert into public.staff_profiles (user_id, job_title, template_key, is_active, created_at, updated_at)
select p.id, 'Administrator', 'admin', true, p.created_at, now()
from public.profiles p
where p.role = 'admin'
on conflict (user_id) do nothing;

insert into public.staff_grants (user_id, permission_code)
select sp.user_id, c.code
from public.staff_profiles sp
cross join public.staff_permission_catalog c
where sp.template_key = 'admin'
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    left join public.staff_profiles s on s.user_id = p.id
    where p.id = auth.uid()
      and p.role = 'admin'
      and coalesce(s.is_active, true)
  );
$$;

create or replace function public.is_active_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    join public.staff_profiles s on s.user_id = p.id
    where p.id = auth.uid()
      and p.role = 'staff'
      and s.is_active
  );
$$;

create or replace function public.is_agency()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or public.is_active_staff();
$$;

create or replace function public.has_grant(p_code text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin()
    or exists (
      select 1
      from public.staff_profiles s
      join public.staff_grants g on g.user_id = s.user_id
      where s.user_id = auth.uid()
        and s.is_active
        and g.permission_code = p_code
    );
$$;

create or replace function public.assigned_to_client(p_client_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin()
    or (
      p_client_id is not null
      and exists (
        select 1 from public.client_staff_assignments a
        where a.user_id = auth.uid() and a.client_id = p_client_id
      )
    )
    or (
      p_client_id is not null
      and exists (
        select 1
        from public.project_staff_assignments a
        join public.projects p on p.id = a.project_id
        where a.user_id = auth.uid() and p.client_id = p_client_id
      )
    );
$$;

create or replace function public.assigned_to_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin()
    or (
      p_project_id is not null
      and exists (
        select 1 from public.project_staff_assignments a
        where a.user_id = auth.uid() and a.project_id = p_project_id
      )
    )
    or (
      p_project_id is not null
      and exists (
        select 1
        from public.projects p
        join public.client_staff_assignments a on a.client_id = p.client_id
        where p.id = p_project_id and a.user_id = auth.uid()
      )
    );
$$;

create or replace function public.staff_may_client(p_client_id uuid, p_perm text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_grant(p_perm)
    and (public.is_admin() or public.assigned_to_client(p_client_id));
$$;

create or replace function public.staff_may_project(p_project_id uuid, p_perm text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_grant(p_perm)
    and (public.is_admin() or public.assigned_to_project(p_project_id));
$$;

create or replace function public.assert_client_perm(p_client_id uuid, p_perm text)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if public.staff_may_client(p_client_id, p_perm) then
    return;
  end if;
  raise exception 'Not allowed' using errcode = '42501';
end;
$$;

create or replace function public.assert_project_perm(p_project_id uuid, p_perm text)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if public.staff_may_project(p_project_id, p_perm) then
    return;
  end if;
  raise exception 'Not allowed' using errcode = '42501';
end;
$$;

create or replace function public.assert_grant(p_perm text)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if public.has_grant(p_perm) then
    return;
  end if;
  raise exception 'Not allowed' using errcode = '42501';
end;
$$;

create or replace function public.active_admin_count()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.profiles p
  left join public.staff_profiles s on s.user_id = p.id
  where p.role = 'admin'
    and coalesce(s.is_active, true);
$$;

create or replace function public.actor_display_name()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    nullif(trim(full_name), ''),
    nullif(trim(email), ''),
    'Team'
  )
  from public.profiles
  where id = auth.uid();
$$;

create or replace function public.can_access_project_file(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  parts text[];
  pid uuid;
  did uuid;
begin
  pid := public.storage_project_id(object_name);
  if pid is null then
    return false;
  end if;
  parts := string_to_array(object_name, '/');
  begin
    did := parts[4]::uuid;
  exception when invalid_text_representation then
    return false;
  end;

  if not exists (
    select 1 from public.deliverables d
    where d.id = did and d.project_id = pid
  ) then
    return false;
  end if;

  if public.is_admin() then
    return true;
  end if;

  if public.staff_may_project(pid, 'files.view') then
    return true;
  end if;

  return exists (
    select 1
    from public.deliverables d
    join public.projects p on p.id = d.project_id
    where d.id = did
      and d.project_id = pid
      and p.client_id = public.current_client_id()
  );
end;
$$;

create or replace function public.current_staff_context()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'is_active', case
      when p.role = 'admin' then coalesce(s.is_active, true)
      when p.role = 'staff' then coalesce(s.is_active, false)
      else false
    end,
    'job_title', coalesce(s.job_title, ''),
    'template_key', s.template_key,
    'permissions', case
      when p.role = 'admin' and coalesce(s.is_active, true) then (
        select coalesce(jsonb_agg(c.code order by c.sort_order), '[]'::jsonb)
        from public.staff_permission_catalog c
      )
      else coalesce((
        select jsonb_agg(g.permission_code order by g.permission_code)
        from public.staff_grants g
        where g.user_id = p.id
      ), '[]'::jsonb)
    end
  )
  from public.profiles p
  left join public.staff_profiles s on s.user_id = p.id
  where p.id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- Auto-assign staff who create clients/projects
-- ---------------------------------------------------------------------------

create or replace function public.staff_auto_assign_client()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_active_staff() then
    insert into public.client_staff_assignments (client_id, user_id, assigned_by)
    values (new.id, auth.uid(), auth.uid())
    on conflict (client_id, user_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists clients_auto_assign_staff on public.clients;
create trigger clients_auto_assign_staff
  after insert on public.clients
  for each row execute function public.staff_auto_assign_client();

create or replace function public.staff_auto_assign_project()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_active_staff() then
    insert into public.project_staff_assignments (project_id, user_id, assigned_by)
    values (new.id, auth.uid(), auth.uid())
    on conflict (project_id, user_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists projects_auto_assign_staff on public.projects;
create trigger projects_auto_assign_staff
  after insert on public.projects
  for each row execute function public.staff_auto_assign_project();

create or replace function public.project_assignment_matches_client()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  project_client uuid;
  has_client_assignments boolean;
begin
  select client_id into project_client from public.projects where id = new.project_id;
  if project_client is null then
    raise exception 'Unable to assign this team member.' using errcode = 'P0001';
  end if;
  select exists (
    select 1 from public.client_staff_assignments a
    where a.user_id = new.user_id
  ) into has_client_assignments;
  if has_client_assignments and not exists (
    select 1 from public.client_staff_assignments a
    where a.user_id = new.user_id and a.client_id = project_client
  ) then
    raise exception 'Unable to assign this team member.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists project_staff_assignments_client_guard on public.project_staff_assignments;
create trigger project_staff_assignments_client_guard
  before insert or update of project_id, user_id
  on public.project_staff_assignments
  for each row execute function public.project_assignment_matches_client();

-- ---------------------------------------------------------------------------
-- Messaging + notifications + activity attribution
-- ---------------------------------------------------------------------------

create or replace function public.messages_force_sender()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  label text;
  profile_role text;
begin
  if auth.uid() is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  new.sender_user_id := auth.uid();
  select
    coalesce(role, 'client'),
    coalesce(nullif(trim(full_name), ''), case when role in ('admin', 'staff') then 'MotiveScripts' else 'Client' end)
    into profile_role, label
  from public.profiles
  where id = auth.uid();
  new.sender_role := case when profile_role in ('admin', 'staff') then 'admin' else 'client' end;
  new.sender_label := coalesce(label, 'MotiveScripts');
  new.body := trim(new.body);
  return new;
end;
$$;

create or replace function public.notify_agency(
  p_perm text,
  p_client_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_conversation_id uuid default null,
  p_message_id uuid default null,
  p_project_id uuid default null,
  p_deliverable_id uuid default null,
  p_proposal_id uuid default null,
  p_contract_id uuid default null,
  p_invoice_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (
    user_id, type, title, body, conversation_id, message_id, project_id, deliverable_id,
    proposal_id, contract_id, invoice_id
  )
  select
    p.id,
    p_type,
    p_title,
    coalesce(p_body, ''),
    p_conversation_id,
    p_message_id,
    p_project_id,
    p_deliverable_id,
    p_proposal_id,
    p_contract_id,
    p_invoice_id
  from public.profiles p
  left join public.staff_profiles s on s.user_id = p.id
  where p.id is distinct from auth.uid()
    and (
      (p.role = 'admin' and coalesce(s.is_active, true))
      or (
        p.role = 'staff'
        and coalesce(s.is_active, false)
        and exists (
          select 1 from public.staff_grants g
          where g.user_id = p.id and g.permission_code = p_perm
        )
        and (
          p_client_id is null
          or exists (
            select 1 from public.client_staff_assignments a
            where a.user_id = p.id and a.client_id = p_client_id
          )
          or exists (
            select 1
            from public.project_staff_assignments a
            join public.projects pr on pr.id = a.project_id
            where a.user_id = p.id and pr.client_id = p_client_id
          )
        )
      )
    )
  on conflict (user_id, message_id) do nothing;
end;
$$;

create or replace function public.notify_admins(
  p_type text,
  p_title text,
  p_body text,
  p_conversation_id uuid default null,
  p_message_id uuid default null,
  p_project_id uuid default null,
  p_deliverable_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  client_id uuid;
begin
  if p_conversation_id is not null then
    select c.client_id into client_id from public.conversations c where c.id = p_conversation_id;
  elsif p_project_id is not null then
    select pr.client_id into client_id from public.projects pr where pr.id = p_project_id;
  end if;
  perform public.notify_agency(
    'messages.view',
    client_id,
    p_type,
    p_title,
    p_body,
    p_conversation_id,
    p_message_id,
    p_project_id,
    p_deliverable_id,
    null,
    null,
    null
  );
end;
$$;

create or replace function public.notify_document(
  p_audience text,
  p_client_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_project_id uuid default null,
  p_proposal_id uuid default null,
  p_contract_id uuid default null,
  p_invoice_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  perm text := 'activity.view';
begin
  if p_type like 'proposal%' then
    perm := 'proposals.view';
  elsif p_type like 'contract%' then
    perm := 'contracts.view';
  elsif p_type like 'invoice%' or p_type like 'payment%' then
    perm := 'invoices.view';
  end if;

  if p_audience = 'admins' then
    perform public.notify_agency(
      perm,
      p_client_id,
      p_type,
      p_title,
      p_body,
      null, null, p_project_id, null, p_proposal_id, p_contract_id, p_invoice_id
    );
  elsif p_audience = 'client' then
    if p_client_id is null then
      return;
    end if;
    insert into public.notifications (
      user_id, type, title, body, project_id, proposal_id, contract_id, invoice_id
    )
    select p.id, p_type, p_title, coalesce(p_body, ''), p_project_id, p_proposal_id, p_contract_id, p_invoice_id
    from public.profiles p
    where p.role = 'client'
      and p.client_id = p_client_id
      and p.id is distinct from auth.uid();
  end if;
end;
$$;

create or replace function public.record_document_activity(
  p_client_id uuid,
  p_project_id uuid,
  p_event text,
  p_message text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  labeled text;
  actor text;
begin
  actor := public.actor_display_name();
  labeled := case
    when actor is not null and actor <> '' and p_message not ilike actor || '%'
      then actor || ' — ' || p_message
    else p_message
  end;
  perform public.append_client_staff_activity(p_client_id, labeled);
  if p_project_id is not null then
    insert into public.activity (project_id, actor_id, activity_type, message, metadata)
    values (
      p_project_id,
      auth.uid(),
      p_event,
      labeled,
      jsonb_build_object('icon', 'status')
    );
    update public.projects set last_activity_at = now() where id = p_project_id;
  end if;
end;
$$;

create or replace function public.messages_notify_recipients()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  conv public.conversations;
  sender_role text;
  business text;
  preview text;
begin
  select * into conv from public.conversations where id = new.conversation_id;
  if not found then
    return new;
  end if;

  select role into sender_role from public.profiles where id = new.sender_user_id;
  select business_name into business from public.clients where id = conv.client_id;
  preview := left(new.body, 80);

  if sender_role = 'client' then
    perform public.notify_admins(
      'new_message',
      'New message from ' || coalesce(business, 'a client'),
      preview,
      conv.id,
      new.id,
      conv.project_id,
      null
    );
  else
    perform public.notify_client_users(
      conv.client_id,
      'new_message',
      'New message from MotiveScripts',
      preview,
      conv.id,
      new.id,
      conv.project_id,
      null
    );
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Staff invitations (hashed tokens, accept RPC)
-- ---------------------------------------------------------------------------

create or replace function public.preview_staff_invitation(p_token text)
returns table (state text, role_label text)
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.staff_invitations;
  hashed text;
  tmpl_label text;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    state := 'invalid';
    role_label := null;
    return next;
    return;
  end if;
  hashed := public.hash_invitation_token(p_token);
  select * into inv from public.staff_invitations where token_hash = hashed;
  if not found then
    state := 'invalid';
    role_label := null;
    return next;
    return;
  end if;
  if inv.status = 'accepted' then
    state := 'accepted';
    role_label := null;
    return next;
    return;
  end if;
  if inv.status = 'revoked' then
    state := 'revoked';
    role_label := null;
    return next;
    return;
  end if;
  if inv.status <> 'pending' or inv.expires_at <= now() then
    state := 'expired';
    role_label := null;
    return next;
    return;
  end if;
  select label into tmpl_label from public.staff_templates where key = inv.template_key;
  state := 'valid';
  role_label := tmpl_label;
  return next;
end;
$$;

create or replace function public.staff_invitation_email_matches(p_token text, p_email text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.staff_invitations;
  hashed text;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    return false;
  end if;
  hashed := public.hash_invitation_token(p_token);
  select * into inv from public.staff_invitations where token_hash = hashed;
  if not found or inv.status <> 'pending' or inv.expires_at <= now() then
    return false;
  end if;
  return inv.email = public.normalize_invite_email(p_email);
end;
$$;

create or replace function public.accept_staff_invitation(p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  inv public.staff_invitations;
  hashed text;
  user_email text;
  target public.profiles;
  next_role text;
  code text;
begin
  if uid is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    raise exception 'INVALID_INVITE' using errcode = 'P0001';
  end if;
  hashed := public.hash_invitation_token(p_token);
  select * into inv from public.staff_invitations where token_hash = hashed for update;
  if not found then
    raise exception 'INVALID_INVITE' using errcode = 'P0001';
  end if;
  if inv.status = 'accepted' then
    raise exception 'ALREADY_ACCEPTED' using errcode = 'P0001';
  end if;
  if inv.status = 'revoked' then
    raise exception 'REVOKED_INVITE' using errcode = 'P0001';
  end if;
  if inv.status <> 'pending' or inv.expires_at <= now() then
    raise exception 'EXPIRED_INVITE' using errcode = 'P0001';
  end if;

  select lower(trim(coalesce(email, ''))) into user_email from auth.users where id = uid;
  if user_email is null or user_email = '' or user_email is distinct from inv.email then
    raise exception 'EMAIL_MISMATCH' using errcode = 'P0001';
  end if;

  select * into target from public.profiles where id = uid for update;
  if not found then
    insert into public.profiles (id, email, full_name, role, client_id)
    values (uid, user_email, coalesce(nullif(inv.invitee_name, ''), ''), 'client', null)
    returning * into target;
  end if;

  if target.role = 'client' and target.client_id is not null then
    raise exception 'IS_CLIENT' using errcode = 'P0001';
  end if;
  if target.role in ('admin', 'staff') and exists (
    select 1 from public.staff_profiles s where s.user_id = uid and s.is_active
  ) then
    raise exception 'ALREADY_STAFF' using errcode = 'P0001';
  end if;

  select profile_role into next_role from public.staff_templates where key = inv.template_key;
  if next_role is null then
    raise exception 'INVALID_INVITE' using errcode = 'P0001';
  end if;

  update public.profiles
    set role = next_role,
        client_id = null,
        email = coalesce(nullif(trim(email), ''), user_email),
        full_name = case
          when length(trim(full_name)) > 0 then full_name
          else coalesce(nullif(inv.invitee_name, ''), full_name)
        end
  where id = uid;

  insert into public.staff_profiles (user_id, job_title, template_key, is_active, created_by)
  values (uid, inv.job_title, inv.template_key, true, inv.created_by)
  on conflict (user_id) do update
    set job_title = excluded.job_title,
        template_key = excluded.template_key,
        is_active = true,
        deactivated_at = null,
        updated_at = now();

  delete from public.staff_grants where user_id = uid;
  if coalesce(array_length(inv.permission_codes, 1), 0) > 0 then
    foreach code in array inv.permission_codes
    loop
      if exists (select 1 from public.staff_permission_catalog c where c.code = code) then
        insert into public.staff_grants (user_id, permission_code, granted_by)
        values (uid, code, inv.created_by)
        on conflict do nothing;
      end if;
    end loop;
  else
    insert into public.staff_grants (user_id, permission_code, granted_by)
    select uid, tp.permission_code, inv.created_by
    from public.staff_template_permissions tp
    where tp.template_key = inv.template_key
    on conflict do nothing;
  end if;

  update public.staff_invitations
    set status = 'accepted',
        accepted_at = now(),
        accepted_user_id = uid
  where id = inv.id;
end;
$$;

create or replace function public.touch_staff_last_active()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;
  update public.staff_profiles
    set last_active_at = now(), updated_at = now()
  where user_id = auth.uid() and is_active;
end;
$$;

create or replace function public.assign_staff_to_client(p_client_id uuid, p_user_id uuid, p_label text default '')
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if not exists (select 1 from public.clients where id = p_client_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if not exists (select 1 from public.staff_profiles s join public.profiles p on p.id = s.user_id where s.user_id = p_user_id and p.role in ('admin', 'staff')) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  insert into public.client_staff_assignments (client_id, user_id, label, assigned_by)
  values (p_client_id, p_user_id, coalesce(trim(p_label), ''), auth.uid())
  on conflict (client_id, user_id) do update set label = excluded.label;
end;
$$;

create or replace function public.unassign_staff_from_client(p_client_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  delete from public.client_staff_assignments
  where client_id = p_client_id and user_id = p_user_id;
end;
$$;

create or replace function public.assign_staff_to_project(p_project_id uuid, p_user_id uuid, p_label text default '')
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if not exists (select 1 from public.projects where id = p_project_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if not exists (select 1 from public.staff_profiles s join public.profiles p on p.id = s.user_id where s.user_id = p_user_id and p.role in ('admin', 'staff')) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  insert into public.project_staff_assignments (project_id, user_id, label, assigned_by)
  values (p_project_id, p_user_id, coalesce(trim(p_label), ''), auth.uid())
  on conflict (project_id, user_id) do update set label = excluded.label;
end;
$$;

create or replace function public.unassign_staff_from_project(p_project_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  delete from public.project_staff_assignments
  where project_id = p_project_id and user_id = p_user_id;
end;
$$;

create or replace function public.update_staff_member(
  p_user_id uuid,
  p_full_name text default null,
  p_job_title text default null,
  p_template_key text default null,
  p_permission_codes text[] default null,
  p_is_active boolean default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.profiles;
  staff public.staff_profiles;
  next_role text;
  was_admin boolean;
  code text;
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if p_user_id = auth.uid() and p_template_key is not null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if p_user_id = auth.uid() and p_permission_codes is not null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select * into target from public.profiles where id = p_user_id for update;
  if not found or target.role not in ('admin', 'staff') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select * into staff from public.staff_profiles where user_id = p_user_id for update;
  if not found then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  was_admin := target.role = 'admin' and staff.is_active;

  if p_template_key is not null then
    select profile_role into next_role from public.staff_templates where key = p_template_key;
    if next_role is null then
      raise exception 'Not allowed' using errcode = '42501';
    end if;
    if was_admin and next_role <> 'admin' and public.active_admin_count() <= 1 then
      raise exception 'LAST_ADMIN' using errcode = 'P0001';
    end if;
    update public.profiles set role = next_role, client_id = null where id = p_user_id;
    update public.staff_profiles set template_key = p_template_key, updated_at = now() where user_id = p_user_id;
    if p_permission_codes is null then
      delete from public.staff_grants where user_id = p_user_id;
      insert into public.staff_grants (user_id, permission_code, granted_by)
      select p_user_id, tp.permission_code, auth.uid()
      from public.staff_template_permissions tp
      where tp.template_key = p_template_key;
    end if;
  end if;

  if p_permission_codes is not null then
    delete from public.staff_grants where user_id = p_user_id;
    foreach code in array p_permission_codes
    loop
      if exists (select 1 from public.staff_permission_catalog c where c.code = code) then
        insert into public.staff_grants (user_id, permission_code, granted_by)
        values (p_user_id, code, auth.uid())
        on conflict do nothing;
      end if;
    end loop;
  end if;

  if p_is_active is not null then
    if was_admin and p_is_active = false and public.active_admin_count() <= 1 then
      raise exception 'LAST_ADMIN' using errcode = 'P0001';
    end if;
    update public.staff_profiles
      set is_active = p_is_active,
          deactivated_at = case when p_is_active then null else now() end,
          updated_at = now()
    where user_id = p_user_id;
  end if;

  if p_full_name is not null then
    update public.profiles set full_name = trim(p_full_name) where id = p_user_id;
  end if;
  if p_job_title is not null then
    update public.staff_profiles set job_title = trim(p_job_title), updated_at = now() where user_id = p_user_id;
  end if;
end;
$$;

create or replace function public.staff_can_access_client(p_client_id uuid, p_perm text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.staff_may_client(p_client_id, p_perm);
$$;

create or replace function public.start_conversation(
  p_subject text,
  p_body text,
  p_project_id uuid default null,
  p_client_id uuid default null
)
returns public.conversations
language plpgsql
security definer
set search_path = public
as $$
declare
  owned uuid;
  conv public.conversations;
  subject_text text := trim(coalesce(p_subject, ''));
  body_text text := trim(coalesce(p_body, ''));
begin
  if auth.uid() is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if length(subject_text) = 0 or length(body_text) = 0 then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  if public.is_admin() or public.has_grant('messages.manage') then
    if p_client_id is null then
      raise exception 'Not allowed' using errcode = '42501';
    end if;
    perform public.assert_client_perm(p_client_id, 'messages.manage');
    owned := p_client_id;
    if not exists (select 1 from public.clients where id = owned) then
      raise exception 'Not allowed' using errcode = '42501';
    end if;
  elsif public.is_client() then
    owned := public.current_client_id();
  else
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  if p_project_id is not null and not exists (
    select 1 from public.projects where id = p_project_id and client_id = owned
  ) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  insert into public.conversations (client_id, project_id, subject, created_by, status)
  values (owned, p_project_id, subject_text, auth.uid(), 'open')
  returning * into conv;

  insert into public.messages (conversation_id, body)
  values (conv.id, body_text);

  if conv.project_id is not null then
    insert into public.activity (project_id, actor_id, activity_type, message, metadata)
    values (
      conv.project_id,
      auth.uid(),
      'conversation_created',
      'Conversation started: ' || subject_text,
      jsonb_build_object('icon', 'status', 'conversation_id', conv.id)
    );
  end if;

  select * into conv from public.conversations where id = conv.id;
  return conv;
end;
$$;

create or replace function public.send_message(p_conversation_id uuid, p_body text)
returns public.messages
language plpgsql
security definer
set search_path = public
as $$
declare
  conv public.conversations;
  created public.messages;
  body_text text := trim(coalesce(p_body, ''));
begin
  if auth.uid() is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if length(body_text) = 0 then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select * into conv from public.conversations where id = p_conversation_id for update;
  if not found then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if not public.owns_conversation(conv.id)
     and not public.staff_may_client(conv.client_id, 'messages.manage') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  insert into public.messages (conversation_id, body)
  values (conv.id, body_text)
  returning * into created;

  return created;
end;
$$;

create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  updated integer;
  conv public.conversations;
begin
  if auth.uid() is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select * into conv from public.conversations where id = p_conversation_id;
  if not found then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if not public.owns_conversation(p_conversation_id)
     and not public.staff_may_client(conv.client_id, 'messages.view') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  update public.messages
    set read_at = now()
  where conversation_id = p_conversation_id
    and sender_user_id is distinct from auth.uid()
    and read_at is null;

  get diagnostics updated = row_count;
  return updated;
end;
$$;

create or replace function public.set_conversation_status(p_conversation_id uuid, p_status text)
returns public.conversations
language plpgsql
security definer
set search_path = public
as $$
declare
  conv public.conversations;
begin
  if p_status not in ('open', 'closed') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select * into conv from public.conversations where id = p_conversation_id for update;
  if not found then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  perform public.assert_client_perm(conv.client_id, 'messages.manage');

  update public.conversations
    set status = p_status
  where id = p_conversation_id
  returning * into conv;

  if p_status = 'closed' and conv.project_id is not null then
    insert into public.activity (project_id, actor_id, activity_type, message, metadata)
    values (
      conv.project_id,
      auth.uid(),
      'conversation_closed',
      'Conversation closed',
      jsonb_build_object('icon', 'status', 'conversation_id', conv.id)
    );
  end if;

  return conv;
end;
$$;

create or replace function public.apply_rpc_admin_guard(p_fn regprocedure, p_replacement text)
returns void
language plpgsql
set search_path = public
as $$
declare
  def text;
  patched text;
begin
  def := pg_get_functiondef(p_fn);
  patched := regexp_replace(
    def,
    'if not public\.is_admin\(\) then[[:space:]]+raise exception ''Not allowed'' using errcode = ''42501'';[[:space:]]+end if;',
    p_replacement
  );
  if patched = def then
    raise exception 'RPC guard patch failed for %', p_fn;
  end if;
  execute patched;
end;
$$;

do $patch$
begin
  perform public.apply_rpc_admin_guard('public.create_proposal(uuid,uuid,text)',
    'perform public.assert_client_perm(p_client_id, ''proposals.manage'');');
  perform public.apply_rpc_admin_guard('public.create_proposal_revision(uuid)',
    'perform public.assert_client_perm((select client_id from public.proposals where id = p_proposal_id), ''proposals.manage'');');
  perform public.apply_rpc_admin_guard('public.send_proposal(uuid)',
    'perform public.assert_client_perm((select client_id from public.proposals where id = p_proposal_id), ''proposals.manage'');');
  perform public.apply_rpc_admin_guard('public.cancel_proposal(uuid)',
    'perform public.assert_client_perm((select client_id from public.proposals where id = p_proposal_id), ''proposals.manage'');');
  perform public.apply_rpc_admin_guard('public.create_contract(uuid,uuid,uuid,text)',
    'perform public.assert_client_perm(p_client_id, ''contracts.manage'');');
  perform public.apply_rpc_admin_guard('public.create_contract_revision(uuid)',
    'perform public.assert_client_perm((select client_id from public.contracts where id = p_contract_id), ''contracts.manage'');');
  perform public.apply_rpc_admin_guard('public.send_contract(uuid)',
    'perform public.assert_client_perm((select client_id from public.contracts where id = p_contract_id), ''contracts.manage'');');
  perform public.apply_rpc_admin_guard('public.cancel_contract(uuid)',
    'perform public.assert_client_perm((select client_id from public.contracts where id = p_contract_id), ''contracts.manage'');');
  perform public.apply_rpc_admin_guard('public.create_invoice(uuid,uuid,uuid,uuid)',
    'perform public.assert_client_perm(p_client_id, ''invoices.manage'');');
  perform public.apply_rpc_admin_guard(
    'public.update_invoice_draft(uuid,date,date,text,bigint,bigint,text,uuid,uuid,uuid,text,jsonb)',
    'perform public.assert_client_perm((select client_id from public.invoices where id = p_invoice_id), ''invoices.manage'');');
  perform public.apply_rpc_admin_guard('public.send_invoice(uuid)',
    'perform public.assert_client_perm((select client_id from public.invoices where id = p_invoice_id), ''invoices.manage'');');
  perform public.apply_rpc_admin_guard('public.cancel_invoice(uuid)',
    'perform public.assert_client_perm((select client_id from public.invoices where id = p_invoice_id), ''invoices.manage'');');
  perform public.apply_rpc_admin_guard('public.record_invoice_payment(uuid,bigint,date,text,text,text)',
    'perform public.assert_client_perm((select client_id from public.invoices where id = p_invoice_id), ''invoices.manage'');');
  perform public.apply_rpc_admin_guard('public.reverse_invoice_payment(uuid)',
    'perform public.assert_client_perm((select i.client_id from public.payments pay join public.invoices i on i.id = pay.invoice_id where pay.id = p_payment_id), ''invoices.manage'');');
  perform public.apply_rpc_admin_guard(
    'public.create_file_version(uuid,text,text,bigint,text,text,uuid,text,text)',
    'perform public.assert_project_perm((select project_id from public.deliverables where id = p_deliverable_id), ''files.manage'');');
  perform public.apply_rpc_admin_guard('public.set_current_file_version(uuid,uuid)',
    'perform public.assert_project_perm((select project_id from public.deliverables where id = p_deliverable_id), ''files.manage'');');
end
$patch$;

drop function public.apply_rpc_admin_guard(regprocedure, text);

-- ---------------------------------------------------------------------------
-- Client invitation / link: staff cannot become clients
-- ---------------------------------------------------------------------------

create or replace function public.admin_link_client_account(p_client_id uuid, p_email text)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized text;
  target public.profiles;
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  normalized := lower(trim(coalesce(p_email, '')));
  if normalized = '' then
    raise exception 'NO_PROFILE' using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.clients where id = p_client_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select * into target
  from public.profiles
  where lower(coalesce(email, '')) = normalized;

  if not found then
    raise exception 'NO_PROFILE' using errcode = 'P0001';
  end if;

  if target.role in ('admin', 'staff') then
    raise exception 'IS_ADMIN' using errcode = 'P0001';
  end if;

  if target.client_id is not null and target.client_id is distinct from p_client_id then
    raise exception 'ALREADY_LINKED' using errcode = 'P0001';
  end if;

  update public.profiles
    set client_id = p_client_id,
        role = 'client'
  where id = target.id
  returning * into target;

  return target;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.staff_profiles enable row level security;
alter table public.staff_grants enable row level security;
alter table public.staff_invitations enable row level security;
alter table public.client_staff_assignments enable row level security;
alter table public.project_staff_assignments enable row level security;
alter table public.staff_permission_catalog enable row level security;
alter table public.staff_templates enable row level security;
alter table public.staff_template_permissions enable row level security;

revoke all on table public.staff_profiles, public.staff_grants, public.staff_invitations,
  public.client_staff_assignments, public.project_staff_assignments,
  public.staff_permission_catalog, public.staff_templates, public.staff_template_permissions
  from anon, authenticated, public;

grant select on table public.staff_profiles, public.staff_grants, public.staff_invitations,
  public.client_staff_assignments, public.project_staff_assignments,
  public.staff_permission_catalog, public.staff_templates, public.staff_template_permissions
  to authenticated;

create policy staff_catalog_select on public.staff_permission_catalog
  for select to authenticated using (public.is_agency());
create policy staff_templates_select on public.staff_templates
  for select to authenticated using (public.is_agency());
create policy staff_template_perms_select on public.staff_template_permissions
  for select to authenticated using (public.is_agency());

create policy staff_profiles_select on public.staff_profiles
  for select to authenticated
  using (
    public.is_admin()
    or public.has_grant('team.view')
    or user_id = auth.uid()
    or exists (
      select 1
      from public.client_staff_assignments a
      join public.client_staff_assignments b on a.client_id = b.client_id
      where a.user_id = auth.uid() and b.user_id = staff_profiles.user_id
    )
    or exists (
      select 1
      from public.project_staff_assignments a
      join public.project_staff_assignments b on a.project_id = b.project_id
      where a.user_id = auth.uid() and b.user_id = staff_profiles.user_id
    )
  );

create policy staff_grants_select on public.staff_grants
  for select to authenticated
  using (public.is_admin() or public.has_grant('team.view') or user_id = auth.uid());

create policy staff_invitations_admin_select on public.staff_invitations
  for select to authenticated using (public.is_admin());

create policy client_assignments_select on public.client_staff_assignments
  for select to authenticated
  using (
    public.is_admin()
    or public.has_grant('team.view')
    or user_id = auth.uid()
    or public.staff_may_client(client_id, 'clients.view')
  );

create policy project_assignments_select on public.project_staff_assignments
  for select to authenticated
  using (
    public.is_admin()
    or public.has_grant('team.view')
    or user_id = auth.uid()
    or public.staff_may_project(project_id, 'projects.view')
  );

drop policy if exists profiles_select_own_or_admin on public.profiles;
create policy profiles_select_own_or_admin on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or public.is_admin()
    or (
      role in ('admin', 'staff')
      and (
        public.has_grant('team.view')
        or exists (
          select 1
          from public.client_staff_assignments a
          join public.client_staff_assignments b on a.client_id = b.client_id
          where a.user_id = auth.uid() and b.user_id = profiles.id
        )
        or exists (
          select 1
          from public.project_staff_assignments a
          join public.project_staff_assignments b on a.project_id = b.project_id
          where a.user_id = auth.uid() and b.user_id = profiles.id
        )
      )
    )
    or (public.has_grant('clients.view') and role = 'client' and public.assigned_to_client(client_id))
  );

drop policy if exists leads_admin_select on public.leads;
drop policy if exists leads_admin_insert on public.leads;
drop policy if exists leads_admin_update on public.leads;
create policy leads_admin_select on public.leads for select to authenticated using (public.has_grant('leads.view'));
create policy leads_admin_insert on public.leads for insert to authenticated with check (public.has_grant('leads.manage'));
create policy leads_admin_update on public.leads for update to authenticated using (public.has_grant('leads.manage')) with check (public.has_grant('leads.manage'));

drop policy if exists clients_admin_select on public.clients;
drop policy if exists clients_admin_insert on public.clients;
drop policy if exists clients_admin_update on public.clients;
create policy clients_admin_select on public.clients for select to authenticated
  using (public.staff_may_client(id, 'clients.view'));
create policy clients_admin_insert on public.clients for insert to authenticated
  with check (public.has_grant('clients.manage'));
create policy clients_admin_update on public.clients for update to authenticated
  using (public.staff_may_client(id, 'clients.manage'))
  with check (public.staff_may_client(id, 'clients.manage'));

drop policy if exists client_staff_admin_select on public.client_staff_data;
drop policy if exists client_staff_admin_insert on public.client_staff_data;
drop policy if exists client_staff_admin_update on public.client_staff_data;
create policy client_staff_admin_select on public.client_staff_data for select to authenticated
  using (public.staff_may_client(client_id, 'clients.view'));
create policy client_staff_admin_insert on public.client_staff_data for insert to authenticated
  with check (public.staff_may_client(client_id, 'clients.manage'));
create policy client_staff_admin_update on public.client_staff_data for update to authenticated
  using (public.staff_may_client(client_id, 'clients.manage'))
  with check (public.staff_may_client(client_id, 'clients.manage'));

drop policy if exists projects_admin_select on public.projects;
drop policy if exists projects_admin_insert on public.projects;
drop policy if exists projects_admin_update on public.projects;
create policy projects_admin_select on public.projects for select to authenticated
  using (public.staff_may_project(id, 'projects.view'));
create policy projects_admin_insert on public.projects for insert to authenticated
  with check (public.has_grant('projects.manage') and public.staff_may_client(client_id, 'projects.manage'));
create policy projects_admin_update on public.projects for update to authenticated
  using (public.staff_may_project(id, 'projects.manage'))
  with check (public.staff_may_project(id, 'projects.manage'));

drop policy if exists milestones_admin_select on public.milestones;
drop policy if exists milestones_admin_insert on public.milestones;
drop policy if exists milestones_admin_update on public.milestones;
drop policy if exists milestones_admin_delete on public.milestones;
create policy milestones_admin_select on public.milestones for select to authenticated
  using (public.staff_may_project(project_id, 'projects.view'));
create policy milestones_admin_insert on public.milestones for insert to authenticated
  with check (public.staff_may_project(project_id, 'projects.manage'));
create policy milestones_admin_update on public.milestones for update to authenticated
  using (public.staff_may_project(project_id, 'projects.manage'))
  with check (public.staff_may_project(project_id, 'projects.manage'));
create policy milestones_admin_delete on public.milestones for delete to authenticated
  using (public.staff_may_project(project_id, 'projects.manage'));

drop policy if exists tasks_admin_select on public.tasks;
drop policy if exists tasks_admin_insert on public.tasks;
drop policy if exists tasks_admin_update on public.tasks;
drop policy if exists tasks_admin_delete on public.tasks;
create policy tasks_admin_select on public.tasks for select to authenticated
  using (public.staff_may_project(project_id, 'projects.view'));
create policy tasks_admin_insert on public.tasks for insert to authenticated
  with check (public.staff_may_project(project_id, 'projects.manage'));
create policy tasks_admin_update on public.tasks for update to authenticated
  using (public.staff_may_project(project_id, 'projects.manage'))
  with check (public.staff_may_project(project_id, 'projects.manage'));
create policy tasks_admin_delete on public.tasks for delete to authenticated
  using (public.staff_may_project(project_id, 'projects.manage'));

drop policy if exists deliverables_admin_select on public.deliverables;
drop policy if exists deliverables_admin_insert on public.deliverables;
drop policy if exists deliverables_admin_update on public.deliverables;
create policy deliverables_admin_select on public.deliverables for select to authenticated
  using (public.staff_may_project(project_id, 'files.view') or public.staff_may_project(project_id, 'projects.view'));
create policy deliverables_admin_insert on public.deliverables for insert to authenticated
  with check (public.staff_may_project(project_id, 'files.manage'));
create policy deliverables_admin_update on public.deliverables for update to authenticated
  using (public.staff_may_project(project_id, 'files.manage'))
  with check (public.staff_may_project(project_id, 'files.manage'));

drop policy if exists file_versions_admin_select on public.file_versions;
drop policy if exists file_versions_admin_insert on public.file_versions;
drop policy if exists file_versions_admin_update on public.file_versions;
create policy file_versions_admin_select on public.file_versions for select to authenticated
  using (exists (
    select 1 from public.deliverables d
    where d.id = deliverable_id and public.staff_may_project(d.project_id, 'files.view')
  ));
create policy file_versions_admin_insert on public.file_versions for insert to authenticated
  with check (exists (
    select 1 from public.deliverables d
    where d.id = deliverable_id and public.staff_may_project(d.project_id, 'files.manage')
  ));
create policy file_versions_admin_update on public.file_versions for update to authenticated
  using (exists (
    select 1 from public.deliverables d
    where d.id = deliverable_id and public.staff_may_project(d.project_id, 'files.manage')
  ))
  with check (exists (
    select 1 from public.deliverables d
    where d.id = deliverable_id and public.staff_may_project(d.project_id, 'files.manage')
  ));

drop policy if exists feedback_admin_select on public.feedback;
drop policy if exists feedback_admin_update on public.feedback;
create policy feedback_admin_select on public.feedback for select to authenticated
  using (public.staff_may_project(project_id, 'feedback.manage') or public.staff_may_project(project_id, 'files.view'));
create policy feedback_admin_update on public.feedback for update to authenticated
  using (public.staff_may_project(project_id, 'feedback.manage'))
  with check (public.staff_may_project(project_id, 'feedback.manage'));

drop policy if exists approvals_admin_select on public.approvals;
create policy approvals_admin_select on public.approvals for select to authenticated
  using (public.staff_may_project(project_id, 'files.view') or public.staff_may_project(project_id, 'feedback.manage'));

drop policy if exists activity_admin_select on public.activity;
drop policy if exists activity_admin_insert on public.activity;
create policy activity_admin_select on public.activity for select to authenticated
  using (public.staff_may_project(project_id, 'activity.view') or public.staff_may_project(project_id, 'projects.view'));
create policy activity_admin_insert on public.activity for insert to authenticated
  with check (public.is_agency() and public.assigned_to_project(project_id));

drop policy if exists conversations_admin_select on public.conversations;
create policy conversations_admin_select on public.conversations for select to authenticated
  using (public.staff_may_client(client_id, 'messages.view'));

drop policy if exists messages_admin_select on public.messages;
create policy messages_admin_select on public.messages for select to authenticated
  using (exists (
    select 1 from public.conversations c
    where c.id = conversation_id and public.staff_may_client(c.client_id, 'messages.view')
  ));

drop policy if exists client_invitations_admin_select on public.client_invitations;
create policy client_invitations_admin_select on public.client_invitations
  for select to authenticated using (public.is_admin());

drop policy if exists proposals_admin_all on public.proposals;
create policy proposals_agency_select on public.proposals for select to authenticated
  using (public.staff_may_client(client_id, 'proposals.view'));
create policy proposals_agency_write on public.proposals for insert to authenticated
  with check (public.staff_may_client(client_id, 'proposals.manage'));
create policy proposals_agency_update on public.proposals for update to authenticated
  using (public.staff_may_client(client_id, 'proposals.manage'))
  with check (public.staff_may_client(client_id, 'proposals.manage'));
create policy proposals_agency_delete on public.proposals for delete to authenticated
  using (public.staff_may_client(client_id, 'proposals.manage'));

drop policy if exists proposal_revisions_admin_all on public.proposal_revisions;
create policy proposal_revisions_agency_select on public.proposal_revisions for select to authenticated
  using (exists (select 1 from public.proposals p where p.id = proposal_id and public.staff_may_client(p.client_id, 'proposals.view')));
create policy proposal_revisions_agency_write on public.proposal_revisions for all to authenticated
  using (exists (select 1 from public.proposals p where p.id = proposal_id and public.staff_may_client(p.client_id, 'proposals.manage')))
  with check (exists (select 1 from public.proposals p where p.id = proposal_id and public.staff_may_client(p.client_id, 'proposals.manage')));

drop policy if exists proposal_items_admin_all on public.proposal_items;
create policy proposal_items_agency_all on public.proposal_items for all to authenticated
  using (exists (
    select 1 from public.proposal_revisions r
    join public.proposals p on p.id = r.proposal_id
    where r.id = revision_id and public.staff_may_client(p.client_id, 'proposals.view')
  ))
  with check (exists (
    select 1 from public.proposal_revisions r
    join public.proposals p on p.id = r.proposal_id
    where r.id = revision_id and public.staff_may_client(p.client_id, 'proposals.manage')
  ));

drop policy if exists proposal_admin_notes_admin on public.proposal_admin_notes;
create policy proposal_admin_notes_agency on public.proposal_admin_notes for all to authenticated
  using (exists (
    select 1 from public.proposal_revisions r
    join public.proposals p on p.id = r.proposal_id
    where r.id = revision_id and public.staff_may_client(p.client_id, 'proposals.manage')
  ))
  with check (exists (
    select 1 from public.proposal_revisions r
    join public.proposals p on p.id = r.proposal_id
    where r.id = revision_id and public.staff_may_client(p.client_id, 'proposals.manage')
  ));

drop policy if exists contracts_admin_all on public.contracts;
create policy contracts_agency_select on public.contracts for select to authenticated
  using (public.staff_may_client(client_id, 'contracts.view'));
create policy contracts_agency_insert on public.contracts for insert to authenticated
  with check (public.staff_may_client(client_id, 'contracts.manage'));
create policy contracts_agency_update on public.contracts for update to authenticated
  using (public.staff_may_client(client_id, 'contracts.manage'))
  with check (public.staff_may_client(client_id, 'contracts.manage'));
create policy contracts_agency_delete on public.contracts for delete to authenticated
  using (public.staff_may_client(client_id, 'contracts.manage'));

drop policy if exists contract_revisions_admin_all on public.contract_revisions;
create policy contract_revisions_agency_all on public.contract_revisions for all to authenticated
  using (exists (select 1 from public.contracts c where c.id = contract_id and public.staff_may_client(c.client_id, 'contracts.view')))
  with check (exists (select 1 from public.contracts c where c.id = contract_id and public.staff_may_client(c.client_id, 'contracts.manage')));

drop policy if exists contract_admin_notes_admin on public.contract_admin_notes;
create policy contract_admin_notes_agency on public.contract_admin_notes for all to authenticated
  using (exists (
    select 1 from public.contract_revisions r
    join public.contracts c on c.id = r.contract_id
    where r.id = revision_id and public.staff_may_client(c.client_id, 'contracts.manage')
  ))
  with check (exists (
    select 1 from public.contract_revisions r
    join public.contracts c on c.id = r.contract_id
    where r.id = revision_id and public.staff_may_client(c.client_id, 'contracts.manage')
  ));

drop policy if exists invoices_admin_all on public.invoices;
create policy invoices_agency_select on public.invoices for select to authenticated
  using (public.staff_may_client(client_id, 'invoices.view'));
create policy invoices_agency_insert on public.invoices for insert to authenticated
  with check (public.staff_may_client(client_id, 'invoices.manage'));
create policy invoices_agency_update on public.invoices for update to authenticated
  using (public.staff_may_client(client_id, 'invoices.manage'))
  with check (public.staff_may_client(client_id, 'invoices.manage'));
create policy invoices_agency_delete on public.invoices for delete to authenticated
  using (public.staff_may_client(client_id, 'invoices.manage'));

drop policy if exists invoice_items_admin_all on public.invoice_items;
create policy invoice_items_agency_all on public.invoice_items for all to authenticated
  using (exists (select 1 from public.invoices i where i.id = invoice_id and public.staff_may_client(i.client_id, 'invoices.view')))
  with check (exists (select 1 from public.invoices i where i.id = invoice_id and public.staff_may_client(i.client_id, 'invoices.manage')));

drop policy if exists payments_admin_select on public.payments;
create policy payments_agency_select on public.payments for select to authenticated
  using (exists (select 1 from public.invoices i where i.id = invoice_id and public.staff_may_client(i.client_id, 'invoices.view')));

drop policy if exists invoice_admin_notes_admin on public.invoice_admin_notes;
create policy invoice_admin_notes_agency on public.invoice_admin_notes for all to authenticated
  using (exists (select 1 from public.invoices i where i.id = invoice_id and public.staff_may_client(i.client_id, 'invoices.manage')))
  with check (exists (select 1 from public.invoices i where i.id = invoice_id and public.staff_may_client(i.client_id, 'invoices.manage')));

drop policy if exists stripe_checkout_sessions_admin_select on public.stripe_checkout_sessions;
create policy stripe_checkout_sessions_admin_select on public.stripe_checkout_sessions
  for select to authenticated using (public.is_admin());

drop policy if exists project_files_insert on storage.objects;
drop policy if exists project_files_delete on storage.objects;
create policy project_files_insert
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'project-files'
    and public.staff_may_project(public.storage_project_id(name), 'files.manage')
    and public.can_access_project_file(name)
  );
create policy project_files_delete
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'project-files'
    and public.staff_may_project(public.storage_project_id(name), 'files.manage')
    and public.can_access_project_file(name)
  );

-- proposal_items FOR ALL with view in USING allows DELETE for view-only staff.
-- Tighten delete via a dedicated policy: drop ALL and split.
drop policy if exists proposal_items_agency_all on public.proposal_items;
create policy proposal_items_agency_select on public.proposal_items for select to authenticated
  using (exists (
    select 1 from public.proposal_revisions r
    join public.proposals p on p.id = r.proposal_id
    where r.id = revision_id and public.staff_may_client(p.client_id, 'proposals.view')
  ));
create policy proposal_items_agency_write on public.proposal_items for insert to authenticated
  with check (exists (
    select 1 from public.proposal_revisions r
    join public.proposals p on p.id = r.proposal_id
    where r.id = revision_id and public.staff_may_client(p.client_id, 'proposals.manage')
  ));
create policy proposal_items_agency_update on public.proposal_items for update to authenticated
  using (exists (
    select 1 from public.proposal_revisions r
    join public.proposals p on p.id = r.proposal_id
    where r.id = revision_id and public.staff_may_client(p.client_id, 'proposals.manage')
  ))
  with check (exists (
    select 1 from public.proposal_revisions r
    join public.proposals p on p.id = r.proposal_id
    where r.id = revision_id and public.staff_may_client(p.client_id, 'proposals.manage')
  ));
create policy proposal_items_agency_delete on public.proposal_items for delete to authenticated
  using (exists (
    select 1 from public.proposal_revisions r
    join public.proposals p on p.id = r.proposal_id
    where r.id = revision_id and public.staff_may_client(p.client_id, 'proposals.manage')
  ));

drop policy if exists proposal_revisions_agency_write on public.proposal_revisions;
create policy proposal_revisions_agency_insert on public.proposal_revisions for insert to authenticated
  with check (exists (select 1 from public.proposals p where p.id = proposal_id and public.staff_may_client(p.client_id, 'proposals.manage')));
create policy proposal_revisions_agency_update on public.proposal_revisions for update to authenticated
  using (exists (select 1 from public.proposals p where p.id = proposal_id and public.staff_may_client(p.client_id, 'proposals.manage')))
  with check (exists (select 1 from public.proposals p where p.id = proposal_id and public.staff_may_client(p.client_id, 'proposals.manage')));
create policy proposal_revisions_agency_delete on public.proposal_revisions for delete to authenticated
  using (exists (select 1 from public.proposals p where p.id = proposal_id and public.staff_may_client(p.client_id, 'proposals.manage')));

drop policy if exists contract_revisions_agency_all on public.contract_revisions;
create policy contract_revisions_agency_select on public.contract_revisions for select to authenticated
  using (exists (select 1 from public.contracts c where c.id = contract_id and public.staff_may_client(c.client_id, 'contracts.view')));
create policy contract_revisions_agency_insert on public.contract_revisions for insert to authenticated
  with check (exists (select 1 from public.contracts c where c.id = contract_id and public.staff_may_client(c.client_id, 'contracts.manage')));
create policy contract_revisions_agency_update on public.contract_revisions for update to authenticated
  using (exists (select 1 from public.contracts c where c.id = contract_id and public.staff_may_client(c.client_id, 'contracts.manage')))
  with check (exists (select 1 from public.contracts c where c.id = contract_id and public.staff_may_client(c.client_id, 'contracts.manage')));
create policy contract_revisions_agency_delete on public.contract_revisions for delete to authenticated
  using (exists (select 1 from public.contracts c where c.id = contract_id and public.staff_may_client(c.client_id, 'contracts.manage')));

drop policy if exists invoice_items_agency_all on public.invoice_items;
create policy invoice_items_agency_select on public.invoice_items for select to authenticated
  using (exists (select 1 from public.invoices i where i.id = invoice_id and public.staff_may_client(i.client_id, 'invoices.view')));
create policy invoice_items_agency_write on public.invoice_items for insert to authenticated
  with check (exists (select 1 from public.invoices i where i.id = invoice_id and public.staff_may_client(i.client_id, 'invoices.manage')));
create policy invoice_items_agency_update on public.invoice_items for update to authenticated
  using (exists (select 1 from public.invoices i where i.id = invoice_id and public.staff_may_client(i.client_id, 'invoices.manage')))
  with check (exists (select 1 from public.invoices i where i.id = invoice_id and public.staff_may_client(i.client_id, 'invoices.manage')));
create policy invoice_items_agency_delete on public.invoice_items for delete to authenticated
  using (exists (select 1 from public.invoices i where i.id = invoice_id and public.staff_may_client(i.client_id, 'invoices.manage')));

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke all on function public.is_agency() from public, anon;
revoke all on function public.is_active_staff() from public, anon;
revoke all on function public.has_grant(text) from public, anon;
revoke all on function public.assigned_to_client(uuid) from public, anon;
revoke all on function public.assigned_to_project(uuid) from public, anon;
revoke all on function public.staff_may_client(uuid, text) from public, anon;
revoke all on function public.staff_may_project(uuid, text) from public, anon;
revoke all on function public.assert_client_perm(uuid, text) from public, anon, authenticated;
revoke all on function public.assert_project_perm(uuid, text) from public, anon, authenticated;
revoke all on function public.assert_grant(text) from public, anon, authenticated;
revoke all on function public.current_staff_context() from public, anon;
revoke all on function public.preview_staff_invitation(text) from public;
revoke all on function public.staff_invitation_email_matches(text, text) from public;
revoke all on function public.accept_staff_invitation(text) from public, anon;
revoke all on function public.touch_staff_last_active() from public, anon;
revoke all on function public.assign_staff_to_client(uuid, uuid, text) from public, anon;
revoke all on function public.unassign_staff_from_client(uuid, uuid) from public, anon;
revoke all on function public.assign_staff_to_project(uuid, uuid, text) from public, anon;
revoke all on function public.unassign_staff_from_project(uuid, uuid) from public, anon;
revoke all on function public.update_staff_member(uuid, text, text, text, text[], boolean) from public, anon;
revoke all on function public.staff_can_access_client(uuid, text) from public, anon;
revoke all on function public.notify_agency(text, uuid, text, text, text, uuid, uuid, uuid, uuid, uuid, uuid, uuid) from public, anon, authenticated;

grant execute on function public.is_agency() to authenticated;
grant execute on function public.is_active_staff() to authenticated;
grant execute on function public.has_grant(text) to authenticated;
grant execute on function public.assigned_to_client(uuid) to authenticated;
grant execute on function public.assigned_to_project(uuid) to authenticated;
grant execute on function public.staff_may_client(uuid, text) to authenticated;
grant execute on function public.staff_may_project(uuid, text) to authenticated;
grant execute on function public.current_staff_context() to authenticated;
grant execute on function public.preview_staff_invitation(text) to anon, authenticated;
grant execute on function public.staff_invitation_email_matches(text, text) to anon, authenticated;
grant execute on function public.accept_staff_invitation(text) to authenticated;
grant execute on function public.touch_staff_last_active() to authenticated;
grant execute on function public.assign_staff_to_client(uuid, uuid, text) to authenticated;
grant execute on function public.unassign_staff_from_client(uuid, uuid) to authenticated;
grant execute on function public.assign_staff_to_project(uuid, uuid, text) to authenticated;
grant execute on function public.unassign_staff_from_project(uuid, uuid) to authenticated;
grant execute on function public.update_staff_member(uuid, text, text, text, text[], boolean) to authenticated;
grant execute on function public.staff_can_access_client(uuid, text) to authenticated;

comment on table public.staff_profiles is 'Internal staff metadata. Authentication remains in auth.users. Deactivate instead of delete.';
comment on table public.staff_grants is 'Granted permission codes for a staff user. Admins bypass grants via is_admin().';
comment on table public.staff_invitations is 'Hashed staff invite tokens. Raw tokens never stored.';

-- ---------------------------------------------------------------------------
-- Client invitation accept: staff cannot become clients
-- ---------------------------------------------------------------------------

create or replace function public.accept_client_invitation(p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  hashed text;
  inv public.client_invitations;
  user_email text;
  target public.profiles;
begin
  if uid is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if p_token is null or length(trim(p_token)) < 32 then
    raise exception 'INVALID_INVITE' using errcode = 'P0001';
  end if;

  hashed := public.hash_invitation_token(p_token);

  select * into inv
  from public.client_invitations
  where token_hash = hashed
  for update;

  if not found then
    raise exception 'INVALID_INVITE' using errcode = 'P0001';
  end if;

  if inv.status = 'accepted' then
    raise exception 'ALREADY_ACCEPTED' using errcode = 'P0001';
  end if;
  if inv.status = 'revoked' then
    raise exception 'REVOKED_INVITE' using errcode = 'P0001';
  end if;
  if inv.status = 'expired' or inv.expires_at <= now() then
    if inv.status = 'pending' then
      update public.client_invitations set status = 'expired' where id = inv.id;
    end if;
    raise exception 'EXPIRED_INVITE' using errcode = 'P0001';
  end if;
  if inv.status <> 'pending' then
    raise exception 'INVALID_INVITE' using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.clients where id = inv.client_id) then
    raise exception 'INVALID_INVITE' using errcode = 'P0001';
  end if;

  select lower(trim(coalesce(email, ''))) into user_email
  from auth.users
  where id = uid;

  if user_email is null or user_email = '' or user_email is distinct from inv.email then
    raise exception 'EMAIL_MISMATCH' using errcode = 'P0001';
  end if;

  select * into target from public.profiles where id = uid for update;
  if not found then
    insert into public.profiles (id, email, full_name, role, client_id)
    values (uid, user_email, coalesce(nullif(inv.invitee_name, ''), ''), 'client', null)
    returning * into target;
  end if;

  if target.role in ('admin', 'staff') then
    raise exception 'IS_ADMIN' using errcode = 'P0001';
  end if;

  if target.client_id is not null and target.client_id is distinct from inv.client_id then
    raise exception 'ALREADY_LINKED' using errcode = 'P0001';
  end if;

  update public.profiles
    set role = 'client',
        client_id = inv.client_id,
        email = coalesce(nullif(trim(email), ''), user_email),
        full_name = case
          when length(trim(full_name)) > 0 then full_name
          else coalesce(nullif(inv.invitee_name, ''), full_name)
        end
  where id = uid;

  update public.client_invitations
    set status = 'accepted',
        accepted_at = now()
  where id = inv.id;

  perform public.append_client_staff_activity(inv.client_id, 'Client portal invitation accepted');
end;
$$;

-- Direct table updates from the browser cannot change role or client_id.
-- SECURITY DEFINER RPCs owned by postgres / supabase_admin still can.
create or replace function public.profiles_protect_privileged_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and (
       new.role is distinct from old.role
       or new.client_id is distinct from old.client_id
     )
     and current_user in ('authenticated', 'anon', 'service_role') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_privileged_columns on public.profiles;
create trigger profiles_protect_privileged_columns
  before update of role, client_id
  on public.profiles
  for each row execute function public.profiles_protect_privileged_columns();

create or replace function public.leads_assigned_to_staff_only()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.assigned_to is not null and not exists (
    select 1 from public.profiles p
    where p.id = new.assigned_to and p.role in ('admin', 'staff')
  ) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists leads_assigned_to_staff_only on public.leads;
create trigger leads_assigned_to_staff_only
  before insert or update of assigned_to
  on public.leads
  for each row execute function public.leads_assigned_to_staff_only();

comment on function public.accept_staff_invitation(text) is
  'Accepts a hashed staff invitation. Linked client accounts are rejected. Role comes from the invitation template, not from the browser.';
comment on function public.current_staff_context() is
  'Returns is_active, job_title, template_key, and permission codes for auth.uid(). Admins receive the full catalog.';

-- Demo Auth users are not inserted here. Invite staff from /admin/team after go-live.


