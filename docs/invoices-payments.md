# MotiveScripts invoices and payments

Phase 16 adds agency invoices and **manual** payment records on top of Phase 12 ownership/RLS, Phase 13 notifications, and Phase 15 document numbering / `document-email`.

Online card payments are Phase 17 ([stripe-payments.md](./stripe-payments.md)). Invoice PDFs are Phase 18 ([invoice-pdf.md](./invoice-pdf.md)). An accepted contract does **not** create an invoice.

```
Lead → Client → Project → Proposal → Contract → Invoice → manual payment and/or Stripe Checkout
```

## Schema

New migration: `supabase/migrations/20260829100000_invoices_payments.sql`

`invoices` (integer cents throughout):

| Column | Notes |
| --- | --- |
| `id` | UUID |
| `invoice_number` | Unique `MS-INV-2026-001` |
| `client_id` | Required. FK → `clients` |
| `project_id` / `contract_id` / `proposal_id` | Optional. Must belong to the same client |
| `status` | Stored: `draft`, `sent`, `viewed`, `partially_paid`, `paid`, `cancelled` |
| `issue_date` / `due_date` | `due_date >= issue_date` |
| `currency` | Default `USD`, `^[A-Z]{3}$` |
| `subtotal_cents`, `tax_cents`, `discount_cents`, `total_cents` | bigint ≥ 0 |
| `amount_paid_cents`, `amount_due_cents` | Derived. `due = total - paid`. Paid cannot exceed total |
| `notes` | Client-visible |
| `snapshot_items` / `bill_to` | Frozen at send |
| `sent_at` / `viewed_at` / `paid_at` / `cancelled_at` | Lifecycle |
| `overdue_notified_at` | Set once when overdue notification fires |

`invoice_items`: `description`, `quantity` (1–9999), `unit_price_cents`, generated `total_cents = quantity * unit_price_cents`. The browser total is never stored.

`payments`: append-oriented manual records (`bank_transfer`, `cash`, `check`, `other`). `recorded_by` / `recorded_by_label` are set in the RPC from `auth.uid()`. Reverse with `reversed_at` instead of DELETE.

`invoice_admin_notes`: agency-only. Clients have no SELECT policy.

`notifications.invoice_id` is optional. Types added: `invoice_ready`, `invoice_viewed`, `payment_recorded`, `invoice_paid`, `invoice_overdue`.

## Numbering

Reuses `document_number_counters` + `next_document_number('invoice')`. Prefix `MS-INV-`. Unique index on `invoice_number`.

## Lifecycle

Stored status is not the same as **effective** status.

`invoice_effective_status(status, due_date, amount_due_cents)`:

- If stored is `sent` or `viewed`, due date is in the past (UTC date), and amount due &gt; 0 → **overdue**
- `partially_paid` stays stored even if the due date has passed
- No cron job is required to *display* overdue

Allowed transitions (RPCs + triggers):

```
draft → sent → viewed → partially_paid → paid
sent / viewed → overdue (effective only)
sent / viewed / overdue → cancelled
```

Blocked:

- `paid` → `draft` or `cancelled`
- `cancelled` → `paid`
- Cancel when any unreverted payment exists
- Payment on `draft`, `cancelled`, or already `paid`
- Payment amount &gt; amount due
- Negative payments
- Editing totals after send except through payment RPCs
- Editing line items after any payment

Clients cannot view `draft` or `cancelled` invoices.

Opening a `sent` invoice as the owning client calls `mark_invoice_viewed` once (`sent` → `viewed`). Draft never becomes viewed.

## Payment model

Admins record a payment with `record_invoice_payment`. The database:

1. Inserts the payment (`recorded_by = auth.uid()`)
2. Recalculates `amount_paid_cents` / `amount_due_cents` from unreverted payments
3. Sets `partially_paid` or `paid`

Corrections use `reverse_invoice_payment` (history stays). There is no casual delete.

This is bookkeeping, not a charge.

## RPCs

All are `SECURITY DEFINER`, `search_path = public`, with `is_admin()` / `is_client()` + ownership checks. Mutations set `app.document_rpc` so table triggers allow the write.

| RPC | Who | Effect |
| --- | --- | --- |
| `create_invoice` | Admin | New draft, number, optional project/contract/proposal. Accepted contract only, same client |
| `update_invoice_draft` | Admin | Draft-only. Replaces line items; DB recalculates totals |
| `send_invoice` | Admin | Requires ≥1 item and total &gt; 0. Freezes snapshot + bill-to. Notifies client |
| `cancel_invoice` | Admin | Not paid; no active payments |
| `record_invoice_payment` | Admin | Manual payment; cannot exceed amount due |
| `reverse_invoice_payment` | Admin | Sets `reversed_at`; recalculates |
| `mark_invoice_viewed` | Client | Own non-draft invoice; `sent` → `viewed` once |

The browser must not UPDATE `status`, `amount_paid_cents`, `client_id`, or `recorded_by`. Table GRANTs on invoices/items/payments are SELECT only.

