-- Project-scoped client messaging for production staff.
-- Keeps the existing conversations/messages system. Does not add a second chat.

-- Developer / Designer / Content Writer: assigned project threads only.
-- Team Member: no client messaging.
-- Admin / PM / Sales / generic staff: existing client-assignment messaging.

create or replace function public.is_production_communicator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.staff_profiles s
    where s.user_id = auth.uid()
      and s.is_active
      and s.template_key in ('developer', 'designer', 'content_writer')
  );
$$;

create or replace function public.is_office_messaging_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.staff_profiles s
    where s.user_id = auth.uid()
      and s.is_active
      and s.template_key not in ('developer', 'designer', 'content_writer', 'team_member')
  );
$$;

create or replace function public.assigned_to_project_directly(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_project_id is not null
    and exists (
      select 1
      from public.project_staff_assignments a
      where a.user_id = auth.uid()
        and a.project_id = p_project_id
    );
$$;

create or replace function public.staff_may_conversation(p_conversation_id uuid, p_perm text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_grant(p_perm)
    and exists (
      select 1
      from public.conversations c
      where c.id = p_conversation_id
        and (
          public.is_admin()
          or (
            public.is_production_communicator()
            and public.assigned_to_project_directly(c.project_id)
          )
          or (
            public.is_office_messaging_staff()
            and public.assigned_to_client(c.client_id)
          )
        )
    );
$$;

revoke all on function public.is_production_communicator() from public, anon;
revoke all on function public.is_office_messaging_staff() from public, anon;
revoke all on function public.assigned_to_project_directly(uuid) from public, anon;
revoke all on function public.staff_may_conversation(uuid, text) from public, anon;

grant execute on function public.is_production_communicator() to authenticated;
grant execute on function public.is_office_messaging_staff() to authenticated;
grant execute on function public.assigned_to_project_directly(uuid) to authenticated;
grant execute on function public.staff_may_conversation(uuid, text) to authenticated;

delete from public.staff_template_permissions
where template_key = 'team_member'
  and permission_code in ('messages.view', 'messages.manage');

delete from public.staff_grants g
using public.staff_profiles s
where g.user_id = s.user_id
  and s.template_key = 'team_member'
  and g.permission_code in ('messages.view', 'messages.manage');

-- Attach a project when the client has exactly one, so production staff can see
-- existing client-started threads without a second messaging system.
update public.conversations c
set project_id = p.id
from public.projects p
where c.project_id is null
  and c.client_id = p.client_id
  and not exists (
    select 1
    from public.projects other
    where other.client_id = p.client_id
      and other.id <> p.id
  );

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
  project_id uuid := p_project_id;
begin
  if auth.uid() is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if length(subject_text) = 0 or length(body_text) = 0 then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  if public.is_client() then
    owned := public.current_client_id();
  elsif public.is_production_communicator() then
    if not public.has_grant('messages.manage') then
      raise exception 'Not allowed' using errcode = '42501';
    end if;
    if project_id is null then
      raise exception 'Not allowed' using errcode = '42501';
    end if;
    if not public.assigned_to_project_directly(project_id) then
      raise exception 'Not allowed' using errcode = '42501';
    end if;
    select pr.client_id into owned from public.projects pr where pr.id = project_id;
    if owned is null then
      raise exception 'Not allowed' using errcode = '42501';
    end if;
  elsif public.is_admin() or public.has_grant('messages.manage') then
    if p_client_id is null then
      raise exception 'Not allowed' using errcode = '42501';
    end if;
    perform public.assert_client_perm(p_client_id, 'messages.manage');
    owned := p_client_id;
    if not exists (select 1 from public.clients where id = owned) then
      raise exception 'Not allowed' using errcode = '42501';
    end if;
  else
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  if project_id is null then
    if (select count(*) from public.projects where client_id = owned) = 1 then
      select id into project_id from public.projects where client_id = owned;
    end if;
  end if;

  if project_id is not null and not exists (
    select 1 from public.projects where id = project_id and client_id = owned
  ) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  insert into public.conversations (client_id, project_id, subject, created_by, status)
  values (owned, project_id, subject_text, auth.uid(), 'open')
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
     and not public.staff_may_conversation(conv.id, 'messages.manage') then
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
     and not public.staff_may_conversation(conv.id, 'messages.view') then
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
  if not public.is_admin() and not public.is_office_messaging_staff() then
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

drop policy if exists conversations_admin_select on public.conversations;
create policy conversations_admin_select on public.conversations
  for select to authenticated
  using (public.staff_may_conversation(id, 'messages.view'));

drop policy if exists messages_admin_select on public.messages;
create policy messages_admin_select on public.messages
  for select to authenticated
  using (public.staff_may_conversation(conversation_id, 'messages.view'));

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
          case
            when p_perm = 'messages.view' and s.template_key in ('developer', 'designer', 'content_writer') then
              p_project_id is not null
              and exists (
                select 1
                from public.project_staff_assignments a
                where a.user_id = p.id and a.project_id = p_project_id
              )
            when p_perm = 'messages.view' and s.template_key = 'team_member' then
              false
            else
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
          end
        )
      )
    )
  on conflict (user_id, message_id) do nothing;
end;
$$;
