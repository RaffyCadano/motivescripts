-- Permanently remove a contract that was never accepted and has no invoices.

create or replace function public.delete_contract(p_contract_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  doc public.contracts;
  accepted_count integer;
  invoice_count integer;
begin
  select * into doc from public.contracts where id = p_contract_id for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  perform public.assert_client_perm(doc.client_id, 'contracts.manage');

  select count(*) into accepted_count
  from public.contract_revisions
  where contract_id = doc.id and status = 'accepted';
  if accepted_count > 0 then
    raise exception 'HAS_ACCEPTED' using errcode = 'P0001';
  end if;

  select count(*) into invoice_count
  from public.invoices
  where contract_id = doc.id;
  if invoice_count > 0 then
    raise exception 'HAS_INVOICES' using errcode = 'P0001';
  end if;

  perform set_config('app.document_rpc', '1', true);
  perform public.record_document_activity(
    doc.client_id,
    doc.project_id,
    'contract_deleted',
    'Contract ' || doc.contract_number || ' deleted'
  );

  update public.contracts
    set working_revision_id = null,
        published_revision_id = null
  where id = doc.id;

  delete from public.notifications where contract_id = doc.id;
  delete from public.contract_revisions where contract_id = doc.id;
  delete from public.contracts where id = doc.id;
end;
$$;

grant execute on function public.delete_contract(uuid) to authenticated;
