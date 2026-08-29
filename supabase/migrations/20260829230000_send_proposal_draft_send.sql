-- Allow sending a draft proposal without line items.
-- Keep the team permission guard from 20260829200000_team_management.sql.
-- Fill a missing title and valid-until date instead of failing as INVALID_STATUS / EXPIRED.

create or replace function public.send_proposal(p_proposal_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  prop public.proposals;
  rev public.proposal_revisions;
  items jsonb;
  company text;
  send_title text;
  send_valid date;
begin
  perform public.assert_client_perm(
    (select client_id from public.proposals where id = p_proposal_id),
    'proposals.manage'
  );
  select * into prop from public.proposals where id = p_proposal_id for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  select * into rev from public.proposal_revisions where id = prop.working_revision_id for update;
  if rev.status <> 'draft' then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;

  send_title := coalesce(nullif(trim(rev.title), ''), 'Website proposal');
  send_valid := coalesce(rev.valid_until, (current_date + 30));
  if send_valid < current_date then
    raise exception 'EXPIRED' using errcode = 'P0001';
  end if;

  perform set_config('app.document_rpc', '1', true);

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', i.id,
    'name', i.name,
    'description', i.description,
    'quantity', i.quantity,
    'unit_price_cents', i.unit_price_cents,
    'total_cents', i.total_cents,
    'sort_order', i.sort_order
  ) order by i.sort_order, i.id), '[]'::jsonb)
  into items
  from public.proposal_items i
  where i.revision_id = rev.id;

  if prop.published_revision_id is not null and prop.published_revision_id is distinct from rev.id then
    update public.proposal_revisions
      set status = 'cancelled'
    where id = prop.published_revision_id
      and status in ('sent', 'viewed', 'expired');
  end if;

  update public.proposal_revisions
    set status = 'sent',
        sent_at = now(),
        title = send_title,
        valid_until = send_valid,
        snapshot_items = items,
        investment_cents = coalesce((select sum(total_cents) from public.proposal_items where revision_id = rev.id), 0)
  where id = rev.id;

  update public.proposals
    set published_revision_id = rev.id,
        working_revision_id = rev.id
  where id = prop.id;

  select business_name into company from public.clients where id = prop.client_id;
  perform public.record_document_activity(prop.client_id, prop.project_id, 'proposal_sent', 'Proposal ' || prop.proposal_number || ' sent');
  perform public.notify_document(
    'client', prop.client_id, 'proposal_ready',
    'Proposal ready for review',
    coalesce(nullif(trim(send_title), ''), prop.proposal_number) || ' is ready to review.',
    prop.project_id, prop.id, null
  );
end;
$$;
