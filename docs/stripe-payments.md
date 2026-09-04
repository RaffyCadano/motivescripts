# MotiveScripts Stripe payments

Phase 17 adds **Stripe Checkout** on top of the Phase 16 invoice ledger. Manual payments (bank transfer, cash, check, other) are unchanged.

There is no PayPal, GCash, subscriptions, marketplace/connected accounts, or PDF generation.

```
Client opens invoice → Pay Online → create-checkout-session (server amount)
  → Stripe-hosted Checkout → stripe-webhook (signature verified)
  → record_stripe_payment → payments row → invoice totals/status
  → notifications + confirmation email
```

The browser return URL is **not** proof of payment. The webhook is.

## Architecture

| Piece | Role |
| --- | --- |
| `create-checkout-session` | Authenticates a **client** user, loads the invoice with the service role, charges `amount_due` (or a smaller validated amount), creates a Checkout Session, stores the session id |
| `stripe-webhook` | Verifies `Stripe-Signature`, records the payment once, updates the invoice via Postgres |
| `record_stripe_payment` | `SECURITY DEFINER`, **service_role only**. Inserts into existing `payments`, calls `recalc_invoice_totals` |
| `document-email` `kind: payment` | Receipt after webhook confirmation. Email failure does not roll back the payment |

Secrets (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, service role) exist only as Edge Function secrets. Never `VITE_`.

## Database

Migration: `supabase/migrations/20260829120000_stripe_payments.sql`

`payments` (same table as manual records):

| Column | Notes |
| --- | --- |
| `provider` | `manual` or `stripe` |
| `payment_method` | existing methods plus `stripe` |
| `stripe_checkout_session_id` | Unique when set |
| `stripe_payment_intent_id` | Unique when set — idempotency key |
| `stripe_event_id` | Last Stripe event id that wrote the row |

`stripe_checkout_sessions` — pending Checkout Sessions (amount frozen at create time). Confirmed money lives in `payments`.

`client_stripe_customers` — one Stripe Customer id per `clients` row. No SELECT for portal users.

`stripe_processed_events` — Stripe `event.id` primary key so retries are no-ops.

Clients still cannot INSERT/UPDATE/DELETE payments. `record_stripe_payment` is not granted to `authenticated`.

## Payment rules

The Edge Function, not React, decides the charge:

1. User must be `profiles.role = client` with `client_id`
2. Invoice `client_id` must match
3. Status not `draft`, `cancelled`, or `paid`
4. `amount_due_cents > 0`
5. Minimum online charge: **50 cents** (Stripe card floor for USD)

There is no client-specified amount. Checkout always charges the invoice's full `amount_due_cents` at session-create time — the request body only carries `invoiceId`. Progress toward paying off an invoice across multiple payments still works, just not by choosing a partial amount inside one Checkout: a manual payment (or a first Checkout, once it's paid) reduces `amount_due_cents`, and the next Checkout — manual or Stripe — charges whatever is due at that point. Stripe amount cannot exceed current amount due at session create. The webhook still records `least(stripe_amount, stored session amount, amount_due)` so a race with a manual payment recorded after the session was created (but before the client pays) cannot drive `amount_paid` over `total` — see Failure handling below for that case. After a confirmed Checkout, other **open** sessions for that invoice are expired so a second tab cannot over-collect.

## Idempotency

1. Unique indexes on `stripe_payment_intent_id` and `stripe_checkout_session_id`
2. `record_stripe_payment` returns `{ duplicate: true }` if either id already exists (including unique_violation)
3. `stripe_processed_events.event_id` primary key
4. Notifications and receipt email run only when a **new** payment row is inserted

## Client UI

- `/client/invoices` — Pay Online when the invoice is payable
- `/client/invoices/:id` — amount (defaults to amount due), Pay Online → redirect to Stripe
- `/client/invoices/:id/payment-success` — “Payment submitted / being confirmed”, then “Payment received” after the ledger updates. Never marks paid from the query string
- `/client/invoices/:id/payment-cancelled` — no charge

Clients see method **Stripe** and Received/Reversed. They do not see PaymentIntent ids, webhook payloads, or recorder identity.

## Admin UI

`/admin/invoices/:id` payment history shows method, status, reference, and Stripe PaymentIntent id. Manual **Record Payment** still uses bank/cash/check/other. Stripe rows can be reversed through the existing reversal RPC (history is kept). Amounts cannot be edited in place.

## Notifications

`payment_received` (Stripe) and existing `invoice_paid` when the invoice reaches paid. Manual admin recordings still use `payment_recorded`.

## Email

After a **new** webhook payment, the webhook calls `document-email` with `{ kind: "payment", id: invoiceId, paymentId }` using the service role. `RESEND_API_KEY` / `PUBLIC_SITE_URL` stay on the function. A Resend failure is logged; the payment stays.

## Exact Supabase setup

1. Dashboard → SQL Editor: run `supabase/migrations/20260829120000_stripe_payments.sql` **after** Phase 16, or `supabase db push` if the CLI is linked.
2. Dashboard → Edge Functions → Secrets (or `supabase secrets set`):

