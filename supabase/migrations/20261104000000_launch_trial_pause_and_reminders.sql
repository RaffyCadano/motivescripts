-- What happens when the free 30-day launch period (20261101000000_launch_free_trial.sql) runs out.
--
-- Until now the period only governed Care Requests, and nothing at all happened at the end of it. This
-- adds the rest of what the Pricing page promises:
--   * reminder emails 7 days and 1 day before it ends;
--   * a daily sweep that PAUSES a launched project whose period has ended and that has no active Care
--     (or hosting) plan: it records paused_at, alerts staff, and tells the client by notification + email;
--   * unpause_website(): the admin action to bring it back (for N days, or indefinitely);
--   * an automatic unpause the moment the client gets an active Care / hosting plan.
--
-- "Paused" is a STATUS in this system, not a switch on the host: hosting is set up by hand with an
-- outside provider, so the staff alert is the prompt to take the site offline (and back online) there.
--
-- Nothing here changes a project that has an active plan, one that hasn't launched, or one an admin marked
-- to stay live (pause_exempt). Every function is service-role / staff only.

alter table public.project_development
  add column if not exists paused_at timestamptz,
  add column if not exists pause_exempt boolean not null default false,
  add column if not exists trial_reminder_7d_sent_at timestamptz,
  add column if not exists trial_reminder_1d_sent_at timestamptz;

comment on column public.project_development.paused_at is
  'Set by run_launch_trial_sweep() when the free launch period ended with no active Care/hosting plan; cleared by unpause_website() or by the client getting an active plan. Status only: staff take the site offline at the host themselves.';
comment on column public.project_development.pause_exempt is
  'True when an admin chose "keep live indefinitely" on Unpause: the sweep never pauses this project.';
comment on column public.project_development.trial_reminder_7d_sent_at is
  'When the "free period ends in about a week" reminder went out. Reset by unpause_website() so a fresh grace period reminds again.';
comment on column public.project_development.trial_reminder_1d_sent_at is
  'When the "free period ends tomorrow" reminder went out. Reset by unpause_website().';

-- ---------------------------------------------------------------------------
-- New notification types
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
      'backup_failed',
      'launch_trial_ending', 'website_paused', 'website_unpaused'
    ]));

-- ---------------------------------------------------------------------------
-- Does this project have a plan that keeps it hosted?
-- ---------------------------------------------------------------------------

-- Same idea as care_requests_before_insert's plan lookup, but a hosting plan counts too (Website Care
-- includes hosting; an admin can also sell hosting on its own). past_due counts: Stripe is still retrying.
create or replace function public.project_has_hosting_plan(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.projects pr
    join public.service_plans sp
      on sp.client_id = pr.client_id
     and (sp.project_id = pr.id or sp.project_id is null)
    where pr.id = p_project_id
      and sp.plan_type in ('care', 'hosting')
      and sp.status in ('active', 'past_due')
  );
$$;

