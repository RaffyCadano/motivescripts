-- Fix found by direct-transition testing (Section 23 of the workflow spec):
-- notify_task_qa_result() computed v_actor_name via
-- `select coalesce(...) into v_actor_name ... where id = auth.uid()`.
-- coalesce() only applies to a matched row -- when auth.uid() matches no
-- profiles row (no row at all, not even a null-full_name row), the SELECT
-- INTO leaves v_actor_name NULL, and the subsequent string concatenation
-- produces a NULL activity.message, which violates activity's NOT NULL
-- constraint and aborts the whole QA-completion transaction. Restructured so
-- the fallback applies unconditionally, matching how the same pattern
-- already appears in client_submit_feedback/client_approve_current_version
-- (safe there only because those functions already require an authenticated
-- client to have passed is_client() first).

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
  select full_name into v_actor_name from public.profiles where id = auth.uid();
  v_actor_name := coalesce(nullif(trim(v_actor_name), ''), 'Someone');

  if new.qa_result = 'fail' then
    insert into public.activity (project_id, actor_id, activity_type, message, metadata)
    values (
      new.project_id, auth.uid(), 'qa_failed',
      v_actor_name || ' failed QA on "' || new.title || '". Project moved back to Development.',
      jsonb_build_object('icon', 'review', 'task_id', new.id)
    );
    perform public.notify_agency(
      'projects.manage', v_project.client_id, 'qa_failed',
      'QA failed: ' || v_project.name,
      new.title || ' did not pass QA. The project needs another development pass.',
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
