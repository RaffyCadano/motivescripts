-- A plain reference note on a service plan for the domain name it relates to
-- (mainly hosting plans). Not validated against a registry, not provisioned --
-- purely a note the admin can see on the Plans tab. Availability checking is
-- a separate read-only Edge Function (check-domain-availability); nothing
-- here ever registers or purchases a domain.

alter table public.service_plans add column if not exists domain text;

create or replace function public.set_service_plan_domain(p_plan_id uuid, p_domain text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if not exists (select 1 from public.service_plans where id = p_plan_id) then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  update public.service_plans
    set domain = nullif(lower(trim(p_domain)), '')
    where id = p_plan_id;
end;
$$;
revoke all on function public.set_service_plan_domain(uuid, text) from public, anon;
grant execute on function public.set_service_plan_domain(uuid, text) to authenticated;
