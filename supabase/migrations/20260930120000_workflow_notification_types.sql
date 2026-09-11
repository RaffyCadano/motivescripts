-- Extends the existing notifications.type enum with the 4 new transition
-- types the production workflow gates emit (qa_failed, qa_passed,
-- client_review_ready, launch_completed) via the existing notify_agency /
-- notify_client_users helpers -- found missing by direct-transition testing
-- (a QA failure/pass could not be recorded at all before this: the insert
-- into notifications raised notifications_type_check and aborted the whole
-- status-change transaction). Purely additive -- every previously allowed
-- value stays allowed.

alter table public.notifications
  drop constraint if exists notifications_type_check;
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
      'qa_failed', 'qa_passed', 'client_review_ready', 'launch_completed'
    ]));
