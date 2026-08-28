# MotiveScripts database

Supabase PostgreSQL is the source of truth for agency business data. Admin, Client, and Staff pages load through `LeadsProvider` → `src/data/agencyRepository.ts`. Runtime TypeScript no longer contains mock/demo business records. An empty database shows real empty states (counts of 0, “No … yet”), not fallback rows.

The public site, Admin shell, Client Portal layout, magic-link auth, and Start a Project `mailto:` form are unchanged. Public **Work** case studies in `src/data/projects.ts` are labeled marketing concepts; they are not CRM records.

## Environment

Vite variables (see `.env.example`):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY` (fallback: `VITE_SUPABASE_ANON_KEY`)

The browser client lives in `src/lib/supabase.ts`. Do not add a second `createClient`. Do not put `service_role`, Stripe secret keys, webhook secrets, or database passwords in frontend env vars.

## Apply migrations

Versioned SQL (production should apply these):

1. `supabase/migrations/20260828090000_initial_schema.sql` — tables, indexes, constraints, RPCs, temporary RLS
2. `supabase/migrations/20260828100000_seed_demo_data.sql` — **no-op placeholder.** Former demo inserts were moved to `supabase/dev-seed/seed_demo_data.sql` (DEVELOPMENT ONLY). Fresh production gets zero business records from this version.
3. `supabase/migrations/20260828120000_file_storage.sql` — file storage columns, private `project-files` bucket
4. `supabase/migrations/20260828140000_auth_roles_rls.sql` — `profiles.client_id`, role-based RLS, Storage ownership, client review RPCs
5. `supabase/migrations/20260828160000_messaging_notifications.sql` — conversations, messages, in-app notifications
6. `supabase/migrations/20260828180000_client_invitations.sql` — hashed client invitations, preview/accept RPCs
7. `supabase/migrations/20260829090000_proposals_contracts.sql` — proposals, contracts, revisions, integer-cent line items, document RPCs
8. `supabase/migrations/20260829100000_invoices_payments.sql` — invoices, invoice items, manual payments, invoice RPCs. Optional demo invoice inserts run **only if** the development seed clients already exist.
9. `supabase/migrations/20260829120000_stripe_payments.sql` — Stripe Checkout ids on `payments`, checkout sessions, webhook RPC
10. `supabase/migrations/20260829200000_team_management.sql` — staff role, permissions, assignments, hashed staff invitations, assignment-aware RLS
11. `supabase/migrations/20260829210000_production_hardening.sql` — invitation `token_hash` not selectable by `authenticated`; proposal/contract identity tables SELECT-only; Stripe checkout session required; tighter activity INSERT

Apply in that order to the **existing** Supabase project:

- Dashboard → SQL Editor → run each file, or
- `supabase db push` if the CLI is linked to the project

The React app must **not** insert demo rows on page load.

## Development seed (optional)

`supabase/dev-seed/seed_demo_data.sql` is **DEVELOPMENT ONLY**. It inserts fake clients/leads/projects (ABC Landscaping, Harbor & Pine, Smith Auto, BrightPath, and related names). Do not run it on production.

Optional local/staging: apply schema migrations first, then run that SQL in the Dashboard. Regenerate with `node scripts/build-seed.mjs` (writes to `supabase/dev-seed/`, never into `supabase/migrations/`). After Phase 12, do not re-run the seed file against a database that already applied `20260828140000_auth_roles_rls.sql` unless you understand that internal client JSON now lives in `client_staff_data`.

Databases that already applied the old seed migration keep those rows until they are deleted manually.


## Relationships

```
auth.users
  → profiles (role admin|staff|client, client_id)
       → staff_profiles / staff_grants / staff_invitations
       → clients                 (client users only)
            → client_staff_assignments
            → client_invitations (admin-managed; hashed tokens)
            → proposals / proposal_revisions / proposal_items
            → contracts / contract_revisions
            → invoices / invoice_items / payments
            → stripe_checkout_sessions / client_stripe_customers
            → projects
                 → milestones, tasks, deliverables, activity
                      → file_versions
                           → feedback, approvals
            → conversations
                 → messages
  → notifications                (per authenticated user; optional proposal_id / contract_id / invoice_id)
