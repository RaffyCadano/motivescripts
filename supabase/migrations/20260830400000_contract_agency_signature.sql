-- Agency must sign a contract draft before it can be sent.
-- Client portal acceptance and optional signed-copy upload stay separate.

alter table public.contract_revisions
  add column if not exists agency_signed_at timestamptz,
  add column if not exists agency_signed_by uuid references auth.users (id) on delete set null,
  add column if not exists agency_signed_name text not null default '',
  add column if not exists agency_signed_email text not null default '';

comment on column public.contract_revisions.agency_signed_at is
  'When an authorized MotiveScripts user signed/approved this revision. Null until signed. Independent of client acceptance.';
comment on column public.contract_revisions.agency_signed_by is
  'auth.users.id of the agency representative who signed.';
comment on column public.contract_revisions.agency_signed_name is
  'Display name recorded at agency signature time.';
comment on column public.contract_revisions.agency_signed_email is
  'Email recorded at agency signature time.';

alter table public.contracts
  add column if not exists client_signed_copy_path text,
  add column if not exists client_signed_copy_file_name text not null default '',
  add column if not exists client_signed_copy_mime_type text not null default '',
  add column if not exists client_signed_copy_size bigint not null default 0,
  add column if not exists client_signed_copy_uploaded_at timestamptz,
  add column if not exists client_signed_copy_uploaded_by uuid references auth.users (id) on delete set null;

comment on column public.contracts.client_signed_copy_path is
  'Optional client-uploaded signed copy in the project-files bucket. Not the same as portal acceptance.';

create or replace function public.guard_contract_revision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  content_changed boolean;
  signature_changed boolean;
begin
  if tg_op = 'DELETE' then
    if not public.document_rpc_active() then
      raise exception 'Not allowed' using errcode = '42501';
    end if;
    return old;
  end if;
  if old.status <> 'draft' and not public.document_rpc_active() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if new.status is distinct from old.status and not public.document_rpc_active() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if new.contract_id is distinct from old.contract_id or new.revision_number is distinct from old.revision_number then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  content_changed :=
    new.title is distinct from old.title
    or new.parties is distinct from old.parties
    or new.scope is distinct from old.scope
    or new.responsibilities is distinct from old.responsibilities
    or new.timeline is distinct from old.timeline
    or new.compensation is distinct from old.compensation
    or new.payment_terms is distinct from old.payment_terms
    or new.confidentiality is distinct from old.confidentiality
    or new.intellectual_property is distinct from old.intellectual_property
    or new.revisions_policy is distinct from old.revisions_policy
    or new.termination is distinct from old.termination
    or new.general_terms is distinct from old.general_terms
    or new.effective_date is distinct from old.effective_date
    or new.expires_at is distinct from old.expires_at;

  if content_changed and old.status = 'draft' and not public.document_rpc_active() then
    new.agency_signed_at := null;
    new.agency_signed_by := null;
    new.agency_signed_name := '';
    new.agency_signed_email := '';
  end if;

  signature_changed :=
    new.agency_signed_at is distinct from old.agency_signed_at
    or new.agency_signed_by is distinct from old.agency_signed_by
    or new.agency_signed_name is distinct from old.agency_signed_name
    or new.agency_signed_email is distinct from old.agency_signed_email;

  if signature_changed and not public.document_rpc_active() then
    if new.agency_signed_at is not null or new.agency_signed_by is not null then
      raise exception 'Not allowed' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.sign_contract(p_contract_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  doc public.contracts;
  rev public.contract_revisions;
  signer_name text;
  signer_email text;
begin
  if public.is_client() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select * into doc from public.contracts where id = p_contract_id for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  perform public.assert_client_perm(doc.client_id, 'contracts.manage');
  select * into rev from public.contract_revisions where id = doc.working_revision_id for update;
  if not found or rev.status <> 'draft' then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;

  select
    coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.email), ''), 'MotiveScripts representative'),
    coalesce(nullif(trim(p.email), ''), '')
  into signer_name, signer_email
  from public.profiles p
  where p.id = auth.uid();

  if signer_name is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  perform set_config('app.document_rpc', '1', true);
  update public.contract_revisions
    set agency_signed_at = now(),
        agency_signed_by = auth.uid(),
        agency_signed_name = signer_name,
        agency_signed_email = signer_email
  where id = rev.id;

  perform public.record_document_activity(
    doc.client_id,
    doc.project_id,
    'contract_agency_signed',
    'Contract ' || doc.contract_number || ' signed by MotiveScripts'
  );
