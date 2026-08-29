-- Restore a cancelled contract revision to draft, sent, or viewed.

create or replace function public.restore_contract(p_contract_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  doc public.contracts;
  rev public.contract_revisions;
  next_status text;
begin
  select * into doc from public.contracts where id = p_contract_id for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  perform public.assert_client_perm(doc.client_id, 'contracts.manage');
  select * into rev from public.contract_revisions where id = doc.working_revision_id for update;
  if rev.status <> 'cancelled' then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;

  if rev.viewed_at is not null then
    next_status := 'viewed';
  elsif rev.sent_at is not null then
    next_status := 'sent';
  else
    next_status := 'draft';
  end if;

  perform set_config('app.document_rpc', '1', true);
  update public.contract_revisions
    set status = next_status
  where id = rev.id;
  perform public.record_document_activity(
    doc.client_id,
    doc.project_id,
    'contract_restored',
    'Contract ' || doc.contract_number || ' restored'
  );
end;
$$;

grant execute on function public.restore_contract(uuid) to authenticated;
