-- Production Workflow Gates & Delivery State Machine.
--
-- Adds real, server-enforced gates on top of the existing commercial flow
-- (Lead -> ... -> Payment) and existing production-task generation, for the
-- delivery side: Design Approval -> Development -> QA -> Client Review ->
-- Final Approval -> Launch -> Handoff. This is NOT a new workflow engine --
-- every gate below reuses tables that already exist (tasks, milestones,
-- deliverables, file_versions, approvals, project_development, invoices) and
-- the alias-based milestone matching already implemented in
-- src/data/projectMilestones.ts (websiteMilestoneDefinition) and
-- src/data/developerOverview.ts (developmentPhaseProgress).
--
-- Backwards compatibility (no new "legacy" flag): every gate below only
-- fires on a genuinely new transition (a Todo task actually leaving Todo, a
-- deployment actually flipping to Production). A task that is already past
-- Todo, or a project already recorded as further along, never re-triggers
-- the check that would have applied to it originally -- see the "legacy
-- exemption" comments on each guard function.

-- ---------------------------------------------------------------------------
-- 1. Schema: add the `final_website` checkpoint value, and a minimal,
--    explicit QA verdict column on tasks.
-- ---------------------------------------------------------------------------

alter table public.deliverables
  drop constraint if exists deliverables_design_checkpoint_check;
alter table public.deliverables
  add constraint deliverables_design_checkpoint_check
    check (design_checkpoint is null or design_checkpoint = any (array[
      'initial_concept', 'logo_brand', 'overall_design', 'final_website'
    ]));

comment on column public.deliverables.design_checkpoint is
  'Stable checkpoint identifier this deliverable represents, if any: initial_concept, logo_brand, overall_design (gates new Development work), or final_website (the Launch-gating "completed site approved for launch" checkpoint -- distinct from any individual file approval).';

alter table public.tasks
  add column if not exists qa_result text;
alter table public.tasks
  drop constraint if exists tasks_qa_result_check;
alter table public.tasks
  add constraint tasks_qa_result_check
    check (qa_result is null or qa_result = any (array['pass', 'fail']));

comment on column public.tasks.qa_result is
  'Verdict for a task_type = qa task, set when it is marked Completed. Minimal, explicit QA state addition per the production workflow spec -- Pending/In Progress are the task''s own status; Passed/Failed is this column once status = Completed. Reuses the existing Team Member role; no qa role was added.';

-- ---------------------------------------------------------------------------
-- 2. Milestone key resolution, reimplemented in SQL from
--    src/data/projectMilestones.ts's WEBSITE_DELIVERY_MILESTONES so triggers
--    can identify "the Development milestone" / "the QA & Client Review
--    milestone" the same way the frontend already does (name or alias,
--    case-insensitive) -- not via task_type, which production task
--    generation never sets (try_insert_production_task leaves it null).
-- ---------------------------------------------------------------------------

create or replace function public.milestone_workflow_key(p_name text)
returns text
language sql
immutable
as $$
  select case lower(trim(coalesce(p_name, '')))
    when 'discovery' then 'discovery'
    when 'design' then 'design'
    when 'development' then 'development'
    when 'qa & client review' then 'review'
    when 'qa and client review' then 'review'
    when 'client review' then 'review'
    when 'review' then 'review'
    when 'launch' then 'launch'
    else null
  end;
$$;

comment on function public.milestone_workflow_key(text) is
  'Maps a milestone name to its workflow key (discovery/design/development/review/launch), matching websiteMilestoneDefinition() in src/data/projectMilestones.ts. "review" covers the single combined QA & Client Review milestone.';

-- ---------------------------------------------------------------------------
-- 3. Checkpoint approval lookup: "does this project currently have an
--    approved <checkpoint> deliverable?" -- reuses the existing rule that an
--    approvals row for the deliverable's current file_version IS the
--    approval (approvals_status_check only ever allows 'Approved'; there is
--    no separate rejected state -- a change request is a feedback row and
--    resets deliverable.status to 'Needs Changes', which is handled by
--    already-shipped client_submit_feedback/client_approve_current_version).
-- ---------------------------------------------------------------------------

create or replace function public.project_checkpoint_approved(p_project_id uuid, p_checkpoint text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.deliverables d
    join public.file_versions v on v.deliverable_id = d.id and v.is_current
    join public.approvals a on a.version_id = v.id
    where d.project_id = p_project_id
      and d.design_checkpoint = p_checkpoint
  );
