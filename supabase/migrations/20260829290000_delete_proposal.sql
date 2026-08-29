-- Permanently remove a proposal that was never accepted and has no linked contract or invoice.

create or replace function public.delete_proposal(p_proposal_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  prop public.proposals;
  accepted_count integer;
  contract_count integer;
  invoice_count integer;
begin
  select * into prop from public.proposals where id = p_proposal_id for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  perform public.assert_client_perm(prop.client_id, 'proposals.manage');

  select count(*) into accepted_count
  from public.proposal_revisions
  where proposal_id = prop.id and status = 'accepted';
  if accepted_count > 0 then
    raise exception 'HAS_ACCEPTED' using errcode = 'P0001';
  end if;

  select count(*) into contract_count
  from public.contracts
  where proposal_id = prop.id;
  if contract_count > 0 then
    raise exception 'HAS_CONTRACTS' using errcode = 'P0001';
  end if;

  select count(*) into invoice_count
  from public.invoices
  where proposal_id = prop.id;
  if invoice_count > 0 then
    raise exception 'HAS_INVOICES' using errcode = 'P0001';
  end if;

  perform set_config('app.document_rpc', '1', true);
  perform public.record_document_activity(
    prop.client_id,
    prop.project_id,
    'proposal_deleted',
    'Proposal ' || prop.proposal_number || ' deleted'
  );

  update public.proposals
    set working_revision_id = null,
        published_revision_id = null
  where id = prop.id;

  delete from public.notifications where proposal_id = prop.id;
  delete from public.proposal_revisions where proposal_id = prop.id;
  delete from public.proposals where id = prop.id;
end;
$$;

grant execute on function public.delete_proposal(uuid) to authenticated;
