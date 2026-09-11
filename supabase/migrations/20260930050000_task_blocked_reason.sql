-- Phase 14 (Developer Task Experience): "Blocked" previously carried no
-- reason at all -- a task just flipped to status='Blocked' with nothing
-- explaining why. Adds a small fixed-choice reason, additive and nullable
-- so every existing task/row is unaffected.

alter table public.tasks
  add column if not exists blocked_reason text
  check (blocked_reason is null or blocked_reason in (
    'waiting_on_client',
    'waiting_on_pm',
    'waiting_on_designer',
    'waiting_on_content',
    'technical_issue',
    'external_dependency',
    'other'
  ));

comment on column public.tasks.blocked_reason is
  'Why a task is Blocked. Null whenever status is not Blocked -- cleared automatically by update_my_task_status and the admin task-update path.';

-- Adding a parameter changes the function's identity for Postgres overload
-- resolution -- create or replace alone would leave the old 2-arg version
-- around as a separate overload, which makes PostgREST's rpc() call
-- ambiguous. Drop it explicitly first.
drop function if exists public.update_my_task_status(uuid, text);

create or replace function public.update_my_task_status(p_task_id uuid, p_status text, p_blocked_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if not (public.is_admin() or public.is_active_staff()) then
    raise exception 'NOT_ALLOWED';
  end if;
  if p_status not in ('Todo', 'In Progress', 'In Review', 'Completed', 'Blocked') then
    raise exception 'INVALID_STATUS';
  end if;
  if p_status = 'Blocked' and p_blocked_reason is not null and p_blocked_reason not in (
    'waiting_on_client', 'waiting_on_pm', 'waiting_on_designer', 'waiting_on_content',
    'technical_issue', 'external_dependency', 'other'
  ) then
    raise exception 'INVALID_STATUS';
  end if;

  update public.tasks
  set
    status = p_status,
    blocked_reason = case when p_status = 'Blocked' then p_blocked_reason else null end,
    completed_at = case
      when p_status = 'Completed' then coalesce(completed_at, now())
      else null
    end,
    updated_at = now()
  where id = p_task_id
    and assigned_to = uid;

  if not found then
    raise exception 'NOT_ALLOWED';
  end if;
end;
$$;

revoke all on function public.update_my_task_status(uuid, text, text) from public, anon;
grant execute on function public.update_my_task_status(uuid, text, text) to authenticated;
