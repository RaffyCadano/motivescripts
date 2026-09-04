# Staff role guides

This is a plain-language guide to what each staff role actually sees and does day to day — meant to be read by the staff member, not just an engineer. For the underlying permission/security model (grants, RLS, templates), see [team-management.md](./team-management.md) instead.

There are two separate workspaces:

- **`/admin`** — Project Manager, Sales, Accounting, generalist Staff, and Admin. A CRM-style panel: clients, projects, proposals, contracts, invoices.
- **`/team`** — Developer, Designer, Content Writer, and Team Member. A simpler "what do I need to work on" workspace built around assigned tasks.

Which one you land on after login is automatic, based on your staff template — you don't choose it. If you're on `/team` and also have office-side permissions (rare), an **Admin** link appears at the bottom of your sidebar to switch over.

Every staff member's dashboard *structure* is the same as everyone else with the same role — what differs is the *data*: you only ever see the clients, projects, and tasks you're actually assigned to.

---

## Project Manager

Home page: `/admin` (Overview). Sidebar: Overview, My Tasks, Projects, Clients, Files, Capacity, Messages, Profile.

Your Overview page is the real starting point each day — it pulls together, in order:

- **Summary numbers** — active projects, discovery items awaiting review, tasks due soon, overdue tasks, client follow-ups needed.
- **Assigned projects** — every project you're on, with a quick read on its discovery/feedback status.
- **Discovery Action Center** — clients who've submitted a discovery intake form but it hasn't been reviewed yet, grouped by how urgent they are. This is usually your first stop.
- **My Tasks** — your own assigned tasks (PMs get tasks too, not just production staff), with inline status changes.
- **Client follow-ups** — clients waiting on a reply, an unresolved feedback item, or a pending approval.
- **Project health** — a rollup flagging projects that look stuck (no recent activity, overdue tasks, unresolved feedback).
- **Team members** — who's working on your projects and what they're carrying.
- **Next actions** — a generated punch list combining the sections above into "do this next."

Day to day: you create projects, assign staff to clients/projects, manage milestones and tasks, review client discovery submissions, and handle feedback/approvals. You do **not** see Payroll (admin-only) or Leads/Proposals/Contracts/Invoices unless specifically granted — your template is scoped to delivery, not sales or finance.

## Sales

Home page: `/admin`. Sidebar (per your `sales` template grants): Leads, Clients, Proposals, Contracts, Messages.

Workflow: a lead comes in (public site form or manually added) → you work it in **Leads** → convert it to a **Client** once it's real → build a **Proposal** (scope, pricing, presets for pages/features/add-ons) → send it for the client to accept in their portal → once accepted, a **Contract** is generated from it. You don't see Invoices, Files, or Projects by default — billing and delivery are handled by Accounting and the PM after handoff.

## Accounting

Home page: `/admin`. Sidebar (per your `accounting` template grants): Clients, Invoices.

You create and send invoices, record manual payments (bank transfer, cash, check), and reconcile what's outstanding. Online (Stripe) payments record themselves automatically once a client pays through the portal — you'll see them appear as `stripe`-method payments, nothing to do there.

**Recurring plans (Website Care, SEO retainers, hosting billing) are admin-only**, even though you can manage invoices — creating or canceling a plan on a client's Plans tab requires the `admin` role specifically, not just `invoices.manage`. This is deliberate: a recurring plan commits the agency to an ongoing Stripe subscription, which is treated as a bigger decision than a one-time invoice. If you need a plan created, ask an admin.

You do not see Payroll — that's staff pay rates, kept separate from client billing and visible to admins only.

## Staff (generalist)

Home page: `/admin`. Sidebar: Overview, My Tasks, Leads, Clients, Projects, Files, Proposals, Contracts, Invoices, Messages, Capacity, Profile — essentially the full admin nav minus **Team** and **Payroll** (and Settings, which is admin-only regardless of role).

This is the catch-all template: it holds every permission except `team.view`/`team.manage`, so it's meant for someone doing more than one job at a small agency, or as a starting point before an admin narrows someone into a more specific template (PM, Sales, Accounting). If that's you, you're not missing a "real" role — you genuinely have broad access, and what you actually work on day to day depends on what your admin has you doing, not a fixed workflow like the other templates below.

One thing this template can't do that Admin can: manage the team itself (invite staff, change roles/grants, deactivate someone) and see company-wide Settings or Payroll.

