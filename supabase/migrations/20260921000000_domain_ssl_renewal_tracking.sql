-- Domain/SSL renewal tracking -- the domain field added in
-- 20260911000000_service_plan_domain.sql was only ever a free-text reference
-- note with no expiration date, so nothing in the app ever warned anyone
-- before a client's domain or SSL certificate lapsed. That's one of the most
-- common causes of a small-business site silently going down. This adds
-- renewal dates plus the same "upcoming, then repeating overdue" reminder
-- shape already used for task deadlines (20260917000000).

alter table public.service_plans
  add column if not exists domain_expires_at date,
  add column if not exists ssl_expires_at date;

comment on column public.service_plans.domain_expires_at is
  'Manual renewal-date reference for the domain noted on this plan. Nothing here renews it automatically -- purely a reminder trigger.';
comment on column public.service_plans.ssl_expires_at is
  'Manual renewal-date reference for the SSL certificate on this plan''s site, if managed outside an auto-renewing host.';

alter table public.notifications
  add column if not exists service_plan_id uuid references public.service_plans (id) on delete cascade;

create index if not exists notifications_service_plan_id_idx
  on public.notifications (service_plan_id) where service_plan_id is not null;

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check check (type in (
    'new_message',
    'feedback_received',
    'changes_requested',
    'version_ready_for_review',
    'version_approved',
    'project_update',
    'proposal_ready',
    'proposal_viewed',
    'proposal_accepted',
    'proposal_declined',
    'contract_ready',
    'contract_viewed',
    'contract_accepted',
    'contract_declined',
    'invoice_ready',
    'invoice_viewed',
    'payment_recorded',
    'payment_received',
    'invoice_paid',
    'invoice_overdue',
    'task_assigned',
    'task_status_changed',
    'project_assigned',
    'milestone_updated',
    'task_info_requested',
    'task_response_submitted',
    'plan_past_due',
    'plan_canceled',
    'task_comment_added',
    'task_due_soon',
    'task_overdue',
    'payroll_paid',
    'domain_expiring_soon',
    'domain_expired',
    'ssl_expiring_soon',
    'ssl_expired'
  ));

-- Widen set_service_plan_domain to also record renewal dates in the same
-- save action as the domain note itself. Dropped first since appending
-- parameters changes the signature -- see 20260918000000 for why.
drop function if exists public.set_service_plan_domain(uuid, text);

