-- MotiveScripts Phase 14 — client invitations
-- Invitation TTL is 7 days (public.invitation_ttl_interval()).
-- Raw tokens are never stored; only SHA-256 hex hashes.

create extension if not exists pgcrypto with schema extensions;

create or replace function public.invitation_ttl_interval()
returns interval
language sql
immutable
as $$
  select interval '7 days';
$$;

create table public.client_invitations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete restrict,
  email text not null,
  invitee_name text not null default '',
  token_hash text not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'expired', 'revoked')),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  revoked_at timestamptz,
  constraint client_invitations_email_not_blank check (length(trim(email)) > 0),
  constraint client_invitations_email_format check (email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  constraint client_invitations_token_hash_shape check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint client_invitations_accepted_needs_time check (status <> 'accepted' or accepted_at is not null),
  constraint client_invitations_revoked_needs_time check (status <> 'revoked' or revoked_at is not null)
);

create unique index client_invitations_token_hash_uidx on public.client_invitations (token_hash);
create unique index client_invitations_one_pending
  on public.client_invitations (client_id, email)
  where status = 'pending';
create index client_invitations_client_id_idx on public.client_invitations (client_id);
create index client_invitations_email_idx on public.client_invitations (email);
create index client_invitations_status_idx on public.client_invitations (status);
create index client_invitations_expires_at_idx on public.client_invitations (expires_at);
create index client_invitations_created_at_idx on public.client_invitations (created_at desc);

comment on table public.client_invitations is 'Portal invites. token_hash is SHA-256 hex of the secret URL token.';
comment on column public.client_invitations.token_hash is 'SHA-256 hex. Never store the raw token.';
comment on function public.invitation_ttl_interval() is 'Change invitation lifetime in one place. Default 7 days.';

create or replace function public.hash_invitation_token(p_token text)
returns text
language sql
immutable
strict
security definer
set search_path = public, extensions
as $$
  select encode(digest(convert_to(trim(p_token), 'UTF8'), 'sha256'), 'hex');
$$;

create or replace function public.normalize_invite_email(p_email text)
returns text
language sql
immutable
as $$
  select lower(trim(coalesce(p_email, '')));
$$;

create or replace function public.client_invitations_normalize_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.email := public.normalize_invite_email(new.email);
  new.invitee_name := trim(coalesce(new.invitee_name, ''));
  new.token_hash := lower(trim(new.token_hash));
  return new;
end;
$$;

drop trigger if exists client_invitations_normalize_email on public.client_invitations;
create trigger client_invitations_normalize_email
  before insert or update of email, invitee_name, token_hash
  on public.client_invitations
  for each row execute function public.client_invitations_normalize_email();

create or replace function public.invitation_effective_status(p_status text, p_expires_at timestamptz)
returns text
language sql
stable
as $$
  select case
    when p_status in ('accepted', 'revoked', 'expired') then p_status
    when p_expires_at <= now() then 'expired'
    else p_status
  end;
$$;

create or replace function public.append_client_staff_activity(p_client_id uuid, p_description text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.client_staff_data (client_id, activity)
  values (
    p_client_id,
    jsonb_build_array(
      jsonb_build_object(
        'id', 'cact-' || replace(gen_random_uuid()::text, '-', ''),
        'description', p_description,
        'createdAt', now(),
        'icon', 'status'
      )
    )
  )
  on conflict (client_id) do update
    set activity =
      jsonb_build_array(
        jsonb_build_object(
          'id', 'cact-' || replace(gen_random_uuid()::text, '-', ''),
          'description', p_description,
          'createdAt', now(),
          'icon', 'status'
        )
      ) || coalesce(public.client_staff_data.activity, '[]'::jsonb);
end;
$$;

create or replace function public.preview_client_invitation(p_token text)
returns table (state text, company_name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  hashed text;
  inv public.client_invitations;
  effective text;
  company text;
begin
  if p_token is null or length(trim(p_token)) < 32 then
    return query select 'invalid'::text, null::text;
    return;
  end if;

  hashed := public.hash_invitation_token(p_token);

  select * into inv
  from public.client_invitations
  where token_hash = hashed;

  if not found then
    return query select 'invalid'::text, null::text;
    return;
  end if;

  effective := public.invitation_effective_status(inv.status, inv.expires_at);

  if effective = 'pending' then
    select c.business_name into company from public.clients c where c.id = inv.client_id;
    return query select 'valid'::text, company;
    return;
  end if;

  return query select effective, null::text;
end;
$$;

create or replace function public.invitation_email_matches(p_token text, p_email text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  hashed text;
  inv public.client_invitations;
begin
  if p_token is null or length(trim(p_token)) < 32 then
    return false;
  end if;

  hashed := public.hash_invitation_token(p_token);

  select * into inv
  from public.client_invitations
  where token_hash = hashed;

  if not found then
    return false;
  end if;

  if public.invitation_effective_status(inv.status, inv.expires_at) <> 'pending' then
    return false;
  end if;

  return public.normalize_invite_email(p_email) = inv.email;
end;
$$;

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

  if target.role = 'admin' then
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

alter table public.client_invitations enable row level security;

revoke all on table public.client_invitations from anon, authenticated, public;
grant select on table public.client_invitations to authenticated;

drop policy if exists client_invitations_admin_select on public.client_invitations;
create policy client_invitations_admin_select
  on public.client_invitations
  for select
  to authenticated
  using (public.is_admin());

comment on function public.invitation_email_matches(text, text) is
  'Returns true only when the token is a pending unexpired invite and the email matches. Does not reveal the invited address.';

revoke all on function public.invitation_ttl_interval() from public, anon;
revoke all on function public.hash_invitation_token(text) from public, anon, authenticated;
revoke all on function public.normalize_invite_email(text) from public, anon;
revoke all on function public.invitation_effective_status(text, timestamptz) from public, anon;
revoke all on function public.append_client_staff_activity(uuid, text) from public, anon, authenticated;
revoke all on function public.preview_client_invitation(text) from public;
revoke all on function public.accept_client_invitation(text) from public, anon;
revoke all on function public.invitation_email_matches(text, text) from public;

grant execute on function public.preview_client_invitation(text) to anon, authenticated;
grant execute on function public.accept_client_invitation(text) to authenticated;
grant execute on function public.invitation_email_matches(text, text) to anon, authenticated;
grant execute on function public.invitation_ttl_interval() to authenticated;
grant execute on function public.normalize_invite_email(text) to authenticated;
grant execute on function public.invitation_effective_status(text, timestamptz) to authenticated;
grant execute on function public.append_client_staff_activity(uuid, text) to service_role;
