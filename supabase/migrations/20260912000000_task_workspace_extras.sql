-- Task Workspace extras: per-task comments, per-task file attachments, and
-- checklist items. All three are internal-only (no client policy) -- tasks
-- themselves are never shown in the client portal, only milestones/files/
-- feedback are. Additive; existing tasks/RLS unchanged.

-- ---------------------------------------------------------------------------
-- 1. task_comments: lightweight notes on a task, distinct from project-wide
--    Messages and from the client-facing feedback/pin-comment system.
-- ---------------------------------------------------------------------------

create table public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  author_id uuid references auth.users (id) on delete set null,
  author_label text not null default 'Team',
  body text not null,
  created_at timestamptz not null default now(),
  constraint task_comments_body_len check (char_length(trim(body)) between 1 and 4000)
);

create index task_comments_task_id_idx on public.task_comments (task_id, created_at);

alter table public.task_comments enable row level security;

create policy task_comments_select on public.task_comments
  for select to authenticated
  using (public.is_admin() or public.staff_may_project(project_id, 'projects.view'));

create policy task_comments_insert on public.task_comments
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and (public.is_admin() or public.staff_may_project(project_id, 'projects.view'))
  );

revoke all on table public.task_comments from public, anon;
grant select, insert on table public.task_comments to authenticated;

-- Notify the task's assignee when someone else comments.
create or replace function public.task_comments_notify_assignee()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  assignee uuid;
  task_title text;
  project_name text;
begin
  select t.assigned_to, t.title, p.name
    into assignee, task_title, project_name
  from public.tasks t
  join public.projects p on p.id = t.project_id
  where t.id = new.task_id;

  if assignee is null or assignee = new.author_id then
    return new;
  end if;

  insert into public.notifications (user_id, type, title, body, project_id)
  values (
    assignee,
    'task_comment_added',
    'New comment on your task',
    coalesce(new.author_label, 'Someone') || ' commented on ' || coalesce(task_title, 'a task') ||
      coalesce(' · ' || project_name, ''),
    new.project_id
  );

  return new;
end;
$$;

revoke all on function public.task_comments_notify_assignee() from public, anon;

create trigger task_comments_notify_assignee
  after insert on public.task_comments
  for each row execute function public.task_comments_notify_assignee();

-- ---------------------------------------------------------------------------
-- 2. task_checklist_items: simple ordered checklist within a task.
-- ---------------------------------------------------------------------------

create table public.task_checklist_items (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  label text not null,
  done boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  constraint task_checklist_items_label_len check (char_length(trim(label)) between 1 and 300)
);

create index task_checklist_items_task_id_idx on public.task_checklist_items (task_id, position);

alter table public.task_checklist_items enable row level security;

create policy task_checklist_items_select on public.task_checklist_items
  for select to authenticated
  using (public.is_admin() or public.staff_may_project(project_id, 'projects.view'));

create policy task_checklist_items_insert on public.task_checklist_items
  for insert to authenticated
  with check (public.is_admin() or public.staff_may_project(project_id, 'projects.view'));

create policy task_checklist_items_update on public.task_checklist_items
  for update to authenticated
  using (public.is_admin() or public.staff_may_project(project_id, 'projects.view'))
  with check (public.is_admin() or public.staff_may_project(project_id, 'projects.view'));

create policy task_checklist_items_delete on public.task_checklist_items
  for delete to authenticated
  using (public.is_admin() or public.staff_may_project(project_id, 'projects.view'));

revoke all on table public.task_checklist_items from public, anon;
grant select, insert, update, delete on table public.task_checklist_items to authenticated;

-- ---------------------------------------------------------------------------
-- 3. task_attachments: internal working files tied to a specific task.
--    Distinct from deliverables (client-reviewable, versioned, has an
--    approval workflow) -- these are supporting files (screenshots,
--    reference docs) with no version history and no client visibility.
-- ---------------------------------------------------------------------------

