-- MotiveScripts Phase 15 — proposals and contracts
-- Integer cents only. Snapshots freeze sent revisions. No invoices or payments.

-- ---------------------------------------------------------------------------
-- Notification types / document FKs (columns added after tables exist)
-- ---------------------------------------------------------------------------

alter table public.notifications drop constraint if exists notifications_type_check;

-- ---------------------------------------------------------------------------
-- Counters
-- ---------------------------------------------------------------------------

create table public.document_number_counters (
  kind text not null check (kind in ('proposal', 'contract')),
  year integer not null,
  last_value integer not null default 0,
  primary key (kind, year)
);

create or replace function public.next_document_number(p_kind text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  y integer := extract(year from timezone('utc', now()))::integer;
  n integer;
  prefix text;
begin
  if p_kind not in ('proposal', 'contract') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  insert into public.document_number_counters (kind, year, last_value)
  values (p_kind, y, 1)
  on conflict (kind, year) do update
    set last_value = public.document_number_counters.last_value + 1
  returning last_value into n;
  prefix := case when p_kind = 'proposal' then 'MS-' else 'MS-CON-' end;
  return prefix || y::text || '-' || lpad(n::text, 3, '0');
end;
$$;

-- ---------------------------------------------------------------------------
-- Proposals
-- ---------------------------------------------------------------------------

create table public.proposals (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete restrict,
  project_id uuid references public.projects (id) on delete restrict,
  proposal_number text not null,
  working_revision_id uuid,
  published_revision_id uuid,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint proposals_number_format check (proposal_number ~ '^MS-[0-9]{4}-[0-9]{3,}$')
);

create unique index proposals_number_uidx on public.proposals (proposal_number);
create index proposals_client_id_idx on public.proposals (client_id);
create index proposals_project_id_idx on public.proposals (project_id);
create index proposals_created_at_idx on public.proposals (created_at desc);

create table public.proposal_revisions (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals (id) on delete restrict,
  revision_number integer not null check (revision_number >= 1),
  status text not null default 'draft' check (status in (
    'draft', 'sent', 'viewed', 'accepted', 'declined', 'expired', 'cancelled'
  )),
  title text not null default '',
  introduction text not null default '',
  overview text not null default '',
  scope text not null default '',
  deliverables_text text not null default '',
  timeline text not null default '',
  payment_terms text not null default '',
  terms text not null default '',
  notes text not null default '',
  investment_cents bigint not null default 0 check (investment_cents >= 0),
  valid_until date,
  snapshot_items jsonb,
  sent_at timestamptz,
  viewed_at timestamptz,
  accepted_at timestamptz,
  accepted_by_user_id uuid references auth.users (id) on delete set null,
  accepted_email text,
  declined_at timestamptz,
  declined_by_user_id uuid references auth.users (id) on delete set null,
  decline_reason text not null default '',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (proposal_id, revision_number)
);

create index proposal_revisions_proposal_id_idx on public.proposal_revisions (proposal_id);
create index proposal_revisions_status_idx on public.proposal_revisions (status);

create table public.proposal_items (
  id uuid primary key default gen_random_uuid(),
  revision_id uuid not null references public.proposal_revisions (id) on delete cascade,
  name text not null,
  description text not null default '',
  quantity integer not null default 1 check (quantity > 0 and quantity <= 9999),
  unit_price_cents bigint not null default 0 check (unit_price_cents >= 0),
  total_cents bigint generated always as (quantity * unit_price_cents) stored,
  sort_order integer not null default 0,
  constraint proposal_items_name_not_blank check (length(trim(name)) > 0)
);

create index proposal_items_revision_id_idx on public.proposal_items (revision_id, sort_order);

create table public.proposal_admin_notes (
  revision_id uuid primary key references public.proposal_revisions (id) on delete cascade,
  notes text not null default ''
);

alter table public.proposals
  add constraint proposals_working_revision_fk
    foreign key (working_revision_id) references public.proposal_revisions (id) on delete restrict,
  add constraint proposals_published_revision_fk
    foreign key (published_revision_id) references public.proposal_revisions (id) on delete restrict;

-- ---------------------------------------------------------------------------
-- Contracts
-- ---------------------------------------------------------------------------

create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete restrict,
  project_id uuid references public.projects (id) on delete restrict,
  proposal_id uuid references public.proposals (id) on delete restrict,
  contract_number text not null,
  working_revision_id uuid,
  published_revision_id uuid,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contracts_number_format check (contract_number ~ '^MS-CON-[0-9]{4}-[0-9]{3,}$')
);

create unique index contracts_number_uidx on public.contracts (contract_number);
create index contracts_client_id_idx on public.contracts (client_id);
create index contracts_project_id_idx on public.contracts (project_id);
create index contracts_proposal_id_idx on public.contracts (proposal_id);
create index contracts_created_at_idx on public.contracts (created_at desc);

