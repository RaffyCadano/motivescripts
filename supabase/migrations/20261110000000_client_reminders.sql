-- Reminder emails for the places a client can stall after they are in the pipeline.
--
--   proposal      sent and not accepted. 3 and 7 days after it was sent, then a last one when it is about to
--                 expire (within 3 days of valid_until).
--   contract      sent and not signed. Same cadence, against expires_at.
--   invoice       due within 3 days and not paid (one email; overdue invoices already have their own).
--                 Recurring plan invoices are left out: Stripe charges those automatically.
--   invite        a portal invitation still pending: on day 3, and the day before it expires. The invite's
--                 secret link is only stored as a hash, so the email points them back to the original message.
--   discovery     the discovery form after payment, not submitted (or sent back for more information).
--   review        files sitting "In Review" waiting for the client's approval (one email per project).
--   info_request  requests for information the client has not answered (one email per project).
--
-- The last three go out 3, 7 and 14 days after the oldest waiting item. Every reminder is recorded once in
-- client_reminder_log (kind, entity, stage), so nothing is ever sent twice, a lower stage is never sent after a
-- higher one, and no more than one goes out per item every 2 days. Clients that are not Active, archived
-- projects and finished items are skipped.
--
-- Emails go through document-email (kind client_reminder) using the Vault secrets, like the other sweeps. If the
-- secrets are missing on an environment nothing is sent and nothing is recorded.

create table if not exists public.client_reminder_log (
  kind text not null,
  entity_id uuid not null,
  stage integer not null,
  sent_at timestamptz not null default now(),
  primary key (kind, entity_id, stage)
);

comment on table public.client_reminder_log is
  'One row per client reminder email sent (see run_client_reminder_sweep()). Service role only.';

alter table public.client_reminder_log enable row level security;
revoke all on table public.client_reminder_log from public, anon, authenticated;

create index if not exists client_reminder_log_entity_idx on public.client_reminder_log (kind, entity_id, sent_at desc);

