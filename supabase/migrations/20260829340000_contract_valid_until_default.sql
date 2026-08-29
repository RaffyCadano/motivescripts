-- New contract drafts default Valid until to 30 calendar days.

create or replace function public.contract_revision_default_expires()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.expires_at is null then
    new.expires_at := current_date + 30;
  end if;
  return new;
end;
$$;

drop trigger if exists contract_revisions_default_expires on public.contract_revisions;
create trigger contract_revisions_default_expires
  before insert on public.contract_revisions
  for each row execute function public.contract_revision_default_expires();

create or replace function public.create_contract_revision(p_contract_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  doc public.contracts;
  pub public.contract_revisions;
  work public.contract_revisions;
  rid uuid;
  next_n integer;
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select * into doc from public.contracts where id = p_contract_id;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  select * into work from public.contract_revisions where id = doc.working_revision_id;
  if work.status = 'draft' then
    raise exception 'DRAFT_EXISTS' using errcode = 'P0001';
  end if;
  if work.status = 'accepted' then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;
  if doc.published_revision_id is null then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;
  select * into pub from public.contract_revisions where id = doc.published_revision_id;
  perform set_config('app.document_rpc', '1', true);
  select coalesce(max(revision_number), 0) + 1 into next_n
  from public.contract_revisions where contract_id = doc.id;
  insert into public.contract_revisions (
    contract_id, revision_number, status, title, parties, scope, responsibilities, timeline,
    compensation, payment_terms, confidentiality, intellectual_property, revisions_policy,
    termination, general_terms, effective_date, expires_at, created_by
  )
  values (
    doc.id, next_n, 'draft', pub.title, pub.parties, pub.scope, pub.responsibilities, pub.timeline,
    pub.compensation, pub.payment_terms, pub.confidentiality, pub.intellectual_property,
    pub.revisions_policy, pub.termination, pub.general_terms, pub.effective_date, current_date + 30, auth.uid()
  )
  returning id into rid;
  update public.contracts set working_revision_id = rid where id = doc.id;
  return rid;
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
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select * into doc from public.contracts where id = p_contract_id for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  select * into rev from public.contract_revisions where id = doc.working_revision_id for update;
  if rev.status <> 'draft' then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
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
    'expires_at', rev.expires_at
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
