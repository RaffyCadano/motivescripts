# MotiveScripts proposals and contracts

Phase 15 adds a professional **proposal → contract** workflow on top of the existing Client and Project records. It does **not** create invoices, collect payment, or integrate an e-signature vendor. On-demand proposal and contract PDFs are Phase 19 ([proposal-contract-pdf.md](./proposal-contract-pdf.md)).

```
Lead → Client → Proposal → Client reviews → Proposal accepted
  → Contract → Client reviews → Contract accepted → Project
  → [Phase 16: Invoice & Payment]
```

A client must already have an authenticated portal account (`profiles.client_id`) to view, accept, or decline. Phase 14 invitations are unchanged.

This is a workflow agreement in the MotiveScripts portal. It is **not** legal advice and **not** a qualified digital signature.

## Snapshot / revision model

Identity tables (`proposals`, `contracts`) hold ownership and human-readable numbers. Content lives on revision rows.

```
proposal
  working_revision_id   ← admin edits this while status = draft
  published_revision_id ← the only revision a client can SELECT
    └── proposal_items (draft line items; totals generated in PostgreSQL)
    └── snapshot_items jsonb (frozen copy written at send)
```

The same pattern applies to `contracts` / `contract_revisions` (`snapshot` jsonb at send).

Once a revision is sent, triggers block in-place content edits unless an RPC sets `app.document_rpc`. To change a sent document, the admin creates a **new revision**. Sending the new revision cancels a previous published `sent` / `viewed` / `expired` revision. The client always reviews `published_revision_id`.

Revision numbers are per document (`1`, `2`, …), shown as “Revision N” in the portal. Proposal numbers stay `MS-YYYY-NNN` across revisions.

## Proposal schema

`proposals`

| Column | Notes |
| --- | --- |
| `id` | UUID |
| `client_id` | Required. FK → `clients.id` |
| `project_id` | Optional. Must belong to the same client |
| `proposal_number` | Unique `MS-2026-001` style. Not the UUID |
| `working_revision_id` / `published_revision_id` | Point at `proposal_revisions` |
| `created_by` | Admin `auth.users.id` |

`proposal_revisions` holds title, introduction, overview, scope, deliverables text, timeline, payment terms, terms, optional client-visible notes, `investment_cents` (bigint ≥ 0), `valid_until`, `snapshot_items`, and lifecycle timestamps (`sent_at`, `viewed_at`, `accepted_at`, `declined_at`). Acceptance also stores `accepted_by_user_id` and `accepted_email`. Decline stores `declined_by_user_id` and `decline_reason`.

`proposal_items`: `quantity` (integer 1–9999), `unit_price_cents` (bigint ≥ 0), `total_cents` **generated** as `quantity * unit_price_cents`. The browser total is never stored.

`proposal_admin_notes`: agency-only. Clients have no SELECT policy.

## Contract schema

`contracts`

| Column | Notes |
| --- | --- |
| `id` | UUID |
| `client_id` | Required |
| `project_id` | Optional; same-client check |
| `proposal_id` | Optional. Required for the preferred “create from accepted proposal” path; must belong to the same client |
| `contract_number` | Unique `MS-CON-2026-001` style |

`contract_revisions` holds editable agreement sections (parties, scope, responsibilities, timeline, compensation, payment terms, confidentiality, IP, revisions, termination, general terms), `effective_date`, `expires_at`, frozen `snapshot` jsonb, and the same acceptance audit fields as proposals.

`website_contract_template(company)` returns starting copy. Admins must edit it. It is not claimed to be valid in every jurisdiction.

A contract is **not** created automatically when a proposal is accepted. The admin chooses **Create Contract**.

## Numbers

`document_number_counters` + `next_document_number(kind)` (SECURITY DEFINER, not granted to `authenticated`). Formats:

- Proposals: `MS-{year}-{nnn}`
- Contracts: `MS-CON-{year}-{nnn}`

Uniqueness is enforced with unique indexes.

## Lifecycle

Statuses: `draft` → `sent` → `viewed` → `accepted`, or `sent`/`viewed` → `declined` / `expired` / `cancelled`.

Invalid backwards transitions (for example accepted → draft) are blocked by revision guards and RPCs.

**Expiration** is computed in SQL (`proposal_effective_status` / `contract_effective_status`): if status is `sent` or `viewed` and the date is before `current_date`, treat as `expired`. Accept/decline RPCs refuse expired documents and persist `expired` when appropriate. The UI uses the same calendar-day comparison (no floating-point `Date` math for money or day boundaries).

Expired, declined, cancelled, and accepted published revisions cannot be accepted.

## Acceptance

Client RPCs require `is_client()`, `profiles.client_id = document.client_id`, and a published revision.

On accept:

- `status = accepted`
- `accepted_at = now()`
- `accepted_by_user_id = auth.uid()`
- `accepted_email` from `auth.users.email`

The client UI also requires a confirmation dialog. Contracts also require the checkbox “I have reviewed and agree to this contract.”

This records authenticated portal acceptance. It is **not** DocuSign / a qualified electronic signature. IP address is **not** collected.

Accepting a proposal does **not** create an invoice, charge the client, create a project, or mark a project complete. If there is no project yet, the admin uses the existing project form.