$$;

comment on function public.project_checkpoint_approved(uuid, text) is
  'True when the project has a deliverable tagged with the given design_checkpoint whose CURRENT version has an approval row. Used for overall_design (Development gate) and final_website (Launch gate).';

-- ---------------------------------------------------------------------------
-- 4. Development gate. A Development-milestone task may leave Todo only if
--    Overall Design is approved for the project -- UNLESS the project is a
--    legacy/in-flight one, determined live from existing state (no stored
--    flag):
--      a) the project's own status already says it is past the design
--         phase (In Development / Client Review / Completed), or
--      b) the project already has a Development-milestone task that is not
--         Todo (real work already happened under the pre-gate model).
--    Either signal alone is enough to exempt the whole project -- this is
--    exactly how existing in-development/completed/launched projects (none
--    of which have ever tagged an overall_design checkpoint, confirmed by
--    inspecting Sandbox data before writing this) keep working unchanged.
-- ---------------------------------------------------------------------------

create or replace function public.project_development_legacy_exempt(p_project_id uuid)
returns boolean
language sql
stable
as $$
  select
    exists (
      select 1 from public.projects
      where id = p_project_id
        and status in ('In Development', 'Client Review', 'Completed')
    )
    or exists (
      select 1
      from public.tasks t
      join public.milestones m on m.id = t.milestone_id
      where t.project_id = p_project_id
        and public.milestone_workflow_key(m.name) = 'development'
        and t.status <> 'Todo'
    );
$$;

comment on function public.project_development_legacy_exempt(uuid) is
  'True if this project already has development in flight under the pre-gate model (status already past design, or a development task already left Todo before this migration). Exempt projects are never newly gated -- satisfies "do not retroactively lock existing projects".';

create or replace function public.enforce_task_workflow_gate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_milestone_key text;
  v_task_type text := coalesce(new.task_type, old.task_type);
begin
  select public.milestone_workflow_key(m.name) into v_milestone_key
  from public.milestones m
  where m.id = new.milestone_id;

  -- Development gate: only the first Todo -> non-Todo transition of a
  -- Development-milestone task is ever checked.
  if v_milestone_key = 'development' and old.status = 'Todo' and new.status <> 'Todo' then
    if not public.project_development_legacy_exempt(new.project_id)
       and not public.project_checkpoint_approved(new.project_id, 'overall_design')
    then
      raise exception 'Development is locked until Overall Design is approved.' using errcode = '42501';
    end if;
  end if;

  -- QA gate: a qa-typed task may only leave Todo once Development is
  -- complete (all Development-milestone tasks Completed). No legacy
  -- exemption is needed here -- try_insert_production_task never set
  -- task_type, so every qa-typed task in Sandbox today was created by a
  -- human after this feature existed; there is nothing pre-existing to
  -- grandfather.
  if v_task_type = 'qa' and old.status = 'Todo' and new.status <> 'Todo' then
    if not public.development_tasks_complete(new.project_id) then
      raise exception 'QA is locked until Development is complete.' using errcode = '42501';
    end if;
  end if;

  -- A qa-typed task moving to Completed must record pass/fail. Clearing the
  -- verdict when a task leaves Completed keeps a reopened QA cycle honest.
  if v_task_type = 'qa' then
    if new.status = 'Completed' and new.qa_result is null then
      raise exception 'Set a QA result (pass or fail) before completing a QA task.' using errcode = '42501';
    end if;
    if new.status <> 'Completed' then
      new.qa_result := null;
    end if;
  else
    new.qa_result := null;
  end if;

  -- client_review-typed task: only actionable once QA has passed.
  if v_task_type = 'client_review' and old.status = 'Todo' and new.status <> 'Todo' then
    if public.qa_latest_result(new.project_id) is distinct from 'pass' then
      raise exception 'Client Review is locked until QA has passed.' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

comment on function public.enforce_task_workflow_gate() is
  'Server-side enforcement for Development/QA/Client Review actionability. Keys off milestone name (via milestone_workflow_key) and task_type, never a UI-only check. Runs BEFORE UPDATE so a disallowed transition never reaches the row.';

drop trigger if exists tasks_workflow_gate on public.tasks;
create trigger tasks_workflow_gate
  before update on public.tasks
  for each row execute function public.enforce_task_workflow_gate();

