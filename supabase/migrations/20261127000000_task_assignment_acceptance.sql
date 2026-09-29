-- Assigning a task used to take effect instantly. Now it doesn't: the assignee has to accept it
-- first (or decline it, which hands it back as unassigned for someone else to pick up), so nobody
-- gets work landed on them with no say in it.
--
-- assignment_status is set automatically by a trigger on assigned_to, not by any of the several
-- call sites that write it (insertTask, updateTaskRecord, reassignTask, and whatever comes next) --
-- centralizing it here means none of them need to remember to set it, and none of them can get it
-- wrong. Existing rows are grandfathered in as 'accepted' -- this only changes what a NEW
-- assignment does from here on, not work already in flight.
alter table public.tasks add column if not exists assignment_status text check (assignment_status in ('pending', 'accepted'));
alter table public.tasks add column if not exists assigned_by uuid references auth.users (id) on delete set null;

update public.tasks set assignment_status = 'accepted' where assigned_to is not null and assignment_status is null;

comment on column public.tasks.assignment_status is
  'null when unassigned; ''pending'' until the assignee accepts (or declines, which clears assigned_to back to null); ''accepted'' once they have (assigning to yourself auto-accepts). Set only by tasks_set_assignment_status, never written directly.';
comment on column public.tasks.assigned_by is
  'Who most recently set assigned_to on this task (never the assignee themselves, since self-assignment does not go through this) -- who to notify if the assignee declines.';

create or replace function public.tasks_set_assignment_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.assigned_to is null then
    new.assignment_status := null;
    new.assigned_by := null;
    return new;
  end if;
  if tg_op = 'UPDATE' and new.assigned_to is not distinct from old.assigned_to then
    return new;
  end if;
  if new.assigned_to = auth.uid() then
    -- Assigning a task to yourself needs no acceptance from yourself.
    new.assignment_status := 'accepted';
    new.assigned_by := null;
  else
    new.assignment_status := 'pending';
    new.assigned_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists tasks_set_assignment_status_trigger on public.tasks;
create trigger tasks_set_assignment_status_trigger
  before insert or update of assigned_to on public.tasks
  for each row execute function public.tasks_set_assignment_status();

comment on function public.tasks_set_assignment_status() is
  'Computes assignment_status/assigned_by from assigned_to on every insert/reassignment, so no call site has to remember to.';

-- The existing "New task assigned" notification now always describes a task still awaiting
-- acceptance (self-assignment already returns early above and never reaches this point), so its
-- wording changes to say so -- same notification type and routing, just truer copy.
create or replace function public.tasks_notify_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  project_name text;
  assignee_name text;
begin
  if new.assigned_to is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.assigned_to is not distinct from old.assigned_to then
    return new;
  end if;

  select name into project_name from public.projects where id = new.project_id;
  select nullif(trim(full_name), '') into assignee_name from public.profiles where id = new.assigned_to;

  insert into public.activity (project_id, actor_id, activity_type, message, metadata)
  values (
    new.project_id,
    auth.uid(),
    'task_assigned',
    trim(new.title) || ' assigned to ' || coalesce(assignee_name, 'a team member'),
    jsonb_build_object('icon', 'task')
  );

  if new.assigned_to = auth.uid() then
    return new;
  end if;

  insert into public.notifications (user_id, type, title, body, project_id)
  values (
    new.assigned_to,
    'task_assigned',
    'New task needs your acceptance',
    trim(new.title) || coalesce(' · ' || project_name, ''),
    new.project_id
  );

  return new;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Accept / decline
-- ---------------------------------------------------------------------------------------------