create or replace function public.run_client_reminder_sweep()
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
    with cand as (
      -- proposals
      select 'proposal'::text as kind, p.id as entity_id,
             case
               when rv.valid_until is not null and rv.valid_until <= current_date + 3 then 3
               when rv.sent_at <= now() - interval '7 days' then 2
               when rv.sent_at <= now() - interval '3 days' then 1
               else 0
             end as stage
      from public.proposals p
      join public.proposal_revisions rv on rv.id = p.published_revision_id
      join public.clients c on c.id = p.client_id
      where rv.status in ('sent', 'viewed')
        and rv.sent_at is not null
        and (rv.valid_until is null or rv.valid_until >= current_date)
        and c.status = 'Active'

      union all
      -- contracts
      select 'contract', ct.id,
             case
               when rv.expires_at is not null and rv.expires_at <= current_date + 3 then 3
               when rv.sent_at <= now() - interval '7 days' then 2
               when rv.sent_at <= now() - interval '3 days' then 1
               else 0
             end
      from public.contracts ct
      join public.contract_revisions rv on rv.id = ct.published_revision_id
      join public.clients c on c.id = ct.client_id
      where rv.status in ('sent', 'viewed')
        and rv.sent_at is not null
        and (rv.expires_at is null or rv.expires_at >= current_date)
        and c.status = 'Active'

      union all
      -- invoices due within 3 days (recurring plan invoices are charged by Stripe)
      select 'invoice', i.id, 1
      from public.invoices i
      join public.clients c on c.id = i.client_id
      where i.status in ('sent', 'viewed', 'partially_paid')
        and i.service_plan_id is null
        and i.amount_due_cents > 0
        and i.due_date is not null
        and i.due_date between current_date and current_date + 3
        and c.status = 'Active'

      union all
      -- portal invitations not yet accepted
      select 'invite', inv.id,
             case
               when inv.expires_at <= now() + interval '1 day' then 2
               when inv.created_at <= now() - interval '3 days' then 1
               else 0
             end
      from public.client_invitations inv
      join public.clients c on c.id = inv.client_id
      where inv.status = 'pending'
        and inv.expires_at > now()
        and c.status = 'Active'

      union all
      -- discovery form not submitted (or sent back for more information)
      select 'discovery', d.id,
             case
               when age >= interval '14 days' then 3
               when age >= interval '7 days' then 2
               when age >= interval '3 days' then 1
               else 0
             end
      from (
        select di.id,
               now() - (case when di.status = 'more_information_needed' then di.updated_at else di.sent_at end) as age
        from public.discovery_intakes di
        join public.projects pr on pr.id = di.project_id and not pr.archived
        join public.clients c on c.id = di.client_id and c.status = 'Active'
        where di.status in ('awaiting_client', 'more_information_needed')
          and (case when di.status = 'more_information_needed' then di.updated_at else di.sent_at end) is not null
      ) d

      union all
      -- files waiting for the client's approval (per project, by the oldest one)
      select 'review', w.project_id,
             case
               when w.oldest <= now() - interval '14 days' then 3
               when w.oldest <= now() - interval '7 days' then 2
               when w.oldest <= now() - interval '3 days' then 1
               else 0
             end
      from (
        select dl.project_id, min(dl.updated_at) as oldest
        from public.deliverables dl
        join public.projects pr on pr.id = dl.project_id and not pr.archived
        join public.clients c on c.id = pr.client_id and c.status = 'Active'
        where dl.status = 'In Review'
          and dl.archived_at is null
          and exists (select 1 from public.file_versions fv where fv.deliverable_id = dl.id and fv.is_current)
        group by dl.project_id
      ) w

      union all
      -- information requests the client has not answered (per project, by the oldest one)
      select 'info_request', w.project_id,
             case
               when w.oldest <= now() - interval '14 days' then 3
               when w.oldest <= now() - interval '7 days' then 2
               when w.oldest <= now() - interval '3 days' then 1
               else 0
             end
      from (
        select t.project_id, min(t.requested_at) as oldest
        from public.task_client_requests t
        join public.projects pr on pr.id = t.project_id and not pr.archived
        join public.clients c on c.id = t.client_id and c.status = 'Active'
        where t.status = 'awaiting_client'
          and t.requested_at is not null
        group by t.project_id
      ) w
    )
    select cand.kind, cand.entity_id, cand.stage
    from cand
    where cand.stage > 0
      -- never repeat a stage, and never go back to a lower one
      and not exists (
        select 1 from public.client_reminder_log l
        where l.kind = cand.kind and l.entity_id = cand.entity_id and l.stage >= cand.stage
      )
      -- at most one reminder per item every 2 days
      and not exists (
        select 1 from public.client_reminder_log l
        where l.kind = cand.kind and l.entity_id = cand.entity_id and l.sent_at > now() - interval '2 days'
      )
    limit 200
  loop
    begin
      perform net.http_post(
        url := base_url || '/functions/v1/document-email',
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || service_key),
        body := jsonb_build_object('kind', 'client_reminder', 'remind', r.kind, 'id', r.entity_id, 'stage', r.stage::text)
      );
      insert into public.client_reminder_log (kind, entity_id, stage) values (r.kind, r.entity_id, r.stage);
      sent := sent + 1;
    exception when others then
      raise notice 'run_client_reminder_sweep: % % failed: %', r.kind, r.entity_id, sqlerrm;
    end;
  end loop;

  return sent;
end;
$$;

revoke all on function public.run_client_reminder_sweep() from public, anon, authenticated;
grant execute on function public.run_client_reminder_sweep() to service_role;

comment on function public.run_client_reminder_sweep() is
  'Scheduled daily via pg_cron (client-reminder-sweep). Emails clients about proposals, contracts and invoices they have not acted on, pending portal invitations, and things waiting on them after work starts. Returns how many it queued.';

select cron.unschedule(jobid) from cron.job where jobname = 'client-reminder-sweep';
select cron.schedule(
  'client-reminder-sweep',
  '15 15 * * *',
  $$ do $do$ begin perform public.run_client_reminder_sweep(); exception when others then raise warning 'run_client_reminder_sweep failed: %', sqlerrm; end $do$; $$
);
