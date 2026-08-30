-- Admins can be assigned to any project, even if they already sit on another client.
-- Backfill staff_profiles so every admin appears in the team directory.

insert into public.staff_profiles (user_id, job_title, template_key, is_active, created_at, updated_at)
select p.id, '', 'admin', true, now(), now()
from public.profiles p
where p.role = 'admin'
on conflict (user_id) do nothing;

create or replace function public.project_assignment_matches_client()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  project_client uuid;
  has_client_assignments boolean;
begin
  if exists (select 1 from public.profiles p where p.id = new.user_id and p.role = 'admin') then
    return new;
  end if;
  select client_id into project_client from public.projects where id = new.project_id;
  if project_client is null then
    raise exception 'Unable to assign this team member.' using errcode = 'P0001';
  end if;
  select exists (
    select 1 from public.client_staff_assignments a
    where a.user_id = new.user_id
  ) into has_client_assignments;
  if has_client_assignments and not exists (
    select 1 from public.client_staff_assignments a
    where a.user_id = new.user_id and a.client_id = project_client
  ) then
    raise exception 'Unable to assign this team member.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
