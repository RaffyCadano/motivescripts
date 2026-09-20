-- Invitation recovery + accept hardening (auth/invite audit).
--
-- 1. WEDGE FIX. Both invite Edge Functions create the auth user at send time,
--    and handle_new_user() then gives that user a profile with role='client'
--    and client_id=null. The only thing that promotes the profile is
--    accept_*_invitation(token), which requires the emailed link to be used
--    end to end. An invitee who signs in any other way (the normal /login
--    page, a link opened in a different browser) is left signed in but stuck
--    on the "Finish your invitation first" dead end, with no route back.
--
--    An authenticated session whose auth email equals the invited email is the
--    same proof of mailbox control that the emailed link provides, so a
--    signed-in user may accept their OWN pending invitation by email. Match is
--    strict (lower/trim, plus-addresses are distinct), server-side expiry is
--    still enforced, and the role/grants still come only from the invitation.
--
-- 2. Accept bodies are moved into internal by-id functions so the token path
--    and the by-email path share exactly one implementation.
--
-- 3. Bugs fixed inside the shared staff accept:
--    a. An admin with no staff_profiles row (is_admin() treats them as
--       active) could be demoted by accepting a staff invite, bypassing the
--       last-admin guard. Now ALREADY_STAFF.
--    b. An explicit "no permissions" selection silently fell back to the full
--       template grants. New staff_invitations.explicit_permissions flag: an
--       invite created with an explicit list is honored exactly, even empty.
--       Existing pending invites default to false (unchanged behavior).
--
-- 4. Staff holding clients.manage could not read client_invitations (policy was
--    is_admin() only), so the client portal panel always showed "Not invited".

alter table public.staff_invitations
  add column if not exists explicit_permissions boolean not null default false;

comment on column public.staff_invitations.explicit_permissions is
  'True when the inviter chose an explicit permission list (possibly empty). False keeps the legacy behavior: an empty list means "use the template defaults".';

-- ---------------------------------------------------------------------------
-- Staff accept: by-id core
-- ---------------------------------------------------------------------------