end;
$$;

create or replace function public.send_contract(p_contract_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  doc public.contracts;
  rev public.contract_revisions;
  snap jsonb;
begin
  select * into doc from public.contracts where id = p_contract_id for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  perform public.assert_client_perm(doc.client_id, 'contracts.manage');
  select * into rev from public.contract_revisions where id = doc.working_revision_id for update;
  if rev.status <> 'draft' then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;
  if rev.agency_signed_at is null then
    raise exception 'AGENCY_SIGNATURE_REQUIRED' using errcode = 'P0001';
  end if;
  if length(trim(rev.title)) = 0 or length(trim(rev.parties)) = 0 or length(trim(rev.scope)) = 0 then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;
  if rev.expires_at is null then
    rev.expires_at := current_date + 30;
  end if;
  if rev.expires_at < current_date then
    raise exception 'EXPIRED' using errcode = 'P0001';
  end if;
  perform set_config('app.document_rpc', '1', true);
  snap := jsonb_build_object(
    'title', rev.title,
    'parties', rev.parties,
    'scope', rev.scope,
    'responsibilities', rev.responsibilities,
    'timeline', rev.timeline,
    'compensation', rev.compensation,
    'payment_terms', rev.payment_terms,
    'confidentiality', rev.confidentiality,
    'intellectual_property', rev.intellectual_property,
    'revisions_policy', rev.revisions_policy,
    'termination', rev.termination,
    'general_terms', rev.general_terms,
    'effective_date', rev.effective_date,
    'expires_at', rev.expires_at,
    'agency_signed_at', rev.agency_signed_at,
    'agency_signed_by', rev.agency_signed_by,
    'agency_signed_name', rev.agency_signed_name,
    'agency_signed_email', rev.agency_signed_email
  );
  if doc.published_revision_id is not null and doc.published_revision_id is distinct from rev.id then
    update public.contract_revisions
      set status = 'cancelled'
    where id = doc.published_revision_id
      and status in ('sent', 'viewed', 'expired');
  end if;
  update public.contract_revisions
    set status = 'sent', sent_at = now(), snapshot = snap, expires_at = rev.expires_at
  where id = rev.id;
  update public.contracts
    set published_revision_id = rev.id, working_revision_id = rev.id
  where id = doc.id;
  perform public.record_document_activity(doc.client_id, doc.project_id, 'contract_sent', 'Contract ' || doc.contract_number || ' sent');
  perform public.notify_document(
    'client', doc.client_id, 'contract_ready',
    'Contract ready for review',
    coalesce(nullif(trim(rev.title), ''), doc.contract_number) || ' is ready to review.',
    doc.project_id, doc.proposal_id, doc.id
  );
end;
$$;

create or replace function public.storage_contract_id(object_name text)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  parts text[];
  cid uuid;
begin
  if object_name is null then
    return null;
  end if;
  parts := string_to_array(object_name, '/');
  if array_length(parts, 1) <> 4 then
    return null;
  end if;
  if parts[1] <> 'contracts' or parts[3] <> 'signed-copy' then
    return null;
  end if;
  if parts[4] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|png|jpe?g|webp)$' then
    return null;
  end if;
  begin
    cid := parts[2]::uuid;
  exception when invalid_text_representation then
    return null;
  end;
  return cid;
