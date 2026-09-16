-- The client portal's "What do you need from us?" checklist (see
-- src/data/clientProjectProgress.ts's clientDeliveryStages()) computes gate
-- status (Development complete, QA passed, Launch) from raw tasks/
-- project_development rows fetched client-side. RLS correctly hides
-- agency-origin tasks (tasks_select_own requires origin = 'client') and all
-- of project_development (project_development_select requires staff) from a
-- client session -- so those specific checklist steps can never resolve as
-- done for any project, for any client. This exposes the same gate booleans
-- the launch trigger already trusts (development_tasks_complete,
-- qa_latest_result, project_client_review_complete,
-- project_checkpoint_approved) through one security definer RPC scoped to
-- the calling client's own project, instead of relaxing RLS on the
-- underlying tables.

create or replace function public.client_project_delivery_gates(p_project_id uuid)
returns table (
  design_approved boolean,
  development_complete boolean,
  qa_passed boolean,
  client_review_complete boolean,
  final_approved boolean,
  is_launched boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.owns_project(p_project_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  return query
  select
    public.project_checkpoint_approved(p_project_id, 'overall_design'),
    public.development_tasks_complete(p_project_id),
    public.qa_latest_result(p_project_id) is not distinct from 'pass',
    public.project_client_review_complete(p_project_id),
    public.project_checkpoint_approved(p_project_id, 'final_website'),
    coalesce(
      (select pd.deployment_status = 'Production' from public.project_development pd where pd.project_id = p_project_id),
      false
    );
end;
$$;

comment on function public.client_project_delivery_gates(uuid) is
  'Client-safe view of the launch checklist gates, computed server-side so it is correct regardless of what RLS lets the client session see directly on tasks/project_development. Mirrors launch_blocking_reasons()''s own checks.';

revoke all on function public.client_project_delivery_gates(uuid) from public, anon;
grant execute on function public.client_project_delivery_gates(uuid) to authenticated;
