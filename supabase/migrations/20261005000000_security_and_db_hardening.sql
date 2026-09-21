-- Security and performance hardening from the global audit.
--
-- 1. notify_document could be called by anyone, including anonymous visitors, to plant notifications for admins
--    and clients. It is an internal helper (only the Edge Functions and other database functions call it), so it
--    becomes service-role only.
-- 2. Every other privileged (SECURITY DEFINER) function that an anonymous visitor could execute becomes
--    signed-in only, except the four token-based invitation checks that the pre-login invitation pages need.
--    Each of them already refused anonymous callers internally; this stops them being callable at all.
-- 3. Functions with no fixed search_path get one (a standard hardening step).
-- 4. Row-level-security policies re-evaluated auth.uid() for every row; wrapping it in a sub-select evaluates it
--    once per query. Same result, faster at scale.
-- 5. Foreign keys without an index (slow joins and cascading deletes as tables grow) get one.
--
-- Everything here is idempotent, so it is safe to run more than once.

-- ---------------------------------------------------------------------------
-- 1. notify_document: server-only
-- ---------------------------------------------------------------------------

revoke execute on function public.notify_document(text, uuid, text, text, text, uuid, uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.notify_document(text, uuid, text, text, text, uuid, uuid, uuid, uuid)
  to service_role;

-- ---------------------------------------------------------------------------
-- 2. No privileged function is callable anonymously, except the pre-login invitation checks
-- ---------------------------------------------------------------------------

do $$
declare
  fn record;
  -- These four run before the person has an account (invitation links), and validate a secret token themselves.
  pre_login constant text[] := array[
    'preview_client_invitation',
    'preview_staff_invitation',
    'invitation_email_matches',
    'staff_invitation_email_matches'
  ];
begin
  for fn in
    select p.oid::regprocedure as sig, p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and p.prorettype <> 'trigger'::regtype
      and has_function_privilege('anon', p.oid, 'execute')
      and p.proname <> all (pre_login)
  loop
    -- PUBLIC is what lets anon execute by default, so it has to go; signed-in users and the server keep access.
    execute format('revoke execute on function %s from public, anon', fn.sig);
    execute format('grant execute on function %s to authenticated, service_role', fn.sig);
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- 3. Fixed search_path on functions that lack one
-- ---------------------------------------------------------------------------

do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and not exists (select 1 from unnest(coalesce(p.proconfig, '{}'::text[])) c where c like 'search_path=%')
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  loop
    execute format('alter function %s set search_path = public, extensions, pg_temp', fn.sig);
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- 4. Evaluate auth.uid() once per query in RLS policies, not once per row
-- ---------------------------------------------------------------------------

do $$
declare
  pol record;
  new_using text;
  new_check text;
  stmt text;
  -- Skips ones already inside a sub-select (Postgres prints those as "( SELECT auth.uid() AS uid)"), so a
  -- second run changes nothing. Matched case-insensitively.
  wrap constant text := '(?<!select )auth\.(uid|jwt|role)\(\)';
begin
  for pol in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (qual ~* wrap or with_check ~* wrap)
  loop
    new_using := case when pol.qual is null then null else regexp_replace(pol.qual, wrap, '(select auth.\1())', 'gi') end;
    new_check := case when pol.with_check is null then null else regexp_replace(pol.with_check, wrap, '(select auth.\1())', 'gi') end;
    stmt := format('alter policy %I on %I.%I', pol.policyname, pol.schemaname, pol.tablename);
    if new_using is not null then stmt := stmt || format(' using (%s)', new_using); end if;
    if new_check is not null then stmt := stmt || format(' with check (%s)', new_check); end if;
    execute stmt;
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- 5. Index every foreign key that has no index leading with its columns
-- ---------------------------------------------------------------------------

do $$
declare
  fk record;
  idx_name text;
begin
  for fk in
    select c.conname, c.conrelid, c.conkey, cl.relname as table_name,
           (select string_agg(quote_ident(a.attname), ', ' order by k.ord)
              from unnest(c.conkey) with ordinality as k(attnum, ord)
              join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum) as cols,
           (select string_agg(a.attname, '_' order by k.ord)
              from unnest(c.conkey) with ordinality as k(attnum, ord)
              join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum) as col_names
    from pg_constraint c
    join pg_class cl on cl.oid = c.conrelid
    join pg_namespace n on n.oid = cl.relnamespace
    where c.contype = 'f'
      and n.nspname = 'public'
      and not exists (
        select 1
        from pg_index i
        where i.indrelid = c.conrelid
          and i.indisvalid
          and (
            select array_agg(u.attnum order by u.ord)
            from unnest(i.indkey::int2[]) with ordinality as u(attnum, ord)
            where u.ord <= array_length(c.conkey, 1)
          ) = c.conkey
      )
  loop
    idx_name := left(fk.table_name || '_' || fk.col_names || '_fk_idx', 63);
    execute format('create index if not exists %I on public.%I (%s)', idx_name, fk.table_name, fk.cols);
  end loop;
end
$$;