```

A client user maps to **exactly one** `clients` row via `profiles.client_id`. Admins and staff have `client_id` null. Staff access to clients/projects is assignment-based; see [team-management.md](./team-management.md).

Internal client notes, staff activity, and leftover message placeholders live in `client_staff_data` (agency users with `clients.view` and assignment). Live invoices are in `invoices` / `payments`, not in that JSON. They are not on `clients`, so a client `SELECT` of their own company row cannot read staff notes.

Feedback and approvals always point at a specific `file_versions` row.

Messaging and in-app notifications: [messaging.md](./messaging.md).

Proposals and contracts: [proposals-contracts.md](./proposals-contracts.md).

Invoices and manual payments: [invoices-payments.md](./invoices-payments.md).

Stripe Checkout: [stripe-payments.md](./stripe-payments.md).

Auth, roles, onboarding, and the security test matrix: [auth.md](./auth.md).

Team management and staff permissions: [team-management.md](./team-management.md).

Client invitations: [client-invitations.md](./client-invitations.md).

## Constraints and indexes

- `UNIQUE (deliverable_id, version_number)`
- Unique index on `approvals.version_id` (one approval per version, when existing rows allow it)
- Partial unique index: at most one `is_current` version per deliverable
- Status CHECKs match existing UI values (lead, client, project, milestone, task, deliverable, feedback, approval)
- Foreign keys are `RESTRICT` except `tasks.milestone_id` / `leads.client_id` / `clients.source_lead_id` (`SET NULL`) and `profiles` → `auth.users` (`CASCADE`)
- Indexes on the common foreign keys and `leads.status`, `leads.email`, `clients.email`

## RPCs

`create_file_version` / `set_current_file_version` (SECURITY INVOKER): agency users with `files.manage` on the deliverable’s project (`assert_project_perm`). Next version number, current flag, optional storage path, activity.

`client_submit_feedback` / `client_approve_current_version` (SECURITY DEFINER): linked client, own current version, intended review statuses only.

`admin_link_client_account(client_id, email)` (SECURITY DEFINER): admin links an existing `profiles` row to a client. Does not create Auth users.

Client invitation RPCs (Phase 14, SECURITY DEFINER): `preview_client_invitation`, `invitation_email_matches`, `accept_client_invitation`. Details: [client-invitations.md](./client-invitations.md).

Proposal and contract RPCs (Phase 15, SECURITY DEFINER): `create_proposal`, `send_proposal`, `accept_proposal`, `decline_proposal`, `create_contract`, `send_contract`, `accept_contract`, `decline_contract`, plus revision / view / cancel helpers. Details: [proposals-contracts.md](./proposals-contracts.md).

Invoice RPCs (Phase 16, SECURITY DEFINER): `create_invoice`, `update_invoice_draft`, `send_invoice`, `cancel_invoice`, `record_invoice_payment`, `reverse_invoice_payment`, `mark_invoice_viewed`. Details: [invoices-payments.md](./invoices-payments.md).

Stripe payment RPC (Phase 17, SECURITY DEFINER, **service_role only**): `record_stripe_payment`. Details: [stripe-payments.md](./stripe-payments.md).

Messaging RPCs (Phase 13, SECURITY DEFINER): `start_conversation`, `send_message`, `mark_conversation_read`, `set_conversation_status`, `mark_notification_read`, `mark_all_notifications_read`. Details: [messaging.md](./messaging.md).

## RLS (Phase 12)

RLS is **enabled** on all application tables. Temporary Phase 10 `*_dev` policies that allowed `anon` are dropped.

Anonymous (`anon`) has **no** grants on agency tables and **no** Storage access.

| User | Resource | Expected |
| --- | --- | --- |
| Admin | Leads | Allowed |
| Admin | Clients | Allowed |
| Admin | Projects | Allowed |
| Admin | Files / Storage | Allowed |
| Client A | Client A | Allowed |
| Client A | Client B | Denied |
| Client A | Project A | Allowed |
| Client A | Project B | Denied |
| Client A | File A | Allowed |
| Client A | File B | Denied |
| Client A | Feedback A | Allowed |
| Client A | Feedback B | Denied |
| Client A | Approval A | Allowed |
| Client A | Approval B | Denied |
| Client A | Leads / staff notes | Denied |
| Anonymous | Agency data | Denied |

Clients may `SELECT` their own client row, projects, milestones, tasks, deliverables, file versions, feedback, approvals, project activity, **their conversations and messages**, **their notifications**, **published proposals/contracts for their `client_id`**, and **non-draft, non-cancelled invoices (plus items and payments) for their `client_id`**. They cannot insert/update projects, versions, `is_current`, `storage_path`, or deliverable status except through the review RPCs. They cannot create or edit proposals, contracts, or invoices, change prices, record payments, or set status timestamps except through the document/invoice RPCs. They cannot read `client_staff_data`, `leads`, `invoice_admin_notes`, `client_stripe_customers`, `stripe_processed_events`, or another client’s documents, conversations, messages, invoices, or notifications. Stripe ledger writes use `record_stripe_payment` (service_role only).

## Provider / data layer

```
UI (existing hooks)
  → AuthProvider (session + profiles.role)
  → LeadsProvider (fetch only after a role is known)
  → agencyRepository (Supabase)
  → PostgreSQL RLS + Storage policies
