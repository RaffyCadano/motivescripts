-- Email copies of the staff notifications, so the important ones reach people who are not in the app.
--
-- Until now everything for staff was an in-app bell alert (only a client's message, a new lead and staff
-- invitations were emailed). This emails the same alerts, for four groups:
--   money            proposal accepted, contract accepted, invoice paid, payment received
--   client_activity  file feedback and approvals, care requests, a client's response to an information request
--   site_alerts      website down / slow / recovered, backup failed, pause and unpause, host pause failed,
--                    domain and SSL renewals
--   team_work        task assigned, due tomorrow, overdue, QA passed / failed, payroll paid
--
-- How it works: an AFTER INSERT trigger on public.notifications queues a call to document-email
-- (kind staff_notification) for a notification that belongs to an admin or staff member and is one of the types
-- above. document-email then checks the person is active, whether they switched that group's email off in
-- their profile (staff_email_preferences; everything is on by default), and throttles the repeating reminders
-- (overdue task, domain or SSL expired) to one email per item per week, then sends and records the email in
-- staff_email_log. Because it hangs off the notification, a person who muted an event in-app gets no email for
-- it either, and clients are never emailed by this path.
--
-- If the Vault secrets are missing on an environment nothing is queued. The trigger never blocks or fails the
-- insert of a notification.

-- ---------------------------------------------------------------------------
-- 1. Which notification types are emailed, and in which group
-- ---------------------------------------------------------------------------

create or replace function public.notification_email_category(p_type text)
returns text
language sql
immutable
as $$
  select case p_type
    when 'proposal_accepted' then 'money'
    when 'contract_accepted' then 'money'
    when 'invoice_paid' then 'money'
    when 'payment_received' then 'money'
    when 'payment_recorded' then 'money'

    when 'feedback_received' then 'client_activity'
    when 'changes_requested' then 'client_activity'
    when 'version_approved' then 'client_activity'
    when 'care_request_submitted' then 'client_activity'
    when 'task_response_submitted' then 'client_activity'

    when 'website_down' then 'site_alerts'
    when 'website_recovered' then 'site_alerts'
    when 'website_slow' then 'site_alerts'
    when 'website_speed_recovered' then 'site_alerts'
    when 'backup_failed' then 'site_alerts'
    when 'website_paused' then 'site_alerts'
    when 'website_unpaused' then 'site_alerts'
    when 'host_pause_failed' then 'site_alerts'
    when 'domain_expiring_soon' then 'site_alerts'
    when 'domain_expired' then 'site_alerts'
    when 'ssl_expiring_soon' then 'site_alerts'
    when 'ssl_expired' then 'site_alerts'

    when 'task_assigned' then 'team_work'
    when 'task_due_soon' then 'team_work'
    when 'task_overdue' then 'team_work'
    when 'qa_failed' then 'team_work'
    when 'qa_passed' then 'team_work'
    when 'payroll_paid' then 'team_work'
    else null
  end;
$$;

revoke all on function public.notification_email_category(text) from public, anon, authenticated;
grant execute on function public.notification_email_category(text) to service_role;

-- ---------------------------------------------------------------------------
-- 2. Personal switches (email, per group) and the record of what was sent
-- ---------------------------------------------------------------------------

create table if not exists public.staff_email_preferences (
  user_id uuid not null references auth.users (id) on delete cascade,
  category text not null check (category in ('money', 'client_activity', 'site_alerts', 'team_work')),
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, category)
);

comment on table public.staff_email_preferences is
  'Per-person email switches for the staff alert groups. No row means on. Read by document-email (staff_notification).';

alter table public.staff_email_preferences enable row level security;
revoke all on table public.staff_email_preferences from public, anon;
grant select, insert, update, delete on table public.staff_email_preferences to authenticated;

drop policy if exists staff_email_preferences_select_own on public.staff_email_preferences;
drop policy if exists staff_email_preferences_insert_own on public.staff_email_preferences;
drop policy if exists staff_email_preferences_update_own on public.staff_email_preferences;
drop policy if exists staff_email_preferences_delete_own on public.staff_email_preferences;
create policy staff_email_preferences_select_own on public.staff_email_preferences
  for select to authenticated using (user_id = auth.uid());
create policy staff_email_preferences_insert_own on public.staff_email_preferences
  for insert to authenticated with check (user_id = auth.uid());
create policy staff_email_preferences_update_own on public.staff_email_preferences
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy staff_email_preferences_delete_own on public.staff_email_preferences
  for delete to authenticated using (user_id = auth.uid());

create table if not exists public.staff_email_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  notification_id uuid,
  type text not null,
  category text not null,
  related_id uuid,
  subject text not null,
  to_email text not null,
  provider_id text,
  created_at timestamptz not null default now()
);

comment on table public.staff_email_log is
  'Staff alert emails sent by document-email (staff_notification). related_id is the task or service plan for the repeating reminders, used to throttle them.';

create index if not exists staff_email_log_user_idx on public.staff_email_log (user_id, created_at desc);
create index if not exists staff_email_log_related_idx on public.staff_email_log (user_id, type, related_id, created_at desc);

alter table public.staff_email_log enable row level security;
revoke all on table public.staff_email_log from public, anon;
grant select on table public.staff_email_log to authenticated;
grant select, insert on table public.staff_email_log to service_role;

drop policy if exists staff_email_log_select_own on public.staff_email_log;
create policy staff_email_log_select_own on public.staff_email_log
  for select to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 3. The trigger that queues the email
-- ---------------------------------------------------------------------------

create or replace function public.notifications_email_staff()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  base_url text;
  service_key text;
begin
  if public.notification_email_category(new.type) is null then
    return new;
  end if;
  -- Only people on the team: clients have their own emails and are never emailed from here.
  if not exists (select 1 from public.profiles p where p.id = new.user_id and p.role in ('admin', 'staff')) then
    return new;
  end if;

  select decrypted_secret into base_url from vault.decrypted_secrets where name = 'edge_function_base_url';
  select decrypted_secret into service_key from vault.decrypted_secrets where name = 'service_role_key';
  if base_url is null or service_key is null then
    return new;
  end if;

  perform net.http_post(
    url := base_url || '/functions/v1/document-email',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || service_key),
    body := jsonb_build_object('kind', 'staff_notification', 'id', new.id)
  );
  return new;
exception when others then
  -- An email problem must never stop the notification itself from being created.
  return new;
end;
$$;

revoke all on function public.notifications_email_staff() from public, anon, authenticated;

drop trigger if exists notifications_email_staff on public.notifications;
create trigger notifications_email_staff
  after insert on public.notifications
  for each row execute function public.notifications_email_staff();
