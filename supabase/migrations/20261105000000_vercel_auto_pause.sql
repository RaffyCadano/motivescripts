-- Optional automatic pause on Vercel (builds on 20261104000000_launch_trial_pause_and_reminders.sql).
--
-- "Paused" stays a status in this system. For a project an admin has opted in (auto_pause_on_vercel) and
-- given a Vercel project, the same events that set / clear the status ALSO ask the vercel-site-control
-- edge function to pause / unpause that Vercel project, using Vercel's own project-pause API:
--   * the daily sweep pausing an expired project        -> pause
--   * unpause_website() (admin)                         -> unpause
--   * a Care / hosting plan starting                     -> unpause
--   * retry_host_site_control() (admin, after a failure) -> whichever action makes Vercel match the status
--
-- Nothing changes for a project that isn't opted in, and nothing happens at all until a VERCEL_API_TOKEN
-- secret is set on the edge function. The edge function records the outcome on the project
-- (host_paused_at / host_pause_error) and alerts staff if Vercel refused, so a failure never blocks the
-- status change: the staff alert to do it by hand is always still there.

alter table public.project_development
  add column if not exists vercel_project_id text,
  add column if not exists vercel_team_id text,
  add column if not exists auto_pause_on_vercel boolean not null default false,
  add column if not exists host_paused_at timestamptz,
  add column if not exists host_pause_error text;

comment on column public.project_development.vercel_project_id is
  'The Vercel project (name or id) behind this website, for automatic pause. Letters, digits, dot, dash, underscore only.';
comment on column public.project_development.vercel_team_id is
  'Vercel team id (team_...) or slug when the project belongs to a team; null for a personal account.';
comment on column public.project_development.auto_pause_on_vercel is
  'Opt-in, default off: when true (and vercel_project_id is set) pausing / unpausing this website also pauses / unpauses it on Vercel.';
comment on column public.project_development.host_paused_at is
  'When vercel-site-control last confirmed the project paused on Vercel; cleared when it confirms an unpause. Written only by that function.';
comment on column public.project_development.host_pause_error is
  'The last failure from vercel-site-control (no token, Vercel refused, ...), cleared on the next success. Written only by that function.';

alter table public.project_development
  drop constraint if exists project_development_vercel_ids_check;
alter table public.project_development
  add constraint project_development_vercel_ids_check
    check (
      (vercel_project_id is null or vercel_project_id ~ '^[A-Za-z0-9._-]{1,100}$')
      and (vercel_team_id is null or vercel_team_id ~ '^[A-Za-z0-9._-]{1,100}$')
    );

-- One more notification type: the automatic pause / unpause on Vercel failed.
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
      'launch_trial_ending', 'website_paused', 'website_unpaused', 'host_pause_failed'
    ]));

-- ---------------------------------------------------------------------------
-- Ask the edge function to pause / unpause the project on Vercel
-- ---------------------------------------------------------------------------

-- Does nothing unless the project is opted in and has a Vercel project. The HTTP call is asynchronous
-- (pg_net), so it never holds up, or fails, the transaction that called it.
create or replace function public.request_host_site_control(p_project_id uuid, p_action text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  base_url text;
  service_key text;
begin
  if p_action not in ('pause', 'unpause') then
    raise exception 'INVALID_ACTION' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.project_development pd
    where pd.project_id = p_project_id
      and pd.auto_pause_on_vercel
      and coalesce(pd.vercel_project_id, '') <> ''
  ) then
    return;
  end if;

  select decrypted_secret into base_url from vault.decrypted_secrets where name = 'edge_function_base_url';
  select decrypted_secret into service_key from vault.decrypted_secrets where name = 'service_role_key';
  if base_url is null or service_key is null then
    update public.project_development
      set host_pause_error = 'The server secrets for calling Vercel are not set up on this environment.'
      where project_id = p_project_id;
    return;
  end if;

  begin
    perform net.http_post(
      url := base_url || '/functions/v1/vercel-site-control',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || service_key),
      body := jsonb_build_object('projectId', p_project_id, 'action', p_action)
    );
  exception when others then
    raise notice 'request_host_site_control failed for project %: %', p_project_id, sqlerrm;
  end;
end;
$$;

revoke all on function public.request_host_site_control(uuid, text) from public, anon, authenticated;

comment on function public.request_host_site_control(uuid, text) is
  'Asynchronously asks the vercel-site-control edge function to pause or unpause the project on Vercel, if the project is opted in (auto_pause_on_vercel + vercel_project_id). Called by the launch-trial sweep, unpause_website(), the plan trigger and retry_host_site_control().';

-- Retry (admin): make Vercel match the status after a failure. Paused here but not on Vercel -> pause;
-- live here but still paused on Vercel -> unpause. Requires projects.manage.
create or replace function public.retry_host_site_control(p_project_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  pd record;
begin
  perform public.assert_project_perm(p_project_id, 'projects.manage');
  select paused_at, host_paused_at, auto_pause_on_vercel, vercel_project_id
    into pd from public.project_development where project_id = p_project_id;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if not pd.auto_pause_on_vercel or coalesce(pd.vercel_project_id, '') = '' then
    raise exception 'NOT_ENABLED' using errcode = 'P0001';
  end if;
  if pd.paused_at is not null and pd.host_paused_at is null then
    perform public.request_host_site_control(p_project_id, 'pause');
  elsif pd.paused_at is null and pd.host_paused_at is not null then
    perform public.request_host_site_control(p_project_id, 'unpause');
  else
    raise exception 'NOTHING_TO_DO' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.retry_host_site_control(uuid) from public, anon;
grant execute on function public.retry_host_site_control(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Hook the three events (same functions as before, one added line each)
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
        'The free launch period ended and there is no active Care plan. Take the site offline at the host (unless it is set to pause on Vercel automatically). Use Unpause on the project to bring it back.',
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

      perform public.request_host_site_control(r.project_id, 'pause');
    exception when others then
      raise notice 'run_launch_trial_sweep: pause failed for project %: %', r.project_id, sqlerrm;
    end;
  end loop;

  -- 2. Reminders, only for projects that would actually be paused (no plan, not exempt).
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

  perform public.request_host_site_control(p_project_id, 'unpause');
end;
$$;

revoke all on function public.unpause_website(uuid, integer) from public, anon;
grant execute on function public.unpause_website(uuid, integer) to authenticated;

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
      'A Care plan started, so the website is no longer paused. Bring the site back online at the host (unless it is set to pause on Vercel automatically).',
      null, null, proj.id
    );
    perform public.notify_client_users(
      proj.client_id, 'website_unpaused', 'Your website is live again',
      'Thanks for choosing a Website Care plan. Your website is no longer paused.',
      null, null, proj.id, null
    );
    perform public.request_host_site_control(proj.id, 'unpause');
  end loop;
  return new;
end;
$$;

revoke all on function public.service_plans_unpause_on_activation() from public, anon, authenticated;
