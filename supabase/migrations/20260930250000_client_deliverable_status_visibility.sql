-- deliverables_select_own / file_versions_select_own (20260828140000) only
-- checked ownership (owns_project / owns_deliverable), never status. The app
-- itself already defines which statuses a client should see -- Draft and
-- Archived are excluded (isClientVisibleDeliverable() in src/data/review.ts)
-- -- but that was only enforced in the frontend. A client's own session
-- token could read Draft deliverable/file-version metadata for their own
-- project directly via the API before the agency intends to share it.
--
-- Fix at the RLS layer, same defense-in-depth approach as the
-- tasks_select_own client-visibility fix: add a status check to the client
-- SELECT policies. owns_deliverable()/owns_project() are left untouched
-- since they're also used for non-status-gated purposes (write-path checks
-- where status gating is handled by business logic instead). Admin/staff
-- SELECT policies (deliverables_admin_select, file_versions_admin_select)
-- are untouched -- staff must still see Draft items.

create or replace function public.deliverable_client_visible(p_deliverable_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.deliverables d
    where d.id = p_deliverable_id
      and d.status in ('In Review', 'Needs Changes', 'Approved')
  );
$$;

comment on function public.deliverable_client_visible(uuid) is
  'Mirrors isClientVisibleDeliverable() in src/data/review.ts -- Draft and Archived are never client-visible. Used to gate client SELECT access at the RLS layer, not just in the UI.';

revoke all on function public.deliverable_client_visible(uuid) from public, anon;
grant execute on function public.deliverable_client_visible(uuid) to authenticated;

drop policy if exists deliverables_select_own on public.deliverables;
create policy deliverables_select_own
  on public.deliverables
  for select
  to authenticated
  using (
    public.owns_project(project_id)
    and status in ('In Review', 'Needs Changes', 'Approved')
  );

drop policy if exists file_versions_select_own on public.file_versions;
create policy file_versions_select_own
  on public.file_versions
  for select
  to authenticated
  using (
    public.owns_deliverable(deliverable_id)
    and public.deliverable_client_visible(deliverable_id)
  );
