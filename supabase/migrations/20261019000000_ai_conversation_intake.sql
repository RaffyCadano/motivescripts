-- AI intake for client messaging: when a client starts a new conversation, an AI assistant talks
-- with them first (asking clarifying questions) instead of paging a human immediately. It hands
-- the thread to a real admin/staff member once it has enough context, or after a small number of
-- exchanges, or on any error -- the client is never left waiting on the AI indefinitely.
--
-- Existing conversations are untouched: only conversations created from this migration onward
-- start in AI-active mode (see the backfill below). An admin/staff reply, or the conversation
-- being started by staff in the first place, immediately hands control to the human -- the AI only
-- ever engages before a person has entered the thread.

-- ---------------------------------------------------------------------------
-- 1. conversations: AI lifecycle state.
-- ---------------------------------------------------------------------------

alter table public.conversations
  add column ai_status text not null default 'active'
    check (ai_status in ('active', 'handed_off', 'disabled')),
  add column ai_handoff_summary text;

comment on column public.conversations.ai_status is
  '''active'' = the AI assistant is gathering info before a human joins (no admin notification/email yet). ''handed_off'' = the AI decided a human should take over (or hit its turn cap, or errored); the normal new_message notification/email has fired. ''disabled'' = a human (admin/staff) already replied, or the conversation predates this feature -- the AI never participates.';
comment on column public.conversations.ai_handoff_summary is
  'One or two sentences the AI wrote summarizing what the client needs, shown to staff at handoff. Null if handoff was forced (turn cap or error) rather than the AI choosing to hand off.';

-- Existing conversations keep today's behavior (immediate notification on every client message) --
-- only conversations created after this migration start with the AI engaging first.
update public.conversations set ai_status = 'disabled';

-- ---------------------------------------------------------------------------
-- 2. messages: a third sender_role, 'ai', for the assistant's own turns. It has no auth.users row
--    behind it (the Edge Function writes these with the service role key, not a user session), so
--    sender_user_id becomes nullable -- but only ever null for an 'ai' row.
-- ---------------------------------------------------------------------------

alter table public.messages alter column sender_user_id drop not null;

alter table public.messages drop constraint if exists messages_sender_role_check;
alter table public.messages add constraint messages_sender_role_check
  check (sender_role in ('admin', 'client', 'ai'));

alter table public.messages add constraint messages_sender_user_id_required_unless_ai
  check (sender_role = 'ai' or sender_user_id is not null);

comment on column public.messages.sender_user_id is
  'auth.users.id of a human sender. Null only for sender_role = ''ai'' -- the assistant has no user account.';

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
  if new.sender_role = 'ai' then
    -- Service-role-only path: ai-conversation-reply inserts with sender_role already set to
    -- 'ai' and no authenticated user behind the call. auth.uid() is null for a service-role
    -- request, so this branch is the only way an 'ai' row is ever accepted -- an authenticated
    -- client or staff member can never set sender_role themselves (overwritten below).
    if auth.uid() is not null then
      raise exception 'Not allowed' using errcode = '42501';
    end if;
    new.sender_user_id := null;
    new.sender_label := coalesce(nullif(trim(new.sender_label), ''), 'MotiveScripts Assistant');
    new.body := trim(new.body);
    return new;
  end if;

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

-- ---------------------------------------------------------------------------
-- 3. Dispatch: fire-and-forget call to the Edge Function, same Vault-secret + pg_net pattern as
--    run_scheduled_website_health_checks / notify_new_message_email. A hard turn cap is enforced
--    here too (not just in the Edge Function) so a bug or crash in the Edge Function before it
--    hands off can never turn into an unbounded reply loop.
-- ---------------------------------------------------------------------------

create or replace function public.dispatch_ai_conversation_reply(p_conversation_id uuid, p_message_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  ai_turn_count integer;
  base_url text;
  service_key text;
begin
  select count(*) into ai_turn_count
  from public.messages
  where conversation_id = p_conversation_id and sender_role = 'ai';

  -- Matches MAX_AI_TURNS in ai-conversation-reply/index.ts. The Edge Function should always hand
  -- off by its own turn 4; this is the backstop if it doesn't.
  if ai_turn_count >= 4 then
    perform public.conversations_ai_handoff(p_conversation_id, p_message_id, null);
    return;
  end if;

  select decrypted_secret into base_url from vault.decrypted_secrets where name = 'edge_function_base_url';
  select decrypted_secret into service_key from vault.decrypted_secrets where name = 'service_role_key';

  if base_url is null or service_key is null then
    raise notice 'dispatch_ai_conversation_reply: edge_function_base_url or service_role_key not set in Vault, skipping';
    return;
  end if;

  perform net.http_post(
    url := base_url || '/functions/v1/ai-conversation-reply',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := jsonb_build_object('conversationId', p_conversation_id, 'messageId', p_message_id)
  );
exception
  when others then
    raise warning 'dispatch_ai_conversation_reply failed for conversation %: %', p_conversation_id, sqlerrm;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Handoff: the AI (or the turn-cap backstop above, or the Edge Function's own error handling)
--    calls this to hand the conversation to a human. Fires exactly the notification + email a
--    normal client message would have fired immediately, just deferred to this moment -- reuses
--    notify_admins / notify_new_message_email unchanged rather than duplicating that logic.
-- ---------------------------------------------------------------------------

create or replace function public.conversations_ai_handoff(
  p_conversation_id uuid,
  p_message_id uuid,
  p_summary text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  conv public.conversations;
  business text;
  preview text;
begin
  -- Only the first handoff notifies -- a concurrent second call (e.g. two client messages in
  -- quick succession both dispatching before the first reply lands) is a no-op here.
  update public.conversations
    set ai_status = 'handed_off',
        ai_handoff_summary = nullif(trim(coalesce(p_summary, '')), '')
  where id = p_conversation_id and ai_status = 'active'
  returning * into conv;

  if not found then
    return;
  end if;

  select business_name into business from public.clients where id = conv.client_id;
  select left(coalesce(conv.ai_handoff_summary, m.body, ''), 80) into preview
  from public.messages m
  where m.id = p_message_id;

  perform public.notify_admins(
    'new_message',
    'New message from ' || coalesce(business, 'a client'),
    coalesce(preview, ''),
    conv.id,
    p_message_id,
    conv.project_id,
    null
  );
  perform public.notify_new_message_email(p_message_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Wire dispatch/handoff into the existing message trigger.
-- ---------------------------------------------------------------------------

create or replace function public.messages_notify_recipients()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  conv public.conversations;
  business text;
  preview text;
begin
  select * into conv from public.conversations where id = new.conversation_id;
  if not found then
    return new;
  end if;

  if new.sender_role = 'ai' then
    -- The AI's own reply: never notifies, never re-dispatches (would loop back into itself), and
    -- never touches ai_status -- that's conversations_ai_handoff's job, called explicitly by the
    -- Edge Function that just wrote this message when it decides to hand off.
    return new;
  end if;

  select business_name into business from public.clients where id = conv.client_id;
  preview := left(new.body, 80);

  if new.sender_role = 'client' then
    if conv.ai_status = 'active' then
      -- The AI is gathering more info before this reaches a human -- no admin notification or
      -- email yet (see conversations_ai_handoff for when those fire); dispatch its next reply.
      perform public.dispatch_ai_conversation_reply(conv.id, new.id);
    else
      perform public.notify_admins(
        'new_message',
        'New message from ' || coalesce(business, 'a client'),
        preview,
        conv.id,
        new.id,
        conv.project_id,
        null
      );
      perform public.notify_new_message_email(new.id);
    end if;
  else
    -- Admin/staff reply: a human is in the thread now, so the AI backs off from here even if it
    -- hadn't handed off yet (e.g. staff browsed to and answered an AI-active thread directly).
    if conv.ai_status = 'active' then
      update public.conversations set ai_status = 'disabled' where id = conv.id;
    end if;
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
    perform public.notify_new_message_email(new.id);
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Grants.
-- ---------------------------------------------------------------------------

revoke all on function public.dispatch_ai_conversation_reply(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.conversations_ai_handoff(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.conversations_ai_handoff(uuid, uuid, text) to service_role;

comment on function public.dispatch_ai_conversation_reply(uuid, uuid) is
  'Called only from messages_notify_recipients (never directly). Fire-and-forget pg_net call to ai-conversation-reply, with a 4-turn backstop that forces a handoff instead of dispatching further.';
comment on function public.conversations_ai_handoff(uuid, uuid, text) is
  'Hands an AI-active conversation to a human: sets ai_status, stores the AI''s summary, and fires the same notify_admins/notify_new_message_email a normal client message would have fired immediately. Called by dispatch_ai_conversation_reply''s backstop and by ai-conversation-reply once it decides (or is forced) to hand off.';
