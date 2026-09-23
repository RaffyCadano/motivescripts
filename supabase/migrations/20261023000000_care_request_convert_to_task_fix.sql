-- Bug found in a global audit: convertCareRequestToTask (careRequestsRepository.ts) did a direct
-- client-side INSERT into `tasks` before calling the care_requests_resolve RPC. That INSERT is
-- gated by tasks_admin_insert's RLS policy, which checks staff_may_coordinate_project(project_id)
-- -- staff_may_project(project_id, 'projects.manage') AND has_grant('clients.manage') -- a
-- STRICTER check than care_requests_resolve's own (projects.manage alone). The "Included -> Convert
-- to task" button in AdminCareRequests.tsx has no permission gating of its own (it's shown to
-- anyone who can reach the page, i.e. anyone with projects.view), so any staff member on a
-- projects.manage-but-not-clients.manage template -- Developer, Designer, Content Writer, Team
-- Member, confirmed as the exact current gap -- would see the button, click it, and get a raw RLS
-- permission-denied error instead of a task. On Production today that's one active Developer, one
-- Designer, and one Content Writer, all currently broken for their own assigned projects.
--
-- Fix: do the insert and the resolve atomically in one SECURITY DEFINER RPC, checking the same
-- single permission (projects.manage on the request's own project) care_requests_resolve already
-- uses -- exactly the same architecture that RPC itself exists for, just not applied consistently
-- to this one flow.

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

  v_priority := case when req.priority in ('Low', 'Medium', 'High', 'Urgent') then req.priority else 'Medium' end;

  insert into public.tasks (project_id, title, description, priority)
  values (req.project_id, 'Website Care: ' || left(req.message, 80), req.message, v_priority)
  returning id into new_task_id;

  update public.care_requests
    set billing_decision = 'included',
        resulting_task_id = new_task_id
  where id = p_request_id;

  return new_task_id;
end;
$$;

revoke all on function public.care_requests_convert_to_task(uuid) from public, anon;
grant execute on function public.care_requests_convert_to_task(uuid) to authenticated;

comment on function public.care_requests_convert_to_task(uuid) is
  'Atomically creates a task from an included Website Care request and links it back, checking only staff_may_project(project_id, ''projects.manage'') -- the same permission care_requests_resolve uses, replacing a direct tasks insert that was subject to the stricter staff_may_coordinate_project (which also requires clients.manage).';
