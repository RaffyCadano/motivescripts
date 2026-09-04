-- Recurring/retainer billing (Website Care, SEO retainers, hosting-as-a-service)
-- on top of the existing one-time invoice ledger. A service_plans row tracks
-- the subscription; each billing cycle creates a real invoices row through the
-- same ledger every other invoice uses -- no separate billing system.

create table public.service_plans (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  plan_type text not null check (plan_type in ('care', 'seo_retainer', 'hosting', 'custom')),
  label text not null check (length(trim(label)) > 0),
  amount_cents bigint not null check (amount_cents >= 50),
  status text not null default 'pending' check (status in ('pending', 'active', 'past_due', 'canceled')),
  stripe_customer_id text,
  stripe_subscription_id text unique,
  stripe_checkout_session_id text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  canceled_at timestamptz
);

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
    'plan_canceled'
  ));

-- Same body as the existing notify_document, extended so plan_past_due/
-- plan_canceled gate on invoices.view like every other billing notification
-- instead of falling through to the generic activity.view default.
create or replace function public.notify_document(
  p_audience text,
  p_client_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_project_id uuid default null,
  p_proposal_id uuid default null,
  p_contract_id uuid default null,
  p_invoice_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  perm text := 'activity.view';
begin
  if p_type like 'proposal%' then
    perm := 'proposals.view';
  elsif p_type like 'contract%' then
    perm := 'contracts.view';
  elsif p_type like 'invoice%' or p_type like 'payment%' or p_type like 'plan_%' then
    perm := 'invoices.view';
  end if;

  if p_audience = 'admins' then
    perform public.notify_agency(
      perm,
      p_client_id,
      p_type,
      p_title,
      p_body,
      null, null, p_project_id, null, p_proposal_id, p_contract_id, p_invoice_id
    );
  elsif p_audience = 'client' then
    if p_client_id is null then
      return;
    end if;
    insert into public.notifications (
      user_id, type, title, body, project_id, proposal_id, contract_id, invoice_id
    )
    select p.id, p_type, p_title, coalesce(p_body, ''), p_project_id, p_proposal_id, p_contract_id, p_invoice_id
    from public.profiles p
    where p.role = 'client'
      and p.client_id = p_client_id
      and p.id is distinct from auth.uid();
  end if;
end;
$$;

create index service_plans_client_idx on public.service_plans (client_id);
create index service_plans_subscription_idx on public.service_plans (stripe_subscription_id) where stripe_subscription_id is not null;

alter table public.service_plans enable row level security;

create policy service_plans_admin_select on public.service_plans for select to authenticated
  using (public.is_admin());
create policy service_plans_client_select on public.service_plans for select to authenticated
  using (public.is_client() and client_id = public.current_client_id());

revoke all on public.service_plans from public, anon;
grant select on public.service_plans to authenticated;
-- All writes go through create_service_plan or the manage-service-plan Edge
-- Function (service_role). No INSERT/UPDATE/DELETE table grants.

alter table public.invoices add column if not exists service_plan_id uuid references public.service_plans(id) on delete set null;
create index if not exists invoices_service_plan_idx on public.invoices (service_plan_id) where service_plan_id is not null;

-- Distinct idempotency key from the one-time flow's stripe_payment_intent_id /
-- stripe_checkout_session_id: a recurring charge's natural key is Stripe's own
-- invoice id (in_...), not a payment intent or checkout session id.
alter table public.payments add column if not exists stripe_invoice_id text;
create unique index if not exists payments_stripe_invoice_uidx on public.payments (stripe_invoice_id) where stripe_invoice_id is not null;

create or replace function public.create_service_plan(
  p_client_id uuid,
  p_project_id uuid,
  p_plan_type text,
  p_label text,
  p_amount_cents bigint
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  plan_id uuid;
  project_client uuid;
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if p_amount_cents is null or p_amount_cents < 50 then
    raise exception 'INVALID_AMOUNT' using errcode = 'P0001';
  end if;
  if p_plan_type not in ('care', 'seo_retainer', 'hosting', 'custom') then
    raise exception 'INVALID_PLAN_TYPE' using errcode = 'P0001';
  end if;
  if coalesce(trim(p_label), '') = '' then
    raise exception 'INVALID_LABEL' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.clients where id = p_client_id) then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if p_project_id is not null then
    select client_id into project_client from public.projects where id = p_project_id;
    if project_client is null or project_client is distinct from p_client_id then
      raise exception 'Not allowed' using errcode = '42501';
    end if;
  end if;

  insert into public.service_plans (client_id, project_id, plan_type, label, amount_cents, created_by)
  values (p_client_id, p_project_id, p_plan_type, trim(p_label), p_amount_cents, auth.uid())
  returning id into plan_id;

  perform public.record_document_activity(
    p_client_id, p_project_id, 'service_plan_created',
    trim(p_label) || ' plan created'
  );

  return plan_id;
end;
$$;
revoke all on function public.create_service_plan(uuid, uuid, text, text, bigint) from public, anon;
grant execute on function public.create_service_plan(uuid, uuid, text, text, bigint) to authenticated;

-- Called only from the stripe-webhook Edge Function (service_role) when
-- Stripe's `invoice.paid` fires for a subscription. Mirrors record_stripe_payment's
-- ledger sequence exactly (app.document_rpc, insert non-draft invoice, insert
-- items, insert payment, explicit recalc since payment inserts don't
-- auto-trigger it) -- unlike the one-time flow, which updates one existing
-- draft invoice, this creates a brand-new invoice every billing cycle, so it
-- also needs its own idempotency backstop: payments.stripe_invoice_id's unique
-- index (added above), checked up front and again via unique_violation.
create or replace function public.record_recurring_invoice_payment(
  p_service_plan_id uuid,
  p_stripe_invoice_id text,
  p_amount_cents bigint,
  p_period_start date,
  p_period_end date
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

  insert into public.invoices (
    client_id, project_id, service_plan_id, invoice_number, status,
    issue_date, due_date, currency, notes, sent_at
  ) values (
    plan.client_id, plan.project_id, plan.id, public.next_document_number('invoice'), 'sent',
    p_period_start, p_period_end, 'USD',
    plan.label || ' -- billing period ' || p_period_start || ' to ' || p_period_end,
    now()
  ) returning id into new_invoice_id;

  insert into public.invoice_items (invoice_id, description, quantity, unit_price_cents, sort_order)
  values (new_invoice_id, plan.label || ' (' || p_period_start || ' - ' || p_period_end || ')', 1, p_amount_cents, 0);

  insert into public.payments (
    invoice_id, amount_cents, currency, payment_date, payment_method, provider,
    reference, notes, recorded_by, recorded_by_label, stripe_invoice_id
  ) values (
    new_invoice_id, p_amount_cents, 'USD', p_period_end, 'stripe', 'stripe',
    'Recurring payment', 'Paid automatically via Stripe subscription.', null, 'Stripe', p_stripe_invoice_id
  );

  perform public.recalc_invoice_totals(new_invoice_id);
  select status = 'paid' into became_paid from public.invoices where id = new_invoice_id;

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
revoke all on function public.record_recurring_invoice_payment(uuid, text, bigint, date, date) from public, anon, authenticated;
grant execute on function public.record_recurring_invoice_payment(uuid, text, bigint, date, date) to service_role;

-- Webhook-only state transitions (activate on checkout completion, mark
-- past_due/canceled from subscription lifecycle events). Never called from
-- the browser -- the checkout-creation and cancel flows go through Stripe
-- itself and let these webhook-driven updates be the single source of truth
-- for status, exactly like the one-time flow never sets invoice status from
-- the client, only from record_stripe_payment.
create or replace function public.activate_service_plan(
  p_stripe_checkout_session_id text,
  p_stripe_subscription_id text,
  p_stripe_customer_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.service_plans
    set status = 'active',
        stripe_subscription_id = p_stripe_subscription_id,
        stripe_customer_id = p_stripe_customer_id
    where stripe_checkout_session_id = p_stripe_checkout_session_id
      and status = 'pending';
end;
$$;
revoke all on function public.activate_service_plan(text, text, text) from public, anon, authenticated;
grant execute on function public.activate_service_plan(text, text, text) to service_role;

create or replace function public.set_service_plan_status_by_subscription(
  p_stripe_subscription_id text,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_status not in ('active', 'past_due', 'canceled') then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;
  update public.service_plans
    set status = p_status,
        canceled_at = case when p_status = 'canceled' then now() else canceled_at end
    where stripe_subscription_id = p_stripe_subscription_id;
end;
$$;
revoke all on function public.set_service_plan_status_by_subscription(text, text) from public, anon, authenticated;
grant execute on function public.set_service_plan_status_by_subscription(text, text) to service_role;

comment on table public.service_plans is
  'Recurring billing plans (Website Care, SEO retainers, hosting-as-a-service). Each billing cycle writes a real invoice via record_recurring_invoice_payment -- same ledger as one-time invoices.';
comment on function public.record_recurring_invoice_payment(uuid, text, bigint, date, date) is
  'Creates one invoice + payment per subscription billing cycle. Idempotent on payments.stripe_invoice_id. Called only from the stripe-webhook Edge Function.';