## RLS

Anonymous: no grants.

| Caller | Proposals / contracts | Revisions | Line items | Admin notes |
| --- | --- | --- | --- | --- |
| Admin | ALL | ALL | ALL | ALL |
| Client (own `client_id`, published only) | SELECT | SELECT published revision only | None | None |
| Client A vs Client B | Denied | Denied | Denied | Denied |

Clients have **no** INSERT/UPDATE/DELETE policies. Status, prices, `client_id`, and acceptance timestamps cannot be changed from the browser. Mutations go through RPCs that check role, ownership, and status.

`client_id` cannot be changed after insert. Project (and contract `proposal_id`) must match the same client.

## RPCs

All listed functions are `SECURITY DEFINER` with `search_path = public`. Status-changing functions set `app.document_rpc` so triggers allow the transition. They verify `auth.uid()` via `is_admin()` / `is_client()` + `current_client_id()`.

Admin: `create_proposal`, `create_proposal_revision`, `send_proposal`, `cancel_proposal`, `create_contract`, `create_contract_revision`, `send_contract`, `cancel_contract`.

Client: `mark_proposal_viewed`, `accept_proposal`, `decline_proposal`, `mark_contract_viewed`, `accept_contract`, `decline_contract`.

View RPCs only move `sent` → `viewed` once (`viewed_at` is coalesced).

Helpers not granted to `authenticated`: `next_document_number`, `notify_document`, `record_document_activity`, `document_rpc_active`.

## Activity and notifications

`record_document_activity` appends to existing `client_staff_data` activity and, when `project_id` is set, `public.activity`. Event names include `proposal_created`, `proposal_sent`, `proposal_viewed`, `proposal_accepted`, `proposal_declined`, `proposal_cancelled`, and the contract equivalents.

In-app notifications reuse the Phase 13 `notifications` table. New types: `proposal_ready`, `proposal_viewed`, `proposal_accepted`, `proposal_declined`, `contract_ready`, `contract_viewed`, `contract_accepted`, `contract_declined`. Optional `proposal_id` / `contract_id` columns were added. Clients are notified when a document is ready; admins are notified on view / accept / decline.

Messaging is unchanged. Client proposal detail can link to `/client/messages` (“Discuss this proposal”) without auto-creating a conversation.

## Email

Edge Function `document-email` (same Resend secrets as invitations). Called **after** a successful send RPC. If email fails, the document stays sent and the admin sees a warning toast.

Secrets (Dashboard, not `VITE_`): `RESEND_API_KEY`, `PUBLIC_SITE_URL`, optional `RESEND_FROM`, `SUPPORT_EMAIL`. The function verifies the caller’s JWT and `profiles.role = admin`. The service-role key stays in the function environment.

Email copy includes MotiveScripts branding, company name, document number, title, investment or effective date, expiration, and a button to the authenticated client portal route. Internal notes are not included. After Phase 19 the send email attaches a generated PDF when generation succeeds ([proposal-contract-pdf.md](./proposal-contract-pdf.md)).

## Routes

Admin (existing Admin shell): `/admin/proposals`, `/admin/proposals/new`, `/admin/proposals/:id`, `/admin/contracts`, `/admin/contracts/new`, `/admin/contracts/:id`.

Client (existing portal): `/client/proposals`, `/client/proposals/:id`, `/client/contracts`, `/client/contracts/:id`.

Route params are not an authorization source. RLS and RPCs use `auth.uid()` → `profiles.client_id`.

## Money

Integer cents only (`bigint`). Line-item totals are generated in PostgreSQL. `send_proposal` recalculates `investment_cents` from `sum(total_cents)`. The UI formats with integer arithmetic in `src/data/money.ts`.

## Out of scope (later phases)

PayPal / GCash / other processors, DocuSign / HelloSign / Adobe Sign, tax engines, subscriptions, team payroll.

Invoices and manual payment recording: [invoices-payments.md](./invoices-payments.md). Stripe Checkout: [stripe-payments.md](./stripe-payments.md). Invoice PDFs: [invoice-pdf.md](./invoice-pdf.md). Proposal and contract PDFs: [proposal-contract-pdf.md](./proposal-contract-pdf.md).

## Apply

New file only: `supabase/migrations/20260829090000_proposals_contracts.sql`.

Deploy the `document-email` function (`verify_jwt = false` in `config.toml`; the function still authenticates the admin JWT itself).

Phase 19 proposal/contract PDFs add no SQL. See [proposal-contract-pdf.md](./proposal-contract-pdf.md).

Phase 21: `authenticated` has SELECT only on `proposals` and `contracts` identity rows. Creates/sends/accepts stay on RPCs. Draft body still updates via `proposal_revisions` / `proposal_items` / `contract_revisions` (sent rows remain trigger-guarded).

Launch: [production-launch-checklist.md](./production-launch-checklist.md). Smoke: [production-smoke-test.md](./production-smoke-test.md).

## Manual tests

Not claimed as passed until run against a database with this migration applied. Use two real Auth users. The SQL editor bypasses RLS.

See the Phase 15 matrix in the implementation work-log (create/send/view/accept, IDOR, money, expiration, existing messaging/files/approvals/invitations).