create or replace function public.accept_task_assignment(p_task_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  task public.tasks;
begin
  if uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  select * into task from public.tasks where id = p_task_id;
  if not found or task.assigned_to is distinct from uid then
    raise exception 'NOT_ALLOWED';
  end if;
  if task.assignment_status is distinct from 'pending' then
    raise exception 'NOT_PENDING';
  end if;

  update public.tasks set assignment_status = 'accepted', updated_at = now() where id = p_task_id;

  insert into public.activity (project_id, actor_id, activity_type, message, metadata)
  values (task.project_id, uid, 'task_accepted', trim(task.title) || ' accepted', jsonb_build_object('icon', 'task'));
end;
$$;

revoke all on function public.accept_task_assignment(uuid) from public, anon;
grant execute on function public.accept_task_assignment(uuid) to authenticated;

create or replace function public.decline_task_assignment(p_task_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  task public.tasks;
  decliner_name text;
  reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  if uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  select * into task from public.tasks where id = p_task_id;
  if not found or task.assigned_to is distinct from uid then
    raise exception 'NOT_ALLOWED';
  end if;
  if task.assignment_status is distinct from 'pending' then
    raise exception 'NOT_PENDING';
  end if;

  -- Hands it back as a plain unassigned task -- the trigger above clears assignment_status/
  -- assigned_by to null the moment assigned_to goes null, same as any other unassignment.
  update public.tasks set assigned_to = null, assignee = '', updated_at = now() where id = p_task_id;

  select nullif(trim(full_name), '') into decliner_name from public.profiles where id = uid;

  insert into public.activity (project_id, actor_id, activity_type, message, metadata)
  values (
    task.project_id,
    uid,
    'task_declined',
    trim(task.title) || ' declined by ' || coalesce(decliner_name, 'a team member') || coalesce(' -- ' || reason, ''),
    jsonb_build_object('icon', 'task')
  );

  if task.assigned_by is not null and task.assigned_by is distinct from uid then
    insert into public.notifications (user_id, type, title, body, project_id)
    values (
      task.assigned_by,
      'task_assignment_declined',
      'Task declined -- needs reassigning',
      trim(task.title) || ' was declined by ' || coalesce(decliner_name, 'the person you assigned it to') || coalesce('. ' || reason, '.'),
      task.project_id
    );
  end if;
end;
$$;

revoke all on function public.decline_task_assignment(uuid, text) from public, anon;
grant execute on function public.decline_task_assignment(uuid, text) to authenticated;

comment on function public.accept_task_assignment(uuid) is 'The assignee accepts a task pending their acceptance.';
comment on function public.decline_task_assignment(uuid, text) is 'The assignee declines a task pending their acceptance -- it goes back to unassigned, and whoever assigned it is notified.';

-- Belt and suspenders: the app already hides the normal status controls behind the acceptance
-- banner while a task is pending, but this closes the same door server-side -- calling this RPC
-- directly can't be used to skip accept_task_assignment.
create or replace function public.update_my_task_status(
  p_task_id uuid,
  p_status text,
  p_blocked_reason text default null,
  p_qa_result text default null,
  p_qa_fail_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  task public.tasks;
begin
  if uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if not (public.is_admin() or public.is_active_staff()) then
    raise exception 'NOT_ALLOWED';
  end if;
  if p_status not in ('Todo', 'In Progress', 'In Review', 'Completed', 'Blocked') then
    raise exception 'INVALID_STATUS';
  end if;
  if p_status = 'Blocked' and p_blocked_reason is not null and p_blocked_reason not in (
    'waiting_on_client', 'waiting_on_pm', 'waiting_on_designer', 'waiting_on_content',
    'technical_issue', 'external_dependency', 'other'
  ) then
    raise exception 'INVALID_STATUS';
  end if;
  if p_qa_result is not null and p_qa_result not in ('pass', 'fail') then
    raise exception 'INVALID_STATUS';
  end if;

  select * into task from public.tasks where id = p_task_id and assigned_to = uid;
  if not found then
    raise exception 'NOT_ALLOWED';
  end if;
  if task.assignment_status = 'pending' then
    raise exception 'NOT_ACCEPTED';
  end if;

  update public.tasks
  set
    status = p_status,
    blocked_reason = case when p_status = 'Blocked' then p_blocked_reason else null end,
    qa_result = case when p_status = 'Completed' then p_qa_result else null end,
    qa_fail_note = case
      when p_status = 'Completed' and p_qa_result = 'fail' then coalesce(trim(p_qa_fail_note), '')
      else ''
    end,
    completed_at = case
      when p_status = 'Completed' then coalesce(completed_at, now())
      else null
    end,
    updated_at = now()
  where id = p_task_id
    and assigned_to = uid;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Notification type + email routing
-- ---------------------------------------------------------------------------------------------

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
    check (type = any (array[
      'new_message', 'feedback_received', 'changes_requested', 'version_ready_for_review',
      'version_approved', 'project_update', 'proposal_ready', 'proposal_viewed',
      'proposal_accepted', 'proposal_declined', 'contract_ready', 'contract_viewed',
      'contract_accepted', 'contract_declined', 'invoice_ready', 'invoice_viewed',
      'payment_recorded', 'payment_received', 'invoice_paid', 'invoice_overdue',
      'task_assigned', 'task_status_changed', 'project_assigned', 'project_unassigned', 'milestone_updated',
      'task_info_requested', 'task_response_submitted', 'plan_past_due', 'plan_canceled',
      'task_comment_added', 'task_due_soon', 'task_overdue', 'payroll_paid',
      'domain_expiring_soon', 'domain_expired', 'ssl_expiring_soon', 'ssl_expired',
      'qa_failed', 'qa_passed', 'client_review_ready', 'launch_completed',
      'development_completed', 'project_completed', 'lead_submitted', 'care_request_submitted',
      'website_down', 'website_recovered', 'website_slow', 'website_speed_recovered',
      'backup_failed',
      'launch_trial_ending', 'website_paused', 'website_unpaused', 'host_pause_failed',
      'task_assignment_declined'
    ]));

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
    when 'task_assignment_declined' then 'team_work'
    when 'qa_failed' then 'team_work'
    when 'qa_passed' then 'team_work'
    when 'payroll_paid' then 'team_work'
    when 'project_assigned' then 'team_work'
    when 'project_unassigned' then 'team_work'
    else null
  end;
$$;
