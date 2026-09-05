-- Two payroll gaps found in the same audit pass as WIP limits/deadline
-- reminders: (1) mark_time_entries_paid never told the staff member they'd
-- been paid -- every other money-adjacent event in this app notifies someone,
-- this one was silent; (2) the payment method selector offers Zelle/PayPal
-- but nothing in the schema stores the staff member's Zelle contact or
-- PayPal email, so the admin has to already know it from outside the app
-- every single time.

alter table public.staff_pay_rates add column if not exists zelle_contact text;
alter table public.staff_pay_rates add column if not exists paypal_email text;

alter table public.notifications
  add column if not exists payroll_payment_id uuid references public.payroll_payments (id) on delete cascade;

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check check (type in (
    'new_message',
    'feedback_received',
    'changes_requested',
    'version_ready_for_review',
    'version_approved',
    'project_update',
    'proposal_ready',
    'proposal_viewed',
    'proposal_accepted',
    'proposal_declined',
    'contract_ready',
    'contract_viewed',
    'contract_accepted',
    'contract_declined',
    'invoice_ready',
    'invoice_viewed',
    'payment_recorded',
    'payment_received',
    'invoice_paid',
    'invoice_overdue',
    'task_assigned',
    'task_status_changed',
    'project_assigned',
    'milestone_updated',
    'task_info_requested',
    'task_response_submitted',
    'plan_past_due',
    'plan_canceled',
    'task_comment_added',
    'task_due_soon',
    'task_overdue',
    'payroll_paid'
  ));

-- Widen set_staff_pay_rate to also record payout contact details. Dropped
-- first since appending parameters changes the signature -- without the
-- drop, Postgres would keep the old 2-arg version around as a separate
-- overload instead of replacing it.
drop function if exists public.set_staff_pay_rate(uuid, bigint);

create or replace function public.set_staff_pay_rate(
  p_user_id uuid,
  p_pay_rate_cents bigint,
  p_zelle_contact text default null,
  p_paypal_email text default null
)
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

  insert into public.staff_pay_rates (user_id, pay_rate_cents, zelle_contact, paypal_email, updated_by)
  values (p_user_id, p_pay_rate_cents, nullif(trim(coalesce(p_zelle_contact, '')), ''), nullif(trim(coalesce(p_paypal_email, '')), ''), auth.uid())
  on conflict (user_id) do update
    set pay_rate_cents = excluded.pay_rate_cents,
        zelle_contact = excluded.zelle_contact,
        paypal_email = excluded.paypal_email,
        updated_at = now(),
        updated_by = auth.uid();
end;
$$;

revoke all on function public.set_staff_pay_rate(uuid, bigint, text, text) from public, anon;
grant execute on function public.set_staff_pay_rate(uuid, bigint, text, text) to authenticated;

-- Widen mark_time_entries_paid to notify the staff member once the payment
-- is recorded. Dropped for the same signature reason as above, even though
-- the argument list itself doesn't change here -- CREATE OR REPLACE would
-- have worked as-is, but keeping the explicit drop makes the "this replaces
-- the prior version, not layers alongside it" intent unambiguous.
drop function if exists public.mark_time_entries_paid(uuid, date, text, text, text);

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
  amount_label text;
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
    'entries', updated_count
  );
end;
$$;

revoke all on function public.mark_time_entries_paid(uuid, date, text, text, text) from public, anon;
grant execute on function public.mark_time_entries_paid(uuid, date, text, text, text) to authenticated;

comment on function public.set_staff_pay_rate(uuid, bigint, text, text) is
  'Admin only. Upserts a staff member''s hourly pay rate plus optional Zelle contact / PayPal email for payouts.';
comment on function public.mark_time_entries_paid(uuid, date, text, text, text) is
  'Admin only. Pays out all of a staff member''s unpaid hours through a date at their current rate, recording a payroll_payments row and notifying the staff member (payroll_paid).';
