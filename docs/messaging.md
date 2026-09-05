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
| Staff | SELECT where `staff_may_conversation(id, 'messages.view')` — see Staff messaging access below | Same | Own inbox only |
| Client | SELECT where `client_id = current_client_id()` | SELECT where `owns_conversation(conversation_id)` | Own inbox only |
| Client A vs B | Denied | Denied | Denied |

Mutations go through RPCs (`search_path = public`):

- `start_conversation(subject, body, project_id, client_id)` — admin/office staff must pass a real `client_id` (checked with `assert_client_perm`); clients **ignore** submitted `client_id` and use `current_client_id()`; production communicators must pass a `project_id` they're directly assigned to
- `send_message(conversation_id, body)` — sender is `auth.uid()`; caller must own the thread (`owns_conversation`) or pass `staff_may_conversation(id, 'messages.manage')`
- `mark_conversation_read(conversation_id)` — only incoming messages (`sender_user_id <> auth.uid()`); same ownership/`staff_may_conversation` check
- `set_conversation_status` — admin or office messaging staff with `messages.manage` on that client
- `mark_notification_read` / `mark_all_notifications_read` — `user_id = auth.uid()` only

Authenticated roles have **SELECT** on the three tables. They do not have INSERT/UPDATE/DELETE grants. That blocks PostgREST from forging `sender_user_id`, `client_id`, or `user_id`.

## Staff messaging access

Added by `supabase/migrations/20260901210000_production_project_messaging.sql`, on top of the Phase 13 model above. Staff are not one bucket — access depends on `staff_profiles.template_key`:

| Template | Access |
| --- | --- |
| Developer, Designer, Content Writer (`is_production_communicator`) | Only conversations whose `project_id` they're directly assigned to (`project_staff_assignments`), and only with the `messages.view`/`messages.manage` grant |
| Team Member | **No client messaging at all.** `messages.view` / `messages.manage` are actively removed from this template's grants — not just hidden in the UI |
| Admin, PM, Sales, and other office staff (`is_office_messaging_staff`) | The original client-assignment model: any conversation for a client they're assigned to (`client_staff_assignments`, or a project assignment that maps to that client) |

`staff_may_conversation(conversation_id, perm)` is the single helper both the RLS policies and the `send_message` / `mark_conversation_read` RPCs check — so this isn't just a read restriction, a production communicator can't write into a thread on a project they aren't assigned to either.

## Notification triggers

**New message** (after INSERT on `messages`, via `notify_admins` → `notify_agency`):

- Sender role `client` → all active admins, always. Non-admin staff only if they pass the same Staff messaging access rule above (production communicators: assigned to that message's project; office staff: assigned to that client; team members: never) — except the sender
- Sender role `admin`/staff → portal users with `profiles.client_id = conversation.client_id`, except the sender

**Phase 9 activity** (after INSERT on `activity`, not on `feedback` — that would double-notify):

| `activity_type` | Recipients | Notification type |
| --- | --- | --- |
| `feedback_submitted` | Admins | `feedback_received` |
| `changes_requested` | Admins | `changes_requested` |
| `version_approved` | Admins | `version_approved` |
| `version_sent_for_review` | That project’s client users | `version_ready_for_review` |
| `status_changed` | That project’s client users | `project_update` |

Activity remains the project audit trail; notifications are a personal inbox. Message bodies are not copied into activity (only `conversation_created` / `conversation_closed` when a project is linked).

As of `20260919000000_activity_task_milestone_events.sql`, task assignment, task status changes, and milestone updates are no longer "noise" that's ignored — they're logged to `public.activity` too (`task_assigned`/`task_status_changed`/`milestone_updated`, icons `task`/`milestone`), since the Activity tab is supposed to be the full project timeline and these are the bulk of day-to-day production work. They deliberately aren't added to `activity_notify_recipients`'s table above — the existing `task_assigned`/`task_status_changed`/`milestone_updated` **notifications** (a separate, older mechanism — see `tasks_notify_assignment`/`tasks_notify_status`/`milestones_notify_update` in `20260830350000_team_member_workspace.sql`) already cover the personal-inbox side of the same events, so wiring them through `activity_notify_recipients` as well would double-notify. A project's initial 15-30 auto-generated tasks are logged as one aggregate `production_plan_generated` row (task/milestone count), not one row per task — see `time-tracking.md`-adjacent migration comments for why.

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
- Apply `supabase/migrations/20260828160000_messaging_notifications.sql` after Phase 12, and `20260901210000_production_project_messaging.sql` after Phase 20 (team management) for the staff-tier access in the section above. Do not edit older migrations.
- Future email/SMS/WhatsApp notifications are out of scope.
- Multiple admins all receive every client-message notification regardless of assignment; there is no per-project admin assignee. (Non-admin staff *are* scoped by assignment — see Staff messaging access.)
- Unread is “the other party opened the thread,” not per-admin read state.

## Production

There is no dedicated `/admin/notifications` product page; the header bell is the live inbox. Conversation access remains RLS + assignment (`messages.view`). Redeploy nothing extra for Phase 21 beyond existing functions if already on Phase 20.

Launch: [production-launch-checklist.md](./production-launch-checklist.md).