revoke all on function public.project_has_hosting_plan(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- The daily sweep: pause expired projects, send the reminders
-- ---------------------------------------------------------------------------

create or replace function public.run_launch_trial_sweep()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  base_url text;
  service_key text;
  r record;

  -- One helper for the emails: the same Vault-secret + pg_net call the overdue-invoice reminders use.
  -- Skipped quietly if the secrets aren't seeded on this environment; the status change and the in-app
  -- notifications still happen.
begin
  select decrypted_secret into base_url from vault.decrypted_secrets where name = 'edge_function_base_url';
  select decrypted_secret into service_key from vault.decrypted_secrets where name = 'service_role_key';

  -- 1. Pause: launched, period over, no plan, not exempt, not already paused.
  for r in
    select pd.project_id, p.client_id, p.name
    from public.project_development pd
    join public.projects p on p.id = pd.project_id
    where pd.deployment_status = 'Production'
      and pd.launch_trial_ends_at is not null
      and pd.launch_trial_ends_at <= now()
      and pd.paused_at is null
      and not pd.pause_exempt
      and not p.archived
      and not public.project_has_hosting_plan(pd.project_id)
  loop
    begin
      update public.project_development set paused_at = now() where project_id = r.project_id;

      perform public.notify_agency(
        'projects.manage', r.client_id, 'website_paused',
        'Website paused: ' || r.name,
        'The free launch period ended and there is no active Care plan. Take the site offline at the host. Use Unpause on the project to bring it back.',
        null, null, r.project_id
      );
      perform public.notify_client_users(
        r.client_id, 'website_paused', 'Your website has been paused',
        'Your free launch period has ended. Choose a Website Care plan to bring it back online.',
        null, null, r.project_id, null
      );

      if base_url is not null and service_key is not null then
        perform net.http_post(
          url := base_url || '/functions/v1/document-email',
          headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || service_key),
          body := jsonb_build_object('kind', 'launch_trial', 'id', r.project_id, 'stage', 'paused')
        );
      end if;
    exception when others then
      raise notice 'run_launch_trial_sweep: pause failed for project %: %', r.project_id, sqlerrm;
    end;
  end loop;

  -- 2. Reminders, only for projects that would actually be paused (no plan, not exempt).
  --    "1 day" wins when a project is first seen inside the last day, and marks the 7-day one sent too.
  for r in
    select pd.project_id, p.client_id, p.name, pd.launch_trial_ends_at,
           (pd.launch_trial_ends_at <= now() + interval '1 day') as last_day
    from public.project_development pd
    join public.projects p on p.id = pd.project_id
    where pd.deployment_status = 'Production'
      and pd.launch_trial_ends_at is not null
      and pd.launch_trial_ends_at > now()
      and pd.launch_trial_ends_at <= now() + interval '7 days'
      and pd.paused_at is null
      and not pd.pause_exempt
      and not p.archived
      and (
        (pd.launch_trial_ends_at <= now() + interval '1 day' and pd.trial_reminder_1d_sent_at is null)
        or (pd.launch_trial_ends_at > now() + interval '1 day' and pd.trial_reminder_7d_sent_at is null)
      )
      and not public.project_has_hosting_plan(pd.project_id)
  loop
    begin
      if r.last_day then
        update public.project_development
          set trial_reminder_1d_sent_at = now(),
              trial_reminder_7d_sent_at = coalesce(trial_reminder_7d_sent_at, now())
          where project_id = r.project_id;
      else
        update public.project_development set trial_reminder_7d_sent_at = now() where project_id = r.project_id;
      end if;

      perform public.notify_client_users(
        r.client_id, 'launch_trial_ending',
        case when r.last_day then 'Your free period ends tomorrow' else 'Your free period ends soon' end,
        'Choose a Website Care plan before ' || to_char(r.launch_trial_ends_at at time zone 'UTC', 'FMMonth FMDD, YYYY')
          || ' to keep your website online.',
        null, null, r.project_id, null
      );

      if base_url is not null and service_key is not null then
        perform net.http_post(
          url := base_url || '/functions/v1/document-email',
          headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || service_key),
          body := jsonb_build_object('kind', 'launch_trial', 'id', r.project_id, 'stage', case when r.last_day then '1d' else '7d' end)
        );
      end if;
    exception when others then
      raise notice 'run_launch_trial_sweep: reminder failed for project %: %', r.project_id, sqlerrm;
    end;
  end loop;
end;
$$;

revoke all on function public.run_launch_trial_sweep() from public, anon, authenticated;

comment on function public.run_launch_trial_sweep() is
  'Scheduled daily via pg_cron (launch-trial-sweep). Pauses launched projects whose free launch period ended with no active Care/hosting plan, and sends the 7-day and 1-day reminders. Emails go through document-email (kind launch_trial) using the Vault secrets, like the overdue-invoice reminders.';

select cron.unschedule(jobid) from cron.job where jobname = 'launch-trial-sweep';
select cron.schedule(
  'launch-trial-sweep',
  '0 14 * * *',
  $$ do $do$ begin perform public.run_launch_trial_sweep(); exception when others then raise warning 'run_launch_trial_sweep failed: %', sqlerrm; end $do$; $$
);

-- ---------------------------------------------------------------------------
-- Unpause (admin) and the automatic unpause when a plan starts
-- ---------------------------------------------------------------------------

