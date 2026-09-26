-- Signed-out visitors (anyone holding the public site key) could run about twenty SECURITY DEFINER functions,
-- because Postgres gives EXECUTE to PUBLIC on every new function. Most check who is calling and refuse, but
-- task_for_attachment_storage_path() has no check at all: with a project id and task id it returns the whole task
-- row, and active_admin_count() tells anyone how many admins exist.
--
-- Nothing in the app calls these while signed out, so take the signed-out role off all of them. The four
-- invitation lookups that the invite pages use before sign-in are deliberately left alone. Signed-in users and
-- the service role keep access, so storage policies and the app itself are unaffected. Trigger functions are
-- skipped (they cannot be called as RPCs anyway).

do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and p.prorettype <> 'trigger'::regtype
      and has_function_privilege('anon', p.oid, 'execute')
      and p.proname not in (
        'preview_client_invitation',
        'preview_staff_invitation',
        'invitation_email_matches',
        'staff_invitation_email_matches'
      )
  loop
    execute format('revoke all on function %s from public, anon', fn.signature);
    execute format('grant execute on function %s to authenticated, service_role', fn.signature);
  end loop;
end;
$$;
