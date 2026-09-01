-- Staff invites copy permission codes into staff_grants. A loop variable named
-- `code` clashes with staff_permission_catalog.code and abort accept.

drop function if exists public._tmp_staff_invite_probe();

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
  perm_code text;
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
    foreach perm_code in array inv.permission_codes
    loop
      if exists (select 1 from public.staff_permission_catalog c where c.code = perm_code) then
        insert into public.staff_grants (user_id, permission_code, granted_by)
        values (uid, perm_code, inv.created_by)
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
  perm_code text;
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
    foreach perm_code in array p_permission_codes
    loop
      if exists (select 1 from public.staff_permission_catalog c where c.code = perm_code) then
        insert into public.staff_grants (user_id, permission_code, granted_by)
        values (p_user_id, perm_code, auth.uid())
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

comment on function public.accept_staff_invitation(text) is
  'Accepts a hashed staff invitation. Linked client accounts are rejected. Role comes from the invitation template, not from the browser.';
