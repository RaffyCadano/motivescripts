-- Documents a real gotcha found while testing 20260930210000: the Vault
-- secret named 'service_role_key' must hold the NEWER "secret" API key
-- format (prefix sb_secret_...), not the legacy JWT-format service_role key
-- (prefix eyJ...) that `supabase projects api-keys` also lists under the
-- name "service_role". Confirmed empirically against Sandbox -- the legacy
-- key made document-email's own isServiceRole check reject the call with
-- 403 not_allowed; the sb_secret_... key passed. Whichever key Edge
-- Functions actually bind to Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") at
-- runtime is the one Vault must hold here.

comment on function public.notify_invoices_overdue_email() is
  'Scheduled daily via pg_cron (same job as notify_task_deadlines). Emails the client once every 7 days while an invoice stays overdue, via document-email''s invoice_overdue kind. Requires two secrets seeded in Supabase Vault, per environment (never in a migration file): edge_function_base_url (this project''s https://<ref>.supabase.co) and service_role_key -- use the NEWER "secret" key format (sb_secret_...) from `supabase projects api-keys --reveal`, not the legacy service_role JWT; the legacy key fails document-email''s own service-role check with 403. Also requires RESEND_API_KEY and PUBLIC_SITE_URL set as Edge Function secrets (same prerequisites every other document email already needs) -- neither is set on Sandbox as of this migration, so no email actually sends yet; verified via net._http_response that the call correctly reaches document-email''s business logic and fails only on that pre-existing, unrelated gap (missing_site_url).';
