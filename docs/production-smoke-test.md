# Production smoke test

Run this against a **deployed** MotiveScripts environment (production or a staging project that uses the same Edge Functions, secrets, and migrations). SQL Editor bypasses RLS — do not treat Dashboard SQL results as a security test.

Record the result of each case: pass / fail / blocked.

**This file is a manual plan.** Completing the TypeScript build does not mean these tests passed.

## AUTH

| # | Test | Expected result |
| --- | --- | --- |
| 1 | Admin login | Magic link signs in. Lands on `/admin`. Never flashes the client portal chrome. |
| 2 | Staff login | Active staff lands on `/admin`. Sidebar only shows permitted areas. |
| 3 | Client login | Linked client lands on `/client` with that company’s records. Never flashes Admin chrome. |
| 4 | Unconfigured account | Auth user with no valid profile (or unlinked client) sees “Your account is not configured yet.” Not sent to admin. |
| 5 | Logout | Session ends. `/admin` and `/client` redirect to `/login`. |
| 6 | Expired session | After JWT expiry, protected data fails with a friendly session message. Sign in again restores access. |

## CLIENT ONBOARDING

| # | Test | Expected result |
| --- | --- | --- |
| 7 | Invite client | Admin Invite Client on `/admin/clients/:id` succeeds. Database stores **hash only**. Admin UI does not show the raw token. |
| 8 | Receive invitation | Invitee gets Resend email. Link uses `PUBLIC_SITE_URL` (`/invite/{64-hex}`). |
| 9 | Accept invitation | Invited email magic-link + accept sets `profiles.role = client` and `profiles.client_id`. Portal opens. |
| 10 | Reject invalid/expired/revoked | Wrong email, expired, revoked, or already-accepted token cannot be accepted. Safe error copy. No other client’s data. |

## STAFF

| # | Test | Expected result |
| --- | --- | --- |
| 11 | Invite staff | Admin Invite from `/admin/team`. Hash-only storage. Email uses `/staff-invite/{token}`. |
| 12 | Accept staff invitation | Invitee becomes `staff` or `admin` from the **template**, not from the browser. |
| 13 | Assign client | Admin assignment appears. Staff without that assignment cannot open the client. |
| 14 | Assign project | Same for a project URL. |
| 15 | Restricted staff access | Staff with view-only or missing grants cannot mutate via RPC. Nav hide is not enough — Postgres denies. |
| 16 | Deactivate staff | `staff_profiles.is_active = false`. RLS and RPCs deny even if the SPA still has a JWT until it expires. |

## PROJECT

| # | Test | Expected result |
| --- | --- | --- |
| 17 | Create project | Project persists and is visible to admin (and assigned staff). |
| 18 | Create milestone | Milestone appears on admin project and on the client timeline when that project is the portal project. |
| 19 | Create task | Task appears on the project. Client “Your Actions” lists live task titles when present. |
| 20 | Update project status | Status persists after refresh. |

## FILES

| # | Test | Expected result |
| --- | --- | --- |
| 21 | Upload file | Object in private `project-files` bucket. Metadata row matches path. |
| 22 | Create new version | New version number. Previous version file remains. |
| 23 | Preview | Authorized user gets a short-lived signed URL. Unauthorized UUID gets “not found”, no URL. |
| 24 | Download | Same authorization as preview. |
| 25 | Old versions intact | Switching current version does not delete previous Storage objects. |

## REVIEW

| # | Test | Expected result |
| --- | --- | --- |
| 26 | Send version for review | Status In Review. Client is notified. |
| 27 | Client submits feedback | Feedback is tied to the **current** version. |
| 28 | Client requests changes | Status Needs Changes. Archived version cannot be reviewed. |
| 29 | Create new version | New current version. Previous approval/feedback stays on the old version. |
| 30 | Approve correct version | Approval stores `version_id`. Approving an archived or other-client version is denied. |

## MESSAGING

| # | Test | Expected result |
| --- | --- | --- |
| 31 | Client sends message | Message persists. `sender_role` is not chosen by the browser. |
| 32 | Admin/staff receives message | Assigned/admin users see the thread. Other clients do not. |
| 33 | Read/unread state | Opening the thread marks the other party’s messages read. |
| 34 | Notification appears | In-app notification for the recipient. Header bell works. `/admin/notifications` stays an “not available” page. |

## PROPOSALS

