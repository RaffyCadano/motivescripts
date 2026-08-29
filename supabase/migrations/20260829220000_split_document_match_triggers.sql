-- Shared assert_document_project_client() reads contract-only columns (contract_number,
-- proposal_id). On proposals that throws: record "new" has no field "contract_number"
-- and create_proposal fails. Use one trigger function per table.

create or replace function public.assert_proposal_project_client()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  project_client uuid;
begin
  if tg_op = 'UPDATE' and new.client_id is distinct from old.client_id then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and new.proposal_number is distinct from old.proposal_number then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if new.project_id is not null then
    select client_id into project_client from public.projects where id = new.project_id;
    if project_client is null or project_client is distinct from new.client_id then
      raise exception 'Not allowed' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.assert_contract_project_client()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  project_client uuid;
  proposal_client uuid;
begin
  if tg_op = 'UPDATE' and new.client_id is distinct from old.client_id then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and new.contract_number is distinct from old.contract_number then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if new.project_id is not null then
    select client_id into project_client from public.projects where id = new.project_id;
    if project_client is null or project_client is distinct from new.client_id then
      raise exception 'Not allowed' using errcode = '42501';
    end if;
  end if;
  if new.proposal_id is not null then
    select client_id into proposal_client from public.proposals where id = new.proposal_id;
    if proposal_client is null or proposal_client is distinct from new.client_id then
      raise exception 'Not allowed' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists proposals_match_project on public.proposals;
create trigger proposals_match_project
  before insert or update of client_id, project_id, proposal_number
  on public.proposals
  for each row execute function public.assert_proposal_project_client();

drop trigger if exists contracts_match_project on public.contracts;
create trigger contracts_match_project
  before insert or update of client_id, project_id, proposal_id, contract_number
  on public.contracts
  for each row execute function public.assert_contract_project_client();

drop function if exists public.assert_document_project_client();
