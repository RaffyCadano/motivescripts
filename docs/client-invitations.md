# Client invitations

Phase 14 adds a secure **Invite Client** workflow. Admins invite a person to a client company. The invitee authenticates with the existing magic-link flow. PostgreSQL links `profiles.client_id` only after the invitation is verified.

The browser never receives a service-role key. Privileged send/resend/revoke runs in a Supabase Edge Function. Acceptance runs in a `SECURITY DEFINER` RPC that checks `auth.uid()`.

## Invitation flow

```
Admin (/admin/clients/:id)
  → Invite Client
  → Edge Function client-invitation (admin JWT + profiles.role = admin)
  → cryptographically random token (32 bytes, hex)
  → store SHA-256 hash only
  → Resend email with /invite/{token}
  → Client opens /invite/:token
  → preview_client_invitation (minimal: valid/expired/revoked/accepted/invalid)
  → client enters invited email
  → invitation_email_matches (boolean only)
  → magic link to /auth/callback?next=/invite/{token}
  → accept_client_invitation (authenticated, email must match)
  → profiles.role = client, profiles.client_id = invitation.client_id
  → /client
```

There is no public self-signup. Login still uses `shouldCreateUser: false`. The Edge Function may create the Auth user with `auth.admin.createUser` so the invited email can receive a magic link.

## Database model

Table `client_invitations`:

| Column | Notes |
| --- | --- |
| `id` | UUID |
| `client_id` | Required. FK → `clients.id` (`ON DELETE RESTRICT`) |
| `email` | Normalized `lower(trim(...))` |
| `invitee_name` | Optional display name |
| `token_hash` | SHA-256 hex of the secret URL token. Never the raw token |
| `status` | `pending` \| `accepted` \| `expired` \| `revoked` |
| `expires_at` | Required |
| `accepted_at` | Set when accepted |
| `created_at` | |
| `created_by` | Admin `auth.users.id` |
| `revoked_at` | Set when revoked |

Constraints: email format, token_hash is 64 hex chars, accepted rows need `accepted_at`, revoked rows need `revoked_at`.

Partial unique index: at most one **pending** row per `(client_id, email)`.

TTL default is **7 days**, defined in one place: `public.invitation_ttl_interval()` (SQL) and `INVITE_TTL_DAYS` in the Edge Function. Change both if you change the lifetime.

Sending an invitation does **not** rewrite `clients.email`.

## Token security

- Token is 32 random bytes, encoded as 64 hex characters. Not a client id, UUID, email, or timestamp.
- Only the hash is stored (`encode(digest(..., 'sha256'), 'hex')` / Web Crypto SHA-256 of the same UTF-8 hex string).
- The raw token appears only in the invitation URL and email.
- Do not log tokens, magic links, Resend API keys, Authorization headers, or the service-role key.

## Expiration, resend, revoke

- Pending invitations past `expires_at` cannot be accepted (`expired`).
- **Resend** marks the old pending row `expired`, inserts a new hash, and sends a new email.
- **Revoke** sets `status = revoked` and `revoked_at`. Rows are kept for audit.
- **Accept** is one-time. A second accept fails safely (`ALREADY_ACCEPTED`).

## Acceptance and account linking

`accept_client_invitation(p_token)` (authenticated only):

1. Invitation exists and token hash matches
2. Status is pending and not expired
3. Client row still exists
4. `auth.users.email` (normalized) equals invitation email
5. Caller is not an admin
6. Profile is not linked to a **different** `client_id`

Then, in one transaction: set `profiles.role = client` and `profiles.client_id`, mark invitation accepted, append staff activity.

If the profile is already linked to the **same** client, accept still completes (marks the invite accepted).

If it is linked to another client, the RPC raises `ALREADY_LINKED`. The UI copy is: “This account is already associated with another client organization. Please contact MotiveScripts.”

Clients cannot change `profiles.role` or `profiles.client_id` (Phase 12 RLS). Do not store ownership in `localStorage`, cookies, or URL params.

## Preview RPC (public token check)

`preview_client_invitation(p_token)` is granted to `anon` and `authenticated`. It returns only:

- `state`: `valid` \| `expired` \| `revoked` \| `accepted` \| `invalid`
- `company_name`: **only** when `state = valid`

It does not return client IDs, emails, hashes, projects, or other users.

`invitation_email_matches(p_token, p_email)` returns a boolean. It does not return the invited address.

Anonymous users have **no** `SELECT` on `client_invitations`.

## Edge Function

`supabase/functions/client-invitation`

Actions: `send` | `resend` | `revoke`.

Authorization: `auth.getUser()` from the caller JWT, then `profiles.role = admin` via the service client. The function does not trust `role`, `client_id`, or email from the body as identity.

`config.toml` sets `verify_jwt = false` so the function can return JSON errors; it still rejects missing/invalid users.

`createUser` and Resend run only inside this function.

