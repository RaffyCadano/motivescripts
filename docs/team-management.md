# Team management and staff permissions

Phase 20 turns MotiveScripts from a single-admin workspace into a small agency workspace. **PostgreSQL RLS and RPCs are the security boundary.** Hiding a button is not access control.

This phase does not change Stripe, invoice math, proposal/contract snapshots, client portal layout, or the public site.

## Roles

Authoritative role remains `profiles.role`:

| Role | Meaning |
| --- | --- |
| `admin` | Full agency access. May invite staff, change roles, assign people, and manage every record. |
| `staff` | Internal user. Access is **permission + assignment**. Cannot manage the team or change their own role. |
| `client` | Existing client portal only. Cannot become staff through the UI. |

`handle_new_user` still creates `admin` or `client` only. Staff role is set when a staff invitation is accepted, never from browser input or JWT metadata.

## Permission model

Catalog in `staff_permission_catalog`. Per-user grants in `staff_grants`. Default sets live in `staff_templates` + `staff_template_permissions`.

Templates:

- **Admin** — `profiles.role = admin`, every permission
- **Staff** — operational access, no `team.view` / `team.manage`
- **Project Manager** — clients, projects, files, feedback, messages, activity
- **Sales** — leads, clients, proposals, contracts, messages
- **Accounting** — clients, invoices

Permission codes: `leads.view|manage`, `clients.*`, `projects.*`, `files.*`, `feedback.manage`, `proposals.*`, `contracts.*`, `invoices.*`, `messages.*`, `team.view|manage`, `activity.view`.

Helpers (all `SECURITY DEFINER`, `search_path = public`):

- `is_admin()` — `role = admin` **and** `staff_profiles.is_active` (legacy admin rows without a staff profile still count as active)
- `is_active_staff()` — `role = staff` and active
- `has_grant(code)` — admin, or active staff with that grant
- `assigned_to_client` / `assigned_to_project` — admin, or a matching assignment (client assignment covers that client’s projects; project assignment covers that client)
- `staff_may_client` / `staff_may_project` — grant **and** assignment (admins skip assignment)
- `current_staff_context()` — `is_active`, `job_title`, `template_key`, permission codes for the UI

**Admins are not expanded into `is_admin()` for staff.** Staff never inherit the old admin-only policies.

Team mutations (`update_staff_member`, assign/unassign, staff invitation Edge Function) require **`is_admin()`**, not `team.manage`. Granting `team.manage` to staff does not let them promote anyone.

## Assignments

Tables:

- `client_staff_assignments` `(client_id, user_id)` unique
- `project_staff_assignments` `(project_id, user_id)` unique

Optional `label` (for example “Project Manager”). No cascade that deletes clients/projects when a staff row is removed; assignments reference `staff_profiles` and cascade only those join rows.

A project assignment is rejected if the person already has **any** client assignments and is not assigned to that project’s client.

Staff who create a client or project are auto-assigned to it.

Leads are permission-based (not assignment-based). Optional `leads.assigned_to` must point at an admin/staff profile.

## Staff invitations

Admins invite from `/admin/team`. The browser must not use the service role.

Flow:

1. Admin calls Edge Function `staff-invitation` (`send` / `resend` / `revoke`) with a user JWT.
2. Function checks `profiles.role = admin` and that the admin is not deactivated.
3. Creates/reuses the Auth user **without** putting `staff` or `admin` in `app_metadata`.
4. Stores a SHA-256 hash of a 32-byte hex token. Raw token is emailed once and never stored.
5. Invitee opens `/staff-invite/{token}`, magic-link signs in, `accept_staff_invitation` sets role from the **template**, writes `staff_profiles` + `staff_grants`.

Rules:

- Pending unique per email
- 7-day expiry
- Single-use
- Linked client (`client_id` set) → `IS_CLIENT`
- Active admin/staff → `already_staff`
- Unlinked `client` profile may be upgraded
- Tokens must not appear in logs

Client invitations stay on `client-invitation`. Accepting a client invite as admin/staff still fails (`IS_ADMIN`). Inviting a staff email as a client fails.

## Authentication routing

Same magic-link login.

- `admin` or `staff` (active) → `/admin`
- `client` with `client_id` → `/client`
- Deactivated staff/admin → deactivated screen; RLS also denies
- Unknown users are never sent to admin

