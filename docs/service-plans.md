# MotiveScripts recurring/retainer billing (service plans)

Adds real Stripe **subscriptions** on top of the [invoices-payments.md](./invoices-payments.md) ledger and the [stripe-payments.md](./stripe-payments.md) webhook, for Website Care, SEO retainers, and hosting-as-a-service. There is no separate billing system — every billing cycle writes a normal `invoices` row through the same ledger a one-time payment uses.

Hosting-as-a-service here is **billing and tracking only**. Nothing provisions a server or DNS — "where a site is actually hosted" is tracked on the project's existing Development hosting-provider field, same as before this phase.

```
Admin creates a service_plans row (pending)
  → manage-service-plan: create_checkout → Stripe subscription Checkout Session
  → client pays → checkout.session.completed (mode=subscription) → activate_service_plan → active
  → every billing cycle: Stripe's invoice.paid → record_recurring_invoice_payment
      → new invoices row + payment row on the same ledger as one-time invoices
  → invoice.payment_failed → past_due
  → customer.subscription.deleted (client-initiated or via "Cancel plan") → canceled
```

## Architecture

| Piece | Role |
| --- | --- |
| `service_plans` | One row per recurring plan. Not a Stripe mirror — `status` is only ever changed by the webhook or `create_service_plan`, never guessed client-side |
| `manage-service-plan` | Admin-only Edge Function. `create_checkout` creates a subscription-mode Checkout Session; `cancel` calls Stripe and lets the webhook update local state |
| `stripe-webhook` | Same function as one-time payments, extended with subscription branches. Signature-verified, `stripe_processed_events` deduped |
| `record_recurring_invoice_payment` | `SECURITY DEFINER`, **service_role only**. Creates one invoice + payment per billing cycle, following `create_invoice`'s real sequence (`app.document_rpc`, items, then an explicit `recalc_invoice_totals` call since payment inserts don't auto-trigger it) |
| `activate_service_plan` / `set_service_plan_status_by_subscription` | Webhook-only state transitions. Never called from the browser |
| `check-domain-availability` | Admin-only Edge Function. Read-only RDAP lookup, no registrar account, nothing purchased |

## Database

Migrations: `supabase/migrations/20260910000000_service_plans.sql`, `20260911000000_service_plan_domain.sql`.

`service_plans`:

