-- Allow the signed-in user to clear their own in-app inbox after reading.
-- Does not change notification creation, RLS select policies, or other users' rows.

create or replace function public.clear_notifications()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  removed integer;
begin
  delete from public.notifications
  where user_id = auth.uid()
    and read_at is not null;
  get diagnostics removed = row_count;
  return removed;
end;
$$;

comment on function public.clear_notifications() is
  'Deletes the current user''s already-read in-app notifications. Unread rows are kept.';

revoke all on function public.clear_notifications() from public, anon;
grant execute on function public.clear_notifications() to authenticated;
