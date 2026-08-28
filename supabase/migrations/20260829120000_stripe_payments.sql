-- MotiveScripts Phase 17 — Stripe Checkout on the Phase 16 invoice ledger
-- Do not edit previous migrations. Integer cents. No processor keys in this file.

-- ---------------------------------------------------------------------------
-- payments: provider + Stripe identifiers (same ledger as manual payments)
-- ---------------------------------------------------------------------------

alter table public.payments
  add column if not exists provider text not null default 'manual',
  add column if not exists stripe_checkout_session_id text,
  add column if not exists stripe_payment_intent_id text,
  add column if not exists stripe_event_id text;

alter table public.payments drop constraint if exists payments_payment_method_check;
alter table public.payments
  add constraint payments_payment_method_check
  check (payment_method in ('bank_transfer', 'cash', 'check', 'other', 'stripe'));

alter table public.payments drop constraint if exists payments_provider_check;
alter table public.payments
  add constraint payments_provider_check
  check (provider in ('manual', 'stripe'));

alter table public.payments drop constraint if exists payments_provider_matches;
alter table public.payments
  add constraint payments_provider_matches check (
    (payment_method = 'stripe' and provider = 'stripe')
    or (payment_method <> 'stripe' and provider = 'manual')
  );

create unique index if not exists payments_stripe_pi_uidx
  on public.payments (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

create unique index if not exists payments_stripe_cs_uidx
  on public.payments (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

comment on column public.payments.provider is 'manual (admin-recorded) or stripe (Checkout webhook).';
comment on column public.payments.stripe_payment_intent_id is 'Idempotency key for Stripe charges. Unique when set.';

-- ---------------------------------------------------------------------------
-- Checkout sessions (pending until webhook confirms)
-- ---------------------------------------------------------------------------

create table if not exists public.stripe_checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete restrict,
  client_id uuid not null references public.clients (id) on delete restrict,
  created_by uuid references auth.users (id) on delete set null,
  stripe_checkout_session_id text not null,
  stripe_payment_intent_id text,
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'open' check (status in ('open', 'completed', 'expired', 'cancelled')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create unique index if not exists stripe_checkout_sessions_session_uidx
  on public.stripe_checkout_sessions (stripe_checkout_session_id);
create index if not exists stripe_checkout_sessions_invoice_idx
  on public.stripe_checkout_sessions (invoice_id, created_at desc);

comment on table public.stripe_checkout_sessions is 'Pending Stripe Checkout Sessions. Confirmed payments live in public.payments.';

-- ---------------------------------------------------------------------------
-- One Stripe Customer per agency client (server-side only)
-- ---------------------------------------------------------------------------

create table if not exists public.client_stripe_customers (
  client_id uuid primary key references public.clients (id) on delete restrict,
  stripe_customer_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists client_stripe_customers_stripe_uidx
  on public.client_stripe_customers (stripe_customer_id);

-- ---------------------------------------------------------------------------
-- Processed Stripe event ids (webhook retries)
-- ---------------------------------------------------------------------------

create table if not exists public.stripe_processed_events (
  event_id text primary key,
  event_type text not null,
  invoice_id uuid references public.invoices (id) on delete set null,
  payment_id uuid references public.payments (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Notifications: payment_received (Stripe-confirmed)
-- ---------------------------------------------------------------------------

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
    'invoice_overdue'
  ));

-- ---------------------------------------------------------------------------
-- Guard: Stripe ids are immutable once set
-- ---------------------------------------------------------------------------

create or replace function public.guard_payments()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' and not public.document_rpc_active() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' then
    if not public.document_rpc_active() then
      raise exception 'Not allowed' using errcode = '42501';
    end if;
    if new.amount_cents is distinct from old.amount_cents
      or new.invoice_id is distinct from old.invoice_id
      or new.payment_date is distinct from old.payment_date
      or new.payment_method is distinct from old.payment_method
      or new.recorded_by is distinct from old.recorded_by
      or new.provider is distinct from old.provider
      or (old.stripe_payment_intent_id is not null
          and new.stripe_payment_intent_id is distinct from old.stripe_payment_intent_id)
      or (old.stripe_checkout_session_id is not null
          and new.stripe_checkout_session_id is distinct from old.stripe_checkout_session_id)
    then
      raise exception 'Not allowed' using errcode = '42501';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

-- ---------------------------------------------------------------------------
-- Authoritative Stripe payment write (service_role / webhook only)
-- ---------------------------------------------------------------------------

create or replace function public.record_stripe_payment(
  p_invoice_id uuid,
  p_amount_cents bigint,
  p_currency text,
  p_checkout_session_id text,
  p_payment_intent_id text,
  p_event_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.invoices;
  existing_id uuid;
  pid uuid;
  recorded bigint;
  became_paid boolean := false;
  sess public.stripe_checkout_sessions;
begin
  if p_payment_intent_id is null or length(trim(p_payment_intent_id)) = 0 then
    raise exception 'PAYMENT_INVALID' using errcode = 'P0001';
  end if;
  if p_checkout_session_id is null or length(trim(p_checkout_session_id)) = 0 then
    raise exception 'PAYMENT_INVALID' using errcode = 'P0001';
  end if;
  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'PAYMENT_INVALID' using errcode = 'P0001';
  end if;

  select id into existing_id
  from public.payments
  where stripe_payment_intent_id = p_payment_intent_id
     or stripe_checkout_session_id = p_checkout_session_id
  limit 1;
  if existing_id is not null then
    return jsonb_build_object(
      'payment_id', existing_id,
      'duplicate', true,
      'skipped', false,
      'became_paid', false
    );
  end if;

  select * into inv from public.invoices where id = p_invoice_id for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if inv.status in ('draft', 'cancelled') then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;

  select * into sess
  from public.stripe_checkout_sessions
  where stripe_checkout_session_id = p_checkout_session_id
  for update;
  if found then
    if sess.invoice_id is distinct from p_invoice_id
      or sess.client_id is distinct from inv.client_id
    then
      raise exception 'Not allowed' using errcode = '42501';
    end if;
  end if;

  if inv.amount_due_cents <= 0 then
    update public.stripe_checkout_sessions
      set status = 'completed',
          stripe_payment_intent_id = coalesce(stripe_payment_intent_id, p_payment_intent_id),
          completed_at = coalesce(completed_at, now())
      where stripe_checkout_session_id = p_checkout_session_id;
    return jsonb_build_object(
      'payment_id', null,
      'duplicate', false,
      'skipped', true,
      'became_paid', false
    );
  end if;

  recorded := least(p_amount_cents, inv.amount_due_cents);

  perform set_config('app.document_rpc', '1', true);
  insert into public.payments (
    invoice_id, amount_cents, currency, payment_date, payment_method, provider,
    reference, notes, recorded_by, recorded_by_label,
    stripe_checkout_session_id, stripe_payment_intent_id, stripe_event_id
  )
  values (
    inv.id, recorded, inv.currency, (timezone('utc', now()))::date,
    'stripe', 'stripe',
    'Online payment',
    case
      when recorded < p_amount_cents then 'Stripe collected more than amount due. Review in Stripe Dashboard.'
      else 'Paid online via Stripe Checkout.'
    end,
    null, 'Stripe',
    p_checkout_session_id, p_payment_intent_id, p_event_id
  )
  returning id into pid;

  perform public.recalc_invoice_totals(inv.id);
  select status = 'paid' into became_paid from public.invoices where id = inv.id;

  update public.stripe_checkout_sessions
    set status = 'completed',
        stripe_payment_intent_id = coalesce(stripe_payment_intent_id, p_payment_intent_id),
        completed_at = coalesce(completed_at, now())
    where stripe_checkout_session_id = p_checkout_session_id;

  perform public.record_document_activity(
    inv.client_id, inv.project_id, 'payment_recorded',
    'Online payment received on ' || inv.invoice_number
  );
  perform public.notify_document(
    'client', inv.client_id, 'payment_received',
    'Payment received',
    'An online payment was received on ' || inv.invoice_number || '.',
    inv.project_id, inv.proposal_id, inv.contract_id, inv.id
  );
  perform public.notify_document(
    'admins', inv.client_id, 'payment_received',
    'Payment received',
    'An online payment was received on ' || inv.invoice_number || '.',
    inv.project_id, inv.proposal_id, inv.contract_id, inv.id
  );
  if became_paid then
    perform public.record_document_activity(
      inv.client_id, inv.project_id, 'invoice_paid', 'Invoice ' || inv.invoice_number || ' paid'
    );
    perform public.notify_document(
      'client', inv.client_id, 'invoice_paid',
      'Invoice paid',
      inv.invoice_number || ' is paid in full.',
      inv.project_id, inv.proposal_id, inv.contract_id, inv.id
    );
    perform public.notify_document(
      'admins', inv.client_id, 'invoice_paid',
      'Invoice paid',
      inv.invoice_number || ' is paid in full.',
      inv.project_id, inv.proposal_id, inv.contract_id, inv.id
    );
  end if;

  return jsonb_build_object(
    'payment_id', pid,
    'duplicate', false,
    'skipped', false,
    'became_paid', became_paid,
    'amount_cents', recorded
  );
exception
  when unique_violation then
    select id into existing_id
    from public.payments
    where stripe_payment_intent_id = p_payment_intent_id
       or stripe_checkout_session_id = p_checkout_session_id
    limit 1;
    return jsonb_build_object(
      'payment_id', existing_id,
      'duplicate', true,
      'skipped', false,
      'became_paid', false
    );
end;
$$;

revoke all on function public.record_stripe_payment(uuid, bigint, text, text, text, text) from public, anon, authenticated;
grant execute on function public.record_stripe_payment(uuid, bigint, text, text, text, text) to service_role;
grant all on table public.stripe_checkout_sessions to postgres, service_role;
grant all on table public.client_stripe_customers to postgres, service_role;
grant all on table public.stripe_processed_events to postgres, service_role;

-- ---------------------------------------------------------------------------
-- RLS: no browser writes; clients never see Stripe customer mapping
-- ---------------------------------------------------------------------------

alter table public.stripe_checkout_sessions enable row level security;
alter table public.client_stripe_customers enable row level security;
alter table public.stripe_processed_events enable row level security;

revoke all on table public.stripe_checkout_sessions from anon, authenticated, public;
revoke all on table public.client_stripe_customers from anon, authenticated, public;
revoke all on table public.stripe_processed_events from anon, authenticated, public;

grant select on table public.stripe_checkout_sessions to authenticated;

create policy stripe_checkout_sessions_admin_select on public.stripe_checkout_sessions
  for select to authenticated
  using (public.is_admin());
