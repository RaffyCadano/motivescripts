# MotiveScripts authentication and access control

Phase 12 replaces preview client access with Supabase Auth, `profiles.role`, database RLS, and private Storage policies.

Frontend route guards are UX only. PostgreSQL RLS and Storage policies are the security boundary.

## Role model

Authoritative role is `profiles.role`, with a check constraint:

- `admin` — agency administrator. Access `/admin`. `client_id` must be null. Full access; manages the team.
- `staff` — internal agency user. Access `/admin` when `staff_profiles.is_active`. Access is permission + assignment. See [team-management.md](./team-management.md).
- `client` — portal user. Access `/client` only after `profiles.client_id` points at a `clients` row.

Do not use JWT `app_metadata.role` as the runtime authorization source. Do not store roles in `localStorage`.

New Auth users get a `profiles` row from trigger `handle_new_user`. The default role is **`client`**. `admin` is set only when `raw_app_meta_data.role` is exactly `admin` at user creation, or by a later SQL/RPC update. **`staff` is never set at signup.** Public magic-link login uses `shouldCreateUser: false`, so unknown emails cannot self-register as admin.

## Ownership chain

```
auth.users.id
  → profiles.id          (role, client_id)
  → clients.id           (client users only)
  → proposals / contracts / invoices (client_id; optional project_id)
  → projects.client_id
  → deliverables.project_id
  → file_versions.deliverable_id
  → feedback / approvals (version_id)
```

Storage object names:

`projects/{projectId}/deliverables/{deliverableId}/versions/{versionId}/file.{ext}`

Policies parse `projectId` and `deliverableId` and check that the deliverable belongs to a project the caller may access.

## Auth callback

`/auth/callback` still completes the magic-link session, then loads `profiles` via `getUser()` + a profile query.

- Safe `next=/invite/{64-hex-token}` → `/invite/{token}`
- Safe `next=/staff-invite/{64-hex-token}` → `/staff-invite/{token}`
- `role = admin` or `staff` (active) → `/admin`
- otherwise → `/client` (the client guard shows a configured-account screen if the profile is missing or unlinked)

Unknown users are **never** sent to admin.

Missing profile copy: “Your account is not configured yet. Please contact MotiveScripts.”

## Route guards

| Caller | `/admin` | `/client` |
| --- | --- | --- |
| Anonymous | `/login` | `/login` |
| Admin (active) | allowed | `/admin` |
| Staff (active) | allowed | `/admin` |
| Deactivated admin/staff | deactivated screen | `/admin` then deactivated screen |
| Linked client | `/client` | allowed |
| Unlinked / missing profile | not-configured screen | not-configured screen |

Guards wait until session **and** profile have resolved so a client never sees Admin chrome.

## Client onboarding

The browser must not create Auth users. There is no `VITE_` service-role key.

To give a client a login:

1. Create the client record in Admin (or convert a lead — conversion still must not duplicate clients).
2. On `/admin/clients/:id`, use **Invite Client**. The `client-invitation` Edge Function creates a hashed invitation, may create the Auth user server-side, and emails a `/invite/{token}` link via Resend.
3. The client opens the link, confirms the invited email, completes the existing magic-link login, then `accept_client_invitation` sets `profiles.role = client` and `profiles.client_id`.

Fallback: **Portal account → Link account** still calls `admin_link_client_account` for an Auth user that already exists.

If the email is an admin, or is already linked to another client, the UI shows a safe error. Clients cannot choose or change `client_id`.

Details: [client-invitations.md](./client-invitations.md).

Do not put `SUPABASE_SERVICE_ROLE_KEY` in any `VITE_` variable.

## Admin account setup

1. Create the Auth user in the Supabase Dashboard.
2. Set the profile role in SQL:

```sql
update public.profiles
set role = 'admin',
    client_id = null
where email = 'you@motivescripts.com';
```

Optional: set Auth `app_metadata.role` to `admin` **before** the user is created so `handle_new_user` inserts admin. After the profile exists, JWT metadata is not enough — update `profiles.role`.

There is no “make me admin” control in the app.

## Login UX

Staff and clients use the same magic-link form. If an email is not registered, the UI still says a link was sent when that is safe to say, so login does not confirm whether an address exists.

Forgot password remains a new magic link, not a password reset flow.

## Helper functions

All are `SECURITY DEFINER` with `search_path = public`:

| Function | Meaning |
| --- | --- |
| `is_admin()` | `profiles.role = admin` for `auth.uid()` and staff profile active (or missing, treated as active) |
| `is_active_staff()` | `role = staff` and `staff_profiles.is_active` |
| `has_grant(code)` | admin, or active staff with that permission |
| `current_client_id()` | linked `clients.id` for a client user |
| `is_client()` | `current_client_id() is not null` |
| `owns_project(id)` | that project’s `client_id` is the caller’s client |
| `owns_deliverable(id)` | deliverable’s project is owned by the caller’s client |
| `can_access_project_file(name)` | Storage path ownership |

Clients cannot change `profiles.role` or `profiles.client_id`. Users cannot promote themselves to admin.

## Client review RPCs

Table `UPDATE` on deliverables is admin-only. Client review actions go through:

- `client_submit_feedback(deliverable_id, message, request_changes)` — own current version, status In Review or Needs Changes; inserts Open feedback; sets Needs Changes
- `client_approve_current_version(deliverable_id)` — own current version, status In Review, no existing approval for that version; inserts approval (`approved_by = auth.uid()`); sets Approved

Both raise `42501` (`Not allowed`) without revealing whether another client’s row exists.

## Temporary limitations

- Admin promotion: SQL, Dashboard metadata-at-create, or Team → invite with the Admin template. See [team-management.md](./team-management.md).
- Client invitations: [client-invitations.md](./client-invitations.md). Messaging: [messaging.md](./messaging.md). Proposals and contracts: [proposals-contracts.md](./proposals-contracts.md). Invoices: [invoices-payments.md](./invoices-payments.md). Stripe: [stripe-payments.md](./stripe-payments.md). Invoice PDFs: [invoice-pdf.md](./invoice-pdf.md). Proposal and contract PDFs: [proposal-contract-pdf.md](./proposal-contract-pdf.md).
- Signed URLs are short-lived. Anyone who already has a URL can open it until it expires; generation of a new URL is blocked by Storage RLS.
- Client portal timeline and “Your Actions” use live project milestones and tasks when present; they hide when empty. Portal identity comes from the authenticated profile and `profiles.client_id`, not a default demo client.

## Production environment

Frontend: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (or `VITE_SUPABASE_ANON_KEY`) only.

Edge secrets: service role (platform), `RESEND_*`, `PUBLIC_SITE_URL`, Stripe keys. Never `VITE_`.

Auth redirect allow-list must include the production origin and `/auth/callback`. `next` query params are only accepted for `/invite/{64-hex}` and `/staff-invite/{64-hex}` (`safeInviteNext`). Other values are ignored (no open redirect).

Magic-link failures show a fixed user message. Raw Supabase errors are not put in the login URL.

Unfinished Admin routes (`/admin/tasks`, `/admin/notifications`, `/admin/activity`, `/admin/settings`) are honest “not available” pages and are not in the primary nav. `/admin/payments` redirects to invoices.

Launch: [production-launch-checklist.md](./production-launch-checklist.md). Smoke tests: [production-smoke-test.md](./production-smoke-test.md).

## Manual tests

See the security matrix and TEST 1–14 list in [database.md](./database.md).
