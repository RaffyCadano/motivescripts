# Time tracking, billing mode, and PM capacity

Adds effort estimation, staff time logging, a per-project billing mode, and hourly invoice generation on top of the existing Phase 12 ownership/RLS and Phase 16 invoice ledger ([invoices-payments.md](./invoices-payments.md)). Not part of the original numbered phase sequence — added later, same conventions.

```
PM estimates hours on a task → staff logs actual hours against a project (optionally a task)
  → project.billing_mode decides framing:
      fixed   → compare logged hours against an optional budgeted_hours target (internal only)
      hourly  → admin generates draft invoice line items from unbilled time entries, at the project's rate
  → PM capacity view aggregates estimated hours (not logged hours) by assignee and due-date week
```

Estimated hours (forward-looking, for capacity planning) and logged hours (actual, for billing/budget) are deliberately separate numbers on separate tables — the capacity view never reads `time_entries`.

## Schema

Migrations: `20260905000000_task_estimated_hours.sql`, `20260905010000_project_billing_fields.sql`, `20260905020000_time_entries.sql`, `20260905030000_invoice_items_fractional_quantity.sql`, `20260905040000_generate_invoice_from_time.sql`.

`tasks.estimated_hours` — nullable `numeric(6,2)`, effort estimate. Not tied to any actual logged time. As of `20260915000000_production_task_default_hours.sql`, auto-generated production tasks get a sensible default from `production_task_estimated_hours(title)` (a title-matched lookup — e.g. "Build homepage" defaults higher than "Test contact form") instead of starting blank; a PM can still override it, and an override is never replaced. The manual task form (`TaskFormModal`) mirrors the same defaults client-side (`estimatedHoursForTitle` in `productionTaskInstructions.ts`) when a recognized title is typed for a *new* task — keep both in sync if the catalog changes. A genuinely custom/unrecognized title still gets no default, same as before.

`projects`:

| Column | Notes |
| --- | --- |
| `billing_mode` | `fixed` (default) or `hourly` |
| `hourly_rate_cents` | Nullable. Only meaningful when `billing_mode = 'hourly'` |
| `budgeted_hours` | Nullable. Only meaningful when `billing_mode = 'fixed'`; compared against total logged hours in the project Time tab |

`time_entries`:

| Column | Notes |
| --- | --- |
| `id` | UUID |
| `project_id` | Required. FK → `projects` |
| `task_id` | Optional. FK → `tasks`, `on delete set null` — a project-level entry has no task |
| `staff_id` | Required. Who logged the hours |
| `entry_date` | Defaults to today (UTC) |
| `hours` | `numeric(6,2)`, `0 < hours <= 24` |
| `note` | Optional |
| `billed_at` / `invoice_id` | Set together when rolled into an invoice. Null = unbilled |
| `created_by` | Always `auth.uid()` |

`invoice_items.quantity` was widened from `integer` to `numeric(10,2)` (still `0 < quantity <= 9999`) so hourly line items can carry fractional hours (e.g. `7.5`) without being floored to a whole number. `total_cents` is regenerated as `round(quantity * unit_price_cents)`.

## RLS

`time_entries` is direct-table RLS-governed CRUD (not RPC-wrapped) — same pattern as `task_client_requests` ([task-workspace, in `20260903000000_task_workspace.sql`]).

| Caller | Select | Insert | Update / Delete |
| --- | --- | --- | --- |
| Admin | All | — (writes as any staff below) | All |
| Staff, own rows, assigned project (`projects.view`) | Own rows | Own rows (`staff_id = auth.uid()`, must have `projects.view` on the project) | Own rows, only while `billed_at is null` |
| Staff with `invoices.manage` on the project | All rows on that project | — | — |

Once `billed_at` is set (by `generate_invoice_items_from_time_entries`), a staff member's own row locks — only an admin can still edit or delete it. This means a billed entry can't be silently changed after it's already reflected on an invoice.

`projects`/`tasks` writes for the new columns go through the same RLS already governing those tables (ownership/`staff_may_project`, not column-specific) — no new policies needed there.

## RPCs

