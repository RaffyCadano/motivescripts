# Staff pay rates and payroll

What the agency owes each staff member for logged hours — separate from [time-tracking.md](./time-tracking.md), which covers what the agency bills the **client**. The two are independent: a project can be invoiced to the client before or after a staff member is paid for the same hours, and there is no rule tying one to the other.

```
Admin sets a staff member's hourly pay rate
  → staff logs hours (already existed, see time-tracking.md)
  → Payroll page: unpaid hours x rate = amount owed, per staff member
  → admin records the payment (method/reference/notes) → payroll_payments row + entries marked paid
```

## Why this is a separate table, not a column on `staff_profiles`

`staff_profiles_select` ([`20260901150000_staff_directory_select.sql`](../supabase/migrations/20260901150000_staff_directory_select.sql)) already lets a staff member read any coworker's `staff_profiles` row if they share a client or project assignment — that policy exists so PMs and teammates can see who's on what. Compensation data must never share that visibility. `staff_pay_rates` is a standalone table with its own, much tighter policy: no assignment-based sharing at all, ever.

## Schema

Migration: `20260908000000_staff_payroll.sql`.

`staff_pay_rates`:

| Column | Notes |
| --- | --- |
| `user_id` | PK, FK → `staff_profiles` |
| `pay_rate_cents` | `bigint >= 0`. Hourly rate paid **to** the staff member |
| `updated_at` / `updated_by` | Set on every change |

`time_entries.payroll_paid_at` — nullable timestamp, added to the existing table from time-tracking.md. Independent of `billed_at`/`invoice_id` (client billing). Once set, the entry locks for the staff member the same way a billed entry does — `time_entries_update`/`time_entries_delete` both require `billed_at is null and payroll_paid_at is null` for a non-admin's own rows. `time_entries.payroll_payment_id` (added in `20260914000000_payroll_payments.sql`) links a paid entry to the specific payment that covered it.

`staff_pay_rates.zelle_contact` / `paypal_email` — nullable, added in `20260918000000_payroll_notify_and_contact.sql`. Optional payout contact info so the admin doesn't have to already know it from outside the app every time "Zelle" or "PayPal" is picked as the method. Set alongside the rate via the same `set_staff_pay_rate` call (now 4 args); shown as a reference line in `RecordPayrollPaymentModal` when that method is selected.

`payroll_payments` (added in `20260914000000_payroll_payments.sql`) — one row per "Mark paid" run for one staff member, mirroring the shape client `payments` already have instead of `mark_time_entries_paid` being a bare timestamp flip:

| Column | Notes |
| --- | --- |
| `staff_id` | Who was paid |
| `amount_cents` / `hours` / `pay_rate_cents` | Frozen at payment time — a later `staff_pay_rates` change never rewrites what a past payment "was for" |
| `through_date` | Entries with `entry_date <= through_date` were included |
| `payment_date`, `method`, `reference`, `notes` | `method` is `bank_transfer`/`zelle`/`paypal`/`cash`/`check`/`other` — a separate, wider set than invoice `payments`' methods (no `stripe`; staff are never paid through the client-facing Stripe flow, and client payments don't offer Zelle/PayPal) |
| `recorded_by` / `recorded_by_label` | Which admin recorded it |

This only records that a payment happened — it does not move money. The actual transfer (bank transfer, cash, check) happens outside the app, same as manual client payments.

## RLS

| Caller | `staff_pay_rates` select | `payroll_payments` select | Write |
| --- | --- | --- | --- |
| Admin | All rows | All rows | Via `set_staff_pay_rate` / `mark_time_entries_paid` only |
| Staff, own row | Own rate only | Own payments only | No write access to either table, not even their own |
| Staff, anyone else's row | Denied | Denied | Denied |

No table grants for INSERT/UPDATE/DELETE on either table — every write goes through the two RPCs below, both `is_admin()`-gated, so there is no path (RLS policy or otherwise) for a staff member to set a rate or record a payment, including their own.

## RPCs

- `set_staff_pay_rate(p_user_id, p_pay_rate_cents)` — admin only. Upserts the rate.
- `mark_time_entries_paid(p_staff_id, p_through_date default today, p_method default 'bank_transfer', p_reference default '', p_notes default '')` — admin only. Requires a pay rate to already be set (`NO_PAY_RATE` if not) and unpaid hours to exist through that date (`NOTHING_TO_PAY` if not). Computes the total from unpaid hours × the staff member's *current* rate, inserts one `payroll_payments` row recording that amount/rate/hours, then marks the covered `time_entries` paid and links them to that payment row. As of `20260918000000_payroll_notify_and_contact.sql`, also inserts a `payroll_paid` notification for the staff member ("Payment recorded", amount/hours/through-date) — previously this was the one money-adjacent event in the app that notified nobody. Returns `{ payment_id, amount_cents, hours, entries }`.

## UI

`/admin/payroll` — admin-only, gated **at the page itself** (`isActiveAdmin(profile)`), not just by nav visibility or the shared `RequireAdminPermission` route guard (which is grant-based and doesn't apply here — see the "Empty-state polish" pattern from the earlier permission audit: this page shows an explicit "you don't have access" message for anyone who isn't a true admin, rather than silently rendering empty data). Same precedent `AdminSettings.tsx`'s Danger Zone already established, just applied to the whole page instead of one section.

Not in `pmNavGroups` at all — a Project Manager, even with broad grants, does not see Payroll in their nav or get past the page's own admin check.

Table: staff name, editable hourly rate, unpaid hours, computed amount owed, "Mark paid" action. Reuses `listMyTimeEntries(staffId)` (from time-tracking.md) for each staff member — safe for an admin to call for any `staffId` since `is_admin()` already grants full `time_entries` visibility regardless of whose id is queried. "Mark paid" opens `RecordPayrollPaymentModal` (method/reference/notes — the amount is computed server-side, not entered) instead of firing immediately.

`/team/time` shows the staff member's own **Payment history** (amount, hours × rate, date, method, reference) alongside their unpaid-hours estimate — a real record now, not just a live-computed number that changes as the rate does.

## Out of scope

Rate history beyond what a payment row freezes (a rate change applies to the next "Mark paid" pass over currently-unpaid hours; past `payroll_payments` rows keep the rate that was actually paid, but there's no view of "rate over time" beyond that). Salaried (non-hourly) staff. Automatic payroll runs or integration with an actual payroll processor — this only tracks what's owed, records that a payment happened, and lets an admin do both by hand.

## Apply

Migrations `20260908000000_staff_payroll.sql` (after `20260907000000`), `20260914000000_payroll_payments.sql`, and `20260918000000_payroll_notify_and_contact.sql`. No Edge Function changes, no new secrets.
