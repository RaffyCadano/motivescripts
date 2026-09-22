-- Turns Website Health Monitoring v1's manual-only "Check Now" (20260928000000) into real
-- automated uptime monitoring: a pg_cron job sweeps every launched project's production_url every
-- 15 minutes, and a trigger alerts staff on a genuine state change (down, or recovered from down).
-- Same call-an-Edge-Function-from-cron pattern already used by notify_invoices_overdue_email
-- (20260930210000/20260930230000) -- pg_net + the same two Vault secrets, wrapped in an
-- exception-safe DO block so a failure here can't take down anything else.

-- ---------------------------------------------------------------------------
-- 1. New notification types for a state change.
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
      'website_down', 'website_recovered'
    ]));

-- ---------------------------------------------------------------------------
-- 2. Alert on a state change into or out of "down". Fires for every insert into
--    website_health_checks -- a manual Check Now and the scheduled sweep both alert the same way,
--    from this one place, not duplicated in the Edge Function.
-- ---------------------------------------------------------------------------

create or replace function public.website_health_checks_notify_state_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_previous_status text;
  v_project record;
begin
  -- Staging checks don't page anyone -- only production reachability is an incident.
  if new.environment <> 'production' then
    return new;
  end if;

  select status into v_previous_status
  from public.website_health_checks
  where project_id = new.project_id
    and environment = new.environment
    and id <> new.id
    and checked_at <= new.checked_at
  order by checked_at desc
  limit 1;

  -- Alert only on a genuine transition into or out of "down" -- not on every consecutive down
  -- check (would spam every 15 minutes for the length of an outage), and not on "degraded": a
  -- single 4xx/5xx is deliberately not escalated, same reasoning as the per-check classification
  -- documented in check-website-health.
  if new.status = 'down' and coalesce(v_previous_status, '') <> 'down' then
    select p.id, p.name, p.client_id into v_project from public.projects p where p.id = new.project_id;
    if v_project.id is not null then
      perform public.notify_agency(
        'projects.view', v_project.client_id, 'website_down',
        v_project.name || ' appears to be down',
        coalesce(nullif(new.error_message, ''), 'The production site stopped responding.'),
        p_project_id => new.project_id
      );
    end if;
  elsif new.status = 'healthy' and v_previous_status = 'down' then
    select p.id, p.name, p.client_id into v_project from public.projects p where p.id = new.project_id;
    if v_project.id is not null then
      perform public.notify_agency(
        'projects.view', v_project.client_id, 'website_recovered',
        v_project.name || ' is back up',
        'The production site is responding again.',
        p_project_id => new.project_id
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists website_health_checks_notify_state_change on public.website_health_checks;
create trigger website_health_checks_notify_state_change
  after insert on public.website_health_checks
  for each row execute function public.website_health_checks_notify_state_change();

revoke all on function public.website_health_checks_notify_state_change() from public, anon, authenticated;

comment on function public.website_health_checks_notify_state_change() is
  'Notifies staff (projects.view) on a production check transitioning into "down", or recovering from it. Fires for both the manual Check Now and the scheduled sweep -- one alerting path for both.';

comment on column public.website_health_checks.checked_by is
  'Staff member who triggered a manual Check Now. Null for a scheduled/automated check (see run_scheduled_website_health_checks and check-website-health''s service-role sweep mode).';

-- ---------------------------------------------------------------------------
-- 3. The scheduled sweep itself: calls check-website-health with the service role key and no
--    projectId, which runs it in batch mode over every launched project. Requires
--    edge_function_base_url and service_role_key in Supabase Vault -- the same secrets
--    notify_invoices_overdue_email already uses (see 20260930220000's comment for the exact key
--    format), already present on both Sandbox and Production.
-- ---------------------------------------------------------------------------

create or replace function public.run_scheduled_website_health_checks()
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
    raise notice 'run_scheduled_website_health_checks: edge_function_base_url or service_role_key not set in Vault, skipping';
    return;
  end if;

  perform net.http_post(
    url := base_url || '/functions/v1/check-website-health',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := '{}'::jsonb
  );
end;
$$;

revoke all on function public.run_scheduled_website_health_checks() from public, anon, authenticated;

comment on function public.run_scheduled_website_health_checks() is
  'Scheduled via pg_cron (check-website-uptime, every 15 minutes). Calls check-website-health with the service role key and no projectId, running it in batch/sweep mode over every launched project''s production_url.';

select cron.schedule(
  'check-website-uptime',
  '*/15 * * * *',
  $$ do $do$ begin perform public.run_scheduled_website_health_checks(); exception when others then raise warning 'run_scheduled_website_health_checks failed: %', sqlerrm; end $do$; $$
);
