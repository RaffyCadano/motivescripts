-- Agency Danger Zone also removes team accounts (staff + extra admins) and
-- pending staff invitations. The admin who runs the purge and Settings stay.

create or replace function public.purge_team_accounts()
returns integer
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  removed integer := 0;
begin
  delete from public.staff_invitations where true;

  delete from public.notifications
  where user_id is distinct from auth.uid()
    and exists (
      select 1
      from public.profiles p
      where p.id = notifications.user_id
        and p.role in ('admin', 'staff')
    );

  begin
    delete from auth.identities
    where user_id is distinct from auth.uid()
      and exists (
        select 1
        from public.profiles p
        where p.id = auth.identities.user_id
          and p.role in ('admin', 'staff')
      );
  exception
    when undefined_table then null;
    when others then null;
  end;

  delete from public.staff_grants where user_id is distinct from auth.uid();
  delete from public.staff_profiles where user_id is distinct from auth.uid();

  delete from auth.users u
  where u.id is distinct from auth.uid()
    and exists (
      select 1
      from public.profiles p
      where p.id = u.id
        and p.role in ('admin', 'staff')
    );

  get diagnostics removed = row_count;

  delete from public.profiles
  where id is distinct from auth.uid()
    and role in ('admin', 'staff');

  return removed;
end;
$$;

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
  team_count integer := 0;
  storage_ok boolean := true;
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

  storage_ok := public.purge_workspace_storage(p_scope <> 'projects');

  if p_scope = 'projects' then
    delete from public.notifications n
    where n.project_id is not null
       or n.deliverable_id is not null
       or n.conversation_id in (select id from public.conversations where project_id is not null);
    delete from public.messages
    where conversation_id in (select id from public.conversations where project_id is not null);
    delete from public.conversations where project_id is not null;
    delete from public.feedback where true;
    delete from public.approvals where true;
    delete from public.file_versions where true;
    delete from public.deliverables where true;
    delete from public.tasks where true;
    delete from public.milestones where true;
    delete from public.activity where true;
    delete from public.project_staff_assignments where true;
    update public.invoices set project_id = null where project_id is not null;
    update public.contracts set project_id = null where project_id is not null;
    update public.proposals set project_id = null where project_id is not null;
    delete from public.projects where true;

    return jsonb_build_object(
      'scope', p_scope,
      'projects', project_count,
      'clients', 0,
      'leads', 0,
      'portal_accounts', 0,
      'team_accounts', 0,
      'storage_cleaned', storage_ok
    );
  end if;

  delete from public.notifications where true;
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
  delete from public.invoice_admin_notes where true;
  delete from public.invoice_items where true;
  delete from public.invoices where true;
  update public.contracts
    set working_revision_id = null,
        published_revision_id = null
    where true;
  delete from public.contract_admin_notes where true;
  delete from public.contract_revisions where true;
  delete from public.contracts where true;
  update public.proposals
    set working_revision_id = null,
        published_revision_id = null
    where true;
  delete from public.proposal_admin_notes where true;
  delete from public.proposal_items where true;
  delete from public.proposal_revisions where true;
  delete from public.proposals where true;
  delete from public.feedback where true;
  delete from public.approvals where true;
  delete from public.file_versions where true;
  delete from public.deliverables where true;
  delete from public.tasks where true;
  delete from public.milestones where true;
  delete from public.activity where true;
  delete from public.project_staff_assignments where true;
  delete from public.client_staff_assignments where true;
  delete from public.client_scope_briefs where true;
  delete from public.client_staff_data where true;
  update public.leads
    set client_id = null,
        converted_at = null
    where client_id is not null;
  update public.profiles
    set client_id = null
    where client_id is not null
      and role = 'client';
  delete from public.projects where true;
  delete from public.clients where true;

  if p_scope = 'agency' then
    delete from public.leads where true;
    delete from public.document_number_counters where true;
    delete from public.notifications where true;
  end if;

  portal_count := public.purge_client_portal_auth();

  if p_scope = 'agency' then
    team_count := public.purge_team_accounts();
  end if;

  return jsonb_build_object(
    'scope', p_scope,
    'projects', project_count,
    'clients', client_count,
    'leads', case when p_scope = 'agency' then lead_count else 0 end,
    'portal_accounts', portal_count,
    'team_accounts', team_count,
    'storage_cleaned', storage_ok
  );
end;
$$;

comment on function public.purge_team_accounts() is
  'Admin-only helper for agency purge. Removes other team Auth/profile rows and staff invitations. Keeps auth.uid().';

comment on function public.purge_workspace(text, text) is
  'Admin-only test workspace reset. Requires an exact confirmation phrase. Agency scope also deletes team accounts except the signed-in admin. Does not delete Settings or Stripe Dashboard objects.';

revoke all on function public.purge_team_accounts() from public, anon, authenticated;
revoke all on function public.purge_workspace(text, text) from public, anon;
grant execute on function public.purge_workspace(text, text) to authenticated;