| Column | Notes |
| --- | --- |
| `plan_type` | `care`, `seo_retainer`, `hosting`, `custom` |
| `label` | Free text, becomes the Stripe Checkout line-item name and the invoice description |
| `amount_cents` | ≥ 50 (Stripe's card floor). Charged every cycle at this amount — no proration UI, no mid-cycle amount changes |
| `status` | `pending` → `active` → `past_due` / `canceled`. Set only by `create_service_plan` (pending) or the webhook |
| `stripe_subscription_id` | Unique. Set on activation |
| `domain` | Free-text reference note, mainly for `hosting` plans. Not validated against a registry |

`invoices.service_plan_id` — nullable FK, set only on recurring-cycle invoices. One-time invoices leave this null.

`payments.stripe_invoice_id` — the idempotency key for recurring charges, distinct from `stripe_payment_intent_id`/`stripe_checkout_session_id` used by the one-time flow (a recurring charge has no payment intent or checkout session of its own after the first cycle; it has a Stripe **invoice** id). Unique index when set.

Two new notification types: `plan_past_due`, `plan_canceled`, gated on `invoices.view` like every other billing notification.

## Idempotency and the activation race

Same dual-layer pattern as one-time payments:

1. `stripe_processed_events.event_id` — top-of-function dedupe, all event types
2. `payments.stripe_invoice_id` unique index + `record_recurring_invoice_payment`'s up-front `select` and `unique_violation` fallback — needed because this RPC **creates a new row every cycle** rather than updating one existing draft, so event-id dedupe alone isn't enough if a retry lands after the unique check but before commit

Stripe does not guarantee `checkout.session.completed` arrives before `invoice.paid` for a subscription's first billing cycle — they can arrive nearly simultaneously. If `invoice.paid` arrives and no `service_plans` row is active yet for that subscription, the webhook returns **HTTP 409 without marking the event processed**, so Stripe retries (with backoff, for days) until activation has actually happened. It never silently drops that first cycle.

## Plan lifecycle

`pending` — created by `create_service_plan`, no Stripe object yet.
`active` — `checkout.session.completed` (subscription mode) matched a `stripe_checkout_session_id` and stored the resulting `stripe_subscription_id`.
`past_due` — `invoice.payment_failed` for that subscription. Admins are notified (`plan_past_due`). The plan is not auto-canceled; Stripe's own retry schedule (or your dunning settings) decides what happens next.
`canceled` — `customer.subscription.deleted`, whether triggered by "Cancel plan" in the app or directly in Stripe/by the customer.

There is no `active` → `pending` path and no resuming a canceled plan — create a new plan instead.

## Admin UI

`/admin/clients/:id#plans` (`ClientRecurringPlansSection`): create a plan (type, optional project, name, monthly amount), "Get checkout link" for `pending` plans, "Cancel plan" for `active`/`past_due`. Hosting-type plans additionally show the domain field: type a domain, "Check availability" (RDAP lookup, no account needed), "Save" to keep it as a note on the plan.

## Client UI

`/client/settings` shows non-canceled plans (label, type, amount, status) via `service_plans` RLS narrowed to the caller's own client. Actual charges appear automatically in the client's existing Invoices list/detail — no separate recurring-payments UI, since `record_recurring_invoice_payment` writes real `invoices` rows.

## Notifications

`payment_received` and (when the cycle's invoice reaches `paid`, which it always should given a single matching line item) `invoice_paid` — same types the one-time flow uses. `plan_past_due` on payment failure, `plan_canceled` on subscription deletion, both to admins only.

## Exact Supabase setup

1. Run `20260910000000_service_plans.sql` then `20260911000000_service_plan_domain.sql` (or `supabase db push`).
2. No new secrets — reuses `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and the platform-provided Supabase keys already set for [stripe-payments.md](./stripe-payments.md).
3. Deploy:

```bash
supabase functions deploy stripe-webhook
supabase functions deploy manage-service-plan
supabase functions deploy check-domain-availability
```

4. Confirm `verify_jwt = false` for `manage-service-plan` and `check-domain-availability` in `supabase/config.toml` (already committed). Both authenticate the caller's JWT inside the function body and check `role = admin`.

## Exact Stripe Dashboard setup

The **same** webhook endpoint used for one-time payments now needs three more subscribed events. Developers → Webhooks → your endpoint → add:

- `invoice.paid`
- `invoice.payment_failed`
- `customer.subscription.deleted`

(`checkout.session.completed` and `checkout.session.async_payment_succeeded` were already required by [stripe-payments.md](./stripe-payments.md) and now also cover subscription-mode sessions — no new endpoint needed.)

Test with card `4242 4242 4242 4242`.

## Failure handling

| Failure | Result |
| --- | --- |
| `invoice.paid` arrives before the plan is activated | HTTP 409, not marked processed — Stripe retries |
| Duplicate `invoice.paid` (replay) | `record_recurring_invoice_payment` returns `duplicate: true`, no second invoice |
| `manage-service-plan` called by non-admin | `not_allowed` |
| `create_checkout` on a non-`pending` plan | `not_payable` |
| `cancel` on a `pending`/`canceled` plan | `not_cancelable` |
| `check-domain-availability` on a ccTLD without RDAP support | Reports `unknown`, not a guess |
| Persisting `stripe_checkout_session_id` fails after Stripe create | Function expires that Checkout Session and returns an error, same pattern as `create-checkout-session` |

## Test matrix

Use Stripe test mode and two Auth users (an admin and a client on the same test client record).

| # | Case |
| --- | --- |
| 1 | Admin creates a plan; status is `pending` |
| 2 | Non-admin cannot call `create_service_plan` or `manage-service-plan` |
| 3 | "Get checkout link" opens a Stripe subscription Checkout |
| 4 | Paying with `4242…` activates the plan (`pending` → `active`) |
| 5 | A real invoice appears in admin Invoices and the client's own Invoices, `paid`, for the plan amount |
| 6 | Replaying the `invoice.paid` webhook event does not create a second invoice |
| 7 | Firing `invoice.paid` manually before `checkout.session.completed` is processed returns 409 and does not drop the cycle once activation catches up |
| 8 | Declining a renewal (`invoice.payment_failed`) sets `past_due` and notifies admins |
| 9 | Canceling in Stripe or via "Cancel plan" sets `canceled` |
| 10 | Client sees their own plans on Settings; not other clients' |
| 11 | Client cannot cancel or create a plan (no such client-facing action) |
| 12 | Domain "Check availability" on a clearly free custom-TLD name returns `available` |
| 13 | Domain "Check availability" on `google.com` returns `taken` |
| 14 | Domain note saves and persists across reload |

## Out of scope

Plan upgrades/downgrades (create a new plan instead), annual/other billing intervals (monthly only), proration, dunning configuration beyond Stripe's defaults, a client-facing "manage my plan" self-service UI, automatic domain registration or purchase (checking only, see Admin UI above), real hosting infrastructure provisioning.

## Production

Follows [stripe-payments.md](./stripe-payments.md)'s live-switch steps — same webhook endpoint, same secrets, add the three subscription events to the live endpoint too. Run one small live subscription end-to-end before relying on it for a real client, then cancel/refund the probe.
