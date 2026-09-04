-- Staff pay rates and payroll settlement (what the agency owes each staff
-- member, as opposed to what the agency bills the client -- see
-- time-tracking.md for the client-billing side).
--
-- Kept in a table separate from staff_profiles: staff_profiles_select
-- (20260901150000_staff_directory_select.sql) already lets a staff member
-- read any coworker's row they share a client/project assignment with, so
-- putting compensation data there would leak it to coworkers immediately.
-- This table has its own, much tighter policy: admin sees every rate, a
-- staff member sees only their own, nobody else sees any of it -- no
-- assignment-based sharing at all.

create table public.staff_pay_rates (
  user_id uuid primary key references public.staff_profiles(user_id) on delete cascade,
  pay_rate_cents bigint not null check (pay_rate_cents >= 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

alter table public.staff_pay_rates enable row level security;

create policy staff_pay_rates_select on public.staff_pay_rates
  for select to authenticated
  using (public.is_admin() or user_id = auth.uid());

revoke all on public.staff_pay_rates from public, anon;
grant select on public.staff_pay_rates to authenticated;

-- Writes only through this RPC (admin-only) -- no INSERT/UPDATE table grants,
-- so a staff member can never set even their own rate.
create or replace function public.set_staff_pay_rate(p_user_id uuid, p_pay_rate_cents bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if p_pay_rate_cents < 0 then
    raise exception 'INVALID_RATE' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.staff_profiles where user_id = p_user_id) then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  insert into public.staff_pay_rates (user_id, pay_rate_cents, updated_by)
  values (p_user_id, p_pay_rate_cents, auth.uid())
  on conflict (user_id) do update
    set pay_rate_cents = excluded.pay_rate_cents,
        updated_at = now(),
        updated_by = auth.uid();
end;
$$;

revoke all on function public.set_staff_pay_rate(uuid, bigint) from public, anon;
grant execute on function public.set_staff_pay_rate(uuid, bigint) to authenticated;

-- Payroll settlement is a second, independent dimension on time_entries,
-- separate from billed_at/invoice_id (which track client billing -- see
-- 20260905020000_time_entries.sql). A project can be billed to the client
-- before or after the staff member is paid for the same hours; the two
-- never need to move together.
alter table public.time_entries add column if not exists payroll_paid_at timestamptz;

drop policy if exists time_entries_update on public.time_entries;
create policy time_entries_update on public.time_entries
  for update to authenticated
  using (public.is_admin() or (staff_id = auth.uid() and billed_at is null and payroll_paid_at is null))
  with check (public.is_admin() or (staff_id = auth.uid() and billed_at is null and payroll_paid_at is null));

drop policy if exists time_entries_delete on public.time_entries;
create policy time_entries_delete on public.time_entries
  for delete to authenticated
  using (public.is_admin() or (staff_id = auth.uid() and billed_at is null and payroll_paid_at is null));

create or replace function public.mark_time_entries_paid(
  p_staff_id uuid,
  p_through_date date default (timezone('utc', now()))::date
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  updated integer;
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  update public.time_entries
    set payroll_paid_at = now()
    where staff_id = p_staff_id
      and payroll_paid_at is null
      and entry_date <= p_through_date;

  get diagnostics updated = row_count;
  return updated;
end;
$$;

revoke all on function public.mark_time_entries_paid(uuid, date) from public, anon;
grant execute on function public.mark_time_entries_paid(uuid, date) to authenticated;
