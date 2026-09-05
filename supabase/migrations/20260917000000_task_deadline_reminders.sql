-- Proactive due-date reminders -- the first time-based (not user-action-
-- triggered) automation in this app. Every notification type until now fired
-- in response to something someone did; due dates existed but nothing
-- actively told staff when one was closing in, so the "pressure" only worked
-- if someone remembered to check their dashboard.
--
-- Runs once daily via pg_cron, calling a plain SQL function -- no Edge
-- Function needed since this only reads tasks/projects and writes
-- notifications, all already reachable from Postgres directly.

alter table public.notifications add column if not exists task_id uuid references public.tasks (id) on delete cascade;

create index if not exists notifications_task_id_idx on public.notifications (task_id) where task_id is not null;

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
    'task_overdue'
  ));

create or replace function public.notify_task_deadlines()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Due tomorrow: fires once per task, ever (a due_date edit that lands back
  -- on "tomorrow" a second time won't re-notify -- acceptable for a v1).
  insert into public.notifications (user_id, type, title, body, project_id, task_id)
  select t.assigned_to, 'task_due_soon', 'Task due tomorrow',
    trim(t.title) || coalesce(' · ' || p.name, ''),
    t.project_id, t.id
  from public.tasks t
  join public.projects p on p.id = t.project_id
  where t.assigned_to is not null
    and t.status <> 'Completed'
    and t.due_date = current_date + 1
    and coalesce(p.archived, false) = false
    and not exists (
      select 1 from public.notifications n
      where n.task_id = t.id and n.type = 'task_due_soon'
    );

  -- Overdue: fires once per task per calendar day it stays overdue and
  -- incomplete -- deliberately a repeating nag, not a one-off, since the
  -- point is ongoing pressure until it's resolved.
  insert into public.notifications (user_id, type, title, body, project_id, task_id)
  select t.assigned_to, 'task_overdue', 'Task overdue',
    trim(t.title) || coalesce(' · ' || p.name, ''),
    t.project_id, t.id
  from public.tasks t
  join public.projects p on p.id = t.project_id
  where t.assigned_to is not null
    and t.status <> 'Completed'
    and t.due_date < current_date
    and coalesce(p.archived, false) = false
    and not exists (
      select 1 from public.notifications n
      where n.task_id = t.id
        and n.type = 'task_overdue'
        and n.created_at::date = current_date
    );
end;
$$;

revoke all on function public.notify_task_deadlines() from public, anon, authenticated;

comment on function public.notify_task_deadlines() is
  'Scheduled daily via pg_cron. Notifies a task''s assignee once when it becomes due tomorrow, and once per day while it stays overdue and incomplete.';

-- Schedule: once daily at 13:00 UTC (~9am US Eastern / 6am Pacific).
-- Requires pg_cron enabled on this project (Database -> Extensions in the
-- Supabase dashboard, or the create extension statement below).
create extension if not exists pg_cron with schema extensions;

select cron.unschedule(jobid) from cron.job where jobname = 'notify-task-deadlines';

select cron.schedule(
  'notify-task-deadlines',
  '0 13 * * *',
  $$select public.notify_task_deadlines();$$
);