create or replace function public._accept_staff_invitation_row(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  inv public.staff_invitations;
  user_email text;
  target public.profiles;
  next_role text;
  perm_code text;
begin
  if uid is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select * into inv from public.staff_invitations where id = p_invitation_id for update;
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
  if target.role in ('admin', 'staff') and (
    exists (select 1 from public.staff_profiles s where s.user_id = uid and s.is_active)
    or (
      target.role = 'admin'
      and not exists (select 1 from public.staff_profiles s where s.user_id = uid)
    )
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
    foreach perm_code in array inv.permission_codes
    loop
      if exists (select 1 from public.staff_permission_catalog c where c.code = perm_code) then
        insert into public.staff_grants (user_id, permission_code, granted_by)
        values (uid, perm_code, inv.created_by)
        on conflict do nothing;
      end if;
    end loop;
  elsif not inv.explicit_permissions then
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

create or replace function public.accept_staff_invitation(p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  invitation_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    raise exception 'INVALID_INVITE' using errcode = 'P0001';
  end if;
  select id into invitation_id
  from public.staff_invitations
  where token_hash = public.hash_invitation_token(p_token);
  if invitation_id is null then
    raise exception 'INVALID_INVITE' using errcode = 'P0001';
  end if;
  perform public._accept_staff_invitation_row(invitation_id);
end;
$$;

comment on function public.accept_staff_invitation(text) is
  'Accepts a hashed staff invitation by token. Linked client accounts are rejected. Role comes from the invitation template, not from the browser.';

-- ---------------------------------------------------------------------------
-- Client accept: by-id core (body unchanged from 20260829200000)
-- ---------------------------------------------------------------------------

create or replace function public._accept_client_invitation_row(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  inv public.client_invitations;
  user_email text;
  target public.profiles;
begin
  if uid is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select * into inv from public.client_invitations where id = p_invitation_id for update;
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
    raise exception 'EXPIRED_INVITE' using errcode = 'P0001';
  end if;
  if inv.status <> 'pending' then
    raise exception 'INVALID_INVITE' using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.clients where id = inv.client_id) then
    raise exception 'INVALID_INVITE' using errcode = 'P0001';
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

create or replace function public.accept_client_invitation(p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  invitation_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if p_token is null or length(trim(p_token)) < 32 then
    raise exception 'INVALID_INVITE' using errcode = 'P0001';
  end if;
  select id into invitation_id
  from public.client_invitations
  where token_hash = public.hash_invitation_token(p_token);
  if invitation_id is null then
    raise exception 'INVALID_INVITE' using errcode = 'P0001';
  end if;
  perform public._accept_client_invitation_row(invitation_id);
end;
$$;

revoke all on function public._accept_staff_invitation_row(uuid) from public, anon, authenticated;
revoke all on function public._accept_client_invitation_row(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Recovery: the signed-in user's own pending invitation, by auth email.
-- ---------------------------------------------------------------------------

create or replace function public.my_pending_invitation()
returns table (invite_kind text, invite_label text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  user_email text;
begin
  if uid is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select lower(trim(coalesce(email, ''))) into user_email from auth.users where id = uid;
  if user_email is null or user_email = '' then
    return;
  end if;

  return query
  select x.k, x.l
  from (
    select 'staff'::text as k, coalesce(t.label, 'Team member')::text as l, i.created_at as made_at
    from public.staff_invitations i
    left join public.staff_templates t on t.key = i.template_key
    where i.email = user_email and i.status = 'pending' and i.expires_at > now()
    union all
    select 'client'::text, c.business_name::text, i.created_at
    from public.client_invitations i
    join public.clients c on c.id = i.client_id
    where i.email = user_email and i.status = 'pending' and i.expires_at > now()
  ) x
  order by x.made_at desc
  limit 1;
end;
$$;

create or replace function public.accept_my_pending_invitation()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  user_email text;
  found_kind text;
  found_id uuid;
begin
  if uid is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select lower(trim(coalesce(email, ''))) into user_email from auth.users where id = uid;
  if user_email is null or user_email = '' then
    raise exception 'INVALID_INVITE' using errcode = 'P0001';
  end if;

  select x.k, x.id into found_kind, found_id
  from (
    select 'staff'::text as k, i.id, i.created_at as made_at
    from public.staff_invitations i
    where i.email = user_email and i.status = 'pending' and i.expires_at > now()
    union all
    select 'client'::text, i.id, i.created_at
    from public.client_invitations i
    where i.email = user_email and i.status = 'pending' and i.expires_at > now()
  ) x
  order by x.made_at desc
  limit 1;

  if found_id is null then
    raise exception 'INVALID_INVITE' using errcode = 'P0001';
  end if;

  if found_kind = 'staff' then
    perform public._accept_staff_invitation_row(found_id);
  else
    perform public._accept_client_invitation_row(found_id);
  end if;
  return found_kind;
end;
$$;

revoke all on function public.my_pending_invitation() from public, anon;
revoke all on function public.accept_my_pending_invitation() from public, anon;
grant execute on function public.my_pending_invitation() to authenticated;
grant execute on function public.accept_my_pending_invitation() to authenticated;

comment on function public.accept_my_pending_invitation() is
  'Lets a signed-in user accept their OWN newest pending staff/client invitation, matched strictly on auth.users.email. Same proof of mailbox control as the emailed link; recovers invitees who signed in through /login before finishing the invite.';

-- ---------------------------------------------------------------------------
-- Staff with clients.manage may read client_invitations for their clients.
-- token_hash stays unreadable (column-level grants from 20260829210000).
-- ---------------------------------------------------------------------------

drop policy if exists client_invitations_staff_select on public.client_invitations;
create policy client_invitations_staff_select
  on public.client_invitations for select
  to authenticated
  using (public.staff_may_client(client_id, 'clients.manage'));