## Developer / Designer / Content Writer

Home page: `/team/dashboard`. Sidebar: Dashboard, My Tasks, My Projects, Files, My Time, Messages, Profile.

Your dashboard shows, in priority order: **overdue tasks**, **due soon**, **assigned tasks**, **my projects**, then recent activity across those projects. Click any task card to open the task detail panel — that's where the actual work instructions live.

**Every task has structured instructions** (Objective, What to do, Before starting, Deliverable, Done when) generated from the client's accepted proposal — you don't need to guess what "Build homepage" means or hunt for scope details; open the task and read it. If a task doesn't have generated instructions (a custom, one-off task a PM created by hand), its plain description is all there is.

Task status you control: **Not Started → In Progress → In Review → Completed** (or **Blocked**, if something outside your control is stopping you). Move it to **In Review** when you're done and want PM/client eyes on it, not straight to Completed — In Review is how the PM knows to check your work. My Tasks has a filter chip for each status, including Blocked.

Tasks like "Prepare/deploy staging" and "Address requested revisions" show an **"Open Files & Feedback"** shortcut right in the task panel — it jumps straight to that project's Files tab instead of you hunting for it. (Two other task types — Discovery and Content Collection — have a similar richer workspace on the PM/admin side; those specific tasks are recommended to Project Manager, since the extra actions there require the `clients.manage` grant no production template has, so you won't see them here even if one lands on your list.)

**You can log time** against a task from the same detail panel if the project bills hourly — this feeds both client invoicing and (if your pay rate is set) your own payroll, independently of each other. **My Time** in your sidebar lists everything you've logged across every project, with edit/delete on any entry that hasn't been billed or paid yet, plus a running "not yet paid" total and an estimate of what you're owed if an admin has set your hourly rate.

Each task detail panel also has a **Checklist** (break the task into steps, check them off — visible to anyone else on the task, not just you), **Attachments** (working files for that task only — screenshots, reference docs; not client-visible, and separate from the project's client-reviewable Files), and **Comments** at the bottom (a lightweight note thread on that one task, distinct from project-wide Messages — the task's assignee gets notified when someone else comments).

**My Tasks** also has a **Board** view next to List — drag a card between status columns to change its status. Drag only works with a mouse; on touch devices, open the card and use the status dropdown instead. A search box filters by title, description, project, client, or milestone as you type.

**You can message the client directly** (Messages in your sidebar) — but only on threads tied to a project you're directly assigned to, not just any client you happen to work with. Developer, Designer, and Content Writer are the only production roles with this ability (Team Member doesn't have it at all — see below). Use it for clarifying questions on your own work; broader project/timeline conversations should still go through the PM.

Your Profile page has device-only notification toggles (email/task reminders), same as the client portal's — they don't unsubscribe you from anything required, just hide reminders in this browser.

On a project's own page (`/team/projects/:id`), the tabs are: Overview, Tasks, Milestones, Files, Time, Feedback, Approvals, Activity — Files/Feedback/Approvals require the `files.view` grant your template already includes. The Time tab scopes to your own logged hours on that project only (RLS hides teammates' entries unless you also hold `invoices.manage`, which no production template does) — for everything you've logged across every project, use My Time in the sidebar instead.

**Hosting stays external.** Deployment/staging/production tasks explicitly say MotiveScripts doesn't perform the actual hosting — that happens on whatever infrastructure the agency uses outside this app. Your job on those tasks is preparing the build and confirming it's live, not provisioning a server.

After you deploy, click **Edit** on the Development card (Overview tab) to update the repository/branch, staging and production URLs, hosting provider, and deployment status yourself — it's a small scoped form, not the full project edit page, so it can't touch anything else about the project.

## Team Member

Same `/team` workspace and dashboard as Developer/Designer/Content Writer above — same tasks, same instructions, same project tabs, same time logging and My Time page, same task checklist/attachments/comments, same Board view.

The one difference: **you don't have Messages at all.** It's not in your sidebar — by design, Team Member has no client-messaging permission, so there's nothing to open. Client-facing communication on your tasks goes through your PM instead. Everything else works the same.

## Admin

Sees everything — every `/admin` section, Payroll, Settings, and can act as any staff role's permissions imply. If you're an admin reading this because you're about to onboard a new hire, the sections above are what they'll actually see once their template is set — worth a skim before their first day so you can answer "what am I looking at" questions.
