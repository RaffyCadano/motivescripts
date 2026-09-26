-- The signed-in person's own login sessions, for the "Active sessions" list on the client Settings page.
--
-- Supabase keeps every login in auth.sessions (browser, IP address, when it started and was last refreshed) but
-- does not expose it to the app. These two functions expose only the caller's own rows:
--   * my_auth_sessions()          lists them, marking the one this request is using;
--   * revoke_my_auth_session(id)  ends one of them (never the current one; signing out does that).
-- Ending a session removes its refresh tokens, so that device is signed out the next time it refreshes (its
-- short-lived access token can keep working for up to an hour).

create or replace function public.my_auth_sessions()
returns table (
  id uuid,
  user_agent text,
  ip text,
  created_at timestamptz,
  last_active_at timestamptz,
  is_current boolean
)
language sql
stable
security definer
set search_path = public, auth
as $$
  select s.id,
         s.user_agent,
         host(s.ip),
         s.created_at,
         coalesce(s.refreshed_at, s.updated_at, s.created_at),
         s.id = nullif(auth.jwt() ->> 'session_id', '')::uuid
  from auth.sessions s
  where s.user_id = auth.uid()
    and (s.not_after is null or s.not_after > now())
  order by coalesce(s.refreshed_at, s.updated_at, s.created_at) desc;
$$;

create or replace function public.revoke_my_auth_session(p_session_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  removed integer;
begin
  if auth.uid() is null then
    raise exception 'NOT_SIGNED_IN' using errcode = 'P0001';
  end if;
  if p_session_id is not distinct from nullif(auth.jwt() ->> 'session_id', '')::uuid then
    raise exception 'CURRENT_SESSION' using errcode = 'P0001';
  end if;
  delete from auth.sessions where id = p_session_id and user_id = auth.uid();
  get diagnostics removed = row_count;
  return removed > 0;
end;
$$;

revoke all on function public.my_auth_sessions() from public, anon;
revoke all on function public.revoke_my_auth_session(uuid) from public, anon;
grant execute on function public.my_auth_sessions() to authenticated;
grant execute on function public.revoke_my_auth_session(uuid) to authenticated;

comment on function public.my_auth_sessions() is
  'The caller''s own login sessions (auth.sessions), newest activity first. Backs the Active sessions list in Settings.';
comment on function public.revoke_my_auth_session(uuid) is
  'Ends one of the caller''s own sessions other than the one in use. Returns whether one was removed.';
