-- Adds an optional per-project pay rate override on top of the existing
-- flat per-staff-member rate (staff_pay_rates). A staff member still has
-- exactly one DEFAULT hourly rate; this lets an admin set a DIFFERENT rate
-- for a specific project (e.g. a specialized/rush project pays more) without
-- changing their rate everywhere else.
--
-- Same visibility boundary as staff_pay_rates: admin sees every override,
-- a staff member sees only their own -- never a coworker's.

create table public.staff_project_pay_rates (
  staff_id uuid not null references public.staff_profiles (user_id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  pay_rate_cents bigint not null check (pay_rate_cents >= 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null,
  primary key (staff_id, project_id)
);

alter table public.staff_project_pay_rates enable row level security;

create policy staff_project_pay_rates_select on public.staff_project_pay_rates
  for select to authenticated
  using (public.is_admin() or staff_id = auth.uid());

revoke all on public.staff_project_pay_rates from public, anon;
grant select on public.staff_project_pay_rates to authenticated;
-- No INSERT/UPDATE/DELETE grants -- writes only through the RPCs below.

create or replace function public.set_staff_project_pay_rate(p_staff_id uuid, p_project_id uuid, p_pay_rate_cents bigint)
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
  if not exists (select 1 from public.staff_profiles where user_id = p_staff_id) then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.projects where id = p_project_id) then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  insert into public.staff_project_pay_rates (staff_id, project_id, pay_rate_cents, updated_by)
  values (p_staff_id, p_project_id, p_pay_rate_cents, auth.uid())
  on conflict (staff_id, project_id) do update
    set pay_rate_cents = excluded.pay_rate_cents,
        updated_at = now(),
        updated_by = auth.uid();
end;
$$;

revoke all on function public.set_staff_project_pay_rate(uuid, uuid, bigint) from public, anon;
grant execute on function public.set_staff_project_pay_rate(uuid, uuid, bigint) to authenticated;

create or replace function public.remove_staff_project_pay_rate(p_staff_id uuid, p_project_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  delete from public.staff_project_pay_rates
  where staff_id = p_staff_id and project_id = p_project_id;
end;
$$;

revoke all on function public.remove_staff_project_pay_rate(uuid, uuid) from public, anon;
grant execute on function public.remove_staff_project_pay_rate(uuid, uuid) to authenticated;

comment on table public.staff_project_pay_rates is
  'Optional per-(staff, project) hourly rate override on top of staff_pay_rates'' single default rate. Absence of a row means "use the default rate" for that project.';

-- ---------------------------------------------------------------------------
-- payroll_payments gains an optional project_id: set when a payment was run
-- scoped to one project (via mark_time_entries_paid's new p_project_id),
-- left null for a payment that settled hours across every project at the
-- staff member's default rate (unchanged behavior for existing payments and
-- callers that never pass p_project_id).
-- ---------------------------------------------------------------------------

alter table public.payroll_payments
  add column if not exists project_id uuid references public.projects (id) on delete set null;

create index if not exists payroll_payments_project_id_idx on public.payroll_payments (project_id);

-- ---------------------------------------------------------------------------
-- mark_time_entries_paid gains an optional p_project_id parameter. This is a
-- new parameter list (not a same-signature replace), so the prior 5-arg
-- version must be dropped explicitly -- otherwise PostgREST is left with two
-- overloads and "could not choose the best candidate function" errors on
-- ambiguous calls (the exact bug fixed for update_my_task_status earlier
-- this session in 20260930180000).
--
-- Behavior:
--   * p_project_id given: pays only that project's unpaid hours, at that
--     project's rate override if one exists, else the staff member's
--     default rate. The resulting payment records which project it was for.
--   * p_project_id omitted (every existing caller): pays unpaid hours across
--     every project at the default rate, EXCLUDING hours on any project that
--     has its own rate override -- those must be settled through their own
--     project-scoped call above. This is deliberate: silently blending a
--     project's special rate into a "pay everything" run at the wrong rate
--     would misstate what the staff member was actually paid for those
--     hours, which payroll_payments is explicitly designed to never do.
-- ---------------------------------------------------------------------------

drop function if exists public.mark_time_entries_paid(uuid, date, text, text, text);

create or replace function public.mark_time_entries_paid(
  p_staff_id uuid,
  p_through_date date default (timezone('utc', now()))::date,
  p_method text default 'bank_transfer',
  p_reference text default '',
  p_notes text default '',
  p_project_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  rate_cents bigint;
  total_hours numeric(10,2);
  total_amount_cents bigint;
  payment_id uuid;
  updated_count integer;
  method_norm text;
  recorder_label text;
  amount_label text;
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  method_norm := lower(trim(p_method));
  if method_norm not in ('bank_transfer', 'zelle', 'paypal', 'cash', 'check', 'other') then
    raise exception 'PAYMENT_INVALID' using errcode = 'P0001';
  end if;

  if p_project_id is not null then
    select coalesce(spr.pay_rate_cents, sr.pay_rate_cents)
      into rate_cents
    from public.staff_pay_rates sr
    left join public.staff_project_pay_rates spr
      on spr.staff_id = sr.user_id and spr.project_id = p_project_id
    where sr.user_id = p_staff_id;
  else
    select pay_rate_cents into rate_cents from public.staff_pay_rates where user_id = p_staff_id;
  end if;

  if rate_cents is null then
    raise exception 'NO_PAY_RATE' using errcode = 'P0001';
  end if;

  if p_project_id is not null then
    select coalesce(sum(hours), 0) into total_hours
    from public.time_entries
    where staff_id = p_staff_id
      and payroll_paid_at is null
      and entry_date <= p_through_date
      and project_id = p_project_id;
  else
    select coalesce(sum(te.hours), 0) into total_hours
    from public.time_entries te
    where te.staff_id = p_staff_id
      and te.payroll_paid_at is null
      and te.entry_date <= p_through_date
      and not exists (
        select 1 from public.staff_project_pay_rates spr
        where spr.staff_id = p_staff_id and spr.project_id = te.project_id
      );
  end if;

  if total_hours <= 0 then
    raise exception 'NOTHING_TO_PAY' using errcode = 'P0001';
  end if;

  total_amount_cents := round(total_hours * rate_cents);

  select coalesce(nullif(trim(full_name), ''), nullif(trim(email), ''), 'Admin')
    into recorder_label
  from public.profiles
  where id = auth.uid();

  insert into public.payroll_payments (
    staff_id, amount_cents, hours, pay_rate_cents, through_date, payment_date,
    method, reference, notes, recorded_by, recorded_by_label, project_id
  ) values (
    p_staff_id, total_amount_cents, total_hours, rate_cents, p_through_date, (timezone('utc', now()))::date,
    method_norm, coalesce(p_reference, ''), coalesce(p_notes, ''), auth.uid(), coalesce(recorder_label, 'Admin'), p_project_id
  ) returning id into payment_id;

  if p_project_id is not null then
    update public.time_entries
      set payroll_paid_at = now(),
          payroll_payment_id = payment_id
      where staff_id = p_staff_id
        and payroll_paid_at is null
        and entry_date <= p_through_date
        and project_id = p_project_id;
  else
    update public.time_entries te
      set payroll_paid_at = now(),
          payroll_payment_id = payment_id
      where te.staff_id = p_staff_id
        and te.payroll_paid_at is null
        and te.entry_date <= p_through_date
        and not exists (
          select 1 from public.staff_project_pay_rates spr
          where spr.staff_id = p_staff_id and spr.project_id = te.project_id
        );
  end if;
  get diagnostics updated_count = row_count;

  amount_label := '$' || (total_amount_cents / 100)::text || '.' || lpad((total_amount_cents % 100)::text, 2, '0');

  insert into public.notifications (user_id, type, title, body, payroll_payment_id)
  values (
    p_staff_id,
    'payroll_paid',
    'Payment recorded',
    amount_label || ' for ' || total_hours || 'h, through ' || p_through_date,
    payment_id
  );

  return jsonb_build_object(
    'payment_id', payment_id,
    'amount_cents', total_amount_cents,
    'hours', total_hours,
    'entries', updated_count,
    'project_id', p_project_id
  );
end;
$$;

revoke all on function public.mark_time_entries_paid(uuid, date, text, text, text, uuid) from public, anon;
grant execute on function public.mark_time_entries_paid(uuid, date, text, text, text, uuid) to authenticated;
