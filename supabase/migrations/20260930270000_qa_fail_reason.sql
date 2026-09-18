-- Production Workflow spec, Section 6 (QA Failure -> Development Revision):
-- "record the failure; require/record a reason". The existing QA workflow
-- (20260930090000_production_workflow_gates.sql) already records pass/fail
-- via tasks.qa_result and notifies on it, but captures no reason at all --
-- a developer or PM seeing "QA failed" has to go find out why some other
-- way. Adds a free-text reason, following the exact same convention already
-- established for tasks.blocked_reason: nullable, only meaningful for its
-- one triggering state, cleared automatically whenever that state is left.
--
-- Free text (not a fixed enum like blocked_reason) because a QA failure
-- reason is inherently descriptive ("checkout button broken on mobile
-- Safari"), not a small closed set of causes.

alter table public.tasks
  add column if not exists qa_fail_note text not null default '';

comment on column public.tasks.qa_fail_note is
  'Why a qa-typed task was marked Failed. Required (non-empty) whenever qa_result = fail; cleared automatically whenever qa_result is cleared (see enforce_task_workflow_gate). Free text, not an enum -- a QA failure reason is inherently descriptive.';

create or replace function public.enforce_task_workflow_gate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_milestone_key text;
  v_task_type text := coalesce(new.task_type, old.task_type);
  v_old_status text := case when TG_OP = 'INSERT' then null else old.status end;
  v_old_milestone_id uuid := case when TG_OP = 'INSERT' then null else old.milestone_id end;
  v_old_task_type text := case when TG_OP = 'INSERT' then null else old.task_type end;
  v_status_entering boolean;
  v_reclassified boolean;
  v_check_gate boolean;
begin
  select public.milestone_workflow_key(m.name) into v_milestone_key
  from public.milestones m
  where m.id = new.milestone_id;

  v_status_entering := new.status in ('In Progress', 'In Review', 'Completed')
    and (v_old_status is null or v_old_status in ('Todo', 'Blocked'));
  v_reclassified := TG_OP = 'UPDATE'
    and new.status in ('In Progress', 'In Review', 'Completed')
    and (
      v_old_milestone_id is distinct from new.milestone_id
      or coalesce(v_old_task_type, '') is distinct from coalesce(new.task_type, '')
    );
  v_check_gate := v_status_entering or v_reclassified;

  if v_milestone_key = 'development' and v_check_gate then
    if not public.project_development_legacy_exempt(new.project_id)
       and not public.project_checkpoint_approved(new.project_id, 'overall_design')
    then
      raise exception 'Development is locked until Overall Design is approved.' using errcode = '42501';
    end if;
  end if;

  if v_task_type = 'qa' and v_check_gate then
    if not public.development_tasks_complete(new.project_id) then
      raise exception 'QA is locked until Development is complete.' using errcode = '42501';
    end if;
  end if;

  if v_task_type = 'qa' then
    if new.status = 'Completed' and new.qa_result is null then
      raise exception 'Set a QA result (pass or fail) before completing a QA task.' using errcode = '42501';
    end if;
    if new.status = 'Completed' and new.qa_result = 'fail' and length(trim(coalesce(new.qa_fail_note, ''))) = 0 then
      raise exception 'A reason is required when QA fails.' using errcode = '42501';
    end if;
    if new.status <> 'Completed' or new.qa_result <> 'fail' then
      new.qa_fail_note := '';
    end if;
    if new.status <> 'Completed' then
      new.qa_result := null;
    end if;
  else
    new.qa_result := null;
    new.qa_fail_note := '';
  end if;

  if v_task_type = 'client_review' and v_check_gate then
    if public.qa_latest_result(new.project_id) is distinct from 'pass' then
      raise exception 'Client Review is locked until QA has passed.' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

-- update_my_task_status: add the QA fail-reason parameter. Same overload
-- hygiene as every prior parameter addition here (20260930050000,
-- 20260930100000, 20260930180000) -- drop the old signature explicitly so
-- PostgREST never sees two ambiguous overloads of the same RPC name.

drop function if exists public.update_my_task_status(uuid, text, text, text);

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

  if not found then
    raise exception 'NOT_ALLOWED';
  end if;
end;
$$;

revoke all on function public.update_my_task_status(uuid, text, text, text, text) from public, anon;
grant execute on function public.update_my_task_status(uuid, text, text, text, text) to authenticated;

-- Surface the reason in the existing QA-failed notification/activity message
-- instead of just naming the task -- the whole point of capturing it.

create or replace function public.notify_task_qa_result()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project public.projects;
  v_actor_name text;
begin
  if new.task_type <> 'qa' or new.qa_result is null or new.qa_result is not distinct from old.qa_result then
    return new;
  end if;

  select * into v_project from public.projects where id = new.project_id;
  select coalesce(nullif(trim(full_name), ''), 'Someone') into v_actor_name
  from public.profiles where id = auth.uid();

  if new.qa_result = 'fail' then
    insert into public.activity (project_id, actor_id, activity_type, message, metadata)
    values (
      new.project_id, auth.uid(), 'qa_failed',
      v_actor_name || ' failed QA on "' || new.title || '"'
        || case when length(trim(coalesce(new.qa_fail_note, ''))) > 0 then ': ' || new.qa_fail_note else '' end
        || '. Project moved back to Development.',
      jsonb_build_object('icon', 'review', 'task_id', new.id, 'qa_fail_note', new.qa_fail_note)
    );
    perform public.notify_agency(
      'projects.manage', v_project.client_id, 'qa_failed',
      'QA failed: ' || v_project.name,
      trim(new.title || ' did not pass QA.'
        || case when length(trim(coalesce(new.qa_fail_note, ''))) > 0 then ' Reason: ' || new.qa_fail_note else '' end
        || ' The project needs another development pass.'),
      null, null, new.project_id
    );
  elsif new.qa_result = 'pass' then
    insert into public.activity (project_id, actor_id, activity_type, message, metadata)
    values (
      new.project_id, auth.uid(), 'qa_passed',
      v_actor_name || ' passed QA on "' || new.title || '". Project is ready for client review.',
      jsonb_build_object('icon', 'review', 'task_id', new.id)
    );
    perform public.notify_agency(
      'projects.manage', v_project.client_id, 'qa_passed',
      'QA passed: ' || v_project.name,
      'QA passed. ' || v_project.name || ' is ready for client review.',
      null, null, new.project_id
    );
    if v_project.client_id is not null then
      perform public.notify_client_users(
        v_project.client_id, 'client_review_ready',
        'Ready for your review: ' || v_project.name,
        'Your project has passed internal QA and is ready for your review.',
        null, null, new.project_id
      );
    end if;
  end if;

  return new;
end;
$$;
