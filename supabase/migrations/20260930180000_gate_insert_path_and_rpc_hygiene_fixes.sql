-- Follow-up review found 5 more gaps in the workflow-gate migrations:

-- ---------------------------------------------------------------------------
-- 1 & 4. tasks_workflow_gate only fired on UPDATE, so a task created
--    directly at an actionable status (e.g. a qa/client_review task
--    inserted as 'Completed' via the admin Add Task modal) bypassed every
--    gate and the "QA needs a verdict" check entirely -- the exact same
--    class of bug 20260930160000 already fixed for the launch gate.
--    Separately, reassigning an already-in-progress task's milestone (or
--    task_type) into a gated category without touching its status also
--    skipped the gate, since the check only looked at the status
--    transition. Both are fixed by checking gate-worthiness on (a) a task
--    entering an actionable status from Todo/Blocked/nothing (insert), or
--    (b) an already-actionable task being reclassified into a gated
--    milestone/task_type.
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
  v_old_status text := case when TG_OP = 'INSERT' then null else old.status end;
  v_old_milestone_id uuid := case when TG_OP = 'INSERT' then null else old.milestone_id end;
  v_old_task_type text := case when TG_OP = 'INSERT' then null else old.task_type end;
  v_status_entering boolean;
  v_reclassified boolean;
  v_check_gate boolean;
begin
  select public.milestone_workflow_key(m.name) into v_milestone_key
  from public.milestones m
  where m.id = new.milestone_id;

  v_status_entering := new.status in ('In Progress', 'In Review', 'Completed')
    and (v_old_status is null or v_old_status in ('Todo', 'Blocked'));
  v_reclassified := TG_OP = 'UPDATE'
    and new.status in ('In Progress', 'In Review', 'Completed')
    and (
      v_old_milestone_id is distinct from new.milestone_id
      or coalesce(v_old_task_type, '') is distinct from coalesce(new.task_type, '')
    );
  v_check_gate := v_status_entering or v_reclassified;

  if v_milestone_key = 'development' and v_check_gate then
    if not public.project_development_legacy_exempt(new.project_id)
       and not public.project_checkpoint_approved(new.project_id, 'overall_design')
    then
      raise exception 'Development is locked until Overall Design is approved.' using errcode = '42501';
    end if;
  end if;

  if v_task_type = 'qa' and v_check_gate then
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

  if v_task_type = 'client_review' and v_check_gate then
    if public.qa_latest_result(new.project_id) is distinct from 'pass' then
      raise exception 'Client Review is locked until QA has passed.' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists tasks_workflow_gate on public.tasks;
create trigger tasks_workflow_gate
  before insert or update on public.tasks
  for each row execute function public.enforce_task_workflow_gate();

-- ---------------------------------------------------------------------------
-- 2. notify_launch_completed was still AFTER UPDATE only, so the activity
--    log entry and "your site is live" client notification never fired for
--    a launch that took the (now legitimate, since 20260930160000) INSERT
--    path. The function body already handles OLD being null correctly
--    (IS NOT DISTINCT FROM treats it as "was not Production"); only the
--    trigger definition needed the same insert-or-update fix as the gate.
-- ---------------------------------------------------------------------------

drop trigger if exists project_development_notify_launch on public.project_development;
create trigger project_development_notify_launch
  after insert or update on public.project_development
  for each row execute function public.notify_launch_completed();

-- ---------------------------------------------------------------------------
-- 3. 20260930100000 added a 4th parameter to update_my_task_status without
--    dropping the old 3-parameter signature first (unlike 20260930050000,
--    which explicitly did this when it went from 2 to 3 params, specifically
--    to avoid PostgREST overload ambiguity) and without the
--    revoke-from-public-then-grant-to-authenticated hardening every other
--    RPC here gets. Confirmed live: both the 3-arg and 4-arg versions exist
--    in Sandbox right now, and the 4-arg one is still reachable by anon at
--    the grant layer (contained today only by its own internal
--    is_admin()/is_active_staff() check, not by GRANT). Cleaning up both.
-- ---------------------------------------------------------------------------

drop function if exists public.update_my_task_status(uuid, text, text);

revoke all on function public.update_my_task_status(uuid, text, text, text) from public, anon;
grant execute on function public.update_my_task_status(uuid, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. get_agency_document_defaults() built its safe result by SELECT * then
--    blanking a denylist of sensitive columns -- a future agency_settings
--    column would leak through it by default unless someone remembered to
--    add it to that list. Rebuilt as an allowlist: every field starts null
--    and only the document-prefill fields are explicitly copied over, so a
--    new column is blank (safe) here until someone deliberately adds it.
-- ---------------------------------------------------------------------------

create or replace function public.get_agency_document_defaults()
returns public.agency_settings
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  src public.agency_settings;
  out_row public.agency_settings;
begin
  if not (
    public.is_admin()
    or public.has_grant('proposals.manage')
    or public.has_grant('contracts.manage')
    or public.has_grant('invoices.manage')
  ) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select * into src from public.agency_settings where id = 1;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  out_row.id := src.id;
  out_row.currency := src.currency;
  out_row.default_proposal_valid_days := src.default_proposal_valid_days;
  out_row.default_proposal_introduction := src.default_proposal_introduction;
  out_row.default_proposal_overview := src.default_proposal_overview;
  out_row.default_proposal_scope := src.default_proposal_scope;
  out_row.default_proposal_deliverables := src.default_proposal_deliverables;
  out_row.default_proposal_timeline := src.default_proposal_timeline;
  out_row.default_proposal_payment_terms := src.default_proposal_payment_terms;
  out_row.default_proposal_terms := src.default_proposal_terms;
  out_row.default_proposal_notes := src.default_proposal_notes;
  out_row.default_contract_terms := src.default_contract_terms;
  out_row.default_invoice_due_days := src.default_invoice_due_days;
  out_row.default_invoice_payment_terms := src.default_invoice_payment_terms;
  out_row.default_invoice_notes := src.default_invoice_notes;
  out_row.default_proposal_website_cents := src.default_proposal_website_cents;
  out_row.default_addon_quote_request_form_cents := src.default_addon_quote_request_form_cents;
  out_row.default_addon_booking_form_cents := src.default_addon_booking_form_cents;
  out_row.default_addon_social_media_cents := src.default_addon_social_media_cents;
  out_row.default_addon_business_email_cents := src.default_addon_business_email_cents;
  out_row.default_addon_domain_cents := src.default_addon_domain_cents;
  out_row.default_addon_hosting_setup_cents := src.default_addon_hosting_setup_cents;
  out_row.updated_at := src.updated_at;

  return out_row;
end;
$$;

revoke all on function public.get_agency_document_defaults() from public, anon;
grant execute on function public.get_agency_document_defaults() to authenticated;
