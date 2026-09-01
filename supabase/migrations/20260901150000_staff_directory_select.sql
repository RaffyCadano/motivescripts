-- Coordinators (Admin, Project Manager) need to list agency staff in order to
-- assign them. Live profiles_select_own_or_admin was only "self or is_admin()",
-- so fetchTeamDirectory hid every assigned teammate from the PM UI even when
-- project_staff_assignments and staff_profiles were visible.
-- Does not grant team.view / team.manage or open /admin/team.

create or replace function public.staff_may_view_agency_directory()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin()
    or public.has_grant('team.view')
    or (
      public.has_grant('clients.manage')
      and public.has_grant('projects.manage')
    );
$$;

revoke all on function public.staff_may_view_agency_directory() from public, anon;
grant execute on function public.staff_may_view_agency_directory() to authenticated;

comment on function public.staff_may_view_agency_directory() is
  'Admin, team.view, or coordinators with both clients.manage and projects.manage. Production/Sales/Accounting templates do not qualify.';

drop policy if exists profiles_select_own_or_admin on public.profiles;
create policy profiles_select_own_or_admin on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or public.is_admin()
    or (
      role in ('admin', 'staff')
      and (
        public.staff_may_view_agency_directory()
        or exists (
          select 1
          from public.client_staff_assignments a
          join public.client_staff_assignments b on a.client_id = b.client_id
          where a.user_id = auth.uid() and b.user_id = profiles.id
        )
        or exists (
          select 1
          from public.project_staff_assignments a
          join public.project_staff_assignments b on a.project_id = b.project_id
          where a.user_id = auth.uid() and b.user_id = profiles.id
        )
      )
    )
    or (
      public.has_grant('clients.view')
      and role = 'client'
      and public.assigned_to_client(client_id)
    )
  );

drop policy if exists staff_profiles_select on public.staff_profiles;
create policy staff_profiles_select on public.staff_profiles
  for select to authenticated
  using (
    public.staff_may_view_agency_directory()
    or user_id = auth.uid()
    or exists (
      select 1
      from public.client_staff_assignments a
      join public.client_staff_assignments b on a.client_id = b.client_id
      where a.user_id = auth.uid() and b.user_id = staff_profiles.user_id
    )
    or exists (
      select 1
      from public.project_staff_assignments a
      join public.project_staff_assignments b on a.project_id = b.project_id
      where a.user_id = auth.uid() and b.user_id = staff_profiles.user_id
    )
  );