`generate_invoice_items_from_time_entries(p_invoice_id, p_through_date default today)` — admin only (`is_admin()`), `security definer`. For a **draft** invoice on an **hourly** project: groups all unbilled time entries on that project through the given date by staff member, inserts one invoice line item per staff member (`"<name> — logged hours through <date>"`, quantity = summed hours, unit price = the project's hourly rate), and marks those entries `billed_at`/`invoice_id` — atomically, in the same transaction. Rejects with `NOT_FOUND`, `INVALID_STATUS` (not draft), `PROJECT_REQUIRED`, or `NOT_HOURLY`.

This does **not** go through `update_invoice_draft`'s delete-all-reinsert pattern. That would require the client to hold the generated items in local state before saving, which creates a window where entries could be marked billed with nothing actually persisted if the admin abandons the draft mid-edit. Doing the insert and the billed-flag update together, server-side, in one transaction avoids that failure mode.

No RPC for logging time itself — `time_entries` INSERT/UPDATE/DELETE go straight through RLS from `src/data/timeEntriesRepository.ts`.

## Capacity view

`collectStaffWorkload()` (`src/data/teamWorkspace.ts`) is agency-wide — it reads the full, unscoped `projects` list (`useLeads().projects`), not a "my projects" scoped list — and flattens every non-archived project's open tasks by assignee, bucketed by the Monday-start week of the due date. `estimated_hours` is summed per person per week; `null` estimates count as 0 hours but are tracked separately as a task count, so a pile of unestimated tasks is visible rather than silently invisible. Staff with zero assigned tasks still appear (cross-referenced from the team directory) at 0h, so under-allocation is as visible as overload.

`/admin/capacity`: a staff × week grid, highlighted amber at 80%+ and red over a flat 32h/week threshold (hardcoded for v1 — no per-staff configurable target). Gated on `projects.view`, in the route-permission guard already covering `/admin/*`. In both `pmNavGroups` and `adminNavGroups`.

Since the grid buckets by the *week of the due date*, a task with no due date has no week to land in. As of `20260916000000_task_default_due_dates.sql`, `tasks.due_date` gets a default too (see `production-task-generation` note in that migration and `sync_project_milestone_dates`) — auto-generated tasks inherit their milestone's due date, itself derived from the project's target launch date split 10/20/40/20/10 across Discovery/Design/Development/Review/Launch. A project with no target launch date still leaves its tasks undated, same as before — this only fills in blanks where there's something real to anchor to.

## Deadline reminders

`20260917000000_task_deadline_reminders.sql` adds the first *time-based* automation in this app — everything else fires in response to a user action; this fires on a schedule. `notify_task_deadlines()` runs once daily (13:00 UTC) via `pg_cron`, notifying a task's assignee once when it becomes due tomorrow (`task_due_soon`), and once per calendar day while it stays overdue and incomplete (`task_overdue`, a deliberate repeating nag, not a one-off). Dedup is by `notifications.task_id` (new column, added for exactly this).

**Requires `pg_cron` enabled on the project** (Database → Extensions in the Supabase dashboard, or the `create extension` statement the migration already runs — if the extension isn't available on the project's plan/region, that statement is what will fail). Check `select * from cron.job;` to confirm the `notify-task-deadlines` job exists, and `select * from cron.job_run_details order by start_time desc limit 5;` to see recent runs if reminders don't seem to be firing.

## UI

- **Log time**: `TeamTaskDetail.tsx`'s "Log time" section (any task, any workspace it's opened from — admin, PM, `/team`) logs against that specific task. The project **Time** tab (`ProjectTimePanel.tsx`, `src/pages/admin/AdminProjectDetails.tsx`) has its own log-time form for hours not tied to a specific task, plus a rollup (total/unbilled hours, budget-vs-actual bar for fixed projects) and an editable/deletable list of unbilled entries.
- **Billing mode**: set on `AdminProjectEdit.tsx`'s "Billing" fieldset (mirrors the existing "Development" fieldset — creation stays minimal, billing is configured after the project exists).
- **Generate from time**: "Generate from time entries" action in `AdminInvoiceDetails.tsx`'s actions menu, shown only for draft invoices on hourly projects.
- **Estimate hours**: `TaskFormModal.tsx`, next to Recommended role / Task type.

## Fractional quantity — where it was fixed

Three places floored `quantity` to a whole number before this change (only one of them is the RPC boundary — the other two are pure client-side display/preview bugs that would have silently misrepresented fractional hours even after the schema allowed them):

- `saveInvoiceDraft()` (`src/data/invoicesRepository.ts`) — the actual save path.
- `invoiceItemsFromSnapshot()` (`src/data/invoices.ts`) — reading a frozen sent-invoice snapshot back for display.
- `previewInvoiceDraftItems()` (`src/data/invoices.ts`) — the live draft-editing preview total.

All three now go through a shared `roundQuantity()` helper (two decimal places, minimum `0.01`). `lineItemTotalCents()` (`src/data/documents.ts`, shared with proposals/contracts) now rounds its result too, since a fractional quantity × integer cents can itself produce a fractional cent amount.

`LineItemsEditor` (shared by invoices, proposals, and contracts) gained an opt-in `allowFractionalQuantity` prop, set only from `InvoiceDraftForm.tsx`. Proposals and contracts — which still use `proposal_items`/`contract_items`, both still plain `integer` — keep their original whole-number-only input behavior unchanged.

## Out of scope

Per-staff hourly rates (rate lives on the project only, to avoid exposing individual compensation data through the same `staff_may_project`-gated reads staff already have). Per-staff configurable capacity targets. A personal timesheet view (`listMyTimeEntries` exists in the repository but has no dedicated page yet). Approval workflow for logged time before billing.

## Apply

Migrations `20260905000000` through `20260905040000`, in order, after `20260903010000`. No Edge Function changes, no new secrets.