create table public.task_attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  file_name text not null,
  file_size bigint not null default 0,
  storage_path text not null,
  uploaded_by uuid references auth.users (id) on delete set null,
  uploaded_by_label text not null default 'Team',
  created_at timestamptz not null default now(),
  constraint task_attachments_name_len check (char_length(trim(file_name)) between 1 and 300),
  constraint task_attachments_path_len check (char_length(storage_path) between 1 and 500)
);

create index task_attachments_task_id_idx on public.task_attachments (task_id, created_at);

alter table public.task_attachments enable row level security;

create policy task_attachments_select on public.task_attachments
  for select to authenticated
  using (public.is_admin() or public.staff_may_project(project_id, 'projects.view'));

create policy task_attachments_insert on public.task_attachments
  for insert to authenticated
  with check (
    uploaded_by = auth.uid()
    and (public.is_admin() or public.staff_may_project(project_id, 'projects.view'))
  );

create policy task_attachments_delete on public.task_attachments
  for delete to authenticated
  using (
    public.is_admin()
    or uploaded_by = auth.uid()
    or public.staff_may_project(project_id, 'projects.manage')
  );

revoke all on table public.task_attachments from public, anon;
grant select, insert, delete on table public.task_attachments to authenticated;

-- Storage: reuse the existing private project-files bucket.
-- Path shape: projects/{projectId}/tasks/{taskId}/attachments/{fileId}.{ext}
-- Distinct segment count/shape from deliverable, contract, discovery, and
-- task-request paths (parts[4] here is a real task uuid, never the literal
-- 'requests' the task-request parser checks for -- no collision either way).

create or replace function public.task_for_attachment_storage_path(object_name text)
returns public.tasks
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  parts text[];
  pid uuid;
  tid uuid;
  row public.tasks;
begin
  if object_name is null then
    return null;
  end if;

  parts := string_to_array(object_name, '/');
  if array_length(parts, 1) is distinct from 6 then
    return null;
  end if;
  if parts[1] <> 'projects' or parts[3] <> 'tasks' or parts[5] <> 'attachments' then
    return null;
  end if;
  if parts[6] is null
    or parts[6] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]+$'
  then
    return null;
  end if;

  begin
    pid := parts[2]::uuid;
    tid := parts[4]::uuid;
  exception
    when invalid_text_representation then
      return null;
  end;

  select t.* into row
  from public.tasks t
  where t.id = tid
    and t.project_id = pid;

  if not found then
    return null;
  end if;

  return row;
end;
$$;

comment on function public.task_for_attachment_storage_path(text) is
  'Parse a task-attachment storage path and return the matching tasks row, or NULL when invalid.';

create or replace function public.can_access_task_attachment(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  t public.tasks;
begin
  t := public.task_for_attachment_storage_path(object_name);
  if t is null then
    return false;
  end if;
  return public.is_admin() or public.staff_may_project(t.project_id, 'projects.view');
end;
$$;

create or replace function public.can_upload_task_attachment(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return public.can_access_task_attachment(object_name);
end;
$$;

create or replace function public.can_delete_task_attachment(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  t public.tasks;
  row public.task_attachments;
begin
  t := public.task_for_attachment_storage_path(object_name);
  if t is null then
    return false;
  end if;
  if public.is_admin() or public.staff_may_project(t.project_id, 'projects.manage') then
    return true;
  end if;
  select a.* into row from public.task_attachments a where a.storage_path = object_name;
  return found and row.uploaded_by = auth.uid();
end;
$$;

drop policy if exists task_attachment_storage_select on storage.objects;
create policy task_attachment_storage_select
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'project-files' and public.can_access_task_attachment(name));

drop policy if exists task_attachment_storage_insert on storage.objects;
create policy task_attachment_storage_insert
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'project-files' and public.can_upload_task_attachment(name));

drop policy if exists task_attachment_storage_delete on storage.objects;
create policy task_attachment_storage_delete
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'project-files' and public.can_delete_task_attachment(name));

-- ---------------------------------------------------------------------------
-- 4. Notification type
-- ---------------------------------------------------------------------------

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
    'task_comment_added'
  ));
