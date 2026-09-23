# Automated website backups

Closes the last unaddressed bullet on Website Care's pricing tiers: "Automated backups" was pure
marketing copy with nothing behind it until `20261020000000_automated_website_backups.sql`. Unlike
Advanced monitoring (Pro-only), backups run for **any active/past-due Care plan, any tier** — the
original pricing bullet lists it under Essential, and Business/Pro both say "everything in
Essential."

## Scope, and why it's bounded this way

Hosting is external — MotiveScripts never provisions or has infrastructure access to a client's
host (see "set up hosting" in `productionTaskInstructions.ts`). There is no server MotiveScripts
controls to pull a filesystem or database backup from. What's honestly buildable, and what this
is: a **daily HTML snapshot of the live production page**, retained and downloadable, so there's a
recent copy to reference or restore content from if a site breaks or a host loses data. This is
**not** a one-click "restore my site" button — promising that would overpromise given external
hosting.

## Flow

```
pg_cron (website-daily-backups, once a day, 03:00 UTC)
  → run_scheduled_website_backups()
  → pg_net POST to website-backup (service role key, no projectId)
  → projects_due_for_website_backup(): every launched project with an active/past-due Care plan
    (any tier) not backed up in the last ~20 hours
  → fetches each production_url (15s timeout, same URL validation as check-website-health)
  → uploads the raw HTML to the project-files bucket
  → inserts one website_backups row (ok, with storage_path + byte_size; or failed, with error_message)
  → a failed row triggers website_backups_notify_failure() → notify_agency(..., 'backup_failed', ...)
```

Staff can also trigger one on demand ("Back up now" in `WebsiteBackupsCard.tsx`) — same Edge
Function, single-project mode, gated on `staff_may_project(projectId, 'projects.manage')` re-checked
server-side, same two-caller shape as `check-website-health`.

## Schema

`website_backups` (RLS: staff select via `staff_may_project(project_id, 'projects.view')`; a
separate client select policy, added by `20261021000000_website_backups_client_visibility.sql`,
gives the client portal read-only status visibility — no insert/update/delete grant to
`authenticated` at all; every row is written by the Edge Function's service role):

| Column | Notes |
| --- | --- |
| `id` | UUID |
| `project_id` | FK → `projects`, `on delete cascade` |
| `status` | `ok` or `failed` |
| `storage_path` | Path in the `project-files` bucket; null when `status = failed` |
| `byte_size` | Null when `status = failed` |
| `error_message` | Up to 500 chars, empty string for a successful backup |
| `triggered_by` | Staff member who used "Back up now"; null for the scheduled sweep |
| `created_at` | Defaults to `now()` |

Storage path shape: `projects/<project_id>/website-backups/<ISO-timestamp>.html`, same
`project-files` bucket as every other upload in the app. Storage RLS (`can_access_website_backup_file`)
is staff-view-only — the client-visibility policy above covers the table only, never file download.

`project_has_active_care_plan(project_id)` is the eligibility check: any tier, unlike
`project_has_fast_monitoring` (Pro's "Advanced monitoring" only). `staff_project_has_active_care_plan`
is the staff-scoped wrapper the frontend calls to decide whether to show `WebsiteBackupsCard` at all.

## Frontend

- `WebsiteBackupsCard.tsx` — shown on `ProjectOverview.tsx`, `TeamDeploymentDetail.tsx`, and
  `TeamProjectDetails.tsx` (same places as `WebsiteHealthCard`), but only when the project has an
  active Care plan. Shows last successful backup + size, a "Back up now" button, and up to 5 recent
  attempts with a download link (a signed URL, 10-minute TTL, same `signedUrlForPath` helper every
  other file download in the app uses).
- `ClientPlans.tsx` — a "Backups" cell next to the existing hours/domain-hosting-SSL status,
  showing only "Last backup ... ago" (or "First automatic backup runs within a day"). No download
  link — clients see that it's happening, not the file.

## Known limitations (v1)

- Daily cadence only, not tier-differentiated (every Care tier gets the same once-a-day snapshot).
- Homepage/production-URL HTML only — not sub-pages, not staging, not a database or asset backup.
- Snapshots larger than 8 MB are refused (`status = failed`) rather than silently truncated.
- No retention/expiry policy yet — every successful snapshot is kept indefinitely.
