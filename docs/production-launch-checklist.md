# Production launch checklist

Use this before pointing a custom domain at MotiveScripts. Completing `npm run build` is **not** launch approval.

Statuses you should record: done / not done / blocked.

Related: [production-smoke-test.md](./production-smoke-test.md).

## SUPABASE

- [ ] All versioned migrations applied **in order**, including `20260829210000_production_hardening.sql`
- [ ] RLS enabled on application tables; anonymous has no agency grants
- [ ] Storage bucket `project-files` exists, **private**, 50 MB limit
- [ ] Storage policies from the auth/files migrations are present
- [ ] Auth: magic link enabled; public signup disabled for the login form (`shouldCreateUser: false`)
- [ ] Redirect URLs include the production origin (`https://your-domain/.../auth/callback` and site origin)
- [ ] Site URL in Auth matches production
- [ ] First admin exists as `profiles.role = admin` with an active `staff_profiles` row
- [ ] Database backups (PITR or nightly) are configured on the paid plan you intend to run
- [ ] You know how to restore a backup (document the console path for your org)

## EDGE FUNCTIONS

Deploy after secrets are set. `verify_jwt = false` in `supabase/config.toml` is expected; each function still authenticates (user JWT, Stripe signature, or origin + service role for `public-lead`).

- [ ] `client-invitation`
- [ ] `staff-invitation`
- [ ] `document-email`
- [ ] `invoice-pdf`
- [ ] `proposal-pdf`
- [ ] `contract-pdf`
- [ ] `create-checkout-session`
- [ ] `stripe-webhook`
- [ ] `public-lead`

Redeploy PDF/email functions whenever `staff_can_access_client` or CORS helpers change.

## EMAIL (Resend)

- [ ] Sending domain verified in Resend
- [ ] `RESEND_FROM` is an allowed sender on that domain
- [ ] `PUBLIC_SITE_URL` is the production HTTPS origin (no trailing slash required; functions strip it)
- [ ] `SUPPORT_EMAIL` set if used
- [ ] Invitation email tested (client + staff)
- [ ] Start a Project form creates a `leads` row (source `Start a Project`) and optionally emails `SUPPORT_EMAIL`
- [ ] Proposal / contract / invoice email tested
- [ ] Payment receipt email tested (Stripe webhook path)
- [ ] Email failure does not roll back invitations incorrectly or mark invoices paid

## STRIPE

Do **not** switch this app to live mode as part of a code deploy. Keep test and live secrets in separate Supabase secret slots / projects if you need both.

- [ ] Test mode Checkout + webhook verified
- [ ] Production Stripe account exists
- [ ] Live secret key stored only as Edge secret `STRIPE_SECRET_KEY` (never `VITE_`)
- [ ] Production webhook endpoint: `https://<project-ref>.supabase.co/functions/v1/stripe-webhook`
- [ ] Events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`
- [ ] Live `STRIPE_WEBHOOK_SECRET` (`whsec_…`) set
- [ ] `PUBLIC_SITE_URL` origin matches the site Stripe redirects to (CORS + success/cancel URLs)
- [ ] A controlled live payment was tested, then refunded if needed

Exact live-key steps: [stripe-payments.md](./stripe-payments.md).

## APPLICATION

- [ ] `npx tsc -b` and `npm run build` succeed for the commit you deploy
- [ ] Production bundle grep has no `SERVICE_ROLE`, `sk_live`, `sk_test`, `whsec_`, `RESEND_API_KEY`
- [ ] Frontend env is only `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY` (or `VITE_SUPABASE_ANON_KEY`)
- [ ] `.env` is not committed
- [ ] No debug copy on live routes (placeholders for Tasks / Activity / Settings say “not available”)
- [ ] Production database was **not** seeded with `supabase/dev-seed/seed_demo_data.sql`
- [ ] Empty CRM lists show real empty states (not demo clients/projects)
- [ ] `/admin/payments` redirects to invoices
- [ ] Mobile layout checked for dashboard, lists, document dialogs, Checkout return pages
- [ ] Error states are friendly (no Postgres/Stripe dumps in the UI)

## DOMAIN

- [ ] Custom domain on the static host
- [ ] HTTPS working
- [ ] Auth redirect allow-list uses that domain
- [ ] Emails use `PUBLIC_SITE_URL` on that domain
- [ ] SPA fallback so `/auth/callback`, `/invite/:token`, `/client/...` resolve

## BACKUPS

- [ ] Postgres backup / PITR enabled
- [ ] Restore drill: who runs it, RPO/RTO expectation
- [ ] Storage: private bucket objects are not in SQL dumps; plan object recovery (versioning or export) if you need it
- [ ] Stripe Dashboard is source of truth for card money if the webhook is delayed — do not “fix” totals from the browser

## Secrets map

**Frontend (Vite):**

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY` (or `VITE_SUPABASE_ANON_KEY`)

**Edge Function secrets only:**

- Platform: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `PUBLIC_SITE_URL` (and optional `SITE_URL`)
- `RESEND_FROM`
- `SUPPORT_EMAIL`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

Never put Edge secrets in `VITE_` variables.

## Deployment order

1. Apply SQL migrations (including Phase 21).
2. Set / confirm Edge secrets.
3. Deploy all nine functions.
4. Configure Auth redirect URLs and Stripe webhook for the production origin.
5. Deploy the Vite `dist/` to the host.
6. Run [production-smoke-test.md](./production-smoke-test.md).
7. Only then call the launch “verified”.

## Rollback / recovery notes

- **App rollback:** redeploy the previous `dist/` (Auth/RLS still from the database).
- **Function rollback:** redeploy the previous function bundle.
- **Migration:** do not rewrite old files. If a Phase 21 grant causes a genuine outage, ship a **new** migration. Do not “fix” access by disabling RLS.
- **Webhook gap:** reconcile from Stripe Dashboard; `record_stripe_payment` is idempotent on PaymentIntent / Checkout session ids.
- **Lost Storage object:** metadata may remain; re-upload a new version. Rows with no `storage_path` show “No file uploaded yet.”
