-- The database calls edge functions (reminder and alert emails, website backups and health checks, host site control)
-- through pg_net, whose default is to give up after 5 seconds. Those functions routinely take longer than that
-- (they look things up, then call Resend or a host), and nine calls in one week timed out. A timed-out call is
-- dropped by the caller, so the function may be cut short and the result is never recorded.
--
-- Give every such call 60 seconds. This rewrites each function that calls net.http_post without a timeout,
-- adding timeout_milliseconds next to its headers. Nothing else about the functions changes.

do $$
declare
  fn record;
  definition text;
begin
  for fn in
    select p.oid, p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and pg_get_functiondef(p.oid) like '%net.http_post%'
      and pg_get_functiondef(p.oid) not like '%timeout_milliseconds%'
  loop
    definition := pg_get_functiondef(fn.oid);
    definition := replace(
      definition,
      'headers := jsonb_build_object(',
      'timeout_milliseconds := 60000, headers := jsonb_build_object('
    );
    if definition not like '%timeout_milliseconds%' then
      raise exception 'Could not add a timeout to %', fn.proname;
    end if;
    execute definition;
  end loop;
end;
$$;
