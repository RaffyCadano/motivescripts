-- MotiveScripts Phase 11 — file storage metadata + private bucket
-- Binary files live in Storage. PostgreSQL stores path + metadata only.
-- Storage access is development/preview compatible and will be tightened
-- during Phase 12 when real client authentication exists.

alter table public.file_versions
  add column if not exists storage_path text,
  add column if not exists mime_type text not null default '';

comment on column public.file_versions.storage_path is
  'Object path in the private project-files bucket. Null means no binary has been uploaded (seed/demo metadata).';
comment on column public.file_versions.file_name is
  'Original uploaded file name. Not used as the Storage object name.';
comment on column public.file_versions.mime_type is
  'Browser-reported MIME type at upload time.';

create unique index if not exists file_versions_storage_path_uidx
  on public.file_versions (storage_path)
  where storage_path is not null;

insert into storage.buckets (id, name, public, file_size_limit)
values ('project-files', 'project-files', false, 52428800)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit;

drop policy if exists project_files_select_dev on storage.objects;
drop policy if exists project_files_insert_dev on storage.objects;
drop policy if exists project_files_delete_dev on storage.objects;

-- TEMPORARY: Client Portal is still previewable without login, so anon must
-- read/write the same objects as authenticated admin users.
-- Do not make the bucket public. Replace these policies in Phase 12.
create policy project_files_select_dev
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'project-files');

create policy project_files_insert_dev
  on storage.objects
  for insert
  to anon, authenticated
  with check (
    bucket_id = 'project-files'
    and name like 'projects/%/deliverables/%/versions/%/file.%'
  );

create policy project_files_delete_dev
  on storage.objects
  for delete
  to anon, authenticated
  using (
    bucket_id = 'project-files'
    and name like 'projects/%/deliverables/%/versions/%/file.%'
  );

comment on policy project_files_select_dev on storage.objects is
  'TEMPORARY preview access. Tighten to authenticated project owners in Phase 12.';

drop function if exists public.create_file_version(uuid, text, text, bigint, text, text);

create or replace function public.create_file_version(
  p_deliverable_id uuid,
  p_file_name text,
  p_file_type text,
  p_file_size bigint,
  p_description text,
  p_uploaded_by text default 'You',
  p_version_id uuid default null,
  p_storage_path text default null,
  p_mime_type text default ''
)
returns public.file_versions
language plpgsql
security invoker
set search_path = public
as $$
declare
  next_number integer;
  created public.file_versions;
  deliverable_status text;
  deliverable_name text;
  project uuid;
begin
  select status, name, project_id
    into deliverable_status, deliverable_name, project
  from public.deliverables
  where id = p_deliverable_id
  for update;

  if not found then
    raise exception 'Deliverable not found';
  end if;
  if deliverable_status = 'Archived' then
    raise exception 'Archived deliverables cannot receive versions';
  end if;

  select coalesce(max(version_number), 0) + 1
    into next_number
  from public.file_versions
  where deliverable_id = p_deliverable_id;

  update public.file_versions
    set is_current = false
  where deliverable_id = p_deliverable_id
    and is_current;

  insert into public.file_versions (
    id,
    deliverable_id,
    version_number,
    label,
    description,
    is_current,
    file_name,
    file_type,
    file_size,
    uploaded_by,
    storage_path,
    mime_type
  )
  values (
    coalesce(p_version_id, gen_random_uuid()),
    p_deliverable_id,
    next_number,
    'v' || next_number,
    coalesce(p_description, ''),
    true,
    coalesce(p_file_name, ''),
    coalesce(p_file_type, 'Other'),
    coalesce(p_file_size, 0),
    coalesce(p_uploaded_by, 'You'),
    p_storage_path,
    coalesce(p_mime_type, '')
  )
  returning * into created;

  update public.deliverables
    set status = 'Draft',
        archived_at = null,
        updated_at = now()
  where id = p_deliverable_id;

  insert into public.activity (project_id, activity_type, message, metadata)
  values (
    project,
    'version_created',
    deliverable_name || ' v' || next_number || ' created.',
    jsonb_build_object(
      'icon', 'file',
      'deliverable_id', p_deliverable_id,
      'version_id', created.id,
      'storage_path', created.storage_path
    )
  );

  update public.projects set last_activity_at = now() where id = project;

  return created;
end;
$$;

grant execute on function public.create_file_version(uuid, text, text, bigint, text, text, uuid, text, text)
  to anon, authenticated;