end;
$$;

create or replace function public.can_access_contract_signed_copy(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  cid uuid;
  owner uuid;
begin
  cid := public.storage_contract_id(object_name);
  if cid is null then
    return false;
  end if;
  select client_id into owner from public.contracts where id = cid;
  if owner is null then
    return false;
  end if;
  if public.staff_may_client(owner, 'contracts.view') then
    return true;
  end if;
  return public.is_client() and public.current_client_id() is not distinct from owner;
end;
$$;

create or replace function public.can_upload_contract_signed_copy(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  cid uuid;
  doc public.contracts;
  st text;
begin
  if not public.is_client() then
    return false;
  end if;
  cid := public.storage_contract_id(object_name);
  if cid is null then
    return false;
  end if;
  select * into doc from public.contracts where id = cid;
  if not found or doc.client_id is distinct from public.current_client_id() or doc.published_revision_id is null then
    return false;
  end if;
  select status into st from public.contract_revisions where id = doc.published_revision_id;
  return st in ('sent', 'viewed', 'accepted');
end;
$$;

create or replace function public.register_contract_signed_copy(
  p_contract_id uuid,
  p_storage_path text,
  p_file_name text,
  p_mime_type text,
  p_file_size bigint
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  doc public.contracts;
  st text;
  previous_path text;
begin
  if not public.is_client() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if public.storage_contract_id(p_storage_path) is distinct from p_contract_id then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if coalesce(p_file_size, 0) <= 0 or p_file_size > 52428800 then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;
  if coalesce(nullif(trim(p_file_name), ''), '') = '' then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;

  select * into doc from public.contracts where id = p_contract_id for update;
  if not found or doc.client_id is distinct from public.current_client_id() or doc.published_revision_id is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select status into st from public.contract_revisions where id = doc.published_revision_id;
  if st not in ('sent', 'viewed', 'accepted') then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;

  previous_path := doc.client_signed_copy_path;
  update public.contracts
    set client_signed_copy_path = p_storage_path,
        client_signed_copy_file_name = trim(p_file_name),
        client_signed_copy_mime_type = coalesce(p_mime_type, ''),
        client_signed_copy_size = p_file_size,
        client_signed_copy_uploaded_at = now(),
        client_signed_copy_uploaded_by = auth.uid()
  where id = doc.id;

  perform public.record_document_activity(
    doc.client_id,
    doc.project_id,
    'contract_signed_copy_uploaded',
    'Signed copy uploaded for contract ' || doc.contract_number
  );
  return previous_path;
end;
$$;

drop policy if exists contract_signed_copy_select on storage.objects;
create policy contract_signed_copy_select
  on storage.objects for select to authenticated
  using (
    bucket_id = 'project-files'
    and public.can_access_contract_signed_copy(name)
  );

drop policy if exists contract_signed_copy_insert on storage.objects;
create policy contract_signed_copy_insert
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'project-files'
    and public.can_upload_contract_signed_copy(name)
  );

drop policy if exists contract_signed_copy_delete on storage.objects;
create policy contract_signed_copy_delete
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'project-files'
    and public.can_upload_contract_signed_copy(name)
  );

revoke all on function public.sign_contract(uuid) from public, anon;
revoke all on function public.register_contract_signed_copy(uuid, text, text, text, bigint) from public, anon;
revoke all on function public.storage_contract_id(text) from public, anon;
revoke all on function public.can_access_contract_signed_copy(text) from public, anon;
revoke all on function public.can_upload_contract_signed_copy(text) from public, anon;

grant execute on function public.sign_contract(uuid) to authenticated;
grant execute on function public.register_contract_signed_copy(uuid, text, text, text, bigint) to authenticated;
grant execute on function public.storage_contract_id(text) to authenticated;
grant execute on function public.can_access_contract_signed_copy(text) to authenticated;
grant execute on function public.can_upload_contract_signed_copy(text) to authenticated;
