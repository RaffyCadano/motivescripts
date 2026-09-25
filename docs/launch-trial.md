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
| Admin presses **Pause website** (project page menu) | `pause_website(project, note, notifyClient)`: pauses a launched site on demand, for reasons the system can't see (unpaid invoice, a client's request). Optional note shown to the client; untick "Tell the client" to pause for staff only (the client portal then doesn't show it as paused). Same status as the automatic pause, so everything below applies; also pauses on Vercel if the project is opted in. Needs `projects.manage`. |
| Admin presses **Unpause website** | `unpause_website(project, days)`: 7 or 30 more days (reminders start over), or `null` = keep live indefinitely (`pause_exempt`). Needs `projects.manage`. |

## "Paused" is a status; Vercel pause is opt-in

Hosting is set up by hand with an outside provider (see the Hosting entries in `productionTaskInstructions.ts`), so by
default nothing here turns a site off or on: the staff notification is the prompt to do that at the host, and Unpause
only clears the status and tells the client.

### Optional: pause the site on Vercel automatically

For a site on Vercel an admin can opt in, per project: **Edit project > Automatic pause on Vercel**, tick the box and give
the Vercel project name (and team id/slug if it belongs to a team). Off by default, so nothing goes offline until it is
turned on for that project. When on, the same events that set / clear the status also call Vercel's project pause /
unpause API through the `vercel-site-control` edge function:

- the daily sweep pausing an expired project -> pause
- Unpause (admin), or a Care/hosting plan starting -> unpause
- **Retry on Vercel** (banner on the project page) -> whichever action makes Vercel match the status

Visitors to a paused Vercel project see Vercel's plain "503 DEPLOYMENT_PAUSED" page. The result is stored on the project
(`host_paused_at` / `host_pause_error`) and shown in the banner; a failure alerts staff (`host_pause_failed`) and never
blocks the status change. Nothing happens at all until the token secret is set:

```
supabase secrets set VERCEL_API_TOKEN=... --project-ref <ref>     # do it for Sandbox and Production separately
```

Use a Vercel access token scoped to the account/team that owns the sites. It lives only in the edge function's secrets.

## What counts as a plan

`project_has_hosting_plan(project)`: a `service_plans` row of type `care` or `hosting`, status `active` or `past_due`
(Stripe is still retrying), for that project or the client's account-wide plan. `seo_retainer` and `custom` do not count.

## Moving parts

- Migrations `20261104000000_launch_trial_pause_and_reminders.sql`, `20261105000000_vercel_auto_pause.sql` and `20261106000000_manual_pause.sql` (`pause_website`, `pause_reason`) (the Vercel columns, `request_host_site_control`, `retry_host_site_control`): columns, the sweep, `unpause_website`, the plan trigger,
  the `launch-trial-sweep` pg_cron job (daily 14:00 UTC), new notification types, and `paused_at` in
  `client_project_delivery_status`.
- Edge function `vercel-site-control` (service-role only; helper `_shared/vercelSite.ts`, tests `scripts/test-vercel-site.mjs`).
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
