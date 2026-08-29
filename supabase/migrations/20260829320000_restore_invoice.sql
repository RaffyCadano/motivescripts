-- Restore a cancelled invoice, or reopen one as a draft for editing.
-- Does not change payments, Stripe rows, or invoice totals.

create or replace function public.restore_invoice(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.invoices;
  next_status text;
begin
  select * into inv from public.invoices where id = p_invoice_id for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  perform public.assert_client_perm(inv.client_id, 'invoices.manage');
  if inv.status <> 'cancelled' then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;
  if inv.amount_paid_cents > 0 or exists (
    select 1 from public.payments where invoice_id = inv.id and reversed_at is null
  ) then
    raise exception 'HAS_PAYMENTS' using errcode = 'P0001';
  end if;

  if inv.viewed_at is not null then
    next_status := 'viewed';
  elsif inv.sent_at is not null then
    next_status := 'sent';
  else
    next_status := 'draft';
  end if;

  perform set_config('app.document_rpc', '1', true);
  update public.invoices
    set status = next_status,
        cancelled_at = null
  where id = inv.id;
  perform public.record_document_activity(
    inv.client_id, inv.project_id, 'invoice_restored', 'Invoice ' || inv.invoice_number || ' restored'
  );
end;
$$;

create or replace function public.reopen_invoice_draft(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.invoices;
begin
  select * into inv from public.invoices where id = p_invoice_id for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  perform public.assert_client_perm(inv.client_id, 'invoices.manage');
  if inv.status not in ('cancelled', 'sent', 'viewed') then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;
  if inv.amount_paid_cents > 0 or exists (
    select 1 from public.payments where invoice_id = inv.id and reversed_at is null
  ) then
    raise exception 'HAS_PAYMENTS' using errcode = 'P0001';
  end if;

  perform set_config('app.document_rpc', '1', true);
  update public.invoices
    set status = 'draft',
        cancelled_at = null
  where id = inv.id;
  perform public.record_document_activity(
    inv.client_id, inv.project_id, 'invoice_reopened', 'Invoice ' || inv.invoice_number || ' reopened for editing'
  );
end;
$$;

revoke all on function public.restore_invoice(uuid) from public, anon;
revoke all on function public.reopen_invoice_draft(uuid) from public, anon;
grant execute on function public.restore_invoice(uuid) to authenticated;
grant execute on function public.reopen_invoice_draft(uuid) to authenticated;
