-- Audit finding (Phase 7, partial): the three design checkpoints (Initial
-- Design/Concept, Logo/Brand Approval, Overall Website Design Approval) are
-- identified today only by free-form deliverable name/category text (e.g.
-- staff naming a deliverable "Website Design"). That's fragile -- nothing
-- stops a typo or a differently-named deliverable from silently not being
-- "the" checkpoint a later process might need to check.
--
-- This adds a stable, optional identifier so staff can explicitly tag which
-- deliverable IS one of the three checkpoints, without inventing a new
-- approval system -- it's still the existing deliverables/file_versions/
-- feedback/approvals flow end to end. Nullable and additive: every existing
-- deliverable is unaffected (design_checkpoint defaults to null, meaning
-- "not a checkpoint," exactly like today).
--
-- Deliberately NOT wired to gate anything yet (see implementation report --
-- that requires a product decision on gating mechanics and historical-data
-- backfill that this migration does not make for you).

alter table public.deliverables
  add column if not exists design_checkpoint text
  check (design_checkpoint is null or design_checkpoint in ('initial_concept', 'logo_brand', 'overall_design'));

comment on column public.deliverables.design_checkpoint is
  'Optional stable tag identifying this deliverable as one of the three design approval checkpoints. Null for every ordinary deliverable. Informational only today -- not wired to any gate.';

-- At most one deliverable per project per checkpoint, so "the Overall
-- Website Design deliverable" is unambiguous if something ever needs to
-- look it up.
create unique index if not exists deliverables_project_checkpoint_uidx
  on public.deliverables (project_id, design_checkpoint)
  where design_checkpoint is not null;
