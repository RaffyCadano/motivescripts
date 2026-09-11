-- Phase 21: low-risk database hardening from the audit.
--
-- 1. FK on-delete behavior. pin_comments.created_by/resolved_by and
--    time_entries.created_by were all NO ACTION (the default) -- the same
--    shape of bug already fixed once this session for payroll_payments.
--    staff_id (time_entries) and version_id/deliverable_id/project_id/
--    client_id (pin_comments) already cascade; created_by/resolved_by were
--    the two columns left behind on each table.
--    - created_by on both tables is NOT NULL, so ON DELETE SET NULL isn't
--      applicable without a nullability change this migration doesn't make.
--      CASCADE matches the table's other strong-ownership FKs instead, and
--      in practice time_entries.created_by is always equal to staff_id
--      (enforced by RLS), which already cascades -- this just closes the
--      same gap directly instead of relying on that coincidence.
--    - pin_comments.resolved_by IS nullable, so SET NULL applies cleanly:
--      deleting whoever resolved a pin shouldn't block deleting their
--      account, and the pin itself should survive as still-resolved.
--
-- 2. Indexes on FK columns with a clear query use-case: time_entries lookups
--    by task/invoice, and notifications lookups by the columns purge_workspace
--    already scans directly (project_id, deliverable_id, message_id,
--    conversation_id), plus invoices.proposal_id (the one FK column on
--    invoices that had no index at all).

alter table public.time_entries drop constraint time_entries_created_by_fkey;
alter table public.time_entries
  add constraint time_entries_created_by_fkey
  foreign key (created_by) references public.profiles(id) on delete cascade;

alter table public.pin_comments drop constraint pin_comments_created_by_fkey;
alter table public.pin_comments
  add constraint pin_comments_created_by_fkey
  foreign key (created_by) references public.profiles(id) on delete cascade;

alter table public.pin_comments drop constraint pin_comments_resolved_by_fkey;
alter table public.pin_comments
  add constraint pin_comments_resolved_by_fkey
  foreign key (resolved_by) references public.profiles(id) on delete set null;

create index if not exists time_entries_task_id_idx on public.time_entries (task_id) where task_id is not null;
create index if not exists time_entries_invoice_id_idx on public.time_entries (invoice_id) where invoice_id is not null;

create index if not exists notifications_project_id_idx on public.notifications (project_id) where project_id is not null;
create index if not exists notifications_deliverable_id_idx on public.notifications (deliverable_id) where deliverable_id is not null;
create index if not exists notifications_message_id_idx on public.notifications (message_id) where message_id is not null;
create index if not exists notifications_conversation_id_idx on public.notifications (conversation_id) where conversation_id is not null;

create index if not exists invoices_proposal_id_idx on public.invoices (proposal_id) where proposal_id is not null;
