# Free launch period, reminders, and pausing

Every project gets a free 30 days from the moment it launches (`project_development.launch_trial_ends_at`, set once by
a trigger when `deployment_status` first becomes Production). What happens around the end of it:

| When | What |
| --- | --- |
| Launch | The period starts. The client can send Website Care requests without a plan (`care_requests_before_insert`). Their Overview shows "Free period ends …". |
| 7 days before | Reminder email + in-app notification to the client (only if there is no active Care/hosting plan). |
| 1 day before | Second reminder, same rules. (A project first seen inside the last day gets only this one.) |
| Period over, no plan | The daily sweep **pauses** the project: sets `paused_at`, notifies staff (`website_paused`, with "take the site offline at the host"), notifies the client and emails them. |
| Client gets an active Care/hosting plan | Trigger `service_plans_unpause_on_activation` clears `paused_at`, tells the client, and alerts staff to bring the site back at the host. |
| Admin presses **Unpause website** | `unpause_website(project, days)`: 7 or 30 more days (reminders start over), or `null` = keep live indefinitely (`pause_exempt`). Needs `projects.manage`. |

## "Paused" is a status, not a switch

Hosting is set up by hand with an outside provider (see the Hosting entries in `productionTaskInstructions.ts`), so
nothing here turns a site off or on. The staff notification is the prompt to do that at the host; Unpause only clears
the status and tells the client.

## What counts as a plan

`project_has_hosting_plan(project)`: a `service_plans` row of type `care` or `hosting`, status `active` or `past_due`
(Stripe is still retrying), for that project or the client's account-wide plan. `seo_retainer` and `custom` do not count.

## Moving parts

- Migration `20261104000000_launch_trial_pause_and_reminders.sql`: columns, the sweep, `unpause_website`, the plan trigger,
  the `launch-trial-sweep` pg_cron job (daily 14:00 UTC), new notification types, and `paused_at` in
  `client_project_delivery_status`.
- Edge function `document-email`, kind `launch_trial` with `stage` `7d` / `1d` / `paused` (service-role only). The sweep
  calls it through `pg_net` using the same Vault secrets as the overdue-invoice reminders (`edge_function_base_url`,
  `service_role_key`); without them the status changes and in-app notifications still happen but no email is sent.
- Client: `ClientPausedBanner`, the Paused badge in `ClientWebsiteSection`, `Overview`.
- Admin: `ProjectWebsitePauseBanner` on the project page.
- Public copy: the Pricing page note and FAQ, and `aiKnowledge.ts` (bump `AI_KNOWLEDGE_VERSION`, redeploy `motivescripts-ai`).

## Testing

The sweep and unpause are covered by rolled-back `DO` blocks against Sandbox (see the PR / commit notes); there is no
frontend logic beyond display. To exercise it by hand on Sandbox: set a launched project's `launch_trial_ends_at` in the
past and run `select public.run_launch_trial_sweep();`.
