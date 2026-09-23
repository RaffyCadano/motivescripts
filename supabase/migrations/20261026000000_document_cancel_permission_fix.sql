-- Found in a full re-sweep of every RPC gated by is_admin() alone, requested after the earlier
-- audit rounds: cancel_proposal, cancel_contract, cancel_invoice, and create_contract_revision were
-- all written in the original proposals/contracts/invoices migration (20260829090000/20260829100000),
-- before staff/team management existed in this codebase at all, and were never updated when it was
-- added. Their siblings WERE updated -- create_proposal, create_contract, send_proposal,
-- send_contract, send_invoice, create_proposal_revision, and reverse_invoice_payment all correctly
-- use assert_client_perm(client_id, '<perm>.manage') today (one of them via a migration literally
-- named restore_document_staff_permissions) -- these four were simply missed.
--
-- Confirmed reachable, not just theoretical:
--   - "Cancel proposal" in AdminProposalDetails.tsx is gated on canManage (proposals.manage) --
--     correct UI, wrong backend. Any Sales staff (who hold proposals.manage) would see it, click
--     it, and get a raw "Not allowed".
--   - "Cancel invoice" / "Reverse payment" in AdminInvoiceDetails.tsx are gated on canManage
--     (invoices.manage) -- same story. Production's one active Accounting staff member holds
--     invoices.manage without being an admin, and would hit this today.
--   - "New revision" and "Cancel contract" in AdminContractDetails.tsx have NO permission gating
--     of their own at all (a third, independent bug, same missing-gate pattern as the earlier Care
--     Requests / Discovery Intake / Task Client Requests findings) -- shown to anyone who can reach
--     the page, gated only on contracts.view. Fixed on the frontend in this same change; see
--     AdminContractDetails.tsx.

create or replace function public.cancel_proposal(p_proposal_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  prop public.proposals;
  rev public.proposal_revisions;
begin
  select * into prop from public.proposals where id = p_proposal_id for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  perform public.assert_client_perm(prop.client_id, 'proposals.manage');
  select * into rev from public.proposal_revisions where id = prop.working_revision_id for update;
  if rev.status in ('accepted') then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;
  if rev.status in ('declined', 'cancelled', 'expired') then
    return;
  end if;
  perform set_config('app.document_rpc', '1', true);
  update public.proposal_revisions set status = 'cancelled' where id = rev.id;
  perform public.record_document_activity(prop.client_id, prop.project_id, 'proposal_cancelled', 'Proposal ' || prop.proposal_number || ' cancelled');
end;
$$;

create or replace function public.cancel_contract(p_contract_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  doc public.contracts;
  rev public.contract_revisions;
begin
  select * into doc from public.contracts where id = p_contract_id for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  perform public.assert_client_perm(doc.client_id, 'contracts.manage');
  select * into rev from public.contract_revisions where id = doc.working_revision_id for update;
  if rev.status = 'accepted' then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;
  if rev.status in ('declined', 'cancelled', 'expired') then
    return;
  end if;
  perform set_config('app.document_rpc', '1', true);
  update public.contract_revisions set status = 'cancelled' where id = rev.id;
  perform public.record_document_activity(doc.client_id, doc.project_id, 'contract_cancelled', 'Contract ' || doc.contract_number || ' cancelled');
end;
$$;

create or replace function public.cancel_invoice(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.invoices;
  effective text;
begin
  select * into inv from public.invoices where id = p_invoice_id for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  perform public.assert_client_perm(inv.client_id, 'invoices.manage');
  if inv.status in ('paid', 'cancelled') then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;
  if inv.amount_paid_cents > 0 or exists (
    select 1 from public.payments where invoice_id = inv.id and reversed_at is null
  ) then
    raise exception 'HAS_PAYMENTS' using errcode = 'P0001';
  end if;
  effective := public.invoice_effective_status(inv.status, inv.due_date, inv.amount_due_cents);
  if effective not in ('draft', 'sent', 'viewed', 'overdue') then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;
  perform set_config('app.document_rpc', '1', true);
  update public.invoices
    set status = 'cancelled', cancelled_at = now()
    where id = inv.id;
  perform public.record_document_activity(
    inv.client_id, inv.project_id, 'invoice_cancelled', 'Invoice ' || inv.invoice_number || ' cancelled'
  );
end;
$$;

create or replace function public.create_contract_revision(p_contract_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  doc public.contracts;
  pub public.contract_revisions;
  work public.contract_revisions;
  rid uuid;
  next_n integer;
begin
  select * into doc from public.contracts where id = p_contract_id;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  perform public.assert_client_perm(doc.client_id, 'contracts.manage');
  select * into work from public.contract_revisions where id = doc.working_revision_id;
  if work.status = 'draft' then
    raise exception 'DRAFT_EXISTS' using errcode = 'P0001';
  end if;
  if work.status = 'accepted' then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;
  if doc.published_revision_id is null then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;
  select * into pub from public.contract_revisions where id = doc.published_revision_id;
  perform set_config('app.document_rpc', '1', true);
  select coalesce(max(revision_number), 0) + 1 into next_n
  from public.contract_revisions where contract_id = doc.id;
  insert into public.contract_revisions (
    contract_id, revision_number, status, title, parties, scope, responsibilities, timeline,
    compensation, payment_terms, confidentiality, intellectual_property, revisions_policy,
    termination, general_terms, effective_date, expires_at, created_by
  )
  values (
    doc.id, next_n, 'draft', pub.title, pub.parties, pub.scope, pub.responsibilities, pub.timeline,
    pub.compensation, pub.payment_terms, pub.confidentiality, pub.intellectual_property,
    pub.revisions_policy, pub.termination, pub.general_terms, pub.effective_date, current_date + 30, auth.uid()
  )
  returning id into rid;
  update public.contracts set working_revision_id = rid where id = doc.id;
  return rid;
end;
$$;
