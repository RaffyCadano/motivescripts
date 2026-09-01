-- Staff invitations set profiles.role = 'staff'. Live still had the pre-team-management
-- check that only allowed admin/client, so accept_staff_invitation failed with 23514.

drop function if exists public._tmp_staff_invite_probe();

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('admin', 'staff', 'client'));

alter table public.profiles drop constraint if exists profiles_admin_client_id_null;
alter table public.profiles drop constraint if exists profiles_agency_client_id_null;
alter table public.profiles add constraint profiles_agency_client_id_null
  check (role = 'client' or client_id is null);
