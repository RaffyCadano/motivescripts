# Notification preferences

**Admin → Settings → Notifications.** Each person switches eight in-app events on or off for themselves. Everything defaults to on, changes save immediately, and email notifications are not part of this.

| Setting | Notification types it controls |
| --- | --- |
| Proposal accepted | `proposal_accepted` |
| Contract accepted | `contract_accepted` |
| Invoice paid | `invoice_paid` |
| Payment received | `payment_received`, `payment_recorded` |
| File feedback | `feedback_received`, `changes_requested` |
| Approval activity | `version_approved`, `version_ready_for_review` |
| New messages | `new_message` |
| Lead submissions | `lead_submitted` (new, see below) |

Task, deadline, payroll, domain/SSL, and project-update notifications are not toggleable and are always delivered.

## How it works

- Migration `supabase/migrations/20261001000000_notification_preferences.sql` adds `notification_preferences (user_id, event, in_app)`. No row means on. Row-level security lets a person read and write only their own rows.
- One `BEFORE INSERT` trigger on `public.notifications` (`notifications_respect_preferences`) looks the notification's type up in `notification_event_for_type()` and skips the insert if that person turned the event off. No existing notification-creating function was changed.
- **New leads** now create an in-app `lead_submitted` notification for every admin, but only for leads that arrive with no signed-in user (the public Start a Project form). Leads an admin adds by hand do not notify admins. A failure to write the notification can never stop a lead from being saved.
- The UI lists events in `src/data/notificationPreferences.ts`; `node --test scripts/test-notification-preferences.mjs` checks that list against the SQL.

## Applying it

Run the migration on each project (SQL Editor or `supabase db query --linked --file …`), then deploy the website. It is safe to re-run.
