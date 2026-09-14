-- Two real gaps found by a follow-up code review of 20260930210000:
--
-- 1. notify_invoices_overdue_email() relied on invoice_effective_status(),
--    which never promotes 'partially_paid' to 'overdue' even when the
--    remaining balance is well past due_date (it's hardcoded to pass
--    'partially_paid' straight through -- see 20260829100000, line 176).
--    A client who pays part of an invoice and then stops would never get a
--    reminder for the remainder, no matter how overdue. This is a
--    pre-existing gap in a function also used for the in-app bell
--    notification and every invoice-status badge in the UI -- fixing THAT
--    shared function would silently change what "Partially Paid" means
--    everywhere else in the app, which is a real product decision this
--    migration does not make unilaterally. Instead, this scopes the fix to
--    exactly what this feature owns: the reminder's own WHERE clause now
--    checks status + due_date + amount_due_cents directly, matching what
--    "actually overdue, whatever the status label says" means for this one
--    purpose, without touching how the invoice's status displays anywhere.
--
-- 2. The daily cron job runs three notify_* functions as one SQL command
--    string, which pg_cron executes as a single implicit transaction. If
--    any one of the three raised an uncaught exception, the whole batch
--    would roll back -- undoing already-inserted notifications from the
--    functions that ran before it, not just skipping the one that failed.
--    Wrapping each call in its own exception-catching DO block gives each
--    function its own implicit savepoint, so one failing never touches the
--    others' work.

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
    raise notice 'notify_invoices_overdue_email: edge_function_base_url or service_role_key not set in Vault, skipping';
    return;
  end if;

  for inv in
    select i.id
    from public.invoices i
    where i.status in ('sent', 'viewed', 'partially_paid')
      and i.due_date is not null
      and i.due_date < (timezone('utc', now()))::date
      and coalesce(i.amount_due_cents, 0) > 0
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
        raise notice 'notify_invoices_overdue_email: failed for invoice %: %', inv.id, sqlerrm;
    end;
  end loop;
end;
$$;

revoke all on function public.notify_invoices_overdue_email() from public, anon, authenticated;

comment on function public.notify_invoices_overdue_email() is
  'Scheduled daily via pg_cron (same job as notify_task_deadlines). Emails the client once every 7 days while an invoice stays overdue -- checks status/due_date/amount_due_cents directly rather than invoice_effective_status(), so a partially-paid invoice with a past-due remaining balance is still caught (invoice_effective_status() never promotes partially_paid to overdue, by design elsewhere in the app -- this reminder needs the underlying fact, not the display label). Requires edge_function_base_url and service_role_key in Supabase Vault -- see 20260930220000''s comment for the exact key format needed.';

select cron.unschedule(jobid) from cron.job where jobname = 'notify-task-deadlines';

select cron.schedule(
  'notify-task-deadlines',
  '0 13 * * *',
  $$
  do $do$ begin perform public.notify_task_deadlines(); exception when others then raise warning 'notify_task_deadlines failed: %', sqlerrm; end $do$;
  do $do$ begin perform public.notify_domain_ssl_renewals(); exception when others then raise warning 'notify_domain_ssl_renewals failed: %', sqlerrm; end $do$;
  do $do$ begin perform public.notify_invoices_overdue_email(); exception when others then raise warning 'notify_invoices_overdue_email failed: %', sqlerrm; end $do$;
  $$
);
