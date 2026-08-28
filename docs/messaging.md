# MotiveScripts messaging and notifications

Phase 13 adds persistent **agency ↔ client** conversations, immutable messages, and an in-app notification inbox. PostgreSQL is the source of truth. React does not keep a mock thread.

Auth, roles, and ownership stay on Phase 12:

```
auth.users.id → profiles (role, client_id) → clients → conversations → messages
                                         → projects (optional on a conversation)
auth.users.id → notifications
```

There is no client-to-client chat and no internal admin team chat. Staff notes stay in the existing admin-only notes/activity UI.

## Conversation model

Table `conversations`:

| Column | Notes |
| --- | --- |
| `id` | UUID |
| `client_id` | Required. FK → `clients.id` (`ON DELETE RESTRICT`) |
| `project_id` | Optional. FK → `projects.id`. Must belong to the same client |
| `subject` | Trimmed, 1–120 characters |
| `status` | `open` or `closed` |
| `created_by` | `auth.users.id` at create time |
| `last_message_preview` | First 140 characters of the latest body |
| `last_message_at` | Updated when a message is inserted |
| `created_at` / `updated_at` | `timestamptz` |

A conversation belongs to a **client**, not to a user account. Linked portal users for that client can participate.

If `project_id` is set, a trigger rejects a mismatch with `conversation.client_id`. `client_id` cannot be changed after insert.

### Closed conversations

**Option A:** sending a message **reopens** the thread (`status = open`). Clients cannot close or reopen. Admins can close or reopen from the thread header. The composer stays available on a closed thread with a short explanation.

## Message model

Table `messages` (append-only history):

| Column | Notes |
| --- | --- |
| `id` | UUID |
| `conversation_id` | FK → `conversations.id` (`RESTRICT`) |
| `sender_user_id` | Always `auth.uid()` (forced in a BEFORE INSERT trigger) |
| `sender_role` | `admin` or `client` from `profiles` at send time |
| `sender_label` | Display cache from `profiles.full_name` |
| `body` | Trimmed, 1–4000 characters |
| `created_at` | `timestamptz` |
| `read_at` | Set when the **other** party opens the thread |

The browser never supplies `sender_user_id`. There is no message edit or delete RPC. `sender_label` is not trusted as identity; `sender_user_id` is.

## Notification model

Table `notifications` (one row per recipient):

| Column | Notes |
| --- | --- |
| `user_id` | Recipient `auth.users.id`. Cascade on user delete |
| `type` | See types below |
| `title` / `body` | Short copy. No secrets |
| `conversation_id` / `message_id` / `project_id` / `deliverable_id` / `proposal_id` / `contract_id` / `invoice_id` | Optional links |
| `read_at` | Null until the owner marks it read |
| `created_at` | Newest first in the UI |

Types: `new_message`, `feedback_received`, `changes_requested`, `version_ready_for_review`, `version_approved`, `project_update`, plus Phase 15 `proposal_*` / `contract_*`, Phase 16 `invoice_ready`, `invoice_viewed`, `payment_recorded`, `invoice_paid`, `invoice_overdue`, plus Phase 17 `payment_received`. Invoice details: [invoices-payments.md](./invoices-payments.md). Stripe: [stripe-payments.md](./stripe-payments.md).

Unique `(user_id, message_id)` prevents duplicate `new_message` rows for the same recipient and message. `message_id` is null for Phase 9 events, so those can repeat if the activity repeats.

The browser cannot INSERT notifications. Triggers and `SECURITY DEFINER` helpers create them. The UI only SELECTS and calls `mark_notification_read` / `mark_all_notifications_read`.

## Ownership and RLS

Anonymous: no table grants, no RPC execute.

| Caller | Conversations | Messages | Notifications |
| --- | --- | --- | --- |
| Admin | SELECT all agency threads | SELECT all messages | Own inbox only |
| Client | SELECT where `client_id = current_client_id()` | SELECT where `owns_conversation(conversation_id)` | Own inbox only |
| Client A vs B | Denied | Denied | Denied |

Mutations go through RPCs (`search_path = public`):

- `start_conversation(subject, body, project_id, client_id)` — admin must pass a real `client_id`; clients **ignore** submitted `client_id` and use `current_client_id()`
- `send_message(conversation_id, body)` — sender is `auth.uid()`; client must own the thread
- `mark_conversation_read(conversation_id)` — only incoming messages (`sender_user_id <> auth.uid()`)
- `set_conversation_status` — admin only
- `mark_notification_read` / `mark_all_notifications_read` — `user_id = auth.uid()` only

Authenticated roles have **SELECT** on the three tables. They do not have INSERT/UPDATE/DELETE grants. That blocks PostgREST from forging `sender_user_id`, `client_id`, or `user_id`.

