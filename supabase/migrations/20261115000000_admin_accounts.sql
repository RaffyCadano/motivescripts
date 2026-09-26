-- Admin: see every account and delete one.
--
-- Until now an account could only be removed by purging the whole workspace. This adds:
--   * admin_list_accounts()      every login (client, staff, admin) with when it was created and last used,
--                                and whether a client has an active Website Care plan;
--   * admin_delete_account()     deletes one login (its profile, sessions, notifications and settings go with
--                                it) after the admin types the account's email to confirm.
-- Guards: admins only; you cannot delete yourself; the last active admin cannot be deleted; a client whose
-- Website Care plan is still active or past due cannot be deleted (cancel the plan first); an account that
-- other records still depend on is left alone (deactivate it instead). Every deletion is written to
-- account_deletions, which admins can read.
--
-- Deleting a login does not delete the client's business record, projects or files, and does not take a
-- website offline: that is a separate action on the project (Pause / take down website).

create table if not exists public.account_deletions (
  id uuid primary key default gen_random_uuid(),
  deleted_user_id uuid not null,
  email text not null,
  full_name text,
  role text,
  client_id uuid,
  business_name text,
  deleted_by uuid references auth.users (id) on delete set null,
  deleted_by_email text,
  created_at timestamptz not null default now()
);

comment on table public.account_deletions is
  'A record of every account deleted with admin_delete_account(): who it was, and which admin deleted it.';

create index if not exists account_deletions_created_idx on public.account_deletions (created_at desc);

alter table public.account_deletions enable row level security;
revoke all on table public.account_deletions from public, anon;
grant select on table public.account_deletions to authenticated;
grant select, insert on table public.account_deletions to service_role;

drop policy if exists account_deletions_select_admin on public.account_deletions;
create policy account_deletions_select_admin on public.account_deletions
  for select to authenticated using (public.is_admin());

create or replace function public.admin_list_accounts()
returns table (
  user_id uuid,
  email text,
  full_name text,
  role text,
  template_key text,
  is_active boolean,
  client_id uuid,
  business_name text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  has_active_plan boolean,
  is_self boolean
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return query
    select p.id,
           p.email,
           p.full_name,
           p.role,
           s.template_key,
           coalesce(s.is_active, true),
           p.client_id,
           c.business_name,
           u.created_at,
           u.last_sign_in_at,
           coalesce(exists (
             select 1 from public.service_plans sp
             where sp.client_id = p.client_id and sp.status in ('active', 'past_due')
           ), false),
           p.id = auth.uid()
    from public.profiles p
    join auth.users u on u.id = p.id
    left join public.staff_profiles s on s.user_id = p.id
    left join public.clients c on c.id = p.client_id
    order by u.created_at desc;
end;
$$;

create or replace function public.admin_delete_account(p_user_id uuid, p_confirmation text)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target record;
  other_admins integer;
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select p.id, p.email, p.full_name, p.role, p.client_id, c.business_name
    into target
    from public.profiles p
    left join public.clients c on c.id = p.client_id
    where p.id = p_user_id;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'CANNOT_DELETE_SELF' using errcode = 'P0001';
  end if;
  if lower(trim(coalesce(p_confirmation, ''))) is distinct from lower(trim(coalesce(target.email, ''))) then
    raise exception 'CONFIRMATION_REQUIRED' using errcode = 'P0001';
  end if;

  if target.role = 'admin' then
    select count(*) into other_admins
      from public.profiles p
      left join public.staff_profiles s on s.user_id = p.id
      where p.role = 'admin' and p.id <> p_user_id and coalesce(s.is_active, true);
    if other_admins = 0 then
      raise exception 'LAST_ADMIN' using errcode = 'P0001';
    end if;
  end if;

  if target.role = 'client' and target.client_id is not null and exists (
    select 1 from public.service_plans sp
    where sp.client_id = target.client_id and sp.status in ('active', 'past_due')
  ) then
    raise exception 'ACTIVE_PLAN' using errcode = 'P0001';
  end if;

  insert into public.account_deletions (deleted_user_id, email, full_name, role, client_id, business_name, deleted_by, deleted_by_email)
  values (
    target.id, coalesce(target.email, ''), target.full_name, target.role, target.client_id, target.business_name,
    auth.uid(), (select email from public.profiles where id = auth.uid())
  );

  begin
    delete from auth.users where id = p_user_id;
  exception when foreign_key_violation then
    raise exception 'HAS_RECORDS' using errcode = 'P0001';
  end;
end;
$$;

revoke all on function public.admin_list_accounts() from public, anon;
revoke all on function public.admin_delete_account(uuid, text) from public, anon;
grant execute on function public.admin_list_accounts() to authenticated;
grant execute on function public.admin_delete_account(uuid, text) to authenticated;

comment on function public.admin_list_accounts() is 'Admin only: every login with created / last sign-in and whether a client has an active Care plan.';
comment on function public.admin_delete_account(uuid, text) is
  'Admin only: deletes one login after the account''s email is typed to confirm. Refuses yourself, the last admin, a client with an active Care plan, and accounts other records depend on. Recorded in account_deletions.';
