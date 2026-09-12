-- Fixes a bypass introduced by 20260930160000's own fix: exempting a move
-- TO 'Blocked' from the gate (so a locked task can be marked Blocked with a
-- reason) only checked `old.status = 'Todo'`, so once a task WAS Blocked,
-- moving it Blocked -> In Progress no longer matched `old.status = 'Todo'`
-- at all and skipped the gate check entirely -- Todo -> Blocked -> In
-- Progress became a complete bypass of the Development/QA/Client Review
-- gates. Also, project_development_legacy_exempt() treated any non-Todo
-- development task (including a merely Blocked one) as proof "real
-- development work already started", which would have falsely exempted an
-- entire project the moment any of its dev tasks was marked Blocked.
--
-- Fix: gate on entering an actionable status (In Progress / In Review /
-- Completed) FROM a non-actionable one (Todo or Blocked), not on leaving
-- Todo specifically. Blocked itself is still never a gated target -- a
-- locked task can always be marked Blocked. Legacy exemption now only
-- counts a task as "real prior work" if it is in an actionable status
-- itself, not just Blocked.

create or replace function public.project_development_legacy_exempt(p_project_id uuid)
returns boolean
language sql
stable
as $$
  select
    exists (
      select 1 from public.projects
      where id = p_project_id
        and status in ('In Development', 'Client Review', 'Completed')
    )
    or exists (
      select 1
      from public.tasks t
      join public.milestones m on m.id = t.milestone_id
      where t.project_id = p_project_id
        and public.milestone_workflow_key(m.name) = 'development'
        and t.status not in ('Todo', 'Blocked')
    );
$$;

create or replace function public.enforce_task_workflow_gate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_milestone_key text;
  v_task_type text := coalesce(new.task_type, old.task_type);
  v_entering_work boolean := old.status in ('Todo', 'Blocked') and new.status in ('In Progress', 'In Review', 'Completed');
begin
  select public.milestone_workflow_key(m.name) into v_milestone_key
  from public.milestones m
  where m.id = new.milestone_id;

  if v_milestone_key = 'development' and v_entering_work then
    if not public.project_development_legacy_exempt(new.project_id)
       and not public.project_checkpoint_approved(new.project_id, 'overall_design')
    then
      raise exception 'Development is locked until Overall Design is approved.' using errcode = '42501';
    end if;
  end if;

  if v_task_type = 'qa' and v_entering_work then
    if not public.development_tasks_complete(new.project_id) then
      raise exception 'QA is locked until Development is complete.' using errcode = '42501';
    end if;
  end if;

  if v_task_type = 'qa' then
    if new.status = 'Completed' and new.qa_result is null then
      raise exception 'Set a QA result (pass or fail) before completing a QA task.' using errcode = '42501';
    end if;
    if new.status <> 'Completed' then
      new.qa_result := null;
    end if;
  else
    new.qa_result := null;
  end if;

  if v_task_type = 'client_review' and v_entering_work then
    if public.qa_latest_result(new.project_id) is distinct from 'pass' then
      raise exception 'Client Review is locked until QA has passed.' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;
