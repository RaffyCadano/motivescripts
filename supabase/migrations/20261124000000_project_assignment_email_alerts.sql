-- Project assignment and removal join the "team_work" email group (same group as task_assigned,
-- task_due_soon/overdue, QA results, and payroll paid) -- so being put on or taken off a project
-- reaches someone who isn't in the app, same as everything else in that group already does.

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
    when 'project_assigned' then 'team_work'
    when 'project_unassigned' then 'team_work'
    else null
  end;
$$;

revoke all on function public.notification_email_category(text) from public, anon, authenticated;
grant execute on function public.notification_email_category(text) to service_role;
