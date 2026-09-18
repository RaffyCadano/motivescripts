-- Cosmetic fix found during testing: notify_task_qa_result() (20260930270000)
-- ran the reason straight into the next sentence with no punctuation --
-- "...Reason: Checkout button broken on mobile Safari The project needs
-- another development pass." Add a period before the next sentence.

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
        || case when length(trim(coalesce(new.qa_fail_note, ''))) > 0 then ' Reason: ' || new.qa_fail_note || '.' else '' end
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