| # | Test | Expected result |
| --- | --- | --- |
| 35 | Create proposal | Draft with `MS-YYYY-NNN`. Direct table INSERT on `proposals` from the browser is denied. |
| 36 | Send proposal | Client can SELECT the published revision only. Email sent (or a friendly email failure that does **not** unsend). |
| 37 | Client views proposal | Own published proposal only. Guessed UUID → not found. |
| 38 | Client accepts/declines | RPC records acceptor identity. Browser cannot forge `accepted_at`. |
| 39 | Create revision | New working draft. Previous published revision remains history. |

## CONTRACTS

| # | Test | Expected result |
| --- | --- | --- |
| 40 | Create contract | Draft. Direct INSERT on `contracts` from the browser is denied. |
| 41 | Send contract | Email + published revision. |
| 42 | Client accepts contract | Acceptance audit fields set (`accepted_by_user_id`, email). |
| 43 | Verify acceptance audit data | Admin sees who accepted and when. Client cannot rewrite those columns. |

## INVOICES

| # | Test | Expected result |
| --- | --- | --- |
| 44 | Create invoice | Draft. Totals from Postgres (cents). |
| 45 | Send invoice | Client can view. Drafts stay hidden from the portal. |
| 46 | Client views invoice | Own invoice only. |
| 47 | Download PDF | `invoice-pdf` authorizes the user. Bytes match ledger amounts. |
| 48 | Record manual payment | Amount ≤ amount due. Ledger row appended. |
| 49 | Reverse payment | Reversal timestamp; history kept. Totals recalc. |
| 50 | Verify invoice totals | `amount_paid` / `amount_due` / status match the ledger. Client cannot UPDATE invoices. |

## STRIPE

Stay in **test mode** unless you are intentionally running a live-card check.

| # | Test | Expected result |
| --- | --- | --- |
| 51 | Create Checkout session | Client JWT required. Charge = server `amount_due` (or a validated lesser amount ≥ 50¢). |
| 52 | Successful test payment | Card `4242…`. Stripe Checkout completes. |
| 53 | Webhook received | Valid `Stripe-Signature`. Invalid signature → 400, no ledger write. |
| 54 | Ledger updated | `payments` row `provider = stripe`. Unique PaymentIntent / session ids. |
| 55 | Invoice marked paid | Only after webhook + `record_stripe_payment`. Success **page** never marks paid. |
| 56 | Duplicate webhook | Second delivery does not create a second payment. |

Abandoned/cancelled Checkout must leave the invoice unpaid.

## SECURITY

| # | Test | Expected result |
| --- | --- | --- |
| 57 | Client A opens Client B project URL | “Project not found”. No data. |
| 58 | Client A opens Client B file URL | “File not found”. No signed URL. |
| 59 | Client A opens Client B invoice URL | “Invoice not found”. Checkout for that id is `not_allowed`. |
| 60 | Staff opens unassigned client | Not found / denied. |
| 61 | Anonymous | Public marketing pages work. `/admin` and `/client` → login. No agency table access. |
| 62 | Browser unauthorized RPC | `accept_proposal`, `record_invoice_payment`, `update_staff_member`, etc. fail for the wrong role. |
| 63 | Browser financial update | Direct UPDATE on `invoices` / `payments` denied. |

## PDF / EMAIL

| # | Test | Expected result |
| --- | --- | --- |
| 64 | Invoice PDF | Authorized download. Amounts from Postgres. |
| 65 | Proposal PDF | Published revision for clients; working/published for agency as designed. |
| 66 | Contract PDF | Same authorization as viewing. |
| 67 | Invoice email | Link uses production origin. Failure does not corrupt invoice status. |
| 68 | Proposal email | Same. |
| 69 | Contract email | Same. |
| 70 | Invitation email | Client and staff invites. Raw token only in the email URL, never in Admin UI or `token_hash` column plaintext. |

## EMPTY DATABASE

Use a project that did **not** apply `supabase/dev-seed/seed_demo_data.sql`.

| # | Test | Expected result |
| --- | --- | --- |
| 71 | Admin lists | Leads, clients, projects, files, messages, proposals, contracts, invoices, team show real empty states. Counts are 0. No ABC Landscaping / Harbor & Pine / Smith Auto / BrightPath rows. |
| 72 | Linked client, no work | Portal loads for that client. Timeline, files, messages, proposals, contracts, invoices empty — not demo records. |
| 73 | Start a Project | `/start-a-project` creates a `leads` row (source Start a Project). Does not open mailto on success. Failure offers mailto. |

## After the run

Keep a dated note of environment (project ref, `PUBLIC_SITE_URL`, Stripe test vs live). Do not paste secret values into tickets or this repo.
