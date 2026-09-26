-- Scheduled jobs (reminder emails, backups, health checks, deadline alerts) each catch their own errors so one
-- failure does not stop the rest, but that also made every run show as "succeeded" with the real error lost in a
-- log line. Record each failure, and let an admin see recent failures and calls that never got an answer.

create table if not exists public.job_failures (
  id uuid primary key default gen_random_uuid(),
  job text not null,
  message text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists job_failures_created_idx on public.job_failures (created_at desc);

alter table public.job_failures enable row level security;
revoke all on public.job_failures from public, anon, authenticated;

create or replace function public.record_job_failure(p_job text, p_message text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.job_failures (job, message) values (left(coalesce(p_job, ''), 120), left(coalesce(p_message, ''), 500));
  delete from public.job_failures where created_at < now() - interval '30 days';
exception when others then
  -- Recording a failure must never be the thing that fails.
  null;
end;
$$;

revoke all on function public.record_job_failure(text, text) from public, anon, authenticated;
grant execute on function public.record_job_failure(text, text) to service_role;

-- What an admin sees: failures from the last 7 days, and how many calls to edge functions got no successful
-- answer in the last 24 hours (a timeout, a network error, or an error status).
create or replace function public.admin_background_health()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  failures jsonb;
  failed_calls integer := 0;
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(row_to_json(f) order by f.created_at desc), '[]'::jsonb)
    into failures
    from (
      select job, message, created_at
      from public.job_failures
      where created_at > now() - interval '7 days'
      order by created_at desc
      limit 20
    ) f;

  begin
    select count(*)::integer into failed_calls
      from net._http_response
      where created > now() - interval '24 hours'
        and (status_code is null or status_code >= 400);
  exception when others then
    failed_calls := 0;
  end;

  return jsonb_build_object('failures', failures, 'failedCalls24h', failed_calls);
end;
$$;

revoke all on function public.admin_background_health() from public, anon;
grant execute on function public.admin_background_health() to authenticated;

-- Make every scheduled job report its failure: after the warning it already logs, also record it.
do $$
declare
  job record;
  updated text;
begin
  for job in select jobid, command from cron.job where command like '%raise warning%' and command not like '%record_job_failure%'
  loop
    updated := regexp_replace(
      job.command,
      'raise warning ''([a-z_]+) failed: %'', sqlerrm;',
      'raise warning ''\1 failed: %'', sqlerrm; perform public.record_job_failure(''\1'', sqlerrm);',
      'g'
    );
    if updated <> job.command then
      perform cron.alter_job(job.jobid, command := updated);
    end if;
  end loop;
end;
$$;