```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
PUBLIC_SITE_URL=https://your-production-origin
RESEND_API_KEY=re_...
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are provided by the platform. Never put Stripe secrets in a `VITE_` variable or in the Vite `.env`.
3. Deploy:

```bash
supabase functions deploy create-checkout-session
supabase functions deploy stripe-webhook
supabase functions deploy document-email
```

4. Confirm `verify_jwt = false` for those functions (this repo’s `supabase/config.toml`). Checkout still requires a user JWT inside the function. The webhook verifies Stripe’s signature, not a Supabase JWT.

## Exact Stripe Dashboard / webhook setup

1. Create a Stripe account and stay in **test mode** until live-card testing is intentional.
2. Developers → API keys → Secret key (`sk_test_…`). Store only as `STRIPE_SECRET_KEY`. This phase does not need a publishable key in the browser (Checkout is hosted).
3. Developers → Webhooks → Add endpoint:
   - URL: `https://<project-ref>.supabase.co/functions/v1/stripe-webhook`
   - Events: `checkout.session.completed`, `checkout.session.async_payment_succeeded` (recurring billing later adds three more subscription events to this same endpoint — see [service-plans.md](./service-plans.md))
4. Open the endpoint → Signing secret → `whsec_…` → set `STRIPE_WEBHOOK_SECRET`.
5. Test with card `4242 4242 4242 4242` and any future expiry / CVC.

Local Stripe CLI (optional):

```bash
stripe listen --forward-to http://127.0.0.1:54321/functions/v1/stripe-webhook
```

Use the CLI `whsec_` as `STRIPE_WEBHOOK_SECRET` for local functions.

## Failure handling

| Failure | Result |
| --- | --- |
| Client pays another invoice id | Function returns `not_allowed` |
| Draft / cancelled / paid / zero due | `not_payable` |
| Amount due below the 50-cent Stripe floor | `amount_too_small` |
| Bad webhook signature | HTTP 400, no ledger write |
| Duplicate webhook | HTTP 200, no second payment |
| Email / Resend down | Payment remains; log only |
| Manual payment after Checkout opened, before pay | Webhook caps at remaining due; leftover Stripe collection needs a Dashboard refund |
| Extra open Checkout sessions after a confirmed pay | Webhook expires them so a second tab cannot over-collect |
| Persist of `stripe_checkout_sessions` fails after Stripe create | Function expires that Checkout Session and returns an error |

## Test matrix

Use Stripe test cards (`4242…`) and two Auth users. SQL Editor bypasses RLS.

| # | Case |
| --- | --- |
| 1 | Client sees Pay Online on a sent invoice with amount due ≥ $0.50 |
| 2 | Draft invoices are not in the client list; no Pay Online |
| 3 | Checkout for another client’s invoice id is denied |
| 4 | Cancelled invoice cannot be paid |
| 5 | Paid invoice has no Pay Online |
| 6 | Checkout `unit_amount` always equals server `amount_due` at session-create time |
| 7 | A manual partial payment recorded before Checkout leaves `partially_paid`; the next Checkout charges only the remaining due |
| 8 | Paying the remainder sets `paid` |
| 9 | Row appears in `payments` with `provider = stripe` |
| 10 | Replaying the webhook does not duplicate the row |
| 11 | Wrong signature is rejected |
| 12–13 | Browser cannot UPDATE status, amount_paid, or payments |
| 14 | Admin Record Payment still works |
| 15 | Manual + Stripe can both apply to one invoice |
| 16 | `payment_received` notification |
| 17 | Receipt email only after webhook |
| 18 | Kill Resend; payment still recorded |
| 19 | Success page says processing until the ledger updates |
| 20 | Client only sees own history; no PaymentIntent id |
| 21 | Admin sees `pi_…` |
| 22 | Production JS bundle has no `sk_live` / `sk_test` / `whsec_` |
| 23 | A manual payment recorded after a Checkout session is opened, before the client pays, is capped correctly (webhook caps at remaining due; see Failure handling) |
| 24 | Refresh keeps the payment |
| 25 | Second Checkout can pay the remaining balance |

## Out of scope

PayPal, GCash, payment plans, Stripe Connect, custom card elements. Recurring/subscription billing is a separate later phase on the same webhook: [service-plans.md](./service-plans.md). Invoice PDFs: [invoice-pdf.md](./invoice-pdf.md). Proposal and contract PDFs: [proposal-contract-pdf.md](./proposal-contract-pdf.md).

## Known limitations

- Abandoned Checkout Sessions stay `open` in `stripe_checkout_sessions` until Stripe expires them (typically 24 hours) or a later payment on the same invoice expires leftovers.
- If amount due drops after a session is created and that session is still paid, the ledger records only remaining due; any extra Stripe collection must be refunded in the Dashboard.
- Client `SELECT` on `payments` may include Stripe ids in the API payload; the Client Portal does not render them.
- Online charges below **50 cents** are rejected (Stripe card floor for USD).
- `document-email` `kind: payment` is service-role only (webhook). Admins cannot send a receipt from the browser.

## Switching to live Stripe (manual)

Do not put live keys in Vite. Do not flip this in application code.

1. Complete the test-mode matrix above on the production (or staging) project.
2. In Stripe, switch the Dashboard to **live** and copy `sk_live_…` (not the publishable key).
3. Create a **live** webhook with the same events, pointing at `https://<project-ref>.supabase.co/functions/v1/stripe-webhook`.
4. Copy the live signing secret `whsec_…`.
5. Set Edge secrets `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` to the live values (replace test secrets on that project, or use a dedicated live Supabase project).
6. Confirm `PUBLIC_SITE_URL` is the HTTPS origin customers use. Checkout CORS and success/cancel URLs use it.
7. Run one small live payment, confirm webhook → ledger → invoice, then refund in Stripe if it was only a probe.
8. Keep test keys out of the live project secrets.

Phase 21: `record_stripe_payment` requires a matching `stripe_checkout_sessions` row. Browser-invoked Checkout CORS is restricted to `PUBLIC_SITE_URL`.

Launch checklist: [production-launch-checklist.md](./production-launch-checklist.md). Smoke tests 51–56: [production-smoke-test.md](./production-smoke-test.md).
