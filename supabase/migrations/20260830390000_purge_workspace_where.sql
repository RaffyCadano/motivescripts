-- pg-safeupdate (and similar guards) reject DELETE/UPDATE without a WHERE clause.

create or replace function public.purge_workspace(p_scope text, p_confirmation text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  expected text;
  project_count integer;
  client_count integer;
  lead_count integer;
  portal_count integer := 0;
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  if p_scope not in ('projects', 'clients', 'agency') then
    raise exception 'INVALID_SCOPE' using errcode = 'P0001';
  end if;

  expected := case p_scope
    when 'projects' then 'DELETE PROJECTS'
    when 'clients' then 'DELETE CLIENTS'
    when 'agency' then 'DELETE AGENCY'
  end;

  if trim(coalesce(p_confirmation, '')) is distinct from expected then
    raise exception 'CONFIRMATION_REQUIRED' using errcode = 'P0001';
  end if;

  perform set_config('app.document_rpc', '1', true);
  perform set_config('app.workspace_purge', '1', true);

  select count(*) into project_count from public.projects;
  select count(*) into client_count from public.clients;
  select count(*) into lead_count from public.leads;

  begin
    delete from storage.objects
    where bucket_id = 'project-files'
      and (
        name like 'projects/%'
        or name in (
          select storage_path
          from public.file_versions
          where storage_path is not null
        )
      );
  exception
    when others then
      null;
  end;

  if p_scope = 'projects' then
    delete from public.notifications
    where project_id is not null or deliverable_id is not null;
    delete from public.feedback where true;
    delete from public.approvals where true;
    delete from public.file_versions where true;
    delete from public.deliverables where true;
    delete from public.tasks where true;
    delete from public.milestones where true;
    delete from public.activity where true;
    update public.conversations set project_id = null where project_id is not null;
    update public.invoices set project_id = null where project_id is not null;
    update public.contracts set project_id = null where project_id is not null;
    update public.proposals set project_id = null where project_id is not null;
    delete from public.projects where true;

    return jsonb_build_object(
      'scope', p_scope,
      'projects', project_count,
      'clients', 0,
      'leads', 0,
      'portal_accounts', 0
    );
  end if;

  delete from public.notifications
  where conversation_id is not null
     or message_id is not null
     or project_id is not null
     or deliverable_id is not null
     or proposal_id is not null
     or contract_id is not null
     or invoice_id is not null;
  delete from public.messages where true;
  delete from public.conversations where true;
  delete from public.client_invitations where true;
  update public.stripe_processed_events
    set invoice_id = null,
        payment_id = null
    where invoice_id is not null or payment_id is not null;
  delete from public.stripe_checkout_sessions where true;
  delete from public.client_stripe_customers where true;
  delete from public.payments where true;
  delete from public.invoices where true;
  update public.contracts
    set working_revision_id = null,
        published_revision_id = null
    where true;
  delete from public.contract_revisions where true;
  delete from public.contracts where true;
  update public.proposals
    set working_revision_id = null,
        published_revision_id = null
    where true;
  delete from public.proposal_revisions where true;
  delete from public.proposals where true;
  delete from public.feedback where true;
  delete from public.approvals where true;
  delete from public.file_versions where true;
  delete from public.deliverables where true;
  delete from public.tasks where true;
  delete from public.milestones where true;
  delete from public.activity where true;
  update public.leads
    set client_id = null,
        converted_at = null
    where client_id is not null;
  delete from public.projects where true;
  delete from public.clients where true;

  if p_scope = 'agency' then
    delete from public.leads where true;
    delete from public.document_number_counters where true;
    delete from public.notifications where true;
  end if;

  select count(*) into portal_count
  from public.profiles
  where role = 'client'
    and id is distinct from auth.uid();

  delete from public.notifications
  where user_id in (
    select id from public.profiles
    where role = 'client' and id is distinct from auth.uid()
  );

  delete from auth.users u
  where u.id is distinct from auth.uid()
    and exists (
      select 1
      from public.profiles p
      where p.id = u.id
        and p.role = 'client'
    );

  return jsonb_build_object(
    'scope', p_scope,
    'projects', project_count,
    'clients', client_count,
    'leads', case when p_scope = 'agency' then lead_count else 0 end,
    'portal_accounts', portal_count
  );
end;
$$;