revoke all on function public.enforce_task_workflow_gate() from public, anon;
revoke all on function public.project_development_legacy_exempt(uuid) from public, anon;
revoke all on function public.project_checkpoint_approved(uuid, text) from public, anon;

-- ---------------------------------------------------------------------------
-- 5. Development Complete: "all Development-milestone tasks Completed",
--    matching developmentPhaseProgress() in src/data/developerOverview.ts
--    (total > 0 && completed === total) rather than "any one task done". A
--    project with zero Development tasks is not "complete" -- nothing to
--    complete yet.
-- ---------------------------------------------------------------------------

create or replace function public.development_tasks_complete(p_project_id uuid)
returns boolean
language sql
stable
as $$
  select coalesce(bool_and(t.status = 'Completed'), false)
  from public.tasks t
  join public.milestones m on m.id = t.milestone_id
  where t.project_id = p_project_id
    and public.milestone_workflow_key(m.name) = 'development'
  having count(*) > 0;
$$;

comment on function public.development_tasks_complete(uuid) is
  'True only when the project has at least one Development-milestone task and all of them are Completed. Matches developmentPhaseProgress() in src/data/developerOverview.ts. PM/Admin can still reach this by completing every task; there is no separate "force complete" escape hatch, since that would let one click skip real work.';

revoke all on function public.development_tasks_complete(uuid) from public, anon;

-- ---------------------------------------------------------------------------
-- 6. QA verdict lookup: the most recently updated qa-typed task with a
--    recorded result is "the" current QA verdict for the project. Reopening
--    a failed QA task and re-completing it with qa_result = 'pass' naturally
--    supersedes the prior failure -- no separate QA-cycle table needed.
-- ---------------------------------------------------------------------------

create or replace function public.qa_latest_result(p_project_id uuid)
returns text
language sql
stable
as $$
  select t.qa_result
  from public.tasks t
  where t.project_id = p_project_id
    and t.task_type = 'qa'
    and t.qa_result is not null
  order by t.updated_at desc
  limit 1;
$$;

comment on function public.qa_latest_result(uuid) is
  'Most recent QA verdict (pass/fail) for the project, or null if QA has never been recorded. "Most recent" = latest updated_at among completed qa-typed tasks with a result -- a fresh pass after a fail supersedes it.';

revoke all on function public.qa_latest_result(uuid) from public, anon;

-- ---------------------------------------------------------------------------
-- 7. QA failure/pass notifications + activity trail. Reuses the existing
--    activity table (project-scoped internal timeline) rather than
--    `feedback`, which is client/deliverable/version-scoped and does not fit
--    an internal QA note. Reuses notify_agency (already the mechanism for
--    "admin + assigned staff with a permission on this project") and
--    notify_client_users -- no new notification plumbing.
-- ---------------------------------------------------------------------------

create or replace function public.notify_task_qa_result()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project public.projects;
  v_actor_name text;
