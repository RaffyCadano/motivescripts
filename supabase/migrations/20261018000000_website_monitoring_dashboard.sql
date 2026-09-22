-- Supports the new admin-wide Website Monitoring page: lets the frontend ask "does this project
-- have Advanced monitoring" -- the same fact projects_due_for_website_check() and the alert
-- trigger already compute server-side. project_has_fast_monitoring() itself has no caller check
-- (it's only ever called from other SECURITY DEFINER functions today), so granting it directly to
-- authenticated would let any signed-in user, including an unrelated client, probe an arbitrary
-- project id for this boolean. This wraps it with the same staff_may_project(...,'projects.view')
-- check every other staff-facing project read already uses.

create or replace function public.staff_project_has_fast_monitoring(p_project_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.staff_may_project(p_project_id, 'projects.view') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return public.project_has_fast_monitoring(p_project_id);
end;
$$;

comment on function public.staff_project_has_fast_monitoring(uuid) is
  'Staff-facing wrapper for project_has_fast_monitoring -- checks staff_may_project(projects.view) itself, since the underlying function has no caller check of its own.';

revoke all on function public.staff_project_has_fast_monitoring(uuid) from public, anon;
grant execute on function public.staff_project_has_fast_monitoring(uuid) to authenticated;