## RLS

Anonymous: no grants.

| Caller | Invoices / items / payments |
| --- | --- |
| Admin | SELECT all agency rows. Mutations via RPCs |
| Client A | SELECT own non-draft, non-cancelled invoices, their items, and their payments |
| Client A vs Client B | Denied |
| Client | No INSERT/UPDATE/DELETE on invoices, items, or payments |
| Anyone | No SELECT on `invoice_admin_notes` except admin |

Ownership: `auth.uid()` → `profiles.client_id` → `invoices.client_id`. URL `client_id` is ignored.

## Notifications and email

Reuse Phase 13 `notifications` and `notify_document`.

| Event | Recipients |
| --- | --- |
| Send | Client: “New invoice available” (`invoice_ready`) |
| First view | Admins: “Invoice viewed” |
| Payment | Client: “Payment recorded”; if paid in full, client + other admins `invoice_paid` |
| Overdue (once) | Client + admins `invoice_overdue` when send/view detects effective overdue |

Overdue notify is **not** on every list fetch.

Email: Edge Function `document-email` with `{ kind: "invoice", id }`. Same Resend secrets as proposals. Send RPC commits first; email failure does **not** roll back `sent`. The admin toast warns if mail fails. After Phase 18 the email attaches a generated PDF when `invoice-pdf` generation succeeds ([invoice-pdf.md](./invoice-pdf.md)).

Email includes MotiveScripts branding, invoice number, amount due, due date, client name, and `/client/invoices/{id}`. No admin notes, no other clients’ data.

Redeploy `document-email` after this phase so the invoice branch exists.

## Activity

`record_document_activity` events: `invoice_created`, `invoice_sent`, `invoice_viewed`, `payment_recorded`, `invoice_paid`, `invoice_cancelled`. Project-linked invoices also append to `public.activity`. Client-facing invoice pages do not show internal staff notes.

## Money

`src/data/money.ts`: integer cents only (`formatUsdFromCents`, `formatMoneyFromCents`, `parseDollarsToCents`). Default display currency USD; other ISO codes can prefix the same cent amount later.

## UI

Admin: `/admin/invoices`, `/admin/invoices/new`, `/admin/invoices/:id`  
Client: `/client/invoices`, `/client/invoices/:id` (nav label **Invoices**; `/client/billing` redirects)

Create Invoice is an explicit admin action from the client profile, project-linked invoice list, or an **accepted** contract. Totals are not copied blindly from a proposal.

## Seed

Optional **DEVELOPMENT ONLY** invoice rows live at the end of `20260829100000_invoices_payments.sql`. They insert only if the development seed clients already exist (`supabase/dev-seed/seed_demo_data.sql`). Production databases without that seed skip the block. React must not insert demo invoices on load.

## Security decisions

- Integer cents; generated line totals
- RPCs derive client, recorder, totals, and status
- Payments cannot exceed amount due; due cannot go negative
- Invoice numbers unique; format checked
- Cross-client FKs rejected by trigger
- Clients cannot record or reverse payments
- No payment processor keys in the browser; no `VITE_` Resend or service-role keys

## Online payments (Phase 17)

Stripe Checkout is layered on this ledger. Manual bank/cash/check/other recording is unchanged. See [stripe-payments.md](./stripe-payments.md).

## Hourly invoices from logged time

Added later, on top of this ledger: `invoice_items.quantity` became fractional, and a `generate_invoice_items_from_time_entries` RPC turns unbilled staff time into draft invoice line items for hourly-billed projects. See [time-tracking.md](./time-tracking.md).

## Test checklist

Use two real Auth users. The SQL editor bypasses RLS.

1. Admin creates invoice  
2. Admin saves draft  
3. Client cannot see draft  
4. Admin sends invoice  
5. Client can see invoice  
6. Client opening a sent invoice → viewed once  
7. Admin records partial payment  
8. Client sees updated paid/due  
9. Admin records remaining payment → paid  
10. Client cannot modify invoice or record payment  
11. Client cannot open another client’s invoice  
12. Admin can open agency invoices  
13. Cancelled invoice cannot be paid  
14. Payment cannot exceed amount due  
15. Refresh keeps data  
16. Project workspace shows linked invoices  
17. Client portal list/detail  
18. Notifications on send/view/pay  
19. Email failure leaves status `sent`

## Apply

1. Run `20260829100000_invoices_payments.sql` on the existing project  
2. Redeploy `document-email`  
3. Confirm Edge secrets: `RESEND_API_KEY`, `PUBLIC_SITE_URL` (Dashboard only, not `VITE_`)

## Production

Clients still cannot INSERT/UPDATE payments or invoices. Manual + Stripe rows share `payments`. Reversals keep history. `/admin/payments` in the app redirects to invoices.

Launch: [production-launch-checklist.md](./production-launch-checklist.md). Stripe live switch: [stripe-payments.md](./stripe-payments.md).