### Edge Function secrets (Dashboard → Edge Functions → Secrets)

Set these in Supabase. Do **not** put them in `.env`, `.env.example`, or any `VITE_` variable.

| Secret | Purpose |
| --- | --- |
| `RESEND_API_KEY` | Send invitation email |
| `PUBLIC_SITE_URL` | Origin for `/invite/{token}` (e.g. `http://localhost:5173` or the production origin) |
| `RESEND_FROM` | Optional. Default `MotiveScripts <motivescripts.team@gmail.com>` |
| `SUPPORT_EMAIL` | Optional. Default `motivescripts.team@gmail.com` |

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are provided by the Edge Function runtime. Do not commit them.

## Email

Uses the existing Resend provider (same sender family as Auth SMTP). The message includes MotiveScripts branding, company name, a short explanation, the invitation link, expiration, and support contact. It does not include passwords, credentials, raw database IDs, or token hashes.

Auth magic links still go through Supabase Auth SMTP (Resend). Invitation email and magic-link email are two different messages.

## RLS

- `client_invitations`: RLS on. `SELECT` for admins only (`is_admin()`). No INSERT/UPDATE/DELETE policies for `authenticated` or `anon`. Writes use the service role in the Edge Function or the accept RPC.
- Clients cannot list invitations.
- Token hashes must not be shown in the UI. Admin queries omit `token_hash`.

## Activity

Send, resend, revoke, and accept append JSON entries on `client_staff_data.activity` (existing admin-only staff activity). Clients never see that table. No in-app notification is sent to the invitee before they have an account; the email is the onboarding notice.

## Auth callback

`/auth/callback` still sends admins to `/admin` and everyone else toward `/client`, except when `next` is a safe invite path: `/invite/` plus 64 hex characters. Other `next` values are ignored.

Add these Redirect URLs in Supabase Auth:

- `{origin}/auth/callback`
- `{origin}/auth/callback?next=/invite/*` (or the exact callback URLs you use)
- `{origin}/invite/*` (safety net if a magic link lands on the invite path)
- `{origin}/`

## Manual tests

TEST 1 — Admin creates a client.

TEST 2 — Admin sends an invitation.

TEST 3 — A `client_invitations` row exists.

TEST 4 — `token_hash` is 64 hex; the raw URL token is not stored.

TEST 5 — Invitation email arrives (requires Resend secret + `PUBLIC_SITE_URL`).

TEST 6 — Valid `/invite/:token` shows the company name after preview.

TEST 7 — Expired invitation cannot be accepted.

TEST 8 — Revoked invitation cannot be accepted.

TEST 9 — Accepted invitation cannot be reused.

TEST 10 — Wrong authenticated email cannot claim the invitation.

TEST 11 — After accept, `profiles.role = client` and `client_id` is the invited client.

TEST 12 — Redirect to `/client`.

TEST 13 — Client sees only their own data (Phase 12 RLS).

TEST 14 — Client A cannot accept Client B’s invitation.

TEST 15 — Client cannot change `client_id` from the browser.

TEST 16 — Client cannot set `role = admin`.

TEST 17 — Anonymous cannot `SELECT` invitation rows.

TEST 18 — Admin can resend.

TEST 19 — Old pending row is invalid after resend.

TEST 20 — Admin can revoke.

TEST 21 — Revoked invitation cannot be reused.

TEST 22 — Existing account linked to another client cannot be reassigned.

TEST 23 — Refresh on Client Portal keeps the session and linkage.

TEST 24 — Sign out and back in keeps `client_id`.

TEST 25 — Admin dashboard still works.

TEST 26 — Messaging still works.

TEST 27 — Files still work.

TEST 28 — Feedback/approvals still work.

TEST 29 — Storage policies still work.

TEST 30 — Invitation page is usable on a narrow viewport.

IDOR: posting a different `clientId` from the browser must not attach the invite to another company (Edge Function checks the client and admin). Accepting with another Auth user must fail. Reading another client’s invitation rows as a client must fail.

Edge Function: anonymous and client JWTs cannot send or revoke. Admins can.

## Limitations

- Invitation emails require Edge Function secrets and a verified Resend sender.
- Magic-link delivery still depends on Auth SMTP.
- Multiple portal users per client are allowed by `profiles.client_id`, but there is no team-management UI.
- Start a Project remains `mailto:`.
- Proposals, contracts, invoices, and Stripe are documented separately (Phases 15–17). Team management: [team-management.md](./team-management.md).

## Production

`PUBLIC_SITE_URL` must be the HTTPS origin used in invitation links. `RESEND_API_KEY` / `RESEND_FROM` stay Edge-only. Authenticated SELECT on `client_invitations` cannot read `token_hash` (Phase 21). Email failure expires the new invitation row so a bad send does not leave a usable pending invite.

Launch: [production-launch-checklist.md](./production-launch-checklist.md).
