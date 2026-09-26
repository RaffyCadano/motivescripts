-- Admin: delete a client and everything that belongs to them.
--
--   admin_client_deletion_preview(client)   what would be deleted, in counts, for the confirmation screen
--   admin_client_storage_paths(client)      the stored files that belong to the client (service role only; the
--                                           admin-client-files edge function removes them through the Storage API,
--                                           because Storage does not allow deleting files with SQL)
--   admin_client_delete_check(client, typed name, leave_website_live)
--                                           runs every guard below and raises the refusal, deleting nothing; the
--                                           edge function calls it BEFORE removing any files, so a refused deletion
--                                           never leaves a client with its files gone
--   admin_delete_client(client, typed name, leave_website_live)
--                                           deletes the client, their projects, tasks, files records, proposals,
--                                           contracts, invoices and payments, messages, plans, requests, and their
--                                           portal logins
--
-- Guards: admins only; the admin must type the business name; a client whose Website Care plan is still active or
-- past due is refused (cancel the plan first, so a subscription is never left billing); and a launched website
-- that is still live is refused unless the admin says to leave it running (take it down first from the
-- Accounts page). This does not touch anything at the host: a site that was live stays live there.
-- Every deletion is recorded in client_deletions (what was deleted, by whom, with the counts).
--
-- Financial records (invoices, payments, contracts, proposals) are deleted with the client. The confirmation
-- screen says so, and shows the counts.

create table if not exists public.client_deletions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null,
  business_name text not null,
  contact_email text,
  counts jsonb not null default '{}'::jsonb,
  deleted_by uuid references auth.users (id) on delete set null,
  deleted_by_email text,
  created_at timestamptz not null default now()
);

comment on table public.client_deletions is
  'A record of every client deleted with admin_delete_client(): who it was, what went with it, and which admin did it.';

alter table public.client_deletions enable row level security;
revoke all on table public.client_deletions from public, anon;
grant select on table public.client_deletions to authenticated;
grant select, insert on table public.client_deletions to service_role;

drop policy if exists client_deletions_select_admin on public.client_deletions;
create policy client_deletions_select_admin on public.client_deletions
  for select to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- The stored files that belong to a client
-- ---------------------------------------------------------------------------

create or replace function public.admin_client_storage_paths(p_client_id uuid)
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(distinct path), '{}')
  from (
    select fv.storage_path as path
      from public.file_versions fv
      join public.deliverables d on d.id = fv.deliverable_id
      join public.projects p on p.id = d.project_id
      where p.client_id = p_client_id and fv.storage_path is not null
    union all
    select ta.storage_path from public.task_attachments ta
      join public.tasks t on t.id = ta.task_id
      join public.projects p on p.id = t.project_id
      where p.client_id = p_client_id and ta.storage_path is not null
    union all
    select tf.storage_path from public.task_client_request_files tf
      join public.projects p on p.id = tf.project_id
      where p.client_id = p_client_id and tf.storage_path is not null
    union all
    select df.storage_path from public.discovery_intake_files df
      join public.projects p on p.id = df.project_id
      where p.client_id = p_client_id and df.storage_path is not null
    union all
    select cf.storage_path from public.care_request_files cf
      where cf.client_id = p_client_id and cf.storage_path is not null
    union all
    select wb.storage_path from public.website_backups wb
      join public.projects p on p.id = wb.project_id
      where p.client_id = p_client_id and wb.storage_path is not null
    union all
    select c.client_signed_copy_path from public.contracts c
      where c.client_id = p_client_id and c.client_signed_copy_path is not null
  ) all_paths;
$$;

