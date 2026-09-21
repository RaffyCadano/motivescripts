-- Recurring plan fixes found in the client-subscription audit (nothing had used recurring billing in
-- production yet, so there is no data to repair).
--
-- 1. record_recurring_invoice_payment stored the END of the billing period as the payment date. A monthly
--    charge taken on Sep 21 for Sep 21 - Oct 21 was booked as Oct 21, so revenue reports and "collected this
--    month" put recurring cash in the wrong month. It now records the date the customer actually paid
--    (p_paid_date, from Stripe's paid_at), and the paid invoice is due on its first day rather than a month
--    later.
-- 2. A plan never went back to "active" after a failed payment was later recovered, so it stayed "past_due"
--    forever. A successful recurring payment now brings a past_due plan back to active.
-- 4. The function's unique_violation handler reported "duplicate" for ANY unique clash, so an unrelated one
--    (such as an invoice-number collision) made the webhook treat a real payment as already recorded and drop
--    it. It now only does that when the payment really exists, and re-raises otherwise.
-- 3. set_service_plan_status_by_subscription changed status unconditionally, so a late or out-of-order
--    Stripe event could flip a canceled plan back to past_due. Transitions are now guarded: canceled is final,
--    past_due only follows active, and active only follows past_due. It also reports whether anything changed.

-- ---------------------------------------------------------------------------
-- 1 + 2. Real payment date, and recovery from past_due
-- ---------------------------------------------------------------------------

drop function if exists public.record_recurring_invoice_payment(uuid, text, bigint, date, date);

create or replace function public.record_recurring_invoice_payment(
  p_service_plan_id uuid,
  p_stripe_invoice_id text,
  p_amount_cents bigint,
  p_period_start date,
  p_period_end date,
  p_paid_date date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  plan public.service_plans;
  new_invoice_id uuid;
  existing_id uuid;
  became_paid boolean := false;
  paid_on date := coalesce(p_paid_date, (timezone('utc', now()))::date);
begin
  if p_stripe_invoice_id is null or length(trim(p_stripe_invoice_id)) = 0 then
    raise exception 'PAYMENT_INVALID' using errcode = 'P0001';
  end if;
  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'PAYMENT_INVALID' using errcode = 'P0001';
  end if;

  select id into existing_id from public.payments where stripe_invoice_id = p_stripe_invoice_id;
  if existing_id is not null then
    return jsonb_build_object('duplicate', true, 'invoice_id', null);
  end if;

  select * into plan from public.service_plans where id = p_service_plan_id for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  perform set_config('app.document_rpc', '1', true);

  -- Issued and due on the first day of the period it covers: it is paid in advance, so "due" a month later
  -- would be misleading. The billing period stays in the notes and the line description.
  insert into public.invoices (
    client_id, project_id, service_plan_id, invoice_number, status,
    issue_date, due_date, currency, notes, sent_at
  ) values (
    plan.client_id, plan.project_id, plan.id, public.next_document_number('invoice'), 'sent',
    p_period_start, p_period_start, 'USD',
    plan.label || ' -- billing period ' || p_period_start || ' to ' || p_period_end,
    now()
  ) returning id into new_invoice_id;

  insert into public.invoice_items (invoice_id, description, quantity, unit_price_cents, sort_order)
  values (new_invoice_id, plan.label || ' (' || p_period_start || ' - ' || p_period_end || ')', 1, p_amount_cents, 0);

  insert into public.payments (
    invoice_id, amount_cents, currency, payment_date, payment_method, provider,
    reference, notes, recorded_by, recorded_by_label, stripe_invoice_id
  ) values (
    new_invoice_id, p_amount_cents, 'USD', paid_on, 'stripe', 'stripe',
    'Recurring payment', 'Paid automatically via Stripe subscription.', null, 'Stripe', p_stripe_invoice_id
  );

  perform public.recalc_invoice_totals(new_invoice_id);
  select status = 'paid' into became_paid from public.invoices where id = new_invoice_id;

  -- A payment that goes through means the plan is current again.
  update public.service_plans set status = 'active' where id = plan.id and status = 'past_due';

  perform public.record_document_activity(
    plan.client_id, plan.project_id, 'payment_recorded',
    'Recurring payment received for ' || plan.label
  );
  perform public.notify_document(
    'client', plan.client_id, 'payment_received', 'Payment received',
    plan.label || ' payment received.', plan.project_id, null, null, new_invoice_id
  );
  perform public.notify_document(
    'admins', plan.client_id, 'payment_received', 'Payment received',
    plan.label || ' payment received.', plan.project_id, null, null, new_invoice_id
  );
  if became_paid then
    perform public.record_document_activity(
      plan.client_id, plan.project_id, 'invoice_paid',
      (select invoice_number from public.invoices where id = new_invoice_id) || ' paid'
    );
    perform public.notify_document(
      'client', plan.client_id, 'invoice_paid', 'Invoice paid',
      plan.label || ' invoice paid in full.', plan.project_id, null, null, new_invoice_id
    );
    perform public.notify_document(
      'admins', plan.client_id, 'invoice_paid', 'Invoice paid',
      plan.label || ' invoice paid in full.', plan.project_id, null, null, new_invoice_id
    );
  end if;

  return jsonb_build_object('duplicate', false, 'invoice_id', new_invoice_id, 'became_paid', became_paid);
exception
  when unique_violation then
    -- Only a payment we already recorded for this Stripe invoice is a harmless duplicate. Any other unique
    -- clash (for example an invoice-number collision) is a real failure: re-raise it so the webhook returns
    -- an error and Stripe retries, instead of reporting "duplicate" and silently dropping the payment.
    select id into existing_id from public.payments where stripe_invoice_id = p_stripe_invoice_id;
    if existing_id is not null then
      return jsonb_build_object('duplicate', true, 'invoice_id', null);
    end if;
    raise;
end;
$$;
revoke all on function public.record_recurring_invoice_payment(uuid, text, bigint, date, date, date) from public, anon, authenticated;
grant execute on function public.record_recurring_invoice_payment(uuid, text, bigint, date, date, date) to service_role;

comment on function public.record_recurring_invoice_payment(uuid, text, bigint, date, date, date) is
  'Creates one invoice + payment per subscription billing cycle, dated the day it was actually paid (p_paid_date). Brings a past_due plan back to active. Idempotent on payments.stripe_invoice_id. Called only from the stripe-webhook Edge Function.';

-- ---------------------------------------------------------------------------
-- 3. Guarded status transitions
-- ---------------------------------------------------------------------------

drop function if exists public.set_service_plan_status_by_subscription(text, text);

create or replace function public.set_service_plan_status_by_subscription(
  p_stripe_subscription_id text,
  p_status text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  changed integer;
begin
  if p_status not in ('active', 'past_due', 'canceled') then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;
  -- canceled is final. past_due only follows active, and active only follows past_due (activation from
  -- pending goes through activate_service_plan, never here). So a late or replayed Stripe event cannot
  -- resurrect a canceled plan or bounce a plan back and forth.
  update public.service_plans
    set status = p_status,
        canceled_at = case when p_status = 'canceled' then now() else canceled_at end
    where stripe_subscription_id = p_stripe_subscription_id
      and status <> p_status
      and status <> 'canceled'
      and (
        p_status = 'canceled'
        or (p_status = 'past_due' and status = 'active')
        or (p_status = 'active' and status = 'past_due')
      );
  get diagnostics changed = row_count;
  return changed > 0;
end;
$$;
revoke all on function public.set_service_plan_status_by_subscription(text, text) from public, anon, authenticated;
grant execute on function public.set_service_plan_status_by_subscription(text, text) to service_role;

comment on function public.set_service_plan_status_by_subscription(text, text) is
  'Webhook-only, guarded plan status change (canceled is final; past_due <-> active only). Returns true when a row changed.';
