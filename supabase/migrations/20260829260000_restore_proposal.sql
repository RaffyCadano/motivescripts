-- Restore a cancelled proposal revision to draft, sent, or viewed.

create or replace function public.restore_proposal(p_proposal_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  prop public.proposals;
  rev public.proposal_revisions;
  next_status text;
begin
  select * into prop from public.proposals where id = p_proposal_id for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  perform public.assert_client_perm(prop.client_id, 'proposals.manage');
  select * into rev from public.proposal_revisions where id = prop.working_revision_id for update;
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
  update public.proposal_revisions
    set status = next_status
  where id = rev.id;
  perform public.record_document_activity(
    prop.client_id,
    prop.project_id,
    'proposal_restored',
    'Proposal ' || prop.proposal_number || ' restored'
  );
end;
$$;

grant execute on function public.restore_proposal(uuid) to authenticated;
