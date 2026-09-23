-- Real automated backups: the last unaddressed bullet on Website Care ("Automated backups" was
-- pure marketing copy with nothing behind it -- see the audit that also produced uptime monitoring,
-- real email support, tier-aware priority, performance alerting, and Pro's faster monitoring +
-- monthly review). Unlike those, backups are available on every Care tier (the original pricing
-- bullet lists it under Essential, and Business/Pro both say "everything in Essential"), so
-- eligibility here is "any active/past-due Care plan, any tier" -- not tier-gated.
--
-- Scope, honestly bounded by what MotiveScripts actually controls: hosting is external (the
-- project's own hosting, never provisioned by MotiveScripts -- see "set up hosting" in
-- productionTaskInstructions.ts), so there is no server MotiveScripts can pull a filesystem/database
-- backup from. What it *can* do, and does here: capture and retain the production site's live HTML
-- once a day, so if a client's site breaks or a host loses data, the agency has a recent copy to
-- reference or restore content from. This is not a one-click "restore my site" button -- that would
-- overpromise given external hosting -- it is a retained, downloadable snapshot history.

-- ---------------------------------------------------------------------------
-- 1. Eligibility: any tier, unlike project_has_fast_monitoring (Pro-only). Same plan-matching
--    precedence (project-specific plan preferred, then client-level) as that function and
--    care_requests_before_insert.
-- ---------------------------------------------------------------------------

create or replace function public.project_has_active_care_plan(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.projects p
    join public.service_plans sp
      on sp.plan_type = 'care' and sp.status in ('active', 'past_due')
      and (sp.project_id = p.id or (sp.project_id is null and sp.client_id = p.client_id))
    where p.id = p_project_id
  );
$$;

comment on function public.project_has_active_care_plan(uuid) is
  'True when the project has any active/past-due Care plan, regardless of tier -- eligibility for automated backups, which (unlike Advanced monitoring) is included on every Care tier.';

revoke all on function public.project_has_active_care_plan(uuid) from public, anon, authenticated;
grant execute on function public.project_has_active_care_plan(uuid) to service_role;