revoke all on function public.admin_client_storage_paths(uuid) from public, anon, authenticated;
grant execute on function public.admin_client_storage_paths(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- What would be deleted
-- ---------------------------------------------------------------------------

create or replace function public.admin_client_deletion_preview(p_client_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  c record;
  pids uuid[];
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select id, business_name, email into c from public.clients where id = p_client_id;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  select coalesce(array_agg(id), '{}') into pids from public.projects where client_id = p_client_id;

  select jsonb_build_object(
    'business_name', c.business_name,
    'projects', cardinality(pids),
    'tasks', (select count(*) from public.tasks where project_id = any (pids)),
    'files', (select count(*) from public.file_versions fv join public.deliverables d on d.id = fv.deliverable_id where d.project_id = any (pids)),
    'proposals', (select count(*) from public.proposals where client_id = p_client_id),
    'contracts', (select count(*) from public.contracts where client_id = p_client_id),
    'invoices', (select count(*) from public.invoices where client_id = p_client_id),
    'paid_cents', (select coalesce(sum(amount_paid_cents), 0) from public.invoices where client_id = p_client_id),
    'conversations', (select count(*) from public.conversations where client_id = p_client_id),
    'time_entries', (select count(*) from public.time_entries where project_id = any (pids)),
    'care_requests', (select count(*) from public.care_requests where client_id = p_client_id),
    'portal_accounts', (select count(*) from public.profiles where client_id = p_client_id and role = 'client'),
    'has_active_plan', exists (
      select 1 from public.service_plans sp where sp.client_id = p_client_id and sp.status in ('active', 'past_due')
    ),
    'live_websites', coalesce((
      select jsonb_agg(p.name order by p.name)
      from public.projects p
      join public.project_development pd on pd.project_id = p.id
      where p.client_id = p_client_id and pd.deployment_status = 'Production' and pd.paused_at is null
    ), '[]'::jsonb),
    'stored_files', cardinality(public.admin_client_storage_paths(p_client_id))
  ) into result;
  return result;
end;
$$;

revoke all on function public.admin_client_deletion_preview(uuid) from public, anon;
grant execute on function public.admin_client_deletion_preview(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- The deletion
-- ---------------------------------------------------------------------------

create or replace function public.admin_client_delete_check(
  p_client_id uuid,
  p_confirmation text,
  p_leave_website_live boolean default false
)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  c record;
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select id, business_name into c from public.clients where id = p_client_id;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if lower(trim(coalesce(p_confirmation, ''))) is distinct from lower(trim(c.business_name)) then
    raise exception 'CONFIRMATION_REQUIRED' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.service_plans sp where sp.client_id = p_client_id and sp.status in ('active', 'past_due')) then
    raise exception 'ACTIVE_PLAN' using errcode = 'P0001';
  end if;
  if not coalesce(p_leave_website_live, false) and exists (
    select 1
    from public.projects p
    join public.project_development pd on pd.project_id = p.id
    where p.client_id = p_client_id and pd.deployment_status = 'Production' and pd.paused_at is null
  ) then
    raise exception 'WEBSITE_LIVE' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.admin_client_delete_check(uuid, text, boolean) from public, anon;
grant execute on function public.admin_client_delete_check(uuid, text, boolean) to authenticated;

create or replace function public.admin_delete_client(
  p_client_id uuid,
  p_confirmation text,
  p_leave_website_live boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  c record;
  pids uuid[];
  user_ids uuid[];
  counts jsonb;
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  perform public.admin_client_delete_check(p_client_id, p_confirmation, p_leave_website_live);
  select id, business_name, email into c from public.clients where id = p_client_id;

  counts := public.admin_client_deletion_preview(p_client_id);

  -- The document guards let deletes through only for the app's own RPCs.
  perform set_config('app.document_rpc', '1', true);
  perform set_config('app.workspace_purge', '1', true);

  select coalesce(array_agg(id), '{}') into pids from public.projects where client_id = p_client_id;
  select coalesce(array_agg(id), '{}') into user_ids
    from public.profiles
    where client_id = p_client_id and role = 'client'
      and not exists (select 1 from public.staff_profiles s where s.user_id = profiles.id);

  -- Messages, conversations, invitations
  delete from public.notifications where project_id = any (pids) or user_id = any (user_ids);
  delete from public.messages where conversation_id in (select id from public.conversations where client_id = p_client_id);
  delete from public.conversations where client_id = p_client_id;
  delete from public.client_invitations where client_id = p_client_id;

  -- Payments and invoices
  update public.stripe_processed_events
    set invoice_id = null, payment_id = null
    where invoice_id in (select id from public.invoices where client_id = p_client_id)
       or payment_id in (select pay.id from public.payments pay join public.invoices i on i.id = pay.invoice_id where i.client_id = p_client_id);
  delete from public.stripe_checkout_sessions where client_id = p_client_id;
  delete from public.client_stripe_customers where client_id = p_client_id;
  delete from public.payments where invoice_id in (select id from public.invoices where client_id = p_client_id);
  delete from public.invoices where client_id = p_client_id;

  -- Contracts, then proposals
  update public.contracts set working_revision_id = null, published_revision_id = null where client_id = p_client_id;
  delete from public.contract_revisions where contract_id in (select id from public.contracts where client_id = p_client_id);
  delete from public.contracts where client_id = p_client_id;
  update public.proposals set working_revision_id = null, published_revision_id = null where client_id = p_client_id;
  delete from public.proposal_revisions where proposal_id in (select id from public.proposals where client_id = p_client_id);
  delete from public.proposals where client_id = p_client_id;

  -- Project work
  delete from public.feedback where client_id = p_client_id or project_id = any (pids);
  delete from public.approvals where client_id = p_client_id or project_id = any (pids);
  delete from public.file_versions where deliverable_id in (select id from public.deliverables where project_id = any (pids));
  delete from public.deliverables where project_id = any (pids);
  delete from public.tasks where project_id = any (pids);
  delete from public.milestones where project_id = any (pids);
  delete from public.activity where project_id = any (pids);
  delete from public.projects where client_id = p_client_id;

  -- The client, and their portal logins
  delete from auth.users where id = any (user_ids);
  delete from public.clients where id = p_client_id;

  insert into public.client_deletions (client_id, business_name, contact_email, counts, deleted_by, deleted_by_email)
  values (
    p_client_id, c.business_name, c.email, counts, auth.uid(),
    (select email from public.profiles where id = auth.uid())
  );

  return counts;
end;
$$;

revoke all on function public.admin_delete_client(uuid, text, boolean) from public, anon;
grant execute on function public.admin_delete_client(uuid, text, boolean) to authenticated;

comment on function public.admin_delete_client(uuid, text, boolean) is
  'Admin only: deletes a client and everything that belongs to them, after their business name is typed to confirm. Refuses a client with an active Care plan, and a live website unless told to leave it running. Recorded in client_deletions.';
comment on function public.admin_client_deletion_preview(uuid) is 'Admin only: what admin_delete_client would delete, as counts.';
