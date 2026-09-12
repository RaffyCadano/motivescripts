-- Four bugs found by a follow-up code review of the production workflow
-- gates (20260930090000) and the earlier agency-settings hardening
-- (20260930060000):

-- ---------------------------------------------------------------------------
-- 1. Launch gate never fired on a project's first save. upsertProjectDevelopment()
--    (src/data/agencyRepository.ts) always calls .upsert(..., { onConflict:
--    'project_id' }) -- when no row exists yet, Postgres runs the BEFORE
--    INSERT path for that statement even though it's logically an upsert,
--    and enforce_launch_gate() was only wired to BEFORE UPDATE. A project
--    with no project_development row yet could be inserted directly with
--    deployment_status = 'Production', skipping every prerequisite check
--    and the Admin/PM-only restriction entirely. The sibling
--    project_development_domain_hosting_guard trigger (20260927000000)
--    already had to solve this exact problem -- this applies the same fix.
-- ---------------------------------------------------------------------------

drop trigger if exists project_development_launch_gate on public.project_development;
create trigger project_development_launch_gate
  before insert or update on public.project_development
  for each row execute function public.enforce_launch_gate();

-- ---------------------------------------------------------------------------
-- 2. The Development/QA/Client-Review gates blocked a task from being
--    marked Blocked, not just from starting real work -- so a task that IS
--    locked (e.g. Development locked behind Overall Design approval)
--    couldn't be marked Blocked with a reason explaining why, which is
--    exactly the scenario the existing blocked_reason feature exists for.
--    Moving TO Blocked is now exempt from all three gates; every other
--    non-Todo transition is still gated exactly as before.
-- ---------------------------------------------------------------------------

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

  if v_milestone_key = 'development' and old.status = 'Todo' and new.status not in ('Todo', 'Blocked') then
    if not public.project_development_legacy_exempt(new.project_id)
       and not public.project_checkpoint_approved(new.project_id, 'overall_design')
    then
      raise exception 'Development is locked until Overall Design is approved.' using errcode = '42501';
    end if;
  end if;

  if v_task_type = 'qa' and old.status = 'Todo' and new.status not in ('Todo', 'Blocked') then
    if not public.development_tasks_complete(new.project_id) then
      raise exception 'QA is locked until Development is complete.' using errcode = '42501';
    end if;
  end if;

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

  if v_task_type = 'client_review' and old.status = 'Todo' and new.status not in ('Todo', 'Blocked') then
    if public.qa_latest_result(new.project_id) is distinct from 'pass' then
      raise exception 'Client Review is locked until QA has passed.' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Milestone rollup only recomputed when a TASK changed, so a Design or
--    Review milestone whose tasks were already all Completed stayed stuck
--    at "In Progress" until some unrelated task edit happened to
--    recompute it -- even though the actual blocker (an approval) had
--    already cleared. Approving/archiving/re-tagging a deliverable now also
--    triggers a rollup of every milestone on that project.
-- ---------------------------------------------------------------------------

