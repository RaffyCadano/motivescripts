-- Notification preferences (per person, in-app) plus an in-app notification for new leads.
--
-- Design:
--  * One small table, one row per (user, event). No row = the default, which is ON, so nothing changes
--    for anyone until they switch something off.
--  * Enforcement is a single BEFORE INSERT trigger on public.notifications, not edits to the many
--    functions that create notifications. It maps a notification type to one of eight user-facing
--    events; if that user turned the event off, the row is simply not created. Types that are not
--    mapped (task, deadline, payroll, domain, project and similar notifications) are always delivered.
--  * New leads never created an in-app notification (public-lead only emails support). A trigger on
--    public.leads now notifies admins, for leads that arrive through the public form only.

-- ---------------------------------------------------------------------------
-- 1. notifications: a lead link + the new 'lead_submitted' type
-- ---------------------------------------------------------------------------

alter table public.notifications
  add column if not exists lead_id uuid references public.leads (id) on delete cascade;

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
      'development_completed', 'project_completed', 'lead_submitted'
    ]));

create index if not exists notifications_lead_id_idx on public.notifications (lead_id) where lead_id is not null;

-- ---------------------------------------------------------------------------
-- 2. Preferences
-- ---------------------------------------------------------------------------

create table if not exists public.notification_preferences (
  user_id uuid not null references auth.users (id) on delete cascade,
  event text not null check (event in (
    'proposal_accepted', 'contract_accepted', 'invoice_paid', 'payment_received',
    'file_feedback', 'approval_activity', 'new_message', 'lead_submitted'
  )),
  in_app boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, event)
);

comment on table public.notification_preferences is
  'Per-person in-app notification switches. No row means the default (on). Enforced by notifications_respect_preferences().';

alter table public.notification_preferences enable row level security;

revoke all on table public.notification_preferences from public, anon;
grant select, insert, update, delete on table public.notification_preferences to authenticated;

drop policy if exists notification_preferences_select_own on public.notification_preferences;
drop policy if exists notification_preferences_insert_own on public.notification_preferences;
drop policy if exists notification_preferences_update_own on public.notification_preferences;
drop policy if exists notification_preferences_delete_own on public.notification_preferences;

create policy notification_preferences_select_own on public.notification_preferences
  for select to authenticated using (user_id = auth.uid());
create policy notification_preferences_insert_own on public.notification_preferences
  for insert to authenticated with check (user_id = auth.uid());
create policy notification_preferences_update_own on public.notification_preferences
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notification_preferences_delete_own on public.notification_preferences
  for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 3. Type -> event mapping, and the enforcement trigger
-- ---------------------------------------------------------------------------

create or replace function public.notification_event_for_type(p_type text)
returns text
language sql
immutable
as $$
  select case p_type
    when 'proposal_accepted' then 'proposal_accepted'
    when 'contract_accepted' then 'contract_accepted'
    when 'invoice_paid' then 'invoice_paid'
    when 'payment_received' then 'payment_received'
    when 'payment_recorded' then 'payment_received'
    when 'feedback_received' then 'file_feedback'
    when 'changes_requested' then 'file_feedback'
    when 'version_approved' then 'approval_activity'
    when 'version_ready_for_review' then 'approval_activity'
    when 'new_message' then 'new_message'
    when 'lead_submitted' then 'lead_submitted'
    else null
  end;
$$;

create or replace function public.notifications_respect_preferences()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event text;
begin
  v_event := public.notification_event_for_type(new.type);
  if v_event is null then
    return new;
  end if;
  if exists (
    select 1
    from public.notification_preferences p
    where p.user_id = new.user_id and p.event = v_event and p.in_app = false
  ) then
    return null; -- the person turned this event off: skip the insert
  end if;
  return new;
end;
$$;

drop trigger if exists notifications_respect_preferences on public.notifications;
create trigger notifications_respect_preferences
  before insert on public.notifications
  for each row execute function public.notifications_respect_preferences();

revoke all on function public.notifications_respect_preferences() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. New-lead notification for admins
-- ---------------------------------------------------------------------------

create or replace function public.notify_admins_new_lead()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only leads that arrive without a signed-in user (the public Start a Project form runs as the service
  -- role). A lead an admin adds by hand does not notify admins about their own action.
  if auth.uid() is not null then
    return new;
  end if;

  begin
    insert into public.notifications (user_id, type, title, body, lead_id)
    select
      p.id,
      'lead_submitted',
      'New lead: ' || coalesce(nullif(trim(new.business_name), ''), nullif(trim(new.name), ''), 'New inquiry'),
      left(coalesce(nullif(trim(new.request), ''), 'New project inquiry'), 200),
      new.id
    from public.profiles p
    where p.role = 'admin';
  exception when others then
    -- Capturing the lead must never fail because a notification could not be written.
    null;
  end;

  return new;
end;
$$;

drop trigger if exists leads_notify_admins on public.leads;
create trigger leads_notify_admins
  after insert on public.leads
  for each row execute function public.notify_admins_new_lead();

revoke all on function public.notify_admins_new_lead() from public, anon, authenticated;