-- Staff-scoped wrapper for the frontend, mirroring staff_project_has_fast_monitoring
-- (20261018000000_website_monitoring_dashboard.sql) exactly.
create or replace function public.staff_project_has_active_care_plan(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.staff_may_project(p_project_id, 'projects.view') then public.project_has_active_care_plan(p_project_id)
    else false
  end;
$$;

revoke all on function public.staff_project_has_active_care_plan(uuid) from public, anon;
grant execute on function public.staff_project_has_active_care_plan(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. website_backups: one row per snapshot attempt. Same shape/RLS philosophy as
--    website_health_checks (20260928000000) -- written only by the website-backup Edge
--    Function's service role, never directly by an authenticated client or staff session.
-- ---------------------------------------------------------------------------

create table public.website_backups (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  status text not null check (status in ('ok', 'failed')),
  storage_path text,
  byte_size integer,
  error_message text not null default '',
  triggered_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint website_backups_error_message_len check (char_length(error_message) <= 500),
  constraint website_backups_ok_has_path check (status = 'failed' or storage_path is not null)
);

comment on table public.website_backups is
  'One row per daily (or manual) production-site snapshot attempt, written only by the website-backup Edge Function. storage_path points at the raw HTML in the project-files bucket; null when status = failed.';
comment on column public.website_backups.triggered_by is
  'Staff member who used "Back up now". Null for the scheduled daily sweep.';

create index website_backups_project_created_idx on public.website_backups (project_id, created_at desc);

alter table public.website_backups enable row level security;

create policy website_backups_select on public.website_backups
  for select to authenticated
  using (public.staff_may_project(project_id, 'projects.view'));

revoke all on table public.website_backups from public, anon;
grant select on table public.website_backups to authenticated;
-- Deliberately no insert/update/delete grant to authenticated -- see comment above.

-- ---------------------------------------------------------------------------
-- 3. Alert staff on a failed backup -- same "trigger owns alerting" shape as
--    website_health_checks_notify_state_change, just without the streak logic (this only runs
--    once a day, so there is no "spam every check" risk to guard against).
-- ---------------------------------------------------------------------------

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
    check (type = any (array[
      'new_message', 'feedback_received', 'changes_requested', 'version_ready_for_review',
      'version_approved', 'project_update', 'proposal_ready', 'proposal_viewed',
      'proposal_accepted', 'proposal_declined', 'contract_ready', 'contract_viewed',
      'contract_accepted', 'contract_declined', 'invoice_ready', 'invoice_viewed',
      'payment_recorded', 'payment_received', 'invoice_paid', 'invoice_overdue',
      'task_assigned', 'task_status_changed', 'project_assigned', 'milestone_updated',
      'task_info_requested', 'task_response_submitted', 'plan_past_due', 'plan_canceled',
      'task_comment_added', 'task_due_soon', 'task_overdue', 'payroll_paid',
      'domain_expiring_soon', 'domain_expired', 'ssl_expiring_soon', 'ssl_expired',
      'qa_failed', 'qa_passed', 'client_review_ready', 'launch_completed',
      'development_completed', 'project_completed', 'lead_submitted', 'care_request_submitted',
      'website_down', 'website_recovered', 'website_slow', 'website_speed_recovered',
      'backup_failed'
    ]));

create or replace function public.website_backups_notify_failure()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project record;
begin
  if new.status <> 'failed' then
    return new;
  end if;
  select p.id, p.name, p.client_id into v_project from public.projects p where p.id = new.project_id;
  if v_project.id is not null then
    perform public.notify_agency(
      'projects.view', v_project.client_id, 'backup_failed',
      'Automated backup failed for ' || v_project.name,
      coalesce(nullif(new.error_message, ''), 'The scheduled site backup could not be completed.'),
      p_project_id => new.project_id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists website_backups_notify_failure on public.website_backups;
create trigger website_backups_notify_failure
  after insert on public.website_backups
  for each row execute function public.website_backups_notify_failure();

revoke all on function public.website_backups_notify_failure() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Scheduled sweep: same call-an-Edge-Function-from-cron pattern as
--    run_scheduled_website_health_checks, once a day rather than every few minutes -- a website
--    backup is not a latency-sensitive check, and daily is what "automated backups" reasonably
--    promises.
-- ---------------------------------------------------------------------------

create or replace function public.projects_due_for_website_backup()
returns table (project_id uuid, production_url text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.production_url
  from public.projects p
  join public.project_development pd on pd.project_id = p.id
  where pd.deployment_status = 'Production'
    and p.production_url is not null
    and p.production_url <> ''
    and public.project_has_active_care_plan(p.id)
    and not exists (
      select 1 from public.website_backups wb
      where wb.project_id = p.id
        and wb.created_at > now() - interval '20 hours'
    )
  order by p.id
  limit 100;
$$;

comment on function public.projects_due_for_website_backup() is
  'Every launched project with an active/past-due Care plan (any tier) not backed up in the last 20 hours -- the ~20h (not 24h) window keeps the daily cron job from drifting later each day it runs a little late.';

revoke all on function public.projects_due_for_website_backup() from public, anon, authenticated;
grant execute on function public.projects_due_for_website_backup() to service_role;

create or replace function public.run_scheduled_website_backups()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  base_url text;
  service_key text;
begin
  select decrypted_secret into base_url from vault.decrypted_secrets where name = 'edge_function_base_url';
  select decrypted_secret into service_key from vault.decrypted_secrets where name = 'service_role_key';

  if base_url is null or service_key is null then
    raise notice 'run_scheduled_website_backups: edge_function_base_url or service_role_key not set in Vault, skipping';
    return;
  end if;

  perform net.http_post(
    url := base_url || '/functions/v1/website-backup',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := '{}'::jsonb
  );
end;
$$;

revoke all on function public.run_scheduled_website_backups() from public, anon, authenticated;

comment on function public.run_scheduled_website_backups() is
  'Scheduled via pg_cron (website-daily-backups, once a day). Calls website-backup with the service role key and no projectId, running it in batch/sweep mode over every Care-plan project due.';

select cron.schedule(
  'website-daily-backups',
  '0 3 * * *',
  $$ do $do$ begin perform public.run_scheduled_website_backups(); exception when others then raise warning 'run_scheduled_website_backups failed: %', sqlerrm; end $do$; $$
);

-- ---------------------------------------------------------------------------
-- 5. Storage RLS for the snapshot files, at path
--    projects/<project_id>/website-backups/<timestamp>.html (see websiteBackupStoragePath in
--    src/data/fileUploadConfig.ts). Staff-view-only, same bucket as everything else
--    (project-files) -- no authenticated insert/update/delete policy at all: every snapshot is
--    written by the website-backup Edge Function's service role, which bypasses RLS entirely, the
--    same way website_health_checks rows are never inserted by an authenticated session.
-- ---------------------------------------------------------------------------

create or replace function public.can_access_website_backup_file(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  parts text[];
  pid uuid;
begin
  parts := string_to_array(object_name, '/');
  if array_length(parts, 1) is distinct from 4 then
    return false;
  end if;
  if parts[1] <> 'projects' or parts[3] <> 'website-backups' then
    return false;
  end if;
  begin
    pid := parts[2]::uuid;
  exception
    when invalid_text_representation then
      return false;
  end;
  return public.staff_may_project(pid, 'projects.view');
end;
$$;

drop policy if exists website_backup_storage_select on storage.objects;
create policy website_backup_storage_select
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'project-files'
    and public.can_access_website_backup_file(name)
  );

revoke all on function public.can_access_website_backup_file(text) from public, anon;
grant execute on function public.can_access_website_backup_file(text) to authenticated;

comment on function public.can_access_website_backup_file(text) is
  'Staff-view-only: matches website_backups_select''s staff_may_project(projects.view) check. No client policy -- backup snapshots are an internal recovery aid, not a client-facing download.';
