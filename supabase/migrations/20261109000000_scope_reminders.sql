-- Reminder emails for a client who has a portal login but has not submitted their Website Scope.
--
-- The scope is the first step of the client workflow: nothing (project, proposal, contract) can be
-- prepared until it is in, and clients tend to log in once and stall there. This sends up to three
-- reminders by email, then stops:
--   * 1st: 2 days after their account was created
--   * 2nd: 5 days after
--   * 3rd: 10 days after (worded as the last one)
-- No reminders once the scope is submitted (by the client or by staff on their behalf), once the client has
-- a project, or if the client is Inactive or Archived. At most one reminder is sent per 3 days, so a sweep
-- that was off for a while never sends them back to back.
--
-- Emails go through document-email (kind scope_reminder) using the Vault secrets, the same as the
-- launch-trial reminders. If the secrets are not seeded on an environment, nothing is sent and the
-- counter is not advanced, so it starts working as soon as they are.

alter table public.clients
  add column if not exists scope_reminders_sent integer not null default 0,
  add column if not exists scope_reminder_last_sent_at timestamptz;

comment on column public.clients.scope_reminders_sent is
  'How many Website Scope reminder emails have gone out (0 to 3). See run_scope_reminder_sweep().';
comment on column public.clients.scope_reminder_last_sent_at is
  'When the latest Website Scope reminder email was sent.';

create or replace function public.run_scope_reminder_sweep()
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  base_url text;
  service_key text;
  r record;
  sent integer := 0;
begin
  select decrypted_secret into base_url from vault.decrypted_secrets where name = 'edge_function_base_url';
  select decrypted_secret into service_key from vault.decrypted_secrets where name = 'service_role_key';
  if base_url is null or service_key is null then
    return 0;
  end if;

  for r in
    select c.id, c.scope_reminders_sent
    from public.clients c
    join lateral (
      select min(p.created_at) as since
      from public.profiles p
      where p.client_id = c.id and p.role = 'client'
    ) portal on portal.since is not null
    where c.status = 'Active'
      and c.scope_reminders_sent < 3
      and now() >= portal.since + ((array[2, 5, 10])[c.scope_reminders_sent + 1] * interval '1 day')
      and (c.scope_reminder_last_sent_at is null or c.scope_reminder_last_sent_at <= now() - interval '3 days')
      and not exists (
        select 1 from public.client_scope_briefs b
        where b.client_id = c.id and b.submitted_at is not null
      )
      and not exists (
        select 1 from public.projects pr
        where pr.client_id = c.id and not pr.archived
      )
  loop
    begin
      perform net.http_post(
        url := base_url || '/functions/v1/document-email',
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || service_key),
        body := jsonb_build_object('kind', 'scope_reminder', 'id', r.id, 'stage', (r.scope_reminders_sent + 1)::text)
      );
      update public.clients
        set scope_reminders_sent = scope_reminders_sent + 1,
            scope_reminder_last_sent_at = now()
        where id = r.id;
      sent := sent + 1;
    exception when others then
      raise notice 'run_scope_reminder_sweep: reminder failed for client %: %', r.id, sqlerrm;
    end;
  end loop;

  return sent;
end;
$$;

revoke all on function public.run_scope_reminder_sweep() from public, anon, authenticated;
grant execute on function public.run_scope_reminder_sweep() to service_role;

comment on function public.run_scope_reminder_sweep() is
  'Scheduled daily via pg_cron (scope-reminder-sweep). Emails clients with a portal login who have not submitted their Website Scope, up to three times. Returns how many reminders it queued.';

select cron.unschedule(jobid) from cron.job where jobname = 'scope-reminder-sweep';
select cron.schedule(
  'scope-reminder-sweep',
  '0 15 * * *',
  $$ do $do$ begin perform public.run_scope_reminder_sweep(); exception when others then raise warning 'run_scope_reminder_sweep failed: %', sqlerrm; end $do$; $$
);
