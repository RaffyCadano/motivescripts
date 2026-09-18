-- When a client approves a deliverable's current version, any client_review
-- task explicitly linked to that exact deliverable (tasks.deliverable_id,
-- set via the existing set_task_deliverable() / TaskDeliverableSection.tsx
-- "linked deliverable" picker) should complete automatically instead of
-- requiring a PM/Admin to notice and flip it by hand.
--
-- This deliberately does NOT match tasks by title text or by "any
-- client_review task in the project's review milestone" -- deliverable_id is
-- the one stable, explicit, already-existing relationship for "which
-- deliverable does this task represent" (see TaskDeliverableSection.tsx's
-- own mismatch warning: a task marked Completed whose linked deliverable
-- isn't Approved). If a project's client_review task was never linked to a
-- deliverable, this intentionally does nothing for it -- there is no
-- reliable way to guess which task it should be, and guessing wrong would
-- complete the wrong thing.
--
-- Only redefines client_approve_current_version (create or replace, new
-- migration -- 20260828140000 is left untouched) to add one update after
-- the existing deliverable-approval logic.

create or replace function public.client_approve_current_version(p_deliverable_id uuid)
returns public.approvals
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  owned_client uuid := public.current_client_id();
  deliverable public.deliverables;
  project public.projects;
  version public.file_versions;
  actor_name text;
  created public.approvals;
begin
  if not public.is_client() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select * into deliverable
  from public.deliverables
  where id = p_deliverable_id
  for update;

  if not found then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select * into project from public.projects where id = deliverable.project_id;
  if not found or project.client_id is distinct from owned_client then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  if deliverable.status <> 'In Review' then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select * into version
  from public.file_versions
  where deliverable_id = deliverable.id
    and is_current
  for update;

  if not found then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  if exists (select 1 from public.approvals where version_id = version.id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select coalesce(nullif(trim(full_name), ''), 'Client')
    into actor_name
  from public.profiles
  where id = uid;

  insert into public.approvals (
    project_id,
    deliverable_id,
    version_id,
    client_id,
    status,
    approved_by,
    approved_by_name,
    approved_at
  )
  values (
    project.id,
    deliverable.id,
    version.id,
    owned_client,
    'Approved',
    uid,
    actor_name,
    now()
  )
  returning * into created;

  update public.deliverables
    set status = 'Approved',
        archived_at = null,
        updated_at = now()
  where id = deliverable.id;

  -- New: auto-complete any client_review task explicitly linked to this
  -- exact deliverable. Scoped to task_type = 'client_review' so linking a
  -- deliverable to, say, a QA or production task never auto-completes it --
  -- only the review-checkpoint task type this priority is about.
  --
  -- Best-effort: enforce_task_workflow_gate() (20260930090000) requires
  -- qa_latest_result = 'pass' before a client_review task can leave 'Todo'.
  -- In the normal workflow that's already true by the time a deliverable
  -- reaches "In Review", but this is a side effect of the client's approval,
  -- not its purpose -- an unusual project state here must never roll back
  -- the approval itself, so any exception from this update is swallowed.
  begin
    update public.tasks
      set status = 'Completed',
          completed_at = now(),
          updated_at = now()
    where deliverable_id = deliverable.id
      and task_type = 'client_review'
      and status <> 'Completed';
  exception when others then
    raise warning 'client_review task auto-complete failed for deliverable %: %', deliverable.id, sqlerrm;
  end;

  insert into public.activity (project_id, actor_id, activity_type, message, metadata)
  values (
    project.id,
    uid,
    'version_approved',
    deliverable.name || ' v' || version.version_number || ' approved.',
    jsonb_build_object('icon', 'review', 'deliverable_id', deliverable.id, 'version_id', version.id)
  );

  update public.projects set last_activity_at = now() where id = project.id;

  return created;
end;
$$;

comment on function public.client_approve_current_version(uuid) is
  'Client approves the current version of a deliverable. Also auto-completes any client_review-typed task explicitly linked to that deliverable via tasks.deliverable_id -- added 20260930260000, see that migration for why deliverable_id (not title/milestone matching) is the identifier used.';