create or replace function public.rollup_one_milestone(p_milestone_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text;
  v_project_id uuid;
  v_total int;
  v_completed int;
  v_gate_open boolean := true;
  v_next_status text;
begin
  select m.name, m.project_id into v_key, v_project_id from public.milestones m where m.id = p_milestone_id;
  if v_project_id is null then
    return;
  end if;
  v_key := public.milestone_workflow_key(v_key);

  select count(*), count(*) filter (where status = 'Completed')
    into v_total, v_completed
  from public.tasks
  where milestone_id = p_milestone_id;

  if v_key = 'design' then
    v_gate_open := public.project_checkpoint_approved(v_project_id, 'overall_design');
  elsif v_key = 'review' then
    v_gate_open := public.qa_latest_result(v_project_id) is not distinct from 'pass'
      and public.project_client_review_complete(v_project_id);
  end if;

  if v_total = 0 or v_completed = 0 then
    v_next_status := 'Not Started';
  elsif v_completed < v_total then
    v_next_status := 'In Progress';
  elsif v_gate_open then
    v_next_status := 'Completed';
  else
    v_next_status := 'In Progress';
  end if;

  update public.milestones set status = v_next_status, updated_at = now()
  where id = p_milestone_id and status is distinct from v_next_status;
end;
$$;

create or replace function public.rollup_milestone_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_milestone_id uuid := coalesce(new.milestone_id, old.milestone_id);
begin
  if v_milestone_id is not null then
    perform public.rollup_one_milestone(v_milestone_id);
  end if;
  return coalesce(new, old);
end;
$$;

create or replace function public.rollup_milestones_for_project(p_project_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.rollup_one_milestone(m.id) from public.milestones m where m.project_id = p_project_id;
end;
$$;

create or replace function public.rollup_milestones_on_deliverable_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.rollup_milestones_for_project(new.project_id);
  return new;
end;
$$;

drop trigger if exists deliverables_rollup_milestones on public.deliverables;
create trigger deliverables_rollup_milestones
  after update of status, design_checkpoint on public.deliverables
  for each row execute function public.rollup_milestones_on_deliverable_change();

create or replace function public.rollup_milestones_on_approval_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.rollup_milestones_for_project(new.project_id);
  return new;
end;
$$;

drop trigger if exists approvals_rollup_milestones on public.approvals;
create trigger approvals_rollup_milestones
  after insert on public.approvals
  for each row execute function public.rollup_milestones_on_approval_insert();

revoke all on function public.rollup_one_milestone(uuid) from public, anon;
revoke all on function public.rollup_milestones_for_project(uuid) from public, anon;
revoke all on function public.rollup_milestones_on_deliverable_change() from public, anon;
revoke all on function public.rollup_milestones_on_approval_insert() from public, anon;

-- ---------------------------------------------------------------------------
-- 4. get_agency_settings() was locked to is_admin() in 20260930060000 to
--    stop any active staff member from reading sensitive business info
--    (contact details, Stripe processor label) by navigating straight to
--    /admin/settings. That was correct, but three document-creation pages
--    (New Invoice, New Contract, the Proposal editor) ALSO call it purely
--    to prefill operational defaults (due days, currency, default terms/
--    notes) -- fields non-admin sales/accounting/PM staff legitimately need
--    when creating those documents. Locking the whole row to admin-only
--    silently broke that prefill for everyone else (each caller swallows
--    the resulting error and falls back to generic hardcoded defaults).
--
--    Fix: a narrower RPC exposing only the prefill-relevant default fields
--    (never the sensitive identity/branding ones), gated on actually
--    holding one of the relevant document-management grants. Admin-only
--    get_agency_settings() is unchanged.
-- ---------------------------------------------------------------------------

create or replace function public.get_agency_document_defaults()
returns public.agency_settings
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  row public.agency_settings;
begin
  if not (
    public.is_admin()
    or public.has_grant('proposals.manage')
    or public.has_grant('contracts.manage')
    or public.has_grant('invoices.manage')
  ) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select * into row from public.agency_settings where id = 1;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  -- Blank every field that isn't a document-prefill default -- defense in
  -- depth so a future caller of this RPC can't accidentally read sensitive
  -- business info through it even if it adds a new column read.
  row.agency_name := '';
  row.business_email := '';
  row.phone := '';
  row.website := '';
  row.address := '';
  row.logo_url := '';
  row.primary_color := '';
  row.secondary_color := '';
  row.support_email := '';
  row.email_from_name := '';
  row.email_from_address := '';
  row.email_reply_to := '';
  row.client_portal_welcome_message := '';

  return row;
end;
$$;

revoke all on function public.get_agency_document_defaults() from public, anon;
grant execute on function public.get_agency_document_defaults() to authenticated;

comment on function public.get_agency_document_defaults() is
  'Document-creation prefill defaults only (due days, currency, default terms/notes) for staff with proposals.manage/contracts.manage/invoices.manage -- sensitive fields (contact info, branding, Stripe label) are blanked. Full settings stay behind admin-only get_agency_settings().';
