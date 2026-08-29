-- Discard an Edit draft and return working to the last published revision.
-- The client keeps the sent/accepted copy. No send is required.

create or replace function public.discard_proposal_draft(p_proposal_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  prop public.proposals;
  work public.proposal_revisions;
  draft_id uuid;
begin
  select * into prop from public.proposals where id = p_proposal_id for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  perform public.assert_client_perm(prop.client_id, 'proposals.manage');
  if prop.published_revision_id is null then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;
  select * into work from public.proposal_revisions where id = prop.working_revision_id for update;
  if work.status <> 'draft' then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;
  if prop.working_revision_id is not distinct from prop.published_revision_id then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;

  draft_id := work.id;
  perform set_config('app.document_rpc', '1', true);
  update public.proposals
    set working_revision_id = prop.published_revision_id
    where id = prop.id;
  delete from public.proposal_revisions where id = draft_id;
end;
$$;

grant execute on function public.discard_proposal_draft(uuid) to authenticated;
