# Production Workflow Gates (v1)

The delivery pipeline that runs after a project is created and paid for: **Design Approval → Development → QA → Client Review → Final Approval → Launch → Handoff**. It sits downstream of the existing commercial flow (Lead → Client → Discovery → Scope → Proposal → Contract → Invoice → Payment), which is unchanged.

This is not a new workflow engine. Every gate reuses existing tables (`tasks`, `milestones`, `deliverables`, `file_versions`, `approvals`, `project_development`, `invoices`) and the existing milestone alias-matching already used by the frontend (`websiteMilestoneDefinition` in `src/data/projectMilestones.ts`).

## Where enforcement actually lives

All gates are server-side (Postgres triggers), not UI checks. The frontend (`src/data/productionWorkflow.ts`) mirrors the same rules only to render "what phase is this project in" -- it never itself allows or blocks a write. See `supabase/migrations/20260930090000_production_workflow_gates.sql` and its three follow-up fix migrations (`...100000`, `...110000`, `...130000`) plus `...120000` (notification types).

## The gates

| Gate | Rule | Enforced by |
| --- | --- | --- |
| Development | A Development-milestone task cannot leave `Todo` unless the project has a deliverable tagged `design_checkpoint = 'overall_design'` with an approval on its current version. | `tasks_workflow_gate` trigger |
| QA actionable | A `task_type = 'qa'` task cannot leave `Todo` until every Development-milestone task is `Completed`. | same trigger |
| QA verdict | A `qa`-typed task cannot be marked `Completed` without `qa_result` (`pass`/`fail`) set in the same update. | same trigger |
| Client Review actionable | A `task_type = 'client_review'` task cannot leave `Todo` until the most recent QA verdict is `pass`. | same trigger |
| Launch | `project_development.deployment_status` cannot become `'Production'` unless ALL of: Overall Design approved, Development complete, QA passed, Client Review complete (all `client_review` tasks `Completed`), `final_website` checkpoint approved, and no invoice for the project is `draft`/`sent`/`viewed`/`partially_paid`. Also requires the caller to be Admin or PM (`staff_may_coordinate_project`), not any staff with `projects.manage`. | `project_development_launch_gate` trigger |

`public.launch_blocking_reasons(project_id)` returns the empty array when a project is launch-ready, or a plain-English reason per unmet gate. It is the single source of truth both the trigger and (mirrored client-side) the Admin/PM UI panel use.

## Backwards compatibility (no new "legacy" flag)

The Development gate only fires on a Development-milestone task's *first* `Todo -> non-Todo` transition, and even then only if the project is not already exempt. A project is exempt (never gated) if either:
- `projects.status` is already `'In Development'`, `'Client Review'`, or `'Completed'`, or
- it already has a Development-milestone task that is not `Todo`.

Either signal alone means development was already unlocked under the pre-gate model, so nothing already in flight, completed, or launched is retroactively blocked. Confirmed against real Sandbox project data before this was written -- see the report's Existing Project Compatibility section.

## QA state

QA reuses the existing Team Member role -- no `role = 'qa'` was added. States:
- **Pending** = task status `Todo`
- **In Progress** = task status `In Progress`
- **Passed** = task status `Completed` and `qa_result = 'pass'`
- **Failed** = task status `Completed` and `qa_result = 'fail'`

`public.qa_latest_result(project_id)` returns the verdict of the most recently completed QA task, so re-running and passing QA after a failure supersedes the prior fail with no separate QA-cycle table.

## Checkpoints

`deliverables.design_checkpoint` now allows a 4th value, `final_website`, alongside the existing `initial_concept` / `logo_brand` / `overall_design`. It represents "the completed website is approved for launch" -- distinct from any individual file or the Overall Design checkpoint. Only the deliverable's *current* version's approval counts (`approvals` has a unique-per-version constraint and no "rejected" state; a change request is a `feedback` row that resets the deliverable to `Needs Changes`, invalidating the checkpoint until a new version is approved).

## Payment gate

There is no "this is the final invoice" flag in the schema, so the rule uses only the existing `invoices.status` enum: launch is blocked while any invoice for the project is `draft`, `sent`, `viewed`, or `partially_paid`. `cancelled` does not block (an intentionally voided invoice, not unpaid work), and a project with zero invoices is not blocked.

## Notifications

Reuses the existing `notify_agency` / `notify_client_users` helpers and the `activity` table -- no new notification system. Four new `notifications.type` values were added: `qa_failed`, `qa_passed`, `client_review_ready`, `launch_completed`.

## What's deliberately not automatic

- **Development Complete**, **Client Review Complete**, and (as ever) **milestone status** are staff-confirmed by completing the relevant tasks -- there is no "one task done = phase done" shortcut, and no separate "force complete" button that skips real task completion.
- Milestone status auto-rolls-up from its own tasks (`tasks_rollup_milestone` trigger), except the Design and Review milestones cannot roll up to `Completed` while their approval gate is unmet (Design needs `overall_design` approved; Review needs QA passed + Client Review complete) -- matching the spec's explicit example of a milestone whose tasks are all done but the gate isn't.
