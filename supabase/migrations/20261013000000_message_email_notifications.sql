-- Messages currently only produce an in-app (bell) notification (messages_notify_recipients,
-- 20260829200000) -- "Basic email support" on the Website Care tiers implied real email delivery
-- that didn't exist. This adds it: a new message now also sends a real email, reusing
-- document-email (the same function invoices/proposals/contracts/payments already send through),
-- called from this trigger via pg_net the same way notify_invoices_overdue_email already calls an
-- Edge Function from SQL.

-- ---------------------------------------------------------------------------
-- 1. Recipient lookup for "a client sent a message, who on staff should hear about it" -- the
--    exact same admin/staff-matching predicate notify_agency already uses for the in-app
--    notification, factored out so document-email can ask the same question for email addresses
--    instead of duplicating (and risking drifting from) that logic in TypeScript.
-- ---------------------------------------------------------------------------

create or replace function public.agency_emails_for(p_perm text, p_client_id uuid)
returns table (email text)
language sql
stable
security definer
set search_path = public
as $$
  select distinct lower(trim(p.email))
  from public.profiles p
  left join public.staff_profiles s on s.user_id = p.id
  where p.email is not null and trim(p.email) <> '' and p.email like '%@%'
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
    );
$$;

comment on function public.agency_emails_for(text, uuid) is
  'Email addresses of the admin/staff who would receive an in-app notify_agency(p_perm, p_client_id, ...) call -- same matching predicate, factored out for document-email''s new_message kind. Service-role only.';

revoke all on function public.agency_emails_for(text, uuid) from public, anon, authenticated;
grant execute on function public.agency_emails_for(text, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 2. Fire-and-forget call to document-email, same Vault-secret pattern as
--    notify_invoices_overdue_email (20260930210000/20260930230000).
-- ---------------------------------------------------------------------------

create or replace function public.notify_new_message_email(p_message_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  base_url text;
  service_key text;
begin
  select decrypted_secret into base_url from vault.decrypted_secrets where name = 'edge_function_base_url';
  select decrypted_secret into service_key from vault.decrypted_secrets where name = 'service_role_key';

  if base_url is null or service_key is null then
    raise notice 'notify_new_message_email: edge_function_base_url or service_role_key not set in Vault, skipping';
    return;
  end if;

  perform net.http_post(
    url := base_url || '/functions/v1/document-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := jsonb_build_object('kind', 'new_message', 'id', p_message_id)
  );
exception
  when others then
    raise warning 'notify_new_message_email failed for message %: %', p_message_id, sqlerrm;
end;
$$;

revoke all on function public.notify_new_message_email(uuid) from public, anon, authenticated;

comment on function public.notify_new_message_email(uuid) is
  'Sends the new-message email via document-email''s new_message kind. Called from messages_notify_recipients for every new message, alongside the existing in-app notification.';

-- ---------------------------------------------------------------------------
-- 3. Wire it into the existing trigger -- same body as 20260829200000, plus the email call.
-- ---------------------------------------------------------------------------

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

  perform public.notify_new_message_email(new.id);

  return new;
end;
$$;
