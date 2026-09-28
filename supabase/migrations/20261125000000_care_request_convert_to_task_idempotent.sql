-- Global audit: care_requests_convert_to_task (20261023000000) has no guard against being called
-- twice for the same request. The admin UI (AdminCareRequests.tsx) only hides the "Convert to task"
-- button once billing_decision is set on the row it already has loaded -- so two admins looking at
-- the same still-undecided request, or one admin double-clicking faster than the response comes
-- back, can each trigger a real task insert. The second call's `update ... where id = p_request_id`
-- would just overwrite resulting_task_id with its own new task, silently orphaning the first one:
-- a real, valid task nobody's request row points back to. Re-check the request's own
-- resulting_task_id right before inserting and stop instead of creating a second task.
create or replace function public.care_requests_convert_to_task(p_request_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  req public.care_requests;
  v_priority text;
  new_task_id uuid;
begin
  select * into req from public.care_requests where id = p_request_id;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if not public.staff_may_project(req.project_id, 'projects.manage') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if req.resulting_task_id is not null then
    -- Already converted (by this same click landing twice, or by someone else in the meantime):
    -- report the task that already exists instead of creating a second one.
    return req.resulting_task_id;
  end if;

  v_priority := case when req.priority in ('Low', 'Medium', 'High', 'Urgent') then req.priority else 'Medium' end;

  insert into public.tasks (project_id, title, description, priority)
  values (req.project_id, 'Website Care: ' || left(req.message, 80), req.message, v_priority)
  returning id into new_task_id;

  update public.care_requests
    set billing_decision = 'included',
        resulting_task_id = new_task_id
  where id = p_request_id
    and resulting_task_id is null;

  if not found then
    -- Lost a race between the select above and this update: someone else's conversion committed
    -- first. Their task is the one of record -- drop the one just inserted here instead of leaving
    -- two live tasks for one request.
    delete from public.tasks where id = new_task_id;
    select resulting_task_id into new_task_id from public.care_requests where id = p_request_id;
  end if;

  return new_task_id;
end;
$$;

revoke all on function public.care_requests_convert_to_task(uuid) from public, anon;
grant execute on function public.care_requests_convert_to_task(uuid) to authenticated;

comment on function public.care_requests_convert_to_task(uuid) is
  'Atomically creates a task from an included Website Care request and links it back, checking only staff_may_project(project_id, ''projects.manage''). Idempotent: a request already converted (or one that wins a concurrent race) returns the existing task instead of creating a second one.';
