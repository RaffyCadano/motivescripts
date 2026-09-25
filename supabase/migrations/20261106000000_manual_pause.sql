-- A manual "Pause website" for admins (builds on 20261104 / 20261105).
--
-- Until now a website could only be paused by the daily sweep when the free launch period ended. This adds
-- pause_website(): an admin (projects.manage) pauses a launched website on demand, for reasons the system
-- can't see (an unpaid invoice, a client asking to take it down). It is the same status as the automatic pause,
-- so Unpause, the plan-starts trigger, the client banner and the optional Vercel pause all work unchanged.
--
--   * p_notify_client = true (default): the client is notified and emailed, and sees the note (if any).
--     false: staff only. The client's portal then doesn't show the site as paused either.
--   * pause_reason records why ('trial_ended' from the sweep, 'manual' from here) so the messages differ.

alter table public.project_development
  add column if not exists pause_reason text
    check (pause_reason is null or pause_reason in ('trial_ended', 'manual')),
  add column if not exists pause_client_note text,
  add column if not exists pause_client_visible boolean not null default true;

comment on column public.project_development.pause_reason is
  'Why the website is paused: trial_ended (the daily sweep) or manual (an admin pressed Pause). Null when not paused.';
comment on column public.project_development.pause_client_note is
  'The note an admin wrote for the client when pausing manually; shown to the client. Null if none or if the client was not told.';
comment on column public.project_development.pause_client_visible is
  'False for a manual pause an admin chose not to tell the client about: the client portal then shows no paused status.';

-- Anything paused before this migration was paused by the sweep.
update public.project_development set pause_reason = 'trial_ended' where paused_at is not null and pause_reason is null;

-- The sweep, unchanged except that it now records the reason (and clears any old manual note / hidden flag).
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
      update public.project_development
        set paused_at = now(), pause_reason = 'trial_ended', pause_client_note = null, pause_client_visible = true
        where project_id = r.project_id;

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

-- ---------------------------------------------------------------------------
-- pause_website(): the manual pause
-- ---------------------------------------------------------------------------

create or replace function public.pause_website(
  p_project_id uuid,
  p_note text default null,
  p_notify_client boolean default true
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  proj record;
  note text := nullif(btrim(coalesce(p_note, '')), '');
  base_url text;
  service_key text;
begin
  perform public.assert_project_perm(p_project_id, 'projects.manage');

  if note is not null and char_length(note) > 500 then
    raise exception 'NOTE_TOO_LONG' using errcode = 'P0001';
  end if;

  select p.id, p.client_id, p.name, pd.deployment_status, pd.paused_at
    into proj
    from public.projects p
    join public.project_development pd on pd.project_id = p.id
    where p.id = p_project_id
    for update of pd;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if proj.paused_at is not null then
    raise exception 'ALREADY_PAUSED' using errcode = 'P0001';
  end if;
  if proj.deployment_status <> 'Production' then
    raise exception 'NOT_LAUNCHED' using errcode = 'P0001';
  end if;

  update public.project_development
    set paused_at = now(),
        pause_reason = 'manual',
        pause_client_note = case when p_notify_client then note else null end,
        pause_client_visible = coalesce(p_notify_client, true)
    where project_id = p_project_id;

  perform public.notify_agency(
    'projects.manage', proj.client_id, 'website_paused',
    'Website paused: ' || proj.name,
    'A staff member paused this website.' || coalesce(' Note: ' || note || '.', '')
      || ' Take the site offline at the host (unless it is set to pause on Vercel automatically). Use Unpause on the project to bring it back.',
    null, null, p_project_id
  );

  if coalesce(p_notify_client, true) then
    perform public.notify_client_users(
      proj.client_id, 'website_paused', 'Your website has been paused',
      coalesce(note, 'We have paused your website. Get in touch if you have any questions.'),
      null, null, p_project_id, null
    );

    select decrypted_secret into base_url from vault.decrypted_secrets where name = 'edge_function_base_url';
    select decrypted_secret into service_key from vault.decrypted_secrets where name = 'service_role_key';
    if base_url is not null and service_key is not null then
      begin
        perform net.http_post(
          url := base_url || '/functions/v1/document-email',
          headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || service_key),
          body := jsonb_build_object('kind', 'launch_trial', 'id', p_project_id, 'stage', 'manual')
        );
      exception when others then
        raise notice 'pause_website: email request failed for project %: %', p_project_id, sqlerrm;
      end;
    end if;
  end if;

  perform public.request_host_site_control(p_project_id, 'pause');
end;
$$;

revoke all on function public.pause_website(uuid, text, boolean) from public, anon;
grant execute on function public.pause_website(uuid, text, boolean) to authenticated;

comment on function public.pause_website(uuid, text, boolean) is
  'Admin/staff with projects.manage: pause a launched website now. Optional note (max 500 chars) and whether to tell the client (default yes). Raises ALREADY_PAUSED / NOT_LAUNCHED. Also pauses it on Vercel when the project is opted in.';

-- ---------------------------------------------------------------------------
-- Client-safe status: why it is paused, the note, and nothing at all for a silent pause
-- ---------------------------------------------------------------------------

drop function if exists public.client_project_delivery_status(uuid);
create or replace function public.client_project_delivery_status(p_project_id uuid)
returns table (
  domain_name text,
  domain_status text,
  hosting_status text,
  deployment_status text,
  launch_trial_ends_at timestamptz,
  paused_at timestamptz,
  pause_reason text,
  pause_note text
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
  select pd.domain_name, pd.domain_status, pd.hosting_status, pd.deployment_status, pd.launch_trial_ends_at,
         case when pd.pause_client_visible then pd.paused_at else null end,
         case when pd.pause_client_visible and pd.paused_at is not null then pd.pause_reason else null end,
         case when pd.pause_client_visible and pd.paused_at is not null then pd.pause_client_note else null end
  from public.project_development pd
  where pd.project_id = p_project_id;
end;
$$;

comment on function public.client_project_delivery_status(uuid) is
  'Client-safe domain/hosting/deployment status labels, the post-launch free-period end, and whether the website is paused (why, and the admin note), for the caller''s own project. A manual pause the admin chose not to tell the client about shows as not paused. No repository, provider, or credential detail.';

revoke all on function public.client_project_delivery_status(uuid) from public, anon;
grant execute on function public.client_project_delivery_status(uuid) to authenticated;
