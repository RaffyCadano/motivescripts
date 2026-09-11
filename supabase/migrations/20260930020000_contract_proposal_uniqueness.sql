-- Audit finding: nothing stops creating two contracts from one accepted
-- proposal (contracts.proposal_id had an index but no unique constraint,
-- and create_contract never checked for an existing contract first).
-- Verified against Sandbox data first: no existing duplicates, so a
-- straight unique index is safe to add without touching any row.
--
-- The business model already has a mechanism for "the contract needs to
-- change": contract_revisions supports multiple revisions per contract.
-- A second contract row for the same proposal was never an intentional
-- path, so one active contract per proposal is enforced going forward.

create unique index if not exists contracts_proposal_id_uidx
  on public.contracts (proposal_id)
  where proposal_id is not null;

-- Re-declare create_contract with a locked, friendly pre-check ahead of the
-- unique index, so a double-submission gets a clear CONTRACT_ALREADY_EXISTS
-- error instead of a raw constraint-violation message. The `for update` lock
-- on the proposal row serializes two concurrent calls for the same proposal:
-- the second call blocks until the first commits, then sees the contract
-- that now exists and raises cleanly instead of racing the unique index.
create or replace function public.create_contract(
  p_client_id uuid,
  p_project_id uuid default null,
  p_proposal_id uuid default null,
  p_title text default 'Website Development Agreement'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  cid uuid;
  rid uuid;
  company text;
  tmpl jsonb;
  pub public.proposal_revisions;
  prop public.proposals;
  copy_scope text := '';
  copy_timeline text := '';
  copy_payment text := '';
  copy_compensation text := '';
  v_project_id uuid := p_project_id;
  v_terms text;
begin
  perform public.assert_client_perm(p_client_id, 'contracts.manage');
  if not exists (select 1 from public.clients where id = p_client_id) then
    raise exception 'CLIENT_NOT_FOUND' using errcode = 'P0001';
  end if;
  if p_proposal_id is not null then
    select * into prop from public.proposals where id = p_proposal_id for update;
    if not found or prop.client_id is distinct from p_client_id then
      raise exception 'Not allowed' using errcode = '42501';
    end if;
    if prop.published_revision_id is null then
      raise exception 'INVALID_STATUS' using errcode = 'P0001';
    end if;
    if exists (select 1 from public.contracts where proposal_id = p_proposal_id) then
      raise exception 'CONTRACT_ALREADY_EXISTS' using errcode = 'P0001';
    end if;
    select * into pub from public.proposal_revisions where id = prop.published_revision_id;
    if pub.status <> 'accepted' then
      raise exception 'INVALID_STATUS' using errcode = 'P0001';
    end if;
    copy_scope := pub.scope;
    copy_timeline := pub.timeline;
    copy_payment := pub.payment_terms;
    copy_compensation :=
      'Investment: $' || (pub.investment_cents / 100)::text || '.' || lpad((pub.investment_cents % 100)::text, 2, '0');
    v_project_id := coalesce(p_project_id, prop.project_id);
  end if;
  select business_name into company from public.clients where id = p_client_id;
  tmpl := public.website_contract_template(company);
  select nullif(trim(default_contract_terms), '') into v_terms
  from public.agency_settings
  where id = 1;
  perform set_config('app.document_rpc', '1', true);
  insert into public.contracts (client_id, project_id, proposal_id, contract_number, created_by)
  values (p_client_id, v_project_id, p_proposal_id, public.next_document_number('contract'), auth.uid())
  returning id into cid;

  insert into public.contract_revisions (
    contract_id, revision_number, status, title, parties, scope, responsibilities, timeline,
    compensation, payment_terms, confidentiality, intellectual_property, revisions_policy,
    termination, general_terms, effective_date, created_by
  )
  values (
    cid, 1, 'draft',
    coalesce(nullif(trim(p_title), ''), tmpl->>'title'),
    tmpl->>'parties',
    coalesce(nullif(trim(copy_scope), ''), tmpl->>'scope'),
    tmpl->>'responsibilities',
    coalesce(nullif(trim(copy_timeline), ''), tmpl->>'timeline'),
    coalesce(nullif(trim(copy_compensation), ''), tmpl->>'compensation'),
    coalesce(nullif(trim(copy_payment), ''), tmpl->>'payment_terms'),
    tmpl->>'confidentiality',
    tmpl->>'intellectual_property',
    tmpl->>'revisions_policy',
    tmpl->>'termination',
    coalesce(v_terms, tmpl->>'general_terms'),
    current_date,
    auth.uid()
  )
  returning id into rid;

  update public.contracts set working_revision_id = rid where id = cid;
  perform public.record_document_activity(p_client_id, v_project_id, 'contract_created', 'Contract created');
  return cid;
end;
$$;

comment on function public.create_contract(uuid, uuid, uuid, text) is
  'Create a draft contract. Requires contracts.manage on the client (staff assignment + grant). One contract per proposal -- CONTRACT_ALREADY_EXISTS if one already exists.';
