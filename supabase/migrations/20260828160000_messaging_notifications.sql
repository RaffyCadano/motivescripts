-- MotiveScripts Phase 13 — conversations, messages, in-app notifications
-- Does not drop existing tables or seed clients/projects.
-- Closed conversations: sending a message reopens the thread (status = open).
-- Mutations go through SECURITY DEFINER RPCs. Authenticated clients only SELECT.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete restrict,
  project_id uuid references public.projects (id) on delete restrict,
  subject text not null,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_by uuid references auth.users (id) on delete set null,
  last_message_preview text not null default '',
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint conversations_subject_not_blank check (length(trim(subject)) > 0),
  constraint conversations_subject_length check (char_length(subject) <= 120)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete restrict,
  sender_user_id uuid not null references auth.users (id) on delete restrict,
  sender_role text not null default 'client' check (sender_role in ('admin', 'client')),
  sender_label text not null default '',
  body text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint messages_body_not_blank check (length(trim(body)) > 0),
  constraint messages_body_length check (char_length(body) <= 4000)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (type in (
    'new_message',
    'feedback_received',
    'changes_requested',
    'version_ready_for_review',
    'version_approved',
    'project_update'
  )),
  title text not null,
  body text not null default '',
  conversation_id uuid references public.conversations (id) on delete restrict,
  message_id uuid references public.messages (id) on delete restrict,
  project_id uuid references public.projects (id) on delete restrict,
  deliverable_id uuid references public.deliverables (id) on delete restrict,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notifications_title_not_blank check (length(trim(title)) > 0)
);

alter table public.notifications
  add constraint notifications_user_message_unique unique (user_id, message_id);

create index conversations_client_id_idx on public.conversations (client_id);
create index conversations_project_id_idx on public.conversations (project_id);
create index conversations_last_message_at_idx on public.conversations (last_message_at desc);
create index conversations_updated_at_idx on public.conversations (updated_at desc);
create index messages_conversation_created_idx on public.messages (conversation_id, created_at);
create index messages_sender_user_id_idx on public.messages (sender_user_id);
create index messages_unread_idx on public.messages (conversation_id) where read_at is null;
create index notifications_user_id_idx on public.notifications (user_id);
create index notifications_created_at_idx on public.notifications (created_at desc);
create index notifications_read_at_idx on public.notifications (user_id, read_at);

comment on table public.conversations is 'Agency ↔ client threads. Owned by clients.id.';
comment on table public.messages is 'Immutable conversation history. sender_user_id is auth.users.id.';
comment on table public.notifications is 'Per-user in-app inbox. Created by triggers, not the browser.';
comment on column public.messages.sender_label is 'Display cache from profiles at send time. sender_user_id is authoritative.';

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.owns_conversation(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.conversations
    where id = p_conversation_id
      and client_id = public.current_client_id()
  );
$$;

create or replace function public.conversations_match_project()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  project_client uuid;
begin
  if tg_op = 'UPDATE' and new.client_id is distinct from old.client_id then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if new.project_id is null then
    return new;
  end if;
  select client_id into project_client from public.projects where id = new.project_id;
  if project_client is null or project_client is distinct from new.client_id then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists conversations_match_project on public.conversations;
create trigger conversations_match_project
  before insert or update of client_id, project_id
  on public.conversations
  for each row execute function public.conversations_match_project();

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
    coalesce(nullif(trim(full_name), ''), case when role = 'admin' then 'MotiveScripts' else 'Client' end)
    into profile_role, label
  from public.profiles
  where id = auth.uid();
  new.sender_role := case when profile_role = 'admin' then 'admin' else 'client' end;
  new.sender_label := coalesce(label, 'MotiveScripts');
  new.body := trim(new.body);
  return new;
end;
$$;

drop trigger if exists messages_force_sender on public.messages;
create trigger messages_force_sender
  before insert on public.messages
  for each row execute function public.messages_force_sender();