create or replace function public.set_service_plan_domain(
  p_plan_id uuid,
  p_domain text,
  p_domain_expires_at date default null,
  p_ssl_expires_at date default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if not exists (select 1 from public.service_plans where id = p_plan_id) then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  update public.service_plans
    set domain = nullif(lower(trim(p_domain)), ''),
        domain_expires_at = p_domain_expires_at,
        ssl_expires_at = p_ssl_expires_at
    where id = p_plan_id;
end;
$$;
revoke all on function public.set_service_plan_domain(uuid, text, date, date) from public, anon;
grant execute on function public.set_service_plan_domain(uuid, text, date, date) to authenticated;

-- Scheduled daily alongside notify_task_deadlines() (same cron job, see
-- below). Recipients match plan_past_due/plan_canceled's existing audience
-- (admins, plus staff holding activity.view on that client) rather than
-- true-admins-only, since this is the same "this recurring/infrastructure
-- thing on service_plans needs attention" class of alert.
create or replace function public.notify_domain_ssl_renewals()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Domain expiring in 30 days: fires once per plan, ever.
  insert into public.notifications (user_id, type, title, body, project_id, service_plan_id)
  select p.id, 'domain_expiring_soon', 'Domain renewal due in 30 days',
    sp.label || coalesce(' · ' || sp.domain, '') || ' — renews ' || sp.domain_expires_at,
    sp.project_id, sp.id
  from public.service_plans sp
  join public.profiles p on true
  left join public.staff_profiles s on s.user_id = p.id
  where sp.status <> 'canceled'
    and sp.domain_expires_at = current_date + 30
    and (
      (p.role = 'admin' and coalesce(s.is_active, true))
      or (
        p.role = 'staff' and coalesce(s.is_active, false)
        and public.staff_may_client(sp.client_id, 'activity.view')
      )
    )
    and not exists (
      select 1 from public.notifications n
      where n.service_plan_id = sp.id and n.type = 'domain_expiring_soon'
    );

  -- Domain expired: fires once per plan per calendar day while it stays
  -- expired and the plan isn't canceled -- a deliberate repeating nag.
  insert into public.notifications (user_id, type, title, body, project_id, service_plan_id)
  select p.id, 'domain_expired', 'Domain renewal overdue',
    sp.label || coalesce(' · ' || sp.domain, '') || ' — was due ' || sp.domain_expires_at,
    sp.project_id, sp.id
  from public.service_plans sp
  join public.profiles p on true
  left join public.staff_profiles s on s.user_id = p.id
  where sp.status <> 'canceled'
    and sp.domain_expires_at <= current_date
    and (
      (p.role = 'admin' and coalesce(s.is_active, true))
      or (
        p.role = 'staff' and coalesce(s.is_active, false)
        and public.staff_may_client(sp.client_id, 'activity.view')
      )
    )
    and not exists (
      select 1 from public.notifications n
      where n.service_plan_id = sp.id
        and n.type = 'domain_expired'
        and n.created_at::date = current_date
    );

  -- SSL expiring in 30 days: fires once per plan, ever.
  insert into public.notifications (user_id, type, title, body, project_id, service_plan_id)
  select p.id, 'ssl_expiring_soon', 'SSL certificate renewal due in 30 days',
    sp.label || coalesce(' · ' || sp.domain, '') || ' — renews ' || sp.ssl_expires_at,
    sp.project_id, sp.id
  from public.service_plans sp
  join public.profiles p on true
  left join public.staff_profiles s on s.user_id = p.id
  where sp.status <> 'canceled'
    and sp.ssl_expires_at = current_date + 30
    and (
      (p.role = 'admin' and coalesce(s.is_active, true))
      or (
        p.role = 'staff' and coalesce(s.is_active, false)
        and public.staff_may_client(sp.client_id, 'activity.view')
      )
    )
    and not exists (
      select 1 from public.notifications n
      where n.service_plan_id = sp.id and n.type = 'ssl_expiring_soon'
    );

  -- SSL expired: fires once per plan per calendar day while it stays
  -- expired and the plan isn't canceled.
  insert into public.notifications (user_id, type, title, body, project_id, service_plan_id)
  select p.id, 'ssl_expired', 'SSL certificate renewal overdue',
    sp.label || coalesce(' · ' || sp.domain, '') || ' — was due ' || sp.ssl_expires_at,
    sp.project_id, sp.id
  from public.service_plans sp
  join public.profiles p on true
  left join public.staff_profiles s on s.user_id = p.id
  where sp.status <> 'canceled'
    and sp.ssl_expires_at <= current_date
    and (
      (p.role = 'admin' and coalesce(s.is_active, true))
      or (
        p.role = 'staff' and coalesce(s.is_active, false)
        and public.staff_may_client(sp.client_id, 'activity.view')
      )
    )
    and not exists (
      select 1 from public.notifications n
      where n.service_plan_id = sp.id
        and n.type = 'ssl_expired'
        and n.created_at::date = current_date
    );
end;
$$;

revoke all on function public.notify_domain_ssl_renewals() from public, anon, authenticated;

comment on function public.notify_domain_ssl_renewals() is
  'Scheduled daily via pg_cron (same job as notify_task_deadlines). Notifies admins/relevant staff once when a plan''s domain or SSL cert is 30 days from expiring, and once per day while it stays expired.';

-- Fold into the existing daily job rather than creating a second cron entry.
select cron.unschedule(jobid) from cron.job where jobname = 'notify-task-deadlines';

select cron.schedule(
  'notify-task-deadlines',
  '0 13 * * *',
  $$select public.notify_task_deadlines(); select public.notify_domain_ssl_renewals();$$
);
