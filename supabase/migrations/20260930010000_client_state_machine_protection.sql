-- Audit finding: discovery_intakes_update and task_client_requests_update
-- both let a client UPDATE any column of their own row (the RLS `with check`
-- only verifies client_id ownership). The app enforces the real state
-- machine and column ownership in JavaScript only (saveDiscoveryIntakeDraft/
-- submitDiscoveryIntake, submitTaskClientResponse) -- a direct Supabase call
-- from the client's own already-authenticated session can bypass that.
--
-- Unlike profiles_protect_privileged_columns (which blocks the protected
-- columns from ANY authenticated write, because profiles.role/client_id are
-- only ever meant to change via a SECURITY DEFINER RPC), these two tables
-- are legitimately updated by clients directly under RLS -- staff also share
-- the same update policy. So these triggers only constrain the CLIENT actor
-- (public.is_client()), leaving staff/PM coordination writes untouched.

create or replace function public.discovery_intakes_protect_client_writes()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and public.is_client() then
    if new.project_id is distinct from old.project_id
       or new.client_id is distinct from old.client_id
       or new.internal_notes is distinct from old.internal_notes
       or new.updated_by is distinct from old.updated_by
       or new.sent_at is distinct from old.sent_at
       or new.completed_at is distinct from old.completed_at
    then
      raise exception 'Not allowed' using errcode = '42501';
    end if;

    -- The only status change a client may make directly is submitting a
    -- form that's actually awaiting them -- everything else (sending,
    -- marking under review, requesting more info, completing) is staff-only.
    if new.status is distinct from old.status
       and not (
         old.status in ('awaiting_client', 'more_information_needed')
         and new.status = 'submitted'
       )
    then
      raise exception 'Not allowed' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists discovery_intakes_protect_client_writes on public.discovery_intakes;
create trigger discovery_intakes_protect_client_writes
  before update on public.discovery_intakes
  for each row execute function public.discovery_intakes_protect_client_writes();

create or replace function public.task_client_requests_protect_client_writes()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and public.is_client() then
    if new.task_id is distinct from old.task_id
       or new.project_id is distinct from old.project_id
       or new.client_id is distinct from old.client_id
       or new.message is distinct from old.message
       or new.created_by is distinct from old.created_by
       or new.requested_at is distinct from old.requested_at
       or new.completed_at is distinct from old.completed_at
    then
      raise exception 'Not allowed' using errcode = '42501';
    end if;

    -- The only thing a client may do directly is respond to a request
    -- that's actually awaiting them. Marking it under review or complete
    -- is a PM/staff action.
    if new.status is distinct from old.status
       and not (old.status = 'awaiting_client' and new.status = 'submitted')
    then
      raise exception 'Not allowed' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists task_client_requests_protect_client_writes on public.task_client_requests;
create trigger task_client_requests_protect_client_writes
  before update on public.task_client_requests
  for each row execute function public.task_client_requests_protect_client_writes();
