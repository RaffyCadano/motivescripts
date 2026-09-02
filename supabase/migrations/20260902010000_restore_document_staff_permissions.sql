-- Restore staff permission guards on create_proposal / create_contract.
-- 20260829310000_agency_settings.sql replaced the team_management guards with is_admin() only.
-- send_proposal, send_contract, and other document RPCs still use assert_client_perm.
-- Does not change business logic, RLS, or discovery storage.

-- ---------------------------------------------------------------------------
-- create_proposal: proposals.manage via assert_client_perm(p_client_id, ...)
-- ---------------------------------------------------------------------------

create or replace function public.create_proposal(
  p_client_id uuid,
  p_project_id uuid default null,
  p_title text default 'Website proposal'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  pid uuid;
  rid uuid;
  v_days integer := 30;
begin
  perform public.assert_client_perm(p_client_id, 'proposals.manage');
  if not exists (select 1 from public.clients where id = p_client_id) then
    raise exception 'CLIENT_NOT_FOUND' using errcode = 'P0001';
  end if;
  select least(greatest(coalesce(default_proposal_valid_days, 30), 1), 365)
    into v_days
  from public.agency_settings
  where id = 1;
  if v_days is null then
    v_days := 30;
  end if;
  perform set_config('app.document_rpc', '1', true);
  insert into public.proposals (client_id, project_id, proposal_number, created_by)
  values (p_client_id, p_project_id, public.next_document_number('proposal'), auth.uid())
  returning id into pid;

  insert into public.proposal_revisions (
    proposal_id, revision_number, status, title, created_by, valid_until
  )
  values (
    pid, 1, 'draft', coalesce(nullif(trim(p_title), ''), 'Website proposal'), auth.uid(),
    (current_date + v_days)
  )
  returning id into rid;

  update public.proposals set working_revision_id = rid where id = pid;
  perform public.record_document_activity(p_client_id, p_project_id, 'proposal_created', 'Proposal created');
  return pid;
end;
$$;

comment on function public.create_proposal(uuid, uuid, text) is
  'Create a draft proposal. Requires proposals.manage on the client (staff assignment + grant).';

-- ---------------------------------------------------------------------------
-- create_contract: contracts.manage via assert_client_perm(p_client_id, ...)
-- ---------------------------------------------------------------------------

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
    select * into prop from public.proposals where id = p_proposal_id;
    if not found or prop.client_id is distinct from p_client_id then
      raise exception 'Not allowed' using errcode = '42501';
    end if;
    if prop.published_revision_id is null then
      raise exception 'INVALID_STATUS' using errcode = 'P0001';
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
  'Create a draft contract. Requires contracts.manage on the client (staff assignment + grant).';
