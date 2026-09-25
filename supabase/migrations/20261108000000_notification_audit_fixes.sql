-- Notification audit fixes.
--
-- 1. delete_project failed for any project that had a file notification: notifications.deliverable_id (and the
--    proposal / contract / invoice / message / conversation links) were ON DELETE RESTRICT, but delete_project
--    deletes the project's deliverables. A notification about something that no longer exists has nothing to open,
--    so those links now cascade, and a deleted project just clears the notification's project link.
-- 2. The overdue-task reminder created a fresh notification every day per task, so a task overdue for a month left
--    30 of them and pushed real notifications out of the 40-item list. It now skips a task while the previous
--    reminder is still unread.
-- 3. Notifications were never purged. Read ones older than 60 days and any older than 180 days are removed daily.
-- 4. List query index: (user_id, created_at desc). The plain user_id index is covered by it.

-- ---------------------------------------------------------------------------
-- 1. Foreign keys
-- ---------------------------------------------------------------------------

alter table public.notifications drop constraint if exists notifications_deliverable_id_fkey;
alter table public.notifications add constraint notifications_deliverable_id_fkey
  foreign key (deliverable_id) references public.deliverables (id) on delete cascade;

alter table public.notifications drop constraint if exists notifications_proposal_id_fkey;
alter table public.notifications add constraint notifications_proposal_id_fkey
  foreign key (proposal_id) references public.proposals (id) on delete cascade;

alter table public.notifications drop constraint if exists notifications_contract_id_fkey;
alter table public.notifications add constraint notifications_contract_id_fkey
  foreign key (contract_id) references public.contracts (id) on delete cascade;

alter table public.notifications drop constraint if exists notifications_invoice_id_fkey;
alter table public.notifications add constraint notifications_invoice_id_fkey
  foreign key (invoice_id) references public.invoices (id) on delete cascade;

alter table public.notifications drop constraint if exists notifications_message_id_fkey;
alter table public.notifications add constraint notifications_message_id_fkey
  foreign key (message_id) references public.messages (id) on delete cascade;

alter table public.notifications drop constraint if exists notifications_conversation_id_fkey;
alter table public.notifications add constraint notifications_conversation_id_fkey
  foreign key (conversation_id) references public.conversations (id) on delete cascade;

alter table public.notifications drop constraint if exists notifications_project_id_fkey;
alter table public.notifications add constraint notifications_project_id_fkey
  foreign key (project_id) references public.projects (id) on delete set null;

-- ---------------------------------------------------------------------------
-- 2. Overdue reminder: one open reminder per task
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.notify_task_deadlines()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
        and (n.created_at::date = current_date or n.read_at is null)
    );
end;
$function$;

-- ---------------------------------------------------------------------------
-- 3. Retention
-- ---------------------------------------------------------------------------

create or replace function public.purge_old_notifications()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  removed integer;
begin
  delete from public.notifications
  where (read_at is not null and read_at < now() - interval '60 days')
     or created_at < now() - interval '180 days';
  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke all on function public.purge_old_notifications() from public, anon, authenticated;
grant execute on function public.purge_old_notifications() to service_role;

select cron.unschedule(jobid) from cron.job where jobname = 'purge-old-notifications';
select cron.schedule(
  'purge-old-notifications',
  '30 3 * * *',
  $$ do $do$ begin perform public.purge_old_notifications(); exception when others then raise warning 'purge_old_notifications failed: %', sqlerrm; end $do$; $$
);

-- ---------------------------------------------------------------------------
-- 4. Index
-- ---------------------------------------------------------------------------

create index if not exists notifications_user_created_idx on public.notifications (user_id, created_at desc);
drop index if exists public.notifications_user_id_idx;
