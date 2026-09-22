-- Two changes to care_requests, per the agency's decision on how this should behave:
--
-- 1. A client must have an active (or past-due) Website Care plan to submit a request at all --
--    submission is now blocked, not just flagged, if they don't. (Superseds the "not gated, just
--    flagged" note in 20261006000000_care_requests.sql.)
-- 2. The client now says up front whether this is a quick update/fix or something new they'd like
--    added -- the latter is tagged distinctly so it stands out in the admin queue as something that
--    may need a separate quote rather than being covered by the Care plan.

alter table public.care_requests
  add column category text not null default 'quick_update' check (category in ('quick_update', 'new_addition'));

create or replace function public.care_requests_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_launched boolean;
  v_has_plan boolean;
begin
  select role into v_role from public.profiles where id = auth.uid();

  if not exists (select 1 from public.projects where id = new.project_id and client_id = new.client_id) then
    raise exception 'PROJECT_CLIENT_MISMATCH';
  end if;

  v_has_plan := exists (
    select 1 from public.service_plans sp
    where sp.plan_type = 'care'
      and sp.status in ('active', 'past_due')
      and (sp.project_id = new.project_id or (sp.project_id is null and sp.client_id = new.client_id))
  );

  if v_role = 'client' then
    new.submitted_by := auth.uid();
    select coalesce(pd.deployment_status = 'Production', false)
      into v_launched
      from public.project_development pd
      where pd.project_id = new.project_id;
    if not coalesce(v_launched, false) then
      raise exception 'NOT_LAUNCHED';
    end if;
    if not v_has_plan then
      raise exception 'NO_ACTIVE_PLAN';
    end if;
  end if;

  new.has_active_care_plan := v_has_plan;

  if new.status = 'Done' and new.resolved_at is null then
    new.resolved_at := now();
  end if;

  return new;
end;
$$;
