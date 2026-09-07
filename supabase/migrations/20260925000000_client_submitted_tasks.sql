-- Post-launch client support -- clients previously had no way to report an
-- issue or request support; only staff could create tasks. This lets a
-- client create a task on their own project, tagged so staff can tell it
-- apart from agency-created work. Mirrors the existing client-write pattern
-- (client_submit_feedback / client_approve_current_version): a security
-- definer RPC that checks ownership itself, rather than a raw RLS insert
-- policy, since clients have no other insert access to `tasks` today and a
-- narrow RPC keeps the client-writable shape (no milestone, no assignee, a
-- fixed starting status) enforced in one place.

alter table public.tasks
  add column if not exists origin text not null default 'agency' check (origin in ('agency', 'client'));

create index if not exists tasks_client_origin_idx on public.tasks (project_id) where origin = 'client';

comment on column public.tasks.origin is
  'Who created this task: agency (staff/admin, the default) or client (via client_create_task). Purely informational -- does not change how the task behaves.';

create or replace function public.client_create_task(
  p_project_id uuid,
  p_title text,
  p_description text default ''
)
returns public.tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  owned_client uuid := public.current_client_id();
  project public.projects;
  actor_name text;
  created public.tasks;
begin
  if not public.is_client() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if p_title is null or length(trim(p_title)) = 0 then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select * into project from public.projects where id = p_project_id;
  if not found or project.client_id is distinct from owned_client then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select coalesce(nullif(trim(full_name), ''), 'Client')
    into actor_name
  from public.profiles
  where id = uid;

  insert into public.tasks (
    project_id,
    title,
    description,
    status,
    priority,
    assignee,
    origin
  )
  values (
    project.id,
    trim(p_title),
    coalesce(trim(p_description), ''),
    'Todo',
    'Medium',
    'Client',
    'client'
  )
  returning * into created;

  insert into public.activity (project_id, actor_id, activity_type, message, metadata)
  values (
    project.id,
    uid,
    'client_task_created',
    actor_name || ' reported: ' || trim(p_title),
    jsonb_build_object('icon', 'task', 'task_id', created.id)
  );

  update public.projects set last_activity_at = now() where id = project.id;

  return created;
end;
$$;

revoke all on function public.client_create_task(uuid, text, text) from public, anon;
grant execute on function public.client_create_task(uuid, text, text) to authenticated;

comment on function public.client_create_task(uuid, text, text) is
  'Lets an authenticated client create a task on their own project (origin=client, status=Todo, no milestone/assignee). Staff triage from there like any other task.';