create table public.contract_revisions (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts (id) on delete restrict,
  revision_number integer not null check (revision_number >= 1),
  status text not null default 'draft' check (status in (
    'draft', 'sent', 'viewed', 'accepted', 'declined', 'expired', 'cancelled'
  )),
  title text not null default '',
  parties text not null default '',
  scope text not null default '',
  responsibilities text not null default '',
  timeline text not null default '',
  compensation text not null default '',
  payment_terms text not null default '',
  confidentiality text not null default '',
  intellectual_property text not null default '',
  revisions_policy text not null default '',
  termination text not null default '',
  general_terms text not null default '',
  effective_date date,
  expires_at date,
  snapshot jsonb,
  sent_at timestamptz,
  viewed_at timestamptz,
  accepted_at timestamptz,
  accepted_by_user_id uuid references auth.users (id) on delete set null,
  accepted_email text,
  declined_at timestamptz,
  declined_by_user_id uuid references auth.users (id) on delete set null,
  decline_reason text not null default '',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (contract_id, revision_number)
);

create index contract_revisions_contract_id_idx on public.contract_revisions (contract_id);
create index contract_revisions_status_idx on public.contract_revisions (status);

create table public.contract_admin_notes (
  revision_id uuid primary key references public.contract_revisions (id) on delete cascade,
  notes text not null default ''
);

alter table public.contracts
  add constraint contracts_working_revision_fk
    foreign key (working_revision_id) references public.contract_revisions (id) on delete restrict,
  add constraint contracts_published_revision_fk
    foreign key (published_revision_id) references public.contract_revisions (id) on delete restrict;

alter table public.notifications
  add column if not exists proposal_id uuid references public.proposals (id) on delete restrict,
  add column if not exists contract_id uuid references public.contracts (id) on delete restrict;

alter table public.notifications
  add constraint notifications_type_check check (type in (
    'new_message',
    'feedback_received',
    'changes_requested',
    'version_ready_for_review',
    'version_approved',
    'project_update',
    'proposal_ready',
    'proposal_viewed',
    'proposal_accepted',
    'proposal_declined',
    'contract_ready',
    'contract_viewed',
    'contract_accepted',
    'contract_declined'
  ));

create index if not exists notifications_proposal_id_idx on public.notifications (proposal_id);
create index if not exists notifications_contract_id_idx on public.notifications (contract_id);

comment on table public.proposals is 'Proposal identity. Content lives on proposal_revisions. Client sees published_revision_id only.';
comment on table public.proposal_revisions is 'Each revision has its own status. Sent revisions are immutable snapshots.';
comment on column public.proposal_items.total_cents is 'Generated quantity * unit_price_cents. Never accept a browser total.';
comment on table public.contracts is 'Contract identity. Linked proposal_id preserves business history.';
comment on table public.contract_revisions is 'Sent revisions freeze content in snapshot jsonb.';
comment on table public.proposal_admin_notes is 'Agency-only notes. Clients must never SELECT this table.';
comment on table public.contract_admin_notes is 'Agency-only notes. Clients must never SELECT this table.';

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.document_rpc_active()
returns boolean
language sql
stable
as $$
  select coalesce(current_setting('app.document_rpc', true), '') = '1';
$$;

create or replace function public.proposal_effective_status(p_status text, p_valid_until date)
returns text
language sql
stable
as $$
  select case
    when p_status in ('accepted', 'declined', 'cancelled', 'expired', 'draft') then p_status
    when p_status in ('sent', 'viewed') and p_valid_until is not null and p_valid_until < current_date then 'expired'
    else p_status
  end;
$$;

create or replace function public.contract_effective_status(p_status text, p_expires_at date)
returns text
language sql
stable
as $$
  select case
    when p_status in ('accepted', 'declined', 'cancelled', 'expired', 'draft') then p_status
    when p_status in ('sent', 'viewed') and p_expires_at is not null and p_expires_at < current_date then 'expired'
    else p_status
  end;
$$;

create or replace function public.assert_document_project_client()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  project_client uuid;
  proposal_client uuid;
  proposal_status text;
begin
  if tg_op = 'UPDATE' and new.client_id is distinct from old.client_id then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if tg_table_name = 'proposals' and tg_op = 'UPDATE' and new.proposal_number is distinct from old.proposal_number then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if tg_table_name = 'contracts' and tg_op = 'UPDATE' and new.contract_number is distinct from old.contract_number then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if new.project_id is not null then
    select client_id into project_client from public.projects where id = new.project_id;
    if project_client is null or project_client is distinct from new.client_id then
      raise exception 'Not allowed' using errcode = '42501';
    end if;
  end if;
  if tg_table_name = 'contracts' and new.proposal_id is not null then
    select client_id into proposal_client from public.proposals where id = new.proposal_id;
    if proposal_client is null or proposal_client is distinct from new.client_id then
      raise exception 'Not allowed' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists proposals_match_project on public.proposals;
