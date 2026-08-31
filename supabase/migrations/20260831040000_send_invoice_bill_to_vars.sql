-- send_invoice failed with 42702: PL/pgSQL variables named email/contact
-- conflicted with clients.email / clients.contact_name in the bill-to SELECT.

create or replace function public.send_invoice(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.invoices;
  items jsonb;
  v_company text;
  v_contact text;
  v_email text;
begin
  perform public.assert_client_perm(
    (select client_id from public.invoices where id = p_invoice_id),
    'invoices.manage'
  );
  select * into inv from public.invoices where id = p_invoice_id for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if inv.status <> 'draft' then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.invoice_items where invoice_id = inv.id) then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;
  perform public.recalc_invoice_totals(inv.id);
  select * into inv from public.invoices where id = p_invoice_id;
  if inv.total_cents <= 0 then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;
  if inv.due_date < inv.issue_date then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', i.id,
    'description', i.description,
    'quantity', i.quantity,
    'unit_price_cents', i.unit_price_cents,
    'total_cents', i.total_cents,
    'sort_order', i.sort_order
  ) order by i.sort_order, i.id), '[]'::jsonb)
  into items
  from public.invoice_items i
  where i.invoice_id = inv.id;

  select c.business_name, c.contact_name, c.email
    into v_company, v_contact, v_email
  from public.clients c
  where c.id = inv.client_id;

  perform set_config('app.document_rpc', '1', true);
  update public.invoices
    set status = 'sent',
        sent_at = now(),
        snapshot_items = items,
        bill_to = jsonb_build_object(
          'business_name', coalesce(v_company, ''),
          'contact_name', coalesce(v_contact, ''),
          'email', coalesce(v_email, '')
        )
    where id = inv.id;

  perform public.record_document_activity(
    inv.client_id, inv.project_id, 'invoice_sent', 'Invoice ' || inv.invoice_number || ' sent'
  );
  perform public.notify_document(
    'client', inv.client_id, 'invoice_ready',
    'New invoice available',
    inv.invoice_number || ' is ready to review.',
    inv.project_id, inv.proposal_id, inv.contract_id, inv.id
  );
  perform public.maybe_notify_invoice_overdue(inv.id);
end;
$$;

revoke all on function public.send_invoice(uuid) from public, anon;
grant execute on function public.send_invoice(uuid) to authenticated;
