-- Two related bugs found by code review:
--
-- 1. deliverables_project_checkpoint_uidx (from
--    20260930040000_deliverable_design_checkpoint.sql) is a partial unique
--    index on (project_id, design_checkpoint) WHERE design_checkpoint IS NOT
--    NULL. It does not exclude archived deliverables, so once an
--    overall_design/final_website-tagged deliverable is archived (its
--    design_checkpoint is not cleared on archive), staff can never tag a
--    replacement deliverable with the same checkpoint -- the unique index
--    rejects it. Fixed by excluding archived rows from the uniqueness rule,
--    so re-tagging after archiving is allowed again.
--
-- 2. project_checkpoint_approved() (from
--    20260930090000_production_workflow_gates.sql), the function the
--    Development and Launch gates use to check "is this checkpoint
--    approved", did not exclude archived deliverables either. Once fix #1
--    allows a second deliverable to carry the same checkpoint, an archived
--    one with a stale approval could make the gate see "approved" even
--    though the real, current deliverable for that checkpoint is not.

drop index if exists deliverables_project_checkpoint_uidx;
create unique index deliverables_project_checkpoint_uidx
  on public.deliverables (project_id, design_checkpoint)
  where design_checkpoint is not null and status <> 'Archived';

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
      and d.status <> 'Archived'
  );
$$;

revoke all on function public.project_checkpoint_approved(uuid, text) from public, anon;