create trigger proposals_match_project
  before insert or update of client_id, project_id, proposal_number
  on public.proposals
  for each row execute function public.assert_document_project_client();

drop trigger if exists contracts_match_project on public.contracts;
create trigger contracts_match_project
  before insert or update of client_id, project_id, proposal_id, contract_number
  on public.contracts
  for each row execute function public.assert_document_project_client();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists proposals_touch on public.proposals;
create trigger proposals_touch before update on public.proposals
  for each row execute function public.touch_updated_at();

drop trigger if exists proposal_revisions_touch on public.proposal_revisions;
create trigger proposal_revisions_touch before update on public.proposal_revisions
  for each row execute function public.touch_updated_at();

drop trigger if exists contracts_touch on public.contracts;
create trigger contracts_touch before update on public.contracts
  for each row execute function public.touch_updated_at();

drop trigger if exists contract_revisions_touch on public.contract_revisions;
create trigger contract_revisions_touch before update on public.contract_revisions
  for each row execute function public.touch_updated_at();

create or replace function public.proposal_items_recalc()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rid uuid;
begin
  rid := coalesce(new.revision_id, old.revision_id);
  update public.proposal_revisions
    set investment_cents = coalesce((
      select sum(total_cents) from public.proposal_items where revision_id = rid
    ), 0)
  where id = rid;
  return coalesce(new, old);
end;
$$;

drop trigger if exists proposal_items_recalc on public.proposal_items;
create trigger proposal_items_recalc
  after insert or update or delete on public.proposal_items
  for each row execute function public.proposal_items_recalc();

create or replace function public.guard_proposal_revision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft' or not public.document_rpc_active() then
      if not public.document_rpc_active() then
        raise exception 'Not allowed' using errcode = '42501';
      end if;
    end if;
    return old;
  end if;
  if tg_op = 'UPDATE' then
    if old.status <> 'draft' and not public.document_rpc_active() then
      raise exception 'Not allowed' using errcode = '42501';
    end if;
    if new.status is distinct from old.status and not public.document_rpc_active() then
      raise exception 'Not allowed' using errcode = '42501';
    end if;
    if new.proposal_id is distinct from old.proposal_id or new.revision_number is distinct from old.revision_number then
      raise exception 'Not allowed' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists proposal_revisions_guard on public.proposal_revisions;
create trigger proposal_revisions_guard
  before update or delete on public.proposal_revisions
  for each row execute function public.guard_proposal_revision();

create or replace function public.guard_proposal_items()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  st text;
  rid uuid;
begin
  rid := coalesce(new.revision_id, old.revision_id);
  select status into st from public.proposal_revisions where id = rid;
  if st is distinct from 'draft' and not public.document_rpc_active() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists proposal_items_guard on public.proposal_items;
create trigger proposal_items_guard
  before insert or update or delete on public.proposal_items
  for each row execute function public.guard_proposal_items();

create or replace function public.guard_contract_revision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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
  return new;
end;
$$;

drop trigger if exists contract_revisions_guard on public.contract_revisions;
create trigger contract_revisions_guard
  before update or delete on public.contract_revisions
  for each row execute function public.guard_contract_revision();

