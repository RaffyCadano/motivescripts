-- Permanently remove a project that has no proposals, contracts, or invoices.

create or replace function public.delete_project(p_project_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  proj public.projects;
  document_count integer;
begin
  select * into proj from public.projects where id = p_project_id for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  perform public.assert_project_perm(proj.id, 'projects.manage');

  select
    (select count(*) from public.proposals where project_id = proj.id) +
    (select count(*) from public.contracts where project_id = proj.id) +
    (select count(*) from public.invoices where project_id = proj.id)
  into document_count;
  if document_count > 0 then
    raise exception 'HAS_DOCUMENTS' using errcode = 'P0001';
  end if;

  delete from public.feedback where project_id = proj.id;
  delete from public.approvals where project_id = proj.id;
  delete from public.file_versions
  where deliverable_id in (select id from public.deliverables where project_id = proj.id);
  delete from public.deliverables where project_id = proj.id;
  delete from public.tasks where project_id = proj.id;
  delete from public.milestones where project_id = proj.id;
  delete from public.activity where project_id = proj.id;

  update public.conversations set project_id = null where project_id = proj.id;
  update public.notifications set project_id = null where project_id = proj.id;

  delete from public.projects where id = proj.id;
end;
$$;

grant execute on function public.delete_project(uuid) to authenticated;
