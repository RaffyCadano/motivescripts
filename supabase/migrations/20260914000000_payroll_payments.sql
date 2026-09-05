-- Payroll payments: a real paper trail for staff pay, matching how client
-- payments already work (method, reference, notes, who recorded it) instead
-- of mark_time_entries_paid's bare timestamp flip. Also freezes the rate and
-- hours actually paid, so a later pay-rate change can't retroactively change
-- what a past payment "was for".

create table public.payroll_payments (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references auth.users (id) on delete restrict,
  amount_cents bigint not null check (amount_cents > 0),
  hours numeric(10,2) not null check (hours > 0),
  pay_rate_cents bigint not null check (pay_rate_cents >= 0),
  through_date date not null,
  payment_date date not null default (timezone('utc', now()))::date,
  method text not null check (method in ('bank_transfer', 'zelle', 'paypal', 'cash', 'check', 'other')),
  reference text not null default '',
  notes text not null default '',
  recorded_by uuid references auth.users (id) on delete set null,
  recorded_by_label text not null default '',
  created_at timestamptz not null default now()
);

create index payroll_payments_staff_id_idx on public.payroll_payments (staff_id, created_at desc);

alter table public.time_entries add column if not exists payroll_payment_id uuid references public.payroll_payments (id) on delete set null;

alter table public.payroll_payments enable row level security;

-- Same visibility boundary as staff_pay_rates: admin sees everyone, a staff
-- member sees only their own -- never a coworker's, even one they're
-- assigned alongside on a project.
create policy payroll_payments_select on public.payroll_payments
  for select to authenticated
  using (public.is_admin() or staff_id = auth.uid());

revoke all on public.payroll_payments from public, anon;
grant select on public.payroll_payments to authenticated;
-- No INSERT/UPDATE/DELETE grants -- every write goes through mark_time_entries_paid.

drop function if exists public.mark_time_entries_paid(uuid, date);

create or replace function public.mark_time_entries_paid(
  p_staff_id uuid,
  p_through_date date default (timezone('utc', now()))::date,
  p_method text default 'bank_transfer',
  p_reference text default '',
  p_notes text default ''
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
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  method_norm := lower(trim(p_method));
  if method_norm not in ('bank_transfer', 'zelle', 'paypal', 'cash', 'check', 'other') then
    raise exception 'PAYMENT_INVALID' using errcode = 'P0001';
  end if;

  select pay_rate_cents into rate_cents from public.staff_pay_rates where user_id = p_staff_id;
  if rate_cents is null then
    raise exception 'NO_PAY_RATE' using errcode = 'P0001';
  end if;

  select coalesce(sum(hours), 0) into total_hours
  from public.time_entries
  where staff_id = p_staff_id and payroll_paid_at is null and entry_date <= p_through_date;

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
    method, reference, notes, recorded_by, recorded_by_label
  ) values (
    p_staff_id, total_amount_cents, total_hours, rate_cents, p_through_date, (timezone('utc', now()))::date,
    method_norm, coalesce(p_reference, ''), coalesce(p_notes, ''), auth.uid(), coalesce(recorder_label, 'Admin')
  ) returning id into payment_id;

  update public.time_entries
    set payroll_paid_at = now(),
        payroll_payment_id = payment_id
    where staff_id = p_staff_id
      and payroll_paid_at is null
      and entry_date <= p_through_date;
  get diagnostics updated_count = row_count;

  return jsonb_build_object(
    'payment_id', payment_id,
    'amount_cents', total_amount_cents,
    'hours', total_hours,
    'entries', updated_count
  );
end;
$$;

revoke all on function public.mark_time_entries_paid(uuid, date, text, text, text) from public, anon;
grant execute on function public.mark_time_entries_paid(uuid, date, text, text, text) to authenticated;

comment on table public.payroll_payments is
  'One row per payroll payment run for one staff member. Amount/hours/rate are frozen at payment time -- a later staff_pay_rates change never rewrites history.';
comment on function public.mark_time_entries_paid(uuid, date, text, text, text) is
  'Admin only. Pays out all of a staff member''s unpaid hours through a date at their current rate, recording a real payroll_payments row (method/reference/notes), not just a timestamp flip.';