create or replace function public.notify_document(
  p_audience text,
  p_client_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_project_id uuid default null,
  p_proposal_id uuid default null,
  p_contract_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_audience = 'admins' then
    insert into public.notifications (
      user_id, type, title, body, project_id, proposal_id, contract_id
    )
    select p.id, p_type, p_title, coalesce(p_body, ''), p_project_id, p_proposal_id, p_contract_id
    from public.profiles p
    where p.role = 'admin'
      and p.id is distinct from auth.uid();
  elsif p_audience = 'client' then
    if p_client_id is null then
      return;
    end if;
    insert into public.notifications (
      user_id, type, title, body, project_id, proposal_id, contract_id
    )
    select p.id, p_type, p_title, coalesce(p_body, ''), p_project_id, p_proposal_id, p_contract_id
    from public.profiles p
    where p.role = 'client'
      and p.client_id = p_client_id
      and p.id is distinct from auth.uid();
  end if;
end;
$$;

create or replace function public.record_document_activity(
  p_client_id uuid,
  p_project_id uuid,
  p_event text,
  p_message text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.append_client_staff_activity(p_client_id, p_message);
  if p_project_id is not null then
    insert into public.activity (project_id, actor_id, activity_type, message, metadata)
    values (
      p_project_id,
      auth.uid(),
      p_event,
      p_message,
      jsonb_build_object('icon', 'status')
    );
    update public.projects set last_activity_at = now() where id = p_project_id;
  end if;
end;
$$;

create or replace function public.website_contract_template(p_company text)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'title', 'Website Development Agreement',
    'parties',
      'This agreement is between MotiveScripts (“Agency”) and ' || coalesce(nullif(trim(p_company), ''), 'the Client') || ' (“Client”). This document is a working agreement for the project described below. It is not legal advice and may need review for a specific jurisdiction.',
    'scope', 'The Agency will design and develop the website described in the related proposal, including the pages and features listed in that proposal’s scope of work.',
    'responsibilities',
      'Agency: plan, design, and implement the agreed website, and communicate progress through the MotiveScripts portal.' || chr(10) ||
      'Client: provide content, feedback, and timely approvals so work can move forward.',
    'timeline', 'The schedule in the related proposal applies unless both parties agree to an update in writing (including a message in the client portal).',
    'compensation', 'Compensation matches the investment in the related proposal. Invoices and payment collection are handled separately.',
    'payment_terms', 'Payment terms match the related proposal unless this agreement states otherwise.',
    'confidentiality', 'Each party will treat non-public business information shared for this project as confidential and use it only to complete the work.',
    'intellectual_property',
      'Upon full payment for the agreed work, the Client receives ownership of the final approved website deliverables created uniquely for the Client, excluding Agency tools, frameworks, and prior materials.',
    'revisions_policy', 'Revision rounds follow the related proposal. Work outside the agreed scope may require an updated proposal.',
    'termination', 'Either party may end this agreement with written notice if the other party materially fails to meet its responsibilities after a reasonable chance to remedy.',
    'general_terms',
      'This agreement is a software workflow record of the business terms the Client reviewed in the MotiveScripts portal. It is not a substitute for counsel. Electronic acceptance here records the authenticated user’s agreement; it is not a qualified digital signature under every jurisdiction’s e-sign rules.'
  );
$$;

-- ---------------------------------------------------------------------------
-- Proposal RPCs
-- ---------------------------------------------------------------------------

create or replace function public.create_proposal(
  p_client_id uuid,
  p_project_id uuid default null,
  p_title text default 'Website proposal'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  pid uuid;
  rid uuid;
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if not exists (select 1 from public.clients where id = p_client_id) then
    raise exception 'CLIENT_NOT_FOUND' using errcode = 'P0001';
  end if;
  perform set_config('app.document_rpc', '1', true);
  insert into public.proposals (client_id, project_id, proposal_number, created_by)
  values (p_client_id, p_project_id, public.next_document_number('proposal'), auth.uid())
  returning id into pid;

  insert into public.proposal_revisions (
    proposal_id, revision_number, status, title, created_by, valid_until
  )
  values (
    pid, 1, 'draft', coalesce(nullif(trim(p_title), ''), 'Website proposal'), auth.uid(),
    (current_date + 30)
  )
  returning id into rid;

  update public.proposals set working_revision_id = rid where id = pid;
  perform public.record_document_activity(p_client_id, p_project_id, 'proposal_created', 'Proposal created');
  return pid;
end;
$$;

create or replace function public.create_proposal_revision(p_proposal_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  prop public.proposals;
  pub public.proposal_revisions;
  work public.proposal_revisions;
  rid uuid;
  next_n integer;
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select * into prop from public.proposals where id = p_proposal_id;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  select * into work from public.proposal_revisions where id = prop.working_revision_id;
  if work.status = 'draft' then
    raise exception 'DRAFT_EXISTS' using errcode = 'P0001';
  end if;
  if work.status = 'accepted' or (prop.published_revision_id is not null and exists (
    select 1 from public.proposal_revisions r
    where r.id = prop.published_revision_id and r.status = 'accepted'
  )) then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;
  if prop.published_revision_id is null then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;
  select * into pub from public.proposal_revisions where id = prop.published_revision_id;
  perform set_config('app.document_rpc', '1', true);
  select coalesce(max(revision_number), 0) + 1 into next_n
  from public.proposal_revisions where proposal_id = prop.id;

  insert into public.proposal_revisions (
    proposal_id, revision_number, status, title, introduction, overview, scope,
    deliverables_text, timeline, payment_terms, terms, notes, investment_cents,
    valid_until, created_by
  )
  values (
    prop.id, next_n, 'draft', pub.title, pub.introduction, pub.overview, pub.scope,
    pub.deliverables_text, pub.timeline, pub.payment_terms, pub.terms, pub.notes,
    pub.investment_cents, coalesce(pub.valid_until, current_date + 30), auth.uid()
  )
  returning id into rid;

  insert into public.proposal_items (revision_id, name, description, quantity, unit_price_cents, sort_order)
  select rid,
    coalesce(item->>'name', 'Item'),
    coalesce(item->>'description', ''),
    greatest(coalesce((item->>'quantity')::integer, 1), 1),
    greatest(coalesce((item->>'unit_price_cents')::bigint, 0), 0),
    coalesce((item->>'sort_order')::integer, 0)
  from jsonb_array_elements(coalesce(pub.snapshot_items, '[]'::jsonb)) as item;

  update public.proposals set working_revision_id = rid where id = prop.id;
  return rid;
end;
$$;

create or replace function public.send_proposal(p_proposal_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  prop public.proposals;
  rev public.proposal_revisions;
  items jsonb;
  company text;
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select * into prop from public.proposals where id = p_proposal_id for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  select * into rev from public.proposal_revisions where id = prop.working_revision_id for update;
  if rev.status <> 'draft' then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;
  if length(trim(rev.title)) = 0 then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.proposal_items where revision_id = rev.id) then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;
  if rev.valid_until is null or rev.valid_until < current_date then
    raise exception 'EXPIRED' using errcode = 'P0001';
  end if;
  perform set_config('app.document_rpc', '1', true);

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', i.id,
    'name', i.name,
    'description', i.description,
    'quantity', i.quantity,
    'unit_price_cents', i.unit_price_cents,
    'total_cents', i.total_cents,
    'sort_order', i.sort_order
  ) order by i.sort_order, i.id), '[]'::jsonb)
  into items
  from public.proposal_items i
  where i.revision_id = rev.id;

  if prop.published_revision_id is not null and prop.published_revision_id is distinct from rev.id then
    update public.proposal_revisions
      set status = 'cancelled'
    where id = prop.published_revision_id
      and status in ('sent', 'viewed', 'expired');
  end if;

  update public.proposal_revisions
    set status = 'sent',
        sent_at = now(),
        snapshot_items = items,
        investment_cents = coalesce((select sum(total_cents) from public.proposal_items where revision_id = rev.id), 0)
  where id = rev.id;

  update public.proposals
    set published_revision_id = rev.id,
        working_revision_id = rev.id
  where id = prop.id;

  select business_name into company from public.clients where id = prop.client_id;
  perform public.record_document_activity(prop.client_id, prop.project_id, 'proposal_sent', 'Proposal ' || prop.proposal_number || ' sent');
  perform public.notify_document(
    'client', prop.client_id, 'proposal_ready',
    'Proposal ready for review',
    coalesce(nullif(trim(rev.title), ''), prop.proposal_number) || ' is ready to review.',
    prop.project_id, prop.id, null
  );
