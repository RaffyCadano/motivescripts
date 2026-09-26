-- A record of the automated emails sent to a client, so staff can show they were reminded.
--
-- document-email writes one row per email it sends for these: the Website Scope reminders, the proposal /
-- contract / invoice / invitation / discovery / review / information reminders, overdue invoices, failed or
-- canceled plans, and the free-launch-period emails. It stores who it went to, the subject, when, and the
-- email provider's message id (the reference to look up delivery with the provider).
--
-- Staff who may view the client can read it (the same rule as the rest of the client's records); nobody
-- can change it from the app, and clients never see it. Rows go with the client if the client is purged.

create table if not exists public.client_email_log (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  kind text not null,
  stage text,
  related_id uuid,
  subject text not null,
  recipients text[] not null default '{}',
  provider_id text,
  created_at timestamptz not null default now()
);

comment on table public.client_email_log is
  'Automated emails sent to a client (written by the document-email edge function). Staff read-only proof that a reminder went out.';
comment on column public.client_email_log.kind is
  'scope_reminder, reminder_proposal / reminder_contract / reminder_invoice / reminder_invite / reminder_discovery / reminder_review / reminder_info_request, invoice_overdue, plan_past_due, plan_canceled or launch_trial.';
comment on column public.client_email_log.provider_id is
  'The email provider''s message id for this send, to look up delivery there.';

create index if not exists client_email_log_client_idx on public.client_email_log (client_id, created_at desc);

alter table public.client_email_log enable row level security;

drop policy if exists client_email_log_select_staff on public.client_email_log;
create policy client_email_log_select_staff on public.client_email_log
  for select to authenticated
  using (public.staff_may_client(client_id, 'clients.view'));

revoke all on table public.client_email_log from public, anon;
grant select on table public.client_email_log to authenticated;
grant select, insert on table public.client_email_log to service_role;
