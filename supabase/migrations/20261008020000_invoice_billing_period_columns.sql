-- Stores the Stripe billing-period bounds that record_recurring_invoice_payment already receives
-- (p_period_start/p_period_end) on every recurring invoice it creates, but previously only wrote
-- into free-text notes/line-item descriptions. Structured columns let the app query "what period
-- is this client's plan currently in" precisely, from data already flowing through the existing
-- invoice.paid webhook -- no new Stripe calls or webhook events needed.

alter table public.invoices
  add column if not exists period_start date,
  add column if not exists period_end date;

comment on column public.invoices.period_start is
  'For a recurring invoice (service_plan_id is set): the Stripe billing period this invoice covers. Null for one-time invoices.';
comment on column public.invoices.period_end is
  'For a recurring invoice (service_plan_id is set): the Stripe billing period this invoice covers. Null for one-time invoices.';

create index if not exists invoices_service_plan_period_idx
  on public.invoices (service_plan_id, period_end desc)
  where service_plan_id is not null;

-- Re-create record_recurring_invoice_payment (last defined in 20261002000000_recurring_plan_fixes.sql,
-- with the p_paid_date fix) to also persist period_start/period_end onto the invoice row. Everything
-- else about the function is unchanged.
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
  -- would be misleading. The billing period stays in the notes and the line description, and now also in
  -- period_start/period_end.
  insert into public.invoices (
    client_id, project_id, service_plan_id, invoice_number, status,
    issue_date, due_date, currency, notes, sent_at, period_start, period_end
  ) values (
    plan.client_id, plan.project_id, plan.id, public.next_document_number('invoice'), 'sent',
    p_period_start, p_period_start, 'USD',
    plan.label || ' -- billing period ' || p_period_start || ' to ' || p_period_end,
    now(), p_period_start, p_period_end
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
    select id into existing_id from public.payments where stripe_invoice_id = p_stripe_invoice_id;
    return jsonb_build_object('duplicate', true, 'invoice_id', null);
end;
$$;
revoke all on function public.record_recurring_invoice_payment(uuid, text, bigint, date, date, date) from public, anon, authenticated;
grant execute on function public.record_recurring_invoice_payment(uuid, text, bigint, date, date, date) to service_role;

comment on function public.record_recurring_invoice_payment(uuid, text, bigint, date, date, date) is
  'Creates one invoice + payment per subscription billing cycle, dated the day it was actually paid (p_paid_date), and records the billing period on the invoice row (period_start/period_end). Brings a past_due plan back to active. Idempotent on payments.stripe_invoice_id. Called only from the stripe-webhook Edge Function.';

-- Reads the Stripe-accurate current/most-recent billing period for a Website Care plan, for
-- "included hours used this period" (see time_entries.service_plan_id/billing_type). Falls back
-- to plan.created_at -> +1 month when no invoice has landed yet (right after checkout, before the
-- first invoice.paid webhook arrives).
create or replace function public.service_plan_current_period(p_plan_id uuid)
returns table (period_start date, period_end date)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  sp public.service_plans;
begin
  select * into sp from public.service_plans where id = p_plan_id;
  if not found then
    return;
  end if;
  -- SECURITY DEFINER bypasses RLS, so this must re-check ownership itself: a client may only read
  -- their own plan's period; staff need the same project-scoped grant care_requests/service_plans
  -- reads already require elsewhere.
  if not (
    (public.is_client() and sp.client_id = public.current_client_id())
    or (sp.project_id is not null and public.staff_may_project(sp.project_id, 'invoices.view'))
    or public.has_grant('invoices.view')
  ) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  return query
    select
      coalesce(i.period_start, (sp.created_at at time zone 'utc')::date) as period_start,
      coalesce(i.period_end, ((sp.created_at at time zone 'utc')::date + interval '1 month')::date) as period_end
    from lateral (
      select inv.period_start, inv.period_end
      from public.invoices inv
      where inv.service_plan_id = sp.id and inv.period_end is not null
      order by inv.period_end desc
      limit 1
    ) i;
end;
$$;
revoke all on function public.service_plan_current_period(uuid) from public, anon;
grant execute on function public.service_plan_current_period(uuid) to authenticated;

comment on function public.service_plan_current_period(uuid) is
  'The plan''s current (or most recent) Stripe billing period, for included-hours usage tracking. SECURITY DEFINER, so it re-checks ownership/grants itself instead of relying on RLS.';
