-- Tasks and deliverables were structurally disconnected: a "Build homepage"
-- task and a "Homepage" deliverable were only related by a human matching
-- titles. Nothing stopped a task from being marked Completed with no
-- deliverable ever uploaded, or a project marked Completed with unapproved
-- deliverables -- progress % and "Completed" status proved nothing.
--
-- This adds an optional link (not every task produces a deliverable -- QA/
-- setup tasks don't) so the two systems can cross-check each other. It does
-- not change how deliverables or tasks are created, and does not auto-link
-- anything -- staff link a task to the deliverable it produces from the task
-- detail panel once that deliverable exists.

alter table public.tasks add column if not exists deliverable_id uuid references public.deliverables (id) on delete set null;
create index if not exists tasks_deliverable_id_idx on public.tasks (deliverable_id) where deliverable_id is not null;

create or replace function public.set_task_deliverable(p_task_id uuid, p_deliverable_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.tasks;
  d public.deliverables;
begin
  select * into t from public.tasks where id = p_task_id;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if not (public.is_admin() or public.staff_may_project(t.project_id, 'projects.view')) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  if p_deliverable_id is not null then
    select * into d from public.deliverables where id = p_deliverable_id;
    if not found or d.project_id is distinct from t.project_id then
      raise exception 'INVALID_DELIVERABLE' using errcode = 'P0001';
    end if;
  end if;

  update public.tasks set deliverable_id = p_deliverable_id, updated_at = now() where id = p_task_id;
end;
$$;

revoke all on function public.set_task_deliverable(uuid, uuid) from public, anon;
grant execute on function public.set_task_deliverable(uuid, uuid) to authenticated;

comment on column public.tasks.deliverable_id is
  'Optional link to the deliverable this task produces. Staff-set via set_task_deliverable; never auto-assigned at task generation since the deliverable does not exist yet at that point.';