-- p_days: 1..365 gives the project that many more days from now (reminders start over); null keeps it
-- live indefinitely (pause_exempt), for a client you've decided not to pause. Requires projects.manage.
create or replace function public.unpause_website(p_project_id uuid, p_days integer default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  proj record;
begin
  perform public.assert_project_perm(p_project_id, 'projects.manage');

  if p_days is not null and (p_days < 1 or p_days > 365) then
    raise exception 'INVALID_DAYS' using errcode = 'P0001';
  end if;

  select p.id, p.client_id, p.name, pd.paused_at
    into proj
    from public.projects p
    join public.project_development pd on pd.project_id = p.id
    where p.id = p_project_id
    for update of pd;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if proj.paused_at is null then
    raise exception 'NOT_PAUSED' using errcode = 'P0001';
  end if;

  update public.project_development
    set paused_at = null,
        pause_exempt = (p_days is null),
        launch_trial_ends_at = case when p_days is null then launch_trial_ends_at else now() + make_interval(days => p_days) end,
        trial_reminder_7d_sent_at = null,
        trial_reminder_1d_sent_at = null
    where project_id = p_project_id;

  perform public.notify_client_users(
    proj.client_id, 'website_unpaused', 'Your website is live again',
    case when p_days is null then 'Your website has been unpaused.'
         else 'Your website has been unpaused for ' || p_days || ' more days. Choose a Website Care plan to keep it online.' end,
    null, null, p_project_id, null
  );
end;
$$;

revoke all on function public.unpause_website(uuid, integer) from public, anon;
grant execute on function public.unpause_website(uuid, integer) to authenticated;

comment on function public.unpause_website(uuid, integer) is
  'Admin/staff with projects.manage: bring a paused website back. p_days (1-365) gives that many more days of free period; null keeps it live indefinitely (pause_exempt). Raises NOT_PAUSED if it is not paused.';

-- A client getting an active Care/hosting plan unpauses their paused website(s) automatically, and staff
-- are told so they can bring the site back online at the host.
create or replace function public.service_plans_unpause_on_activation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  proj record;
begin
  if new.plan_type not in ('care', 'hosting') or new.status not in ('active', 'past_due') then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status in ('active', 'past_due') then
    return new; -- already counted as active
  end if;

  for proj in
    select p.id, p.client_id, p.name
    from public.projects p
    join public.project_development pd on pd.project_id = p.id
    where p.client_id = new.client_id
      and pd.paused_at is not null
      and (new.project_id is null or new.project_id = p.id)
  loop
    update public.project_development set paused_at = null where project_id = proj.id;
    perform public.notify_agency(
      'projects.manage', proj.client_id, 'website_unpaused',
      'Website unpaused: ' || proj.name,
      'A Care plan started, so the website is no longer paused. Bring the site back online at the host.',
      null, null, proj.id
    );
    perform public.notify_client_users(
      proj.client_id, 'website_unpaused', 'Your website is live again',
      'Thanks for choosing a Website Care plan. Your website is no longer paused.',
      null, null, proj.id, null
    );
  end loop;
  return new;
end;
$$;

revoke all on function public.service_plans_unpause_on_activation() from public, anon, authenticated;

drop trigger if exists service_plans_unpause_on_activation on public.service_plans;
create trigger service_plans_unpause_on_activation
  after insert or update of status on public.service_plans
  for each row execute function public.service_plans_unpause_on_activation();

-- ---------------------------------------------------------------------------
-- Client-safe status gains paused_at (same function, one more column)
-- ---------------------------------------------------------------------------

drop function if exists public.client_project_delivery_status(uuid);
create or replace function public.client_project_delivery_status(p_project_id uuid)
returns table (
  domain_name text,
  domain_status text,
  hosting_status text,
  deployment_status text,
  launch_trial_ends_at timestamptz,
  paused_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.owns_project(p_project_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  return query
  select pd.domain_name, pd.domain_status, pd.hosting_status, pd.deployment_status, pd.launch_trial_ends_at, pd.paused_at
  from public.project_development pd
  where pd.project_id = p_project_id;
end;
$$;

comment on function public.client_project_delivery_status(uuid) is
  'Client-safe domain/hosting/deployment status labels, plus the post-launch free-period end and whether the website is paused, for the caller''s own project. No repository, provider, or credential detail -- see project_development for the full staff-only row.';

revoke all on function public.client_project_delivery_status(uuid) from public, anon;
grant execute on function public.client_project_delivery_status(uuid) to authenticated;