```

Mutations wait for the database, then refresh the snapshot. Failed mutations keep the previous UI and show a toast. Public pages do not load agency tables.

## File storage (Phase 11 + 12)

Binaries live in a **private** Storage bucket. PostgreSQL `file_versions` stores metadata and `storage_path`.

- Bucket: `project-files` (private, 50 MB limit)
- Path: `projects/{projectId}/deliverables/{deliverableId}/versions/{versionId}/file.{ext}`
- Original name is stored in `file_versions.file_name`
- Preview/download uses short-lived signed URLs. Signed URLs are not stored in the database.
- Deliverables without a Storage object show “No file uploaded yet” until someone uploads a real file. Development seed metadata (if applied) also has no binary.
- Allowed types (change in `src/data/fileUploadConfig.ts`): PDF, DOC, DOCX, TXT, PNG, JPG, JPEG, WEBP, SVG, PSD, AI, FIG, XD, ZIP
- SVG is download-only (not rendered inline)

Apply:

`supabase/migrations/20260828120000_file_storage.sql`

then

`supabase/migrations/20260828140000_auth_roles_rls.sql`

If the bucket insert fails in SQL Editor, create it in Dashboard → Storage:

1. New bucket named `project-files`
2. Public: **off**
3. File size limit: 50 MB
4. Then re-run the storage policies from the Phase 12 migration

Storage policies allow **authenticated** admins to upload/delete, and authenticated admins or the owning client to read, after `can_access_project_file` validates the path. Anonymous has no access. The bucket is not public.

Do not put a service-role key in any `VITE_` variable.

## Client identity

The Client Portal resolves the signed-in user with `auth.uid()` → `profiles.client_id` → `clients.id`. URLs do not determine ownership. There is no frontend default client.

## Manual verification (RLS / IDOR)

Not claimed as passed until you run them after applying Phase 12 SQL.

**SQL Editor note:** the dashboard SQL editor usually runs as a superuser and **bypasses RLS**. Use two real Auth users in the app (or `set role authenticated` with JWT claims in a carefully configured session). Do not treat unrestricted SQL results as an RLS test.

TEST 1 — Admin login → `/admin` dashboard loads.

TEST 2 — Linked client login → `/client` portal loads with that client’s name and projects.

TEST 3 — Client opens `/admin` → redirected to `/client`.

TEST 4 — Admin opens `/client` → redirected to `/admin`.

TEST 5 — Client A opens `/client/project/{Client B project id}` → “Project not found”.

TEST 6 — Client A opens `/client/files/{Client B deliverable id}` → “File not found”; no signed URL.

TEST 7 — Client A submits feedback on own current In Review / Needs Changes version → succeeds.

TEST 8 — Client A calls `client_submit_feedback` with Client B’s deliverable id → denied.

TEST 9 — Client A approves own current In Review version → succeeds.

TEST 10 — Client A approves Client B’s version → denied.

TEST 11 — Admin uploads a file → Storage object + `file_versions` row.

TEST 12 — Authorized client can open/download that file.

TEST 13 — Unauthorized client cannot.

TEST 14 — Logout, then `/admin` or `/client` → `/login`. Refresh keeps the session until logout (Supabase persistSession).

Anonymous: public pages `/`, `/services`, `/work`, `/process`, `/about`, `/start-a-project`, `/login` still work and must not load agency tables.

## Still frontend-only

- Public website and Start a Project (`mailto:`)
- PayPal / GCash / other processors (not Stripe)

Stripe Checkout is Phase 17 (see [stripe-payments.md](./stripe-payments.md)). Invoice PDFs are Phase 18 (see [invoice-pdf.md](./invoice-pdf.md)). Proposal and contract PDFs are Phase 19 (see [proposal-contract-pdf.md](./proposal-contract-pdf.md)). Client invitations are live after Phase 14 (see [client-invitations.md](./client-invitations.md)). Messaging and in-app notifications are live after Phase 13 (see [messaging.md](./messaging.md)). Proposals and contracts are live after Phase 15 (see [proposals-contracts.md](./proposals-contracts.md)). Invoices and manual payment records are live after Phase 16 (see [invoices-payments.md](./invoices-payments.md)). Team management is Phase 20 (see [team-management.md](./team-management.md)). Production hardening is Phase 21 (see [production-launch-checklist.md](./production-launch-checklist.md)). Do not re-run the Phase 10 seed file after Phase 12.