begin
  if new.task_type <> 'qa' or new.qa_result is null or new.qa_result is not distinct from old.qa_result then
    return new;
  end if;

  select * into v_project from public.projects where id = new.project_id;
  select coalesce(nullif(trim(full_name), ''), 'Someone') into v_actor_name
  from public.profiles where id = auth.uid();

  if new.qa_result = 'fail' then
    insert into public.activity (project_id, actor_id, activity_type, message, metadata)
    values (
      new.project_id, auth.uid(), 'qa_failed',
      v_actor_name || ' failed QA on "' || new.title || '". Project moved back to Development.',
      jsonb_build_object('icon', 'review', 'task_id', new.id)
    );
    perform public.notify_agency(
      'projects.manage', v_project.client_id, 'qa_failed',
      'QA failed: ' || v_project.name,
      new.title || ' did not pass QA. The project needs another development pass.',
      null, null, new.project_id
    );
  elsif new.qa_result = 'pass' then
    insert into public.activity (project_id, actor_id, activity_type, message, metadata)
    values (
      new.project_id, auth.uid(), 'qa_passed',
      v_actor_name || ' passed QA on "' || new.title || '". Project is ready for client review.',
      jsonb_build_object('icon', 'review', 'task_id', new.id)
    );
    perform public.notify_agency(
      'projects.manage', v_project.client_id, 'qa_passed',
      'QA passed: ' || v_project.name,
      'QA passed. ' || v_project.name || ' is ready for client review.',
      null, null, new.project_id
    );
    if v_project.client_id is not null then
      perform public.notify_client_users(
        v_project.client_id, 'client_review_ready',
        'Ready for your review: ' || v_project.name,
        'Your project has passed internal QA and is ready for your review.',
        null, null, new.project_id
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists tasks_notify_qa_result on public.tasks;
create trigger tasks_notify_qa_result
  after update of qa_result on public.tasks
  for each row execute function public.notify_task_qa_result();

revoke all on function public.notify_task_qa_result() from public, anon;

-- ---------------------------------------------------------------------------
-- 8. Launch gate. Launching == flipping project_development.deployment_status
--    to 'Production' -- the same column the app already uses to mean "live
--    in production" (see clientWebsitePhase() in src/data/projectDevelopment.ts).
--    Requires: Overall Design approved, Development complete, QA passed,
--    Client Review completed, Final Website approved, and no invoice for
--    the project left in a non-terminal state. Restricted to Admin/PM
--    (staff_may_coordinate_project), the same audience the existing
--    domain/hosting column guard uses -- a developer with plain
--    projects.manage cannot flip this even though they can edit the rest of
--    the row.
-- ---------------------------------------------------------------------------

create or replace function public.project_client_review_complete(p_project_id uuid)
returns boolean
language sql
stable
as $$
  select coalesce(bool_and(t.status = 'Completed'), false)
  from public.tasks t
  join public.milestones m on m.id = t.milestone_id
  where t.project_id = p_project_id
    and public.milestone_workflow_key(m.name) = 'review'
    and t.task_type = 'client_review'
  having count(*) > 0;
$$;

comment on function public.project_client_review_complete(uuid) is
  'True when the project has at least one client_review-typed task and all of them are Completed. PM/Admin marks a client_review task Completed after the client has approved via the existing feedback/approval flow -- same "staff confirms real evidence" pattern as development_tasks_complete.';

create or replace function public.project_payment_gate_open(p_project_id uuid)
returns boolean
language sql
stable
as $$
  select not exists (
    select 1 from public.invoices
    where project_id = p_project_id
      and status in ('draft', 'sent', 'viewed', 'partially_paid')
  );
$$;

comment on function public.project_payment_gate_open(uuid) is
  'True when no invoice for the project is left in a non-terminal state. A project with zero invoices is not blocked (nothing to require payment on). cancelled is not blocking -- an intentionally voided invoice, not unpaid work. Uses the existing invoices.status enum only; no new payment concept invented.';

create or replace function public.launch_blocking_reasons(p_project_id uuid)
returns text[]
language plpgsql
stable
as $$
declare
  v_reasons text[] := '{}';
begin
  if not public.project_checkpoint_approved(p_project_id, 'overall_design') then
    v_reasons := v_reasons || 'Overall Design is not approved.';
  end if;
  if not public.development_tasks_complete(p_project_id) then
    v_reasons := v_reasons || 'Development is not complete.';
  end if;
  if public.qa_latest_result(p_project_id) is distinct from 'pass' then
    v_reasons := v_reasons || 'QA has not passed.';
  end if;
  if not public.project_client_review_complete(p_project_id) then
    v_reasons := v_reasons || 'Client review is not complete.';
  end if;
  if not public.project_checkpoint_approved(p_project_id, 'final_website') then
    v_reasons := v_reasons || 'The final website has not been approved.';
  end if;
  if not public.project_payment_gate_open(p_project_id) then
    v_reasons := v_reasons || 'An invoice for this project is still outstanding.';
  end if;
  return v_reasons;
end;
$$;

comment on function public.launch_blocking_reasons(uuid) is
  'All reasons this project cannot launch right now, empty array when ready. Single source of truth for both the enforcing trigger and the Admin/PM UI "what is blocking progress" panel -- the UI calls this read-only function rather than re-deriving the rule.';

create or replace function public.enforce_launch_gate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reasons text[];
begin
  if new.deployment_status = 'Production' and old.deployment_status is distinct from 'Production' then
    if not public.staff_may_coordinate_project(new.project_id) then
      raise exception 'Not allowed' using errcode = '42501';
    end if;
    v_reasons := public.launch_blocking_reasons(new.project_id);
    if array_length(v_reasons, 1) > 0 then
      raise exception 'Cannot launch yet: %', array_to_string(v_reasons, ' ') using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

comment on function public.enforce_launch_gate() is
  'Blocks project_development.deployment_status -> Production unless launch_blocking_reasons() is empty and the caller is Admin/PM (staff_may_coordinate_project) -- not any projects.manage staff. Deliberately keys off deployment_status, the same column the app already treats as "site is live" (see clientWebsitePhase()), so this needs no new project-level field.';

drop trigger if exists project_development_launch_gate on public.project_development;
create trigger project_development_launch_gate
  before update on public.project_development
  for each row execute function public.enforce_launch_gate();

revoke all on function public.enforce_launch_gate() from public, anon;
revoke all on function public.project_client_review_complete(uuid) from public, anon;
revoke all on function public.project_payment_gate_open(uuid) from public, anon;
revoke all on function public.launch_blocking_reasons(uuid) from public, anon;

-- Launch-completed notification: fires once, exactly when deployment_status
-- actually becomes Production (the trigger above has already proven every
-- gate was satisfied by the time this AFTER trigger runs).
create or replace function public.notify_launch_completed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project public.projects;
begin
  if new.deployment_status <> 'Production' or old.deployment_status is not distinct from 'Production' then
    return new;
  end if;
  select * into v_project from public.projects where id = new.project_id;
  insert into public.activity (project_id, actor_id, activity_type, message, metadata)
  values (new.project_id, auth.uid(), 'launched', v_project.name || ' has launched.', jsonb_build_object('icon', 'deploy'));
  if v_project.client_id is not null then
    perform public.notify_client_users(
      v_project.client_id, 'launch_completed',
      v_project.name || ' is live!',
      'Your project has launched. Thank you for working with us.',
      null, null, new.project_id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists project_development_notify_launch on public.project_development;
create trigger project_development_notify_launch
  after update on public.project_development
  for each row execute function public.notify_launch_completed();

revoke all on function public.notify_launch_completed() from public, anon;

-- ---------------------------------------------------------------------------
-- 9. Milestone auto-rollup from child tasks. Design and Review milestones
--    are approval-gated: their tasks can all be Completed while the
--    milestone itself is not, because completing tasks is necessary but not
--    sufficient (explicit example in the spec: Design tasks done but
--    Overall Design not approved must not read as milestone Completed).
--    Discovery/Development/Launch roll up on task completion alone -- there
--    is no separate approval concept for those today.
-- ---------------------------------------------------------------------------

create or replace function public.rollup_milestone_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_milestone_id uuid := coalesce(new.milestone_id, old.milestone_id);
  v_key text;
  v_project_id uuid;
  v_total int;
  v_completed int;
  v_gate_open boolean := true;
  v_next_status text;
begin
  if v_milestone_id is null then
    return coalesce(new, old);
  end if;

  select m.name, m.project_id into v_key, v_project_id from public.milestones m where m.id = v_milestone_id;
  v_key := public.milestone_workflow_key(v_key);

  select count(*), count(*) filter (where status = 'Completed')
    into v_total, v_completed
  from public.tasks
  where milestone_id = v_milestone_id;

  if v_key = 'design' then
    v_gate_open := public.project_checkpoint_approved(v_project_id, 'overall_design');
  elsif v_key = 'review' then
    v_gate_open := public.qa_latest_result(v_project_id) is not distinct from 'pass'
      and public.project_client_review_complete(v_project_id);
  end if;

  if v_total = 0 then
    v_next_status := 'Not Started';
  elsif v_completed = 0 then
    v_next_status := 'Not Started';
  elsif v_completed < v_total then
    v_next_status := 'In Progress';
  elsif v_gate_open then
    v_next_status := 'Completed';
  else
    v_next_status := 'In Progress';
  end if;

  update public.milestones set status = v_next_status, updated_at = now()
  where id = v_milestone_id and status is distinct from v_next_status;

  return coalesce(new, old);
end;
$$;

comment on function public.rollup_milestone_status() is
  'Recomputes the owning milestone status from its own child tasks after any task status/milestone change. Design and Review milestones cannot roll up to Completed without their approval gate open (overall_design approved; QA passed + client review complete), per the spec''s explicit example. Auto rollup only -- a PM can still hand-set milestone status via the existing milestones_admin_update policy, and it stands until the next task change recomputes it.';

drop trigger if exists tasks_rollup_milestone on public.tasks;
create trigger tasks_rollup_milestone
  after insert or update of status, milestone_id or delete on public.tasks
  for each row execute function public.rollup_milestone_status();

revoke all on function public.rollup_milestone_status() from public, anon;
