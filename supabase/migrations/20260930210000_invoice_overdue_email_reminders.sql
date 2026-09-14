-- Automated overdue-invoice EMAIL reminders. Until now, "overdue" only
-- produced an in-app notification (bell icon) via maybe_notify_invoice_overdue()
-- -- no real email was ever sent, and that in-app notification itself only
-- fired reactively (when staff sent the invoice, or the client viewed it),
-- never on a proactive schedule. This adds a genuine emailed reminder,
-- proactively checked once daily, folded into the existing daily cron job
-- (20260917000000_task_deadline_reminders.sql /
-- 20260921000000_domain_ssl_renewal_tracking.sql) rather than a new one.
--
-- Cadence: at most once every 7 days per invoice while it stays overdue --
-- an escalating-but-not-spammy nag, unlike the daily in-app "task_overdue"
-- notification (a quiet bell icon repeating daily is fine; a real email
-- landing in someone's inbox every day is not).
--
-- Calling the Edge Function from Postgres needs pg_net (HTTP from SQL) plus
-- the project URL and service-role key, which cannot be committed to a
-- migration file. Both are read from Supabase Vault at call time; the
-- actual secret values are seeded separately, directly against each
-- environment (see docs/invoices-payments.md), never checked into git.

create extension if not exists pg_net with schema extensions;

alter table public.invoices add column if not exists overdue_email_sent_at timestamptz;

comment on column public.invoices.overdue_email_sent_at is
  'Last time the overdue-reminder EMAIL was sent for this invoice (see notify_invoices_overdue_email()). Separate from overdue_notified_at, which tracks the in-app bell notification only.';

create or replace function public.notify_invoices_overdue_email()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  base_url text;
  service_key text;
  inv record;
begin
  select decrypted_secret into base_url from vault.decrypted_secrets where name = 'edge_function_base_url';
  select decrypted_secret into service_key from vault.decrypted_secrets where name = 'service_role_key';

  if base_url is null or service_key is null then
    -- Secrets not seeded yet on this environment -- do nothing rather than
    -- error out the whole daily cron job (task/SSL reminders must still run).
    raise notice 'notify_invoices_overdue_email: edge_function_base_url or service_role_key not set in Vault, skipping';
    return;
  end if;

  for inv in
    select i.id
    from public.invoices i
    where public.invoice_effective_status(i.status, i.due_date, i.amount_due_cents) = 'overdue'
      and (i.overdue_email_sent_at is null or i.overdue_email_sent_at < now() - interval '7 days')
  loop
    begin
      perform net.http_post(
        url := base_url || '/functions/v1/document-email',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || service_key
        ),
        body := jsonb_build_object('kind', 'invoice_overdue', 'id', inv.id)
      );
      update public.invoices set overdue_email_sent_at = now() where id = inv.id;
    exception
      when others then
        -- One invoice's email failing (bad recipient, Resend hiccup, etc.)
        -- must not stop the rest of the batch or the other cron tasks.
        raise notice 'notify_invoices_overdue_email: failed for invoice %: %', inv.id, sqlerrm;
    end;
  end loop;
end;
$$;

revoke all on function public.notify_invoices_overdue_email() from public, anon, authenticated;

comment on function public.notify_invoices_overdue_email() is
  'Scheduled daily via pg_cron (same job as notify_task_deadlines). Emails the client once every 7 days while an invoice stays overdue, via document-email''s invoice_overdue kind. Requires edge_function_base_url and service_role_key seeded in Supabase Vault -- see docs/invoices-payments.md.';

-- Fold into the existing daily job rather than creating a second cron entry.
select cron.unschedule(jobid) from cron.job where jobname = 'notify-task-deadlines';

select cron.schedule(
  'notify-task-deadlines',
  '0 13 * * *',
  $$select public.notify_task_deadlines(); select public.notify_domain_ssl_renewals(); select public.notify_invoices_overdue_email();$$
);