## RLS (IDOR)

Never trust role, staff id, client id, or project id from the browser.

Path: `auth.uid()` → `profiles` → role → grants/assignments → row.

Clients still use `auth.uid()` → `profiles.client_id` → ownership.

Direct `UPDATE` of `profiles.role` or `profiles.client_id` from `authenticated` / `service_role` is blocked by trigger `profiles_protect_privileged_columns`. SECURITY DEFINER RPCs owned by `postgres` / `supabase_admin` may still change those columns.

Last active admin cannot be deactivated or demoted (`LAST_ADMIN`).

Staff cannot:

- change their own role or grants
- approve files as a client (`client_approve_current_version` still requires `is_client()`)
- see another client’s files via URL (Storage `can_access_project_file` + assignment + `files.view`)
- write invoices/proposals/contracts without `*.manage` and assignment (RPC `assert_client_perm`)

View-only grants never use `FOR ALL` with view in `USING` (that would allow DELETE).

## RPCs

| Function | Who |
| --- | --- |
| `preview_staff_invitation` / `staff_invitation_email_matches` | anon + authenticated |
| `accept_staff_invitation` | authenticated |
| `update_staff_member` | admin |
| `assign_staff_to_client` / `unassign_*` / project variants | admin |
| `touch_staff_last_active` | authenticated (own row) |
| `staff_can_access_client` | authenticated (used by PDF/email functions with the **user** JWT) |
| Document/invoice/file RPCs | patched from `is_admin()` to `assert_client_perm` / `assert_project_perm` |

## Edge Function

`supabase/functions/staff-invitation` — `verify_jwt = false`, admin JWT checked inside. Secrets: `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `PUBLIC_SITE_URL` (or `SITE_URL`), `RESEND_FROM`, `SUPPORT_EMAIL`. Never `VITE_*`.

PDF and `document-email` allow active staff with the matching view/manage grant and assignment via `staff_can_access_client`.

## Activation / deactivation

There is no Delete on team members. Deactivate sets `staff_profiles.is_active = false`. `is_admin()` / `is_active_staff()` become false, so RLS and RPCs fail even if the SPA still has cached UI. Reactivate restores access.

## Demo data

This migration does **not** insert fake `auth.users`. Existing `profiles.role = admin` rows get a `staff_profiles` row (template `admin`) and full grants. Invite additional staff from `/admin/team`.

## Testing

After `supabase db push` and deploying `staff-invitation` (plus existing invitation/PDF/email functions):

1. Admin opens `/admin/team`.
2. Invite a staff email; confirm Resend mail has no raw token in the database.
3. Wait until expiry (or set `expires_at` in SQL) and confirm accept fails.
4. Revoke a pending invite.
5. Accept with the invited mailbox; `profiles.role` is `staff` (or `admin` if that template was chosen).
6. A linked client cannot accept a staff invite.
7. Staff cannot change their role or grants.
8. Staff without `team.view` cannot use Team (UI + RLS).
9. Staff cannot open an unassigned client/project/file URL.
10. Client cannot read `staff_*` tables or internal notes (`client_staff_data`).
11. Duplicate client/project assignments are rejected (`unique`).
12. Removing an assignment removes access on the next query.
13. Deactivated staff are blocked by RLS, not only by React.
14. Last admin cannot be deactivated.
15. Staff cannot approve as the client.
16. Production bundle has no `SERVICE_ROLE`, `sk_live`, `sk_test`, `whsec_`, `RESEND_API_KEY`.

## Deployment

1. Apply `supabase/migrations/20260829200000_team_management.sql`.
2. `supabase functions deploy staff-invitation` with the same secrets as `client-invitation`.
3. Redeploy `document-email`, `invoice-pdf`, `proposal-pdf`, and `contract-pdf` so staff authorization is included.
4. Confirm the first admin has a `staff_profiles` row (the migration backfills existing admins).

## Production

Apply `20260829210000_production_hardening.sql` after Phase 20. Authenticated clients/staff cannot SELECT `staff_invitations.token_hash`. Team writes remain `is_admin()` only. Last-admin protection is unchanged.

Launch: [production-launch-checklist.md](./production-launch-checklist.md). Smoke: [production-smoke-test.md](./production-smoke-test.md).
