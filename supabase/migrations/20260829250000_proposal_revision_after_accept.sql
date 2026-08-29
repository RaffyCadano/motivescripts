-- Allow a new draft revision after a proposal is accepted.
-- The accepted revision stays on record. Sending the new draft publishes it.

create or replace function public.create_proposal_revision(p_proposal_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  prop public.proposals;
  pub public.proposal_revisions;
  work public.proposal_revisions;
  rid uuid;
  next_n integer;
begin
  select * into prop from public.proposals where id = p_proposal_id;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  perform public.assert_client_perm(prop.client_id, 'proposals.manage');
  select * into work from public.proposal_revisions where id = prop.working_revision_id;
  if work.status = 'draft' then
    raise exception 'DRAFT_EXISTS' using errcode = 'P0001';
  end if;
  if prop.published_revision_id is null then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;
  select * into pub from public.proposal_revisions where id = prop.published_revision_id;
  perform set_config('app.document_rpc', '1', true);
  select coalesce(max(revision_number), 0) + 1 into next_n
  from public.proposal_revisions where proposal_id = prop.id;

  insert into public.proposal_revisions (
    proposal_id, revision_number, status, title, introduction, overview, scope,
    deliverables_text, timeline, payment_terms, terms, notes, investment_cents,
    valid_until, created_by
  )
  values (
    prop.id, next_n, 'draft', pub.title, pub.introduction, pub.overview, pub.scope,
    pub.deliverables_text, pub.timeline, pub.payment_terms, pub.terms, pub.notes,
    pub.investment_cents, coalesce(pub.valid_until, current_date + 30), auth.uid()
  )
  returning id into rid;

  insert into public.proposal_items (revision_id, name, description, quantity, unit_price_cents, sort_order)
  select rid,
    coalesce(item->>'name', 'Item'),
    coalesce(item->>'description', ''),
    greatest(coalesce((item->>'quantity')::integer, 1), 1),
    greatest(coalesce((item->>'unit_price_cents')::bigint, 0), 0),
    coalesce((item->>'sort_order')::integer, 0)
  from jsonb_array_elements(coalesce(pub.snapshot_items, '[]'::jsonb)) as item;

  update public.proposals set working_revision_id = rid where id = prop.id;
  return rid;
end;
$$;
