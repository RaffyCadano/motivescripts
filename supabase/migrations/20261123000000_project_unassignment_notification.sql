-- Assigning someone to a project already notifies them ("Added to a project", via
-- project_staff_notify_assignment on insert). Removing them notified nobody -- the person found
-- out only by noticing the project had disappeared from their own list. Adds the matching
-- notification on removal, e.g. for "this person is too slow and the deadline is close, swap
-- them out" -- the person being swapped out now hears about it the same way the new person does.

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
      'launch_trial_ending', 'website_paused', 'website_unpaused', 'host_pause_failed'
    ]));

-- Not added to notification_event_for_type() (notification_preferences.sql) -- like
-- project_assigned, task_assigned and the other operational notifications, this is always
-- delivered rather than gated behind one of the eight toggleable preference categories.

create or replace function public.project_staff_notify_unassignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  project_name text;
begin
  if old.user_id = auth.uid() then
    return old;
  end if;

  select name into project_name from public.projects where id = old.project_id;

  insert into public.notifications (user_id, type, title, body, project_id)
  values (
    old.user_id,
    'project_unassigned',
    'Removed from a project',
    coalesce(project_name, 'A project') || ' is no longer assigned to you.',
    old.project_id
  );

  return old;
end;
$$;

drop trigger if exists project_staff_notify_unassignment on public.project_staff_assignments;
create trigger project_staff_notify_unassignment
  after delete on public.project_staff_assignments
  for each row
  execute function public.project_staff_notify_unassignment();