create or replace function public.conversations_touch_from_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
    set last_message_at = new.created_at,
        last_message_preview = left(new.body, 140),
        updated_at = now(),
        status = 'open'
  where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists messages_touch_conversation on public.messages;
create trigger messages_touch_conversation
  after insert on public.messages
  for each row execute function public.conversations_touch_from_message();

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
begin
  insert into public.notifications (
    user_id, type, title, body, conversation_id, message_id, project_id, deliverable_id
  )
  select
    p.id,
    p_type,
    p_title,
    coalesce(p_body, ''),
    p_conversation_id,
    p_message_id,
    p_project_id,
    p_deliverable_id
  from public.profiles p
  where p.role = 'admin'
    and p.id is distinct from auth.uid()
  on conflict (user_id, message_id) do nothing;
end;
$$;

create or replace function public.notify_client_users(
  p_client_id uuid,
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
begin
  if p_client_id is null then
    return;
  end if;
  insert into public.notifications (
    user_id, type, title, body, conversation_id, message_id, project_id, deliverable_id
  )
  select
    p.id,
    p_type,
    p_title,
    coalesce(p_body, ''),
    p_conversation_id,
    p_message_id,
    p_project_id,
    p_deliverable_id
  from public.profiles p
  where p.role = 'client'
    and p.client_id = p_client_id
    and p.id is distinct from auth.uid()
  on conflict (user_id, message_id) do nothing;
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

drop trigger if exists messages_notify_recipients on public.messages;
create trigger messages_notify_recipients
  after insert on public.messages
  for each row execute function public.messages_notify_recipients();

create or replace function public.activity_notify_recipients()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  project_client uuid;
  deliverable uuid;
begin
  select client_id into project_client from public.projects where id = new.project_id;
  deliverable := null;
  if jsonb_typeof(new.metadata) = 'object' and (new.metadata ? 'deliverable_id') then
    begin
      deliverable := (new.metadata->>'deliverable_id')::uuid;
    exception when others then
      deliverable := null;
    end;
  end if;

  if new.activity_type in ('feedback_submitted') then
    perform public.notify_admins(
      'feedback_received',
      'New feedback on a deliverable',
      left(new.message, 120),
      null, null, new.project_id, deliverable
    );
  elsif new.activity_type = 'changes_requested' then
    perform public.notify_admins(
      'changes_requested',
      'Changes requested on a deliverable',
      left(new.message, 120),
      null, null, new.project_id, deliverable
    );
  elsif new.activity_type = 'version_approved' then
    perform public.notify_admins(
      'version_approved',
      'A deliverable was approved',
      left(new.message, 120),
      null, null, new.project_id, deliverable
    );
  elsif new.activity_type = 'version_sent_for_review' then
    perform public.notify_client_users(
      project_client,
      'version_ready_for_review',
      'A file is ready for review',
      left(new.message, 120),
      null, null, new.project_id, deliverable
    );
  elsif new.activity_type = 'status_changed' then
    perform public.notify_client_users(
      project_client,
      'project_update',
      'Project updated',
      left(new.message, 120),
      null, null, new.project_id, null
    );
  end if;

  return new;
end;
$$;

drop trigger if exists activity_notify_recipients on public.activity;
create trigger activity_notify_recipients
  after insert on public.activity
  for each row execute function public.activity_notify_recipients();

create or replace function public.conversations_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists conversations_updated_at on public.conversations;
create trigger conversations_updated_at
  before update on public.conversations
  for each row execute function public.conversations_set_updated_at();

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

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

  if public.is_admin() then
    if p_client_id is null then
      raise exception 'Not allowed' using errcode = '42501';
    end if;
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

  if p_project_id is not null then
    insert into public.activity (project_id, actor_id, activity_type, message, metadata)
    values (
      p_project_id,
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
  if not public.is_admin() and not public.owns_conversation(conv.id) then
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
begin
  if auth.uid() is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if not public.is_admin() and not public.owns_conversation(p_conversation_id) then
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
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if p_status not in ('open', 'closed') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  update public.conversations
    set status = p_status
  where id = p_conversation_id
  returning * into conv;

  if not found then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

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

create or replace function public.mark_notification_read(p_notification_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.notifications
    set read_at = coalesce(read_at, now())
  where id = p_notification_id
    and user_id = auth.uid();
end;
$$;

create or replace function public.mark_all_notifications_read()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  updated integer;
begin
  update public.notifications
    set read_at = now()
  where user_id = auth.uid()
    and read_at is null;
  get diagnostics updated = row_count;
  return updated;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;

revoke all on table public.conversations, public.messages, public.notifications from anon, authenticated;
grant select on table public.conversations to authenticated;
grant select on table public.messages to authenticated;
grant select on table public.notifications to authenticated;

drop policy if exists conversations_admin_select on public.conversations;
drop policy if exists conversations_admin_insert on public.conversations;
drop policy if exists conversations_admin_update on public.conversations;
drop policy if exists conversations_select_own on public.conversations;
drop policy if exists conversations_insert_own on public.conversations;
create policy conversations_admin_select on public.conversations for select to authenticated using (public.is_admin());
create policy conversations_select_own
  on public.conversations for select to authenticated
  using (client_id = public.current_client_id());

drop policy if exists messages_admin_select on public.messages;
drop policy if exists messages_select_own on public.messages;
drop policy if exists messages_insert_own on public.messages;
create policy messages_admin_select on public.messages for select to authenticated using (public.is_admin());
create policy messages_select_own
  on public.messages for select to authenticated
  using (public.owns_conversation(conversation_id));

drop policy if exists notifications_select_own on public.notifications;
drop policy if exists notifications_update_own on public.notifications;
create policy notifications_select_own
  on public.notifications for select to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Grants + realtime
-- ---------------------------------------------------------------------------

revoke all on function public.owns_conversation(uuid) from public, anon;
revoke all on function public.notify_admins(text, text, text, uuid, uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.notify_client_users(uuid, text, text, text, uuid, uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.messages_force_sender() from public, anon, authenticated;
revoke all on function public.conversations_touch_from_message() from public, anon, authenticated;
revoke all on function public.messages_notify_recipients() from public, anon, authenticated;
revoke all on function public.activity_notify_recipients() from public, anon, authenticated;
revoke all on function public.conversations_match_project() from public, anon, authenticated;
revoke all on function public.conversations_set_updated_at() from public, anon, authenticated;
revoke all on function public.start_conversation(text, text, uuid, uuid) from public, anon;
revoke all on function public.send_message(uuid, text) from public, anon;
revoke all on function public.mark_conversation_read(uuid) from public, anon;
revoke all on function public.set_conversation_status(uuid, text) from public, anon;
revoke all on function public.mark_notification_read(uuid) from public, anon;
revoke all on function public.mark_all_notifications_read() from public, anon;

grant execute on function public.owns_conversation(uuid) to authenticated;
grant execute on function public.start_conversation(text, text, uuid, uuid) to authenticated;
grant execute on function public.send_message(uuid, text) to authenticated;
grant execute on function public.mark_conversation_read(uuid) to authenticated;
grant execute on function public.set_conversation_status(uuid, text) to authenticated;
grant execute on function public.mark_notification_read(uuid) to authenticated;
grant execute on function public.mark_all_notifications_read() to authenticated;

do $$
begin
  begin
    execute 'alter publication supabase_realtime add table public.conversations';
  exception when duplicate_object then null;
  end;
  begin
    execute 'alter publication supabase_realtime add table public.messages';
  exception when duplicate_object then null;
  end;
  begin
    execute 'alter publication supabase_realtime add table public.notifications';
  exception when duplicate_object then null;
  end;
end $$;