end;
$$;

create or replace function public.mark_proposal_viewed(p_proposal_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  prop public.proposals;
  rev public.proposal_revisions;
  effective text;
begin
  if not public.is_client() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select * into prop from public.proposals where id = p_proposal_id;
  if not found or prop.client_id is distinct from public.current_client_id() or prop.published_revision_id is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select * into rev from public.proposal_revisions where id = prop.published_revision_id for update;
  effective := public.proposal_effective_status(rev.status, rev.valid_until);
  if effective <> 'sent' then
    return;
  end if;
  perform set_config('app.document_rpc', '1', true);
  update public.proposal_revisions
    set status = 'viewed',
        viewed_at = coalesce(viewed_at, now())
  where id = rev.id;
  perform public.record_document_activity(prop.client_id, prop.project_id, 'proposal_viewed', 'Proposal ' || prop.proposal_number || ' viewed');
  perform public.notify_document(
    'admins', prop.client_id, 'proposal_viewed',
    'Proposal viewed',
    prop.proposal_number || ' was opened.',
    prop.project_id, prop.id, null
  );
end;
$$;

create or replace function public.accept_proposal(p_proposal_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  prop public.proposals;
  rev public.proposal_revisions;
  effective text;
  user_email text;
begin
  if not public.is_client() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select * into prop from public.proposals where id = p_proposal_id for update;
  if not found or prop.client_id is distinct from public.current_client_id() or prop.published_revision_id is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select * into rev from public.proposal_revisions where id = prop.published_revision_id for update;
  effective := public.proposal_effective_status(rev.status, rev.valid_until);
  if effective = 'expired' then
    perform set_config('app.document_rpc', '1', true);
    if rev.status in ('sent', 'viewed') then
      update public.proposal_revisions set status = 'expired' where id = rev.id;
    end if;
    raise exception 'EXPIRED' using errcode = 'P0001';
  end if;
  if effective not in ('sent', 'viewed') then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;
  select lower(trim(coalesce(email, ''))) into user_email from auth.users where id = auth.uid();
  perform set_config('app.document_rpc', '1', true);
  update public.proposal_revisions
    set status = 'accepted',
        accepted_at = now(),
        accepted_by_user_id = auth.uid(),
        accepted_email = user_email,
        viewed_at = coalesce(viewed_at, now())
  where id = rev.id;
  perform public.record_document_activity(prop.client_id, prop.project_id, 'proposal_accepted', 'Proposal ' || prop.proposal_number || ' accepted');
  perform public.notify_document(
    'admins', prop.client_id, 'proposal_accepted',
    'Proposal accepted',
    prop.proposal_number || ' was accepted.',
    prop.project_id, prop.id, null
  );
end;
$$;

create or replace function public.decline_proposal(p_proposal_id uuid, p_reason text default '')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  prop public.proposals;
  rev public.proposal_revisions;
  effective text;
begin
  if not public.is_client() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select * into prop from public.proposals where id = p_proposal_id for update;
  if not found or prop.client_id is distinct from public.current_client_id() or prop.published_revision_id is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select * into rev from public.proposal_revisions where id = prop.published_revision_id for update;
  effective := public.proposal_effective_status(rev.status, rev.valid_until);
  if effective = 'expired' then
    perform set_config('app.document_rpc', '1', true);
    if rev.status in ('sent', 'viewed') then
      update public.proposal_revisions set status = 'expired' where id = rev.id;
    end if;
    raise exception 'EXPIRED' using errcode = 'P0001';
  end if;
  if effective not in ('sent', 'viewed') then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;
  perform set_config('app.document_rpc', '1', true);
  update public.proposal_revisions
    set status = 'declined',
        declined_at = now(),
        declined_by_user_id = auth.uid(),
        decline_reason = trim(coalesce(p_reason, '')),
        viewed_at = coalesce(viewed_at, now())
  where id = rev.id;
  perform public.record_document_activity(prop.client_id, prop.project_id, 'proposal_declined', 'Proposal ' || prop.proposal_number || ' declined');
  perform public.notify_document(
    'admins', prop.client_id, 'proposal_declined',
    'Proposal declined',
    prop.proposal_number || ' was declined.',
    prop.project_id, prop.id, null
  );
end;
$$;

create or replace function public.cancel_proposal(p_proposal_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  prop public.proposals;
  rev public.proposal_revisions;
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select * into prop from public.proposals where id = p_proposal_id for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  select * into rev from public.proposal_revisions where id = prop.working_revision_id for update;
  if rev.status in ('accepted') then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;
  if rev.status in ('declined', 'cancelled', 'expired') then
    return;
  end if;
  perform set_config('app.document_rpc', '1', true);
  update public.proposal_revisions set status = 'cancelled' where id = rev.id;
  perform public.record_document_activity(prop.client_id, prop.project_id, 'proposal_cancelled', 'Proposal ' || prop.proposal_number || ' cancelled');
end;
$$;

-- ---------------------------------------------------------------------------
-- Contract RPCs
-- ---------------------------------------------------------------------------

create or replace function public.create_contract(
  p_client_id uuid,
  p_project_id uuid default null,
  p_proposal_id uuid default null,
  p_title text default 'Website Development Agreement'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  cid uuid;
  rid uuid;
  company text;
  tmpl jsonb;
  pub public.proposal_revisions;
  prop public.proposals;
  copy_scope text := '';
  copy_timeline text := '';
  copy_payment text := '';
  copy_compensation text := '';
  v_project_id uuid := p_project_id;
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if not exists (select 1 from public.clients where id = p_client_id) then
    raise exception 'CLIENT_NOT_FOUND' using errcode = 'P0001';
  end if;
  if p_proposal_id is not null then
    select * into prop from public.proposals where id = p_proposal_id;
    if not found or prop.client_id is distinct from p_client_id then
      raise exception 'Not allowed' using errcode = '42501';
    end if;
    if prop.published_revision_id is null then
      raise exception 'INVALID_STATUS' using errcode = 'P0001';
    end if;
    select * into pub from public.proposal_revisions where id = prop.published_revision_id;
    if pub.status <> 'accepted' then
      raise exception 'INVALID_STATUS' using errcode = 'P0001';
    end if;
    copy_scope := pub.scope;
    copy_timeline := pub.timeline;
    copy_payment := pub.payment_terms;
    copy_compensation :=
      'Investment: $' || (pub.investment_cents / 100)::text || '.' || lpad((pub.investment_cents % 100)::text, 2, '0');
    v_project_id := coalesce(p_project_id, prop.project_id);
  end if;
  select business_name into company from public.clients where id = p_client_id;
  tmpl := public.website_contract_template(company);
  perform set_config('app.document_rpc', '1', true);
  insert into public.contracts (client_id, project_id, proposal_id, contract_number, created_by)
  values (p_client_id, v_project_id, p_proposal_id, public.next_document_number('contract'), auth.uid())
  returning id into cid;

  insert into public.contract_revisions (
    contract_id, revision_number, status, title, parties, scope, responsibilities, timeline,
    compensation, payment_terms, confidentiality, intellectual_property, revisions_policy,
    termination, general_terms, effective_date, created_by
  )
  values (
    cid, 1, 'draft',
    coalesce(nullif(trim(p_title), ''), tmpl->>'title'),
    tmpl->>'parties',
    coalesce(nullif(trim(copy_scope), ''), tmpl->>'scope'),
    tmpl->>'responsibilities',
    coalesce(nullif(trim(copy_timeline), ''), tmpl->>'timeline'),
    coalesce(nullif(trim(copy_compensation), ''), tmpl->>'compensation'),
    coalesce(nullif(trim(copy_payment), ''), tmpl->>'payment_terms'),
    tmpl->>'confidentiality',
    tmpl->>'intellectual_property',
    tmpl->>'revisions_policy',
    tmpl->>'termination',
    tmpl->>'general_terms',
    current_date,
    auth.uid()
  )
  returning id into rid;

  update public.contracts set working_revision_id = rid where id = cid;
  perform public.record_document_activity(p_client_id, v_project_id, 'contract_created', 'Contract created');
  return cid;
end;
$$;

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
    pub.revisions_policy, pub.termination, pub.general_terms, pub.effective_date, pub.expires_at, auth.uid()
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
    set status = 'sent', sent_at = now(), snapshot = snap
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

create or replace function public.mark_contract_viewed(p_contract_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  doc public.contracts;
  rev public.contract_revisions;
  effective text;
begin
  if not public.is_client() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select * into doc from public.contracts where id = p_contract_id;
  if not found or doc.client_id is distinct from public.current_client_id() or doc.published_revision_id is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select * into rev from public.contract_revisions where id = doc.published_revision_id for update;
  effective := public.contract_effective_status(rev.status, rev.expires_at);
  if effective <> 'sent' then
    return;
  end if;
  perform set_config('app.document_rpc', '1', true);
  update public.contract_revisions
    set status = 'viewed', viewed_at = coalesce(viewed_at, now())
  where id = rev.id;
  perform public.record_document_activity(doc.client_id, doc.project_id, 'contract_viewed', 'Contract ' || doc.contract_number || ' viewed');
  perform public.notify_document(
    'admins', doc.client_id, 'contract_viewed',
    'Contract viewed',
    doc.contract_number || ' was opened.',
    doc.project_id, doc.proposal_id, doc.id
  );
end;
$$;

create or replace function public.accept_contract(p_contract_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  doc public.contracts;
  rev public.contract_revisions;
  effective text;
  user_email text;
begin
  if not public.is_client() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select * into doc from public.contracts where id = p_contract_id for update;
  if not found or doc.client_id is distinct from public.current_client_id() or doc.published_revision_id is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select * into rev from public.contract_revisions where id = doc.published_revision_id for update;
  effective := public.contract_effective_status(rev.status, rev.expires_at);
  if effective = 'expired' then
    perform set_config('app.document_rpc', '1', true);
    if rev.status in ('sent', 'viewed') then
      update public.contract_revisions set status = 'expired' where id = rev.id;
    end if;
    raise exception 'EXPIRED' using errcode = 'P0001';
  end if;
  if effective not in ('sent', 'viewed') then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;
  select lower(trim(coalesce(email, ''))) into user_email from auth.users where id = auth.uid();
  perform set_config('app.document_rpc', '1', true);
  update public.contract_revisions
    set status = 'accepted',
        accepted_at = now(),
        accepted_by_user_id = auth.uid(),
        accepted_email = user_email,
        viewed_at = coalesce(viewed_at, now())
  where id = rev.id;
  perform public.record_document_activity(doc.client_id, doc.project_id, 'contract_accepted', 'Contract ' || doc.contract_number || ' accepted');
  perform public.notify_document(
    'admins', doc.client_id, 'contract_accepted',
    'Contract accepted',
    doc.contract_number || ' was accepted.',
    doc.project_id, doc.proposal_id, doc.id
  );
end;
$$;

create or replace function public.decline_contract(p_contract_id uuid, p_reason text default '')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  doc public.contracts;
  rev public.contract_revisions;
  effective text;
begin
  if not public.is_client() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select * into doc from public.contracts where id = p_contract_id for update;
  if not found or doc.client_id is distinct from public.current_client_id() or doc.published_revision_id is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select * into rev from public.contract_revisions where id = doc.published_revision_id for update;
  effective := public.contract_effective_status(rev.status, rev.expires_at);
  if effective = 'expired' then
    perform set_config('app.document_rpc', '1', true);
    if rev.status in ('sent', 'viewed') then
      update public.contract_revisions set status = 'expired' where id = rev.id;
    end if;
    raise exception 'EXPIRED' using errcode = 'P0001';
  end if;
  if effective not in ('sent', 'viewed') then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;
  perform set_config('app.document_rpc', '1', true);
  update public.contract_revisions
    set status = 'declined',
        declined_at = now(),
        declined_by_user_id = auth.uid(),
        decline_reason = trim(coalesce(p_reason, '')),
        viewed_at = coalesce(viewed_at, now())
  where id = rev.id;
  perform public.record_document_activity(doc.client_id, doc.project_id, 'contract_declined', 'Contract ' || doc.contract_number || ' declined');
  perform public.notify_document(
    'admins', doc.client_id, 'contract_declined',
    'Contract declined',
    doc.contract_number || ' was declined.',
    doc.project_id, doc.proposal_id, doc.id
  );
end;
$$;

create or replace function public.cancel_contract(p_contract_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  doc public.contracts;
  rev public.contract_revisions;
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select * into doc from public.contracts where id = p_contract_id for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  select * into rev from public.contract_revisions where id = doc.working_revision_id for update;
  if rev.status = 'accepted' then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;
  if rev.status in ('declined', 'cancelled', 'expired') then
    return;
  end if;
  perform set_config('app.document_rpc', '1', true);
  update public.contract_revisions set status = 'cancelled' where id = rev.id;
  perform public.record_document_activity(doc.client_id, doc.project_id, 'contract_cancelled', 'Contract ' || doc.contract_number || ' cancelled');
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.proposals enable row level security;
alter table public.proposal_revisions enable row level security;
alter table public.proposal_items enable row level security;
alter table public.proposal_admin_notes enable row level security;
alter table public.contracts enable row level security;
alter table public.contract_revisions enable row level security;
alter table public.contract_admin_notes enable row level security;
alter table public.document_number_counters enable row level security;

revoke all on table public.proposals from anon, public;
revoke all on table public.proposal_revisions from anon, public;
revoke all on table public.proposal_items from anon, public;
revoke all on table public.proposal_admin_notes from anon, authenticated, public;
revoke all on table public.contracts from anon, public;
revoke all on table public.contract_revisions from anon, public;
revoke all on table public.contract_admin_notes from anon, authenticated, public;
revoke all on table public.document_number_counters from anon, authenticated, public;

grant select, insert, update on table public.proposals to authenticated;
grant select, insert, update on table public.proposal_revisions to authenticated;
grant select, insert, update, delete on table public.proposal_items to authenticated;
grant select, insert, update on table public.proposal_admin_notes to authenticated;
grant select, insert, update on table public.contracts to authenticated;
grant select, insert, update on table public.contract_revisions to authenticated;
grant select, insert, update on table public.contract_admin_notes to authenticated;

create policy proposals_admin_all on public.proposals for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy proposals_client_select on public.proposals for select to authenticated
  using (public.is_client() and client_id = public.current_client_id() and published_revision_id is not null);

create policy proposal_revisions_admin_all on public.proposal_revisions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy proposal_revisions_client_select on public.proposal_revisions for select to authenticated
  using (
    public.is_client()
    and exists (
      select 1 from public.proposals p
      where p.id = proposal_id
        and p.client_id = public.current_client_id()
        and p.published_revision_id = proposal_revisions.id
    )
  );

create policy proposal_items_admin_all on public.proposal_items for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy proposal_admin_notes_admin on public.proposal_admin_notes for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy contracts_admin_all on public.contracts for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy contracts_client_select on public.contracts for select to authenticated
  using (public.is_client() and client_id = public.current_client_id() and published_revision_id is not null);

create policy contract_revisions_admin_all on public.contract_revisions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy contract_revisions_client_select on public.contract_revisions for select to authenticated
  using (
    public.is_client()
    and exists (
      select 1 from public.contracts c
      where c.id = contract_id
        and c.client_id = public.current_client_id()
        and c.published_revision_id = contract_revisions.id
    )
  );

create policy contract_admin_notes_admin on public.contract_admin_notes for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Clients have no INSERT/UPDATE/DELETE policies on document tables.

revoke all on function public.next_document_number(text) from public, anon, authenticated;
revoke all on function public.document_rpc_active() from public, anon, authenticated;
revoke all on function public.website_contract_template(text) from public, anon;
revoke all on function public.notify_document(text, uuid, text, text, text, uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.record_document_activity(uuid, uuid, text, text) from public, anon, authenticated;

grant execute on function public.proposal_effective_status(text, date) to authenticated;
grant execute on function public.contract_effective_status(text, date) to authenticated;
grant execute on function public.create_proposal(uuid, uuid, text) to authenticated;
grant execute on function public.create_proposal_revision(uuid) to authenticated;
grant execute on function public.send_proposal(uuid) to authenticated;
grant execute on function public.mark_proposal_viewed(uuid) to authenticated;
grant execute on function public.accept_proposal(uuid) to authenticated;
grant execute on function public.decline_proposal(uuid, text) to authenticated;
grant execute on function public.cancel_proposal(uuid) to authenticated;
grant execute on function public.create_contract(uuid, uuid, uuid, text) to authenticated;
grant execute on function public.create_contract_revision(uuid) to authenticated;
grant execute on function public.send_contract(uuid) to authenticated;
grant execute on function public.mark_contract_viewed(uuid) to authenticated;
grant execute on function public.accept_contract(uuid) to authenticated;
grant execute on function public.decline_contract(uuid, text) to authenticated;
grant execute on function public.cancel_contract(uuid) to authenticated;
grant execute on function public.website_contract_template(text) to authenticated;

grant execute on function public.notify_document(text, uuid, text, text, text, uuid, uuid, uuid) to service_role;
grant execute on function public.record_document_activity(uuid, uuid, text, text) to service_role;
grant execute on function public.next_document_number(text) to service_role;