## Notification triggers

**New message** (after INSERT on `messages`):

- Sender role `client` → every `profiles.role = admin` except the sender
- Sender role `admin` → portal users with `profiles.client_id = conversation.client_id`, except the sender

**Phase 9 activity** (after INSERT on `activity`, not on `feedback` — that would double-notify):

| `activity_type` | Recipients | Notification type |
| --- | --- | --- |
| `feedback_submitted` | Admins | `feedback_received` |
| `changes_requested` | Admins | `changes_requested` |
| `version_approved` | Admins | `version_approved` |
| `version_sent_for_review` | That project’s client users | `version_ready_for_review` |
| `status_changed` | That project’s client users | `project_update` |

Milestone/task noise is ignored. Activity remains the project audit trail; notifications are a personal inbox. Message bodies are not copied into activity (only `conversation_created` / `conversation_closed` when a project is linked).

Notification links use existing routes only (`/admin/messages/:id`, `/client/messages/:id`, `/admin/projects/:id`, `/client/files/:id`, `/client/project/:id`).

## Admin behavior

- `/admin/messages` and `/admin/messages/:conversationId`
- List: client, subject, project, preview, time, status, unread
- Create a conversation for a client (subject, optional project, first message)
- Close / reopen
- Header bell + Messages nav badge from live unread counts
- Overview **Unread Messages** stat
- Client and project pages have light links into the inbox

## Client behavior

- `/client/messages` (existing route; no second messaging area)
- List: subject, project, preview, time, unread (no other clients, no staff notes)
- Start a thread with MotiveScripts; `client_id` comes from the profile
- Optional project dropdown is that client’s projects only
- Sidebar badge + header bell
- Project page: **Message MotiveScripts**

## Realtime

Tables `conversations`, `messages`, and `notifications` are added to `supabase_realtime` when the publication exists.

Subscriptions start **after** the session and profile are known:

- Conversations: admin sees agency changes; client filter `client_id=eq.{own}`
- Notifications: `user_id=eq.{auth.uid()}`
- Open thread: `conversation_id=eq.{id}` only (not every message in the database)

RLS still applies to Realtime. Window focus also refetches. If Realtime is off or blocked, fetching still works.

## Limits

- Conversation list: 100, newest `last_message_at` first
- Messages: latest 50, optional **Load older messages**
- Notifications: latest 40, newest first

Enter sends; Shift+Enter inserts a newline. No attachments, emoji picker, SMS, or email in this phase. Auth magic-link email (Resend) is unchanged.

## Seed

No demo conversations are inserted. There is no stable `auth.users` id to attach senders to. Development seed clients (if applied) are untouched by messaging SQL.

## Manual tests

TEST 1 — Admin → `/admin/messages` → list loads (empty until someone starts a thread).

TEST 2 — Client → `/client/messages` → only that client’s threads.

TEST 3 — Admin sends → message appears for admin.

TEST 4 — Client refreshes → message remains.

TEST 5 — Client opens thread → incoming messages get `read_at`.

TEST 6 — Client replies → admin sees the message (refresh or Realtime).

TEST 7 — Admin refreshes → client message remains.

TEST 8 — Client A opens `/client/messages/{Client B id}` → not found / empty (RLS).

TEST 9 — Client A `send_message` on Client B’s id → denied.

TEST 10 — Client A SELECT Client B notifications → none.

TEST 11 — Client message → admin notification.

TEST 12 — Admin message → client notification.

TEST 13 — Client feedback → admin `feedback_received`.

TEST 14 — Changes requested → admin `changes_requested`.

TEST 15 — Send for review → client `version_ready_for_review`.

TEST 16 — Client approval → admin `version_approved`.

TEST 17 — Logout → rows remain in Postgres.

TEST 18 — Login again → history still there.

TEST 19 — Mobile: list → thread → Back.

TEST 20 — Anonymous `/admin/messages` or `/client/messages` → `/login`.

## Limitations

- **RLS verification not performed** against a live project in this implementation pass. Confirm TEST 8–10 with two client Auth users.
- **Realtime verification not performed.** Enable Realtime on those tables in the Supabase dashboard if events do not arrive.
- Apply `supabase/migrations/20260828160000_messaging_notifications.sql` after Phase 12. Do not edit older migrations.
- Future email/SMS/WhatsApp notifications are out of scope.
- Multiple admins all receive client-message notifications; there is no per-project assignee.
- Unread is “the other party opened the thread,” not per-admin read state.

## Production

There is no dedicated `/admin/notifications` product page; the header bell is the live inbox. Conversation access remains RLS + assignment (`messages.view`). Redeploy nothing extra for Phase 21 beyond existing functions if already on Phase 20.

Launch: [production-launch-checklist.md](./production-launch-checklist.md).
