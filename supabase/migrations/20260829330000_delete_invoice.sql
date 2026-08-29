-- Permanently remove an invoice that has no payment records.

create or replace function public.delete_invoice(p_invoice_id uuid)
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

  if inv.status in ('paid', 'partially_paid') or inv.amount_paid_cents > 0 then
    raise exception 'HAS_PAYMENTS' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.payments where invoice_id = inv.id) then
    raise exception 'HAS_PAYMENTS' using errcode = 'P0001';
  end if;

  perform set_config('app.document_rpc', '1', true);
  perform public.record_document_activity(
    inv.client_id,
    inv.project_id,
    'invoice_deleted',
    'Invoice ' || inv.invoice_number || ' deleted'
  );

  delete from public.stripe_checkout_sessions where invoice_id = inv.id;
  delete from public.notifications where invoice_id = inv.id;
  delete from public.invoices where id = inv.id;
end;
$$;

revoke all on function public.delete_invoice(uuid) from public, anon;
grant execute on function public.delete_invoice(uuid) to authenticated;
