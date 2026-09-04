# Staff pay rates and payroll

What the agency owes each staff member for logged hours — separate from [time-tracking.md](./time-tracking.md), which covers what the agency bills the **client**. The two are independent: a project can be invoiced to the client before or after a staff member is paid for the same hours, and there is no rule tying one to the other.

```
Admin sets a staff member's hourly pay rate
  → staff logs hours (already existed, see time-tracking.md)
  → Payroll page: unpaid hours x rate = amount owed, per staff member
  → admin marks hours paid (own settlement flag, independent of client billing)
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

`time_entries.payroll_paid_at` — nullable timestamp, added to the existing table from time-tracking.md. Independent of `billed_at`/`invoice_id` (client billing). Once set, the entry locks for the staff member the same way a billed entry does — `time_entries_update`/`time_entries_delete` both require `billed_at is null and payroll_paid_at is null` for a non-admin's own rows.

## RLS

| Caller | `staff_pay_rates` select | Write |
| --- | --- | --- |
| Admin | All rows | Via `set_staff_pay_rate` only |
| Staff, own row | Own rate only | No write access, not even to their own rate |
| Staff, anyone else's row | Denied | Denied |

No table grants for INSERT/UPDATE on `staff_pay_rates` — every write goes through `set_staff_pay_rate`, which is `is_admin()`-gated, so there is no path (RLS policy or otherwise) for a staff member to set any rate, including their own.

## RPCs

- `set_staff_pay_rate(p_user_id, p_pay_rate_cents)` — admin only. Upserts the rate.
- `mark_time_entries_paid(p_staff_id, p_through_date default today)` — admin only. Marks all of that staff member's unpaid (`payroll_paid_at is null`) entries through the given date as paid, in one update. Mirrors `generate_invoice_items_from_time_entries`'s shape but settles payroll instead of generating an invoice.

## UI

`/admin/payroll` — admin-only, gated **at the page itself** (`isActiveAdmin(profile)`), not just by nav visibility or the shared `RequireAdminPermission` route guard (which is grant-based and doesn't apply here — see the "Empty-state polish" pattern from the earlier permission audit: this page shows an explicit "you don't have access" message for anyone who isn't a true admin, rather than silently rendering empty data). Same precedent `AdminSettings.tsx`'s Danger Zone already established, just applied to the whole page instead of one section.

Not in `pmNavGroups` at all — a Project Manager, even with broad grants, does not see Payroll in their nav or get past the page's own admin check.

Table: staff name, editable hourly rate, unpaid hours, computed amount owed, "Mark paid" action. Reuses `listMyTimeEntries(staffId)` (from time-tracking.md) for each staff member — safe for an admin to call for any `staffId` since `is_admin()` already grants full `time_entries` visibility regardless of whose id is queried.

## Out of scope

Rate history (a rate change applies to the next "Mark paid" pass over currently-unpaid hours; it does not retroactively separate already-paid history from a rate at the time it was earned — for a small team, settle up before changing someone's rate if that distinction matters to you). Salaried (non-hourly) staff. A self-service "my earnings" view for staff (their own row is already readable via RLS, so this is a UI-only follow-up if wanted later, not a schema change). Automatic payroll runs or integration with an actual payroll processor — this only tracks what's owed and lets an admin mark it settled by hand.

## Apply

Migration `20260908000000_staff_payroll.sql`, after `20260907000000`. No Edge Function changes, no new secrets.
