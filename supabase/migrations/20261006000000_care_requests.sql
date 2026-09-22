-- Care requests: a client's ask for ongoing "Website Care" work (small updates, content changes,
-- technical support) after their site has launched. Kept separate from `tasks` -- which drives
-- project delivery before launch -- so it can carry its own light triage queue (priority + status)
-- without staff having to hunt through Messages for what's been asked for. Uses the same four
-- priority levels as tasks (taskPriorities in src/data/agencyProjects.ts) for a consistent look.
--
-- Submission is not gated on having an *active* Care plan -- a client could reasonably ask for
-- something without one, and blocking them outright would be a business call, not a technical one.
-- Instead each row snapshots whether the client had an active plan at the moment they asked, so
-- staff can see it at a glance and decide.

create table public.care_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  submitted_by uuid references public.profiles (id) on delete set null,
  message text not null,
  priority text not null default 'Medium' check (priority in ('Low', 'Medium', 'High', 'Urgent')),
  status text not null default 'New' check (status in ('New', 'In Progress', 'Done')),
  -- Snapshotted at insert time (by trigger, never trusted from the client) from service_plans, not
  -- re-checked later -- if the client cancels afterwards this row still reflects what was true when
  -- they asked.
  has_active_care_plan boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index care_requests_client_idx on public.care_requests (client_id);
create index care_requests_project_idx on public.care_requests (project_id);
create index care_requests_status_idx on public.care_requests (status);

create trigger care_requests_set_updated_at
  before update on public.care_requests
  for each row execute function public.set_updated_at();

-- Fills in the trusted fields a client submission must not control, checks the project is
-- actually launched (for a client submission -- staff logging one on a client's behalf may do so
-- any time), and stamps resolved_at when a row is created already Done (staff backfilling one).
create or replace function public.care_requests_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_launched boolean;
begin
  select role into v_role from public.profiles where id = auth.uid();

  if not exists (select 1 from public.projects where id = new.project_id and client_id = new.client_id) then
    raise exception 'PROJECT_CLIENT_MISMATCH';
  end if;

  if v_role = 'client' then
    new.submitted_by := auth.uid();
    select coalesce(pd.deployment_status = 'Production', false)
      into v_launched
      from public.project_development pd
      where pd.project_id = new.project_id;
    if not coalesce(v_launched, false) then
      raise exception 'NOT_LAUNCHED';
    end if;
  end if;

  new.has_active_care_plan := exists (
    select 1 from public.service_plans sp
    where sp.plan_type = 'care'
      and sp.status in ('active', 'past_due')
      and (sp.project_id = new.project_id or (sp.project_id is null and sp.client_id = new.client_id))
  );

  if new.status = 'Done' and new.resolved_at is null then
    new.resolved_at := now();
  end if;

  return new;
end;
$$;

create trigger care_requests_before_insert
  before insert on public.care_requests
  for each row execute function public.care_requests_before_insert();

-- Keeps resolved_at in sync with status on every later update (the insert trigger above only
-- covers the moment of creation).
create or replace function public.care_requests_before_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'Done' and old.status is distinct from 'Done' then
    new.resolved_at := now();
  elsif new.status <> 'Done' then
    new.resolved_at := null;
  end if;
  return new;
end;
$$;

create trigger care_requests_before_update
  before update on public.care_requests
  for each row execute function public.care_requests_before_update();

create or replace function public.care_requests_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_name text;
  v_preview text;
begin
  select business_name into v_client_name from public.clients where id = new.client_id;
  v_preview := left(new.message, 140);
  perform public.notify_agency(
    'projects.view',
    new.client_id,
    'care_request_submitted',
    'New care request' || coalesce(' — ' || v_client_name, ''),
    v_preview,
    p_project_id => new.project_id
  );
  return new;
end;
$$;

create trigger care_requests_after_insert
  after insert on public.care_requests
  for each row execute function public.care_requests_after_insert();

alter table public.care_requests enable row level security;

create policy care_requests_client_select on public.care_requests for select to authenticated
  using (public.is_client() and client_id = public.current_client_id());

create policy care_requests_client_insert on public.care_requests for insert to authenticated
  with check (public.is_client() and client_id = public.current_client_id());

create policy care_requests_staff_select on public.care_requests for select to authenticated
  using (public.staff_may_project(project_id, 'projects.view'));

create policy care_requests_staff_insert on public.care_requests for insert to authenticated
  with check (public.staff_may_project(project_id, 'projects.manage'));

create policy care_requests_staff_update on public.care_requests for update to authenticated
  using (public.staff_may_project(project_id, 'projects.manage'))
  with check (public.staff_may_project(project_id, 'projects.manage'));

create policy care_requests_staff_delete on public.care_requests for delete to authenticated
  using (public.staff_may_project(project_id, 'projects.manage'));

revoke all on public.care_requests from public, anon;
grant select, insert on public.care_requests to authenticated;
grant update, delete on public.care_requests to authenticated;
grant all on public.care_requests to service_role;

revoke all on function public.care_requests_before_insert() from public, anon, authenticated;
revoke all on function public.care_requests_before_update() from public, anon, authenticated;
revoke all on function public.care_requests_after_insert() from public, anon, authenticated;

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
      'development_completed', 'project_completed', 'lead_submitted', 'care_request_submitted'
    ]));
