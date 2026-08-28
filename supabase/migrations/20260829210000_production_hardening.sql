-- MotiveScripts Phase 21 — production hardening
-- Does not add product features. Tightens grants, Stripe session binding, and activity inserts.

-- ---------------------------------------------------------------------------
-- Invitation hashes stay server-side. Authenticated SELECT cannot read token_hash.
-- ---------------------------------------------------------------------------

revoke select on table public.client_invitations from authenticated;
grant select (
  id, client_id, email, invitee_name, status, expires_at, accepted_at, created_at, created_by, revoked_at
) on table public.client_invitations to authenticated;
grant all on table public.client_invitations to postgres, service_role;

revoke select on table public.staff_invitations from authenticated;
grant select (
  id, email, invitee_name, job_title, template_key, permission_codes,
  status, expires_at, accepted_at, accepted_user_id, created_at, created_by, revoked_at
) on table public.staff_invitations to authenticated;
grant all on table public.staff_invitations to postgres, service_role;

-- ---------------------------------------------------------------------------
-- Proposal/contract identity rows are RPC-only. Draft content still lives on
-- revisions, items, and admin notes (existing triggers block sent-document edits).
-- ---------------------------------------------------------------------------

revoke insert, update, delete on table public.proposals from authenticated;
revoke insert, update, delete on table public.contracts from authenticated;
grant select on table public.proposals to authenticated;
grant select on table public.contracts to authenticated;

-- ---------------------------------------------------------------------------
-- Activity inserts require a write-related grant plus assignment (admins pass).
-- ---------------------------------------------------------------------------

drop policy if exists activity_admin_insert on public.activity;
create policy activity_admin_insert on public.activity for insert to authenticated
  with check (
    public.staff_may_project(project_id, 'projects.manage')
    or public.staff_may_project(project_id, 'files.manage')
    or public.staff_may_project(project_id, 'feedback.manage')
  );

-- ---------------------------------------------------------------------------
-- Stripe ledger writes require a stored checkout session for that invoice.
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
  if not found then
    raise exception 'PAYMENT_INVALID' using errcode = 'P0001';
  end if;
  if sess.invoice_id is distinct from p_invoice_id
    or sess.client_id is distinct from inv.client_id
  then
    raise exception 'Not allowed' using errcode = '42501';
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
