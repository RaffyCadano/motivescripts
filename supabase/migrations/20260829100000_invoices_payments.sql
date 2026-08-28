-- MotiveScripts Phase 16 — invoices and manual payment records
-- Integer cents only. No payment processors. No invoices from the React app on load.

-- ---------------------------------------------------------------------------
-- Numbering
-- ---------------------------------------------------------------------------

alter table public.document_number_counters
  drop constraint if exists document_number_counters_kind_check;

alter table public.document_number_counters
  add constraint document_number_counters_kind_check
  check (kind in ('proposal', 'contract', 'invoice'));

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
  if p_kind not in ('proposal', 'contract', 'invoice') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  insert into public.document_number_counters (kind, year, last_value)
  values (p_kind, y, 1)
  on conflict (kind, year) do update
    set last_value = public.document_number_counters.last_value + 1
  returning last_value into n;
  prefix := case
    when p_kind = 'proposal' then 'MS-'
    when p_kind = 'contract' then 'MS-CON-'
    else 'MS-INV-'
  end;
  return prefix || y::text || '-' || lpad(n::text, 3, '0');
end;
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null,
  client_id uuid not null references public.clients (id) on delete restrict,
  project_id uuid references public.projects (id) on delete restrict,
  contract_id uuid references public.contracts (id) on delete restrict,
  proposal_id uuid references public.proposals (id) on delete restrict,
  status text not null default 'draft' check (status in (
    'draft', 'sent', 'viewed', 'partially_paid', 'paid', 'cancelled'
  )),
  issue_date date not null default (timezone('utc', now()))::date,
  due_date date not null default ((timezone('utc', now()))::date + 14),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  subtotal_cents bigint not null default 0 check (subtotal_cents >= 0),
  tax_cents bigint not null default 0 check (tax_cents >= 0),
  discount_cents bigint not null default 0 check (discount_cents >= 0),
  total_cents bigint not null default 0 check (total_cents >= 0),
  amount_paid_cents bigint not null default 0 check (amount_paid_cents >= 0),
  amount_due_cents bigint not null default 0 check (amount_due_cents >= 0),
  notes text not null default '',
  snapshot_items jsonb,
  bill_to jsonb,
  sent_at timestamptz,
  viewed_at timestamptz,
  paid_at timestamptz,
  cancelled_at timestamptz,
  overdue_notified_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invoices_number_format check (invoice_number ~ '^MS-INV-[0-9]{4}-[0-9]{3,}$'),
  constraint invoices_dates_ok check (due_date >= issue_date),
  constraint invoices_paid_not_over_total check (amount_paid_cents <= total_cents),
  constraint invoices_due_matches check (amount_due_cents = total_cents - amount_paid_cents)
);

create unique index invoices_number_uidx on public.invoices (invoice_number);
create index invoices_client_id_idx on public.invoices (client_id);
create index invoices_project_id_idx on public.invoices (project_id);
create index invoices_contract_id_idx on public.invoices (contract_id);
create index invoices_status_idx on public.invoices (status);
create index invoices_due_date_idx on public.invoices (due_date);
create index invoices_created_at_idx on public.invoices (created_at desc);

create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  description text not null,
  quantity integer not null default 1 check (quantity > 0 and quantity <= 9999),
  unit_price_cents bigint not null default 0 check (unit_price_cents >= 0),
  total_cents bigint generated always as (quantity * unit_price_cents) stored,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint invoice_items_description_not_blank check (length(trim(description)) > 0)
);

create index invoice_items_invoice_id_idx on public.invoice_items (invoice_id, sort_order);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete restrict,
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  payment_date date not null default (timezone('utc', now()))::date,
  payment_method text not null check (payment_method in ('bank_transfer', 'cash', 'check', 'other')),
  reference text not null default '',
  notes text not null default '',
  recorded_by uuid references auth.users (id) on delete set null,
  recorded_by_label text not null default '',
  reversed_at timestamptz,
  reversed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index payments_invoice_id_idx on public.payments (invoice_id, created_at);

create table public.invoice_admin_notes (
  invoice_id uuid primary key references public.invoices (id) on delete cascade,
  notes text not null default ''
);

alter table public.notifications
  add column if not exists invoice_id uuid references public.invoices (id) on delete restrict;

alter table public.notifications drop constraint if exists notifications_type_check;
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
    'contract_declined',
    'invoice_ready',
    'invoice_viewed',
    'payment_recorded',
    'invoice_paid',
    'invoice_overdue'
  ));

create index if not exists notifications_invoice_id_idx on public.notifications (invoice_id);

comment on table public.invoices is 'Agency invoices. Totals are integer cents. Clients see non-draft, non-cancelled rows only.';
comment on column public.invoice_items.total_cents is 'Generated quantity * unit_price_cents. Never accept a browser total.';
comment on table public.payments is 'Manual payment records. Append-oriented. Reverse instead of deleting.';
comment on table public.invoice_admin_notes is 'Agency-only notes. Clients must never SELECT this table.';

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.invoice_effective_status(
  p_status text,
  p_due_date date,
  p_amount_due_cents bigint
)
returns text
language sql
stable
as $$
  select case
    when p_status in ('draft', 'paid', 'cancelled', 'partially_paid') then p_status
    when p_status in ('sent', 'viewed')
      and p_due_date is not null
      and p_due_date < (timezone('utc', now()))::date
      and coalesce(p_amount_due_cents, 0) > 0
      then 'overdue'
    else p_status
  end;
$$;

create or replace function public.assert_invoice_relationships()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  related_client uuid;
begin
  if tg_op = 'UPDATE' and new.client_id is distinct from old.client_id then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and new.invoice_number is distinct from old.invoice_number then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if new.project_id is not null then
    select client_id into related_client from public.projects where id = new.project_id;
    if related_client is null or related_client is distinct from new.client_id then
      raise exception 'Not allowed' using errcode = '42501';
    end if;
  end if;
  if new.contract_id is not null then
    select client_id into related_client from public.contracts where id = new.contract_id;
    if related_client is null or related_client is distinct from new.client_id then
      raise exception 'Not allowed' using errcode = '42501';
    end if;
  end if;
  if new.proposal_id is not null then
    select client_id into related_client from public.proposals where id = new.proposal_id;
    if related_client is null or related_client is distinct from new.client_id then
      raise exception 'Not allowed' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists invoices_match_client on public.invoices;
create trigger invoices_match_client
  before insert or update of client_id, project_id, contract_id, proposal_id, invoice_number
  on public.invoices
  for each row execute function public.assert_invoice_relationships();

drop trigger if exists invoices_touch on public.invoices;
create trigger invoices_touch before update on public.invoices
  for each row execute function public.touch_updated_at();

create or replace function public.guard_invoice()
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
  if new.status is distinct from old.status and not public.document_rpc_active() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if old.status = 'paid' and new.status in ('draft', 'cancelled') then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;
  if old.status = 'cancelled' and new.status = 'paid' then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;
  if old.status <> 'draft' and not public.document_rpc_active() then
    if new.tax_cents is distinct from old.tax_cents
      or new.discount_cents is distinct from old.discount_cents
      or new.subtotal_cents is distinct from old.subtotal_cents
      or new.total_cents is distinct from old.total_cents
      or new.amount_paid_cents is distinct from old.amount_paid_cents
      or new.amount_due_cents is distinct from old.amount_due_cents
      or new.currency is distinct from old.currency
      or new.issue_date is distinct from old.issue_date
      or new.due_date is distinct from old.due_date
      or new.notes is distinct from old.notes
      or new.project_id is distinct from old.project_id
      or new.contract_id is distinct from old.contract_id
      or new.proposal_id is distinct from old.proposal_id
    then
      raise exception 'Not allowed' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists invoices_guard on public.invoices;
create trigger invoices_guard
  before update or delete on public.invoices
  for each row execute function public.guard_invoice();

create or replace function public.recalc_invoice_totals(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  subtotal bigint;
  tax bigint;
  discount bigint;
  paid bigint;
  total bigint;
  due bigint;
  st text;
  viewed timestamptz;
begin
  perform set_config('app.document_rpc', '1', true);
  select coalesce(sum(total_cents), 0) into subtotal
  from public.invoice_items where invoice_id = p_invoice_id;
  select tax_cents, discount_cents, status, viewed_at
    into tax, discount, st, viewed
  from public.invoices where id = p_invoice_id;
  if not found then
    return;
  end if;
  total := subtotal + tax - discount;
  if total < 0 then
    total := 0;
  end if;
  select coalesce(sum(amount_cents), 0) into paid
  from public.payments
  where invoice_id = p_invoice_id and reversed_at is null;
  if paid > total then
    raise exception 'PAYMENT_EXCEEDS_TOTAL' using errcode = 'P0001';
  end if;
  due := total - paid;
  update public.invoices
    set subtotal_cents = subtotal,
        total_cents = total,
        amount_paid_cents = paid,
        amount_due_cents = due
    where id = p_invoice_id;

  if st in ('draft', 'cancelled') then
    return;
  end if;

  if paid = 0 then
    update public.invoices
      set status = case when viewed is not null then 'viewed' else 'sent' end,
          paid_at = null
      where id = p_invoice_id
        and status in ('partially_paid', 'paid', 'sent', 'viewed');
  elsif paid > 0 and paid < total then
    update public.invoices
      set status = 'partially_paid',
          paid_at = null
      where id = p_invoice_id;
  elsif paid = total and total > 0 then
    update public.invoices
      set status = 'paid',
          paid_at = coalesce(paid_at, now())
      where id = p_invoice_id;
  end if;
end;
$$;

create or replace function public.invoice_items_after()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recalc_invoice_totals(coalesce(new.invoice_id, old.invoice_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists invoice_items_after on public.invoice_items;
create trigger invoice_items_after
  after insert or update or delete on public.invoice_items
  for each row execute function public.invoice_items_after();

create or replace function public.guard_invoice_items()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  st text;
  paid bigint;
  iid uuid;
begin
  iid := coalesce(new.invoice_id, old.invoice_id);
  select status, amount_paid_cents into st, paid from public.invoices where id = iid;
  if st is distinct from 'draft' and not public.document_rpc_active() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if coalesce(paid, 0) > 0 and not public.document_rpc_active() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists invoice_items_guard on public.invoice_items;
create trigger invoice_items_guard
  before insert or update or delete on public.invoice_items
  for each row execute function public.guard_invoice_items();

create or replace function public.guard_payments()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' and not public.document_rpc_active() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' then
    if not public.document_rpc_active() then
      raise exception 'Not allowed' using errcode = '42501';
    end if;
    if new.amount_cents is distinct from old.amount_cents
      or new.invoice_id is distinct from old.invoice_id
      or new.payment_date is distinct from old.payment_date
      or new.payment_method is distinct from old.payment_method
      or new.recorded_by is distinct from old.recorded_by
    then
      raise exception 'Not allowed' using errcode = '42501';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists payments_guard on public.payments;
create trigger payments_guard
  before insert or update or delete on public.payments
  for each row execute function public.guard_payments();

drop function if exists public.notify_document(text, uuid, text, text, text, uuid, uuid, uuid);

create or replace function public.notify_document(
  p_audience text,
  p_client_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_project_id uuid default null,
  p_proposal_id uuid default null,
  p_contract_id uuid default null,
  p_invoice_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_audience = 'admins' then
    insert into public.notifications (
      user_id, type, title, body, project_id, proposal_id, contract_id, invoice_id
    )
    select p.id, p_type, p_title, coalesce(p_body, ''), p_project_id, p_proposal_id, p_contract_id, p_invoice_id
    from public.profiles p
    where p.role = 'admin'
      and p.id is distinct from auth.uid();
  elsif p_audience = 'client' then
    if p_client_id is null then
      return;
    end if;
    insert into public.notifications (
      user_id, type, title, body, project_id, proposal_id, contract_id, invoice_id
    )
    select p.id, p_type, p_title, coalesce(p_body, ''), p_project_id, p_proposal_id, p_contract_id, p_invoice_id
    from public.profiles p
    where p.role = 'client'
      and p.client_id = p_client_id
      and p.id is distinct from auth.uid();
  end if;
end;
$$;

create or replace function public.maybe_notify_invoice_overdue(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.invoices;
  effective text;
begin
  select * into inv from public.invoices where id = p_invoice_id;
  if not found then
    return;
  end if;
  effective := public.invoice_effective_status(inv.status, inv.due_date, inv.amount_due_cents);
  if effective <> 'overdue' or inv.overdue_notified_at is not null then
    return;
  end if;
  perform set_config('app.document_rpc', '1', true);
  update public.invoices set overdue_notified_at = now() where id = inv.id;
  perform public.notify_document(
    'client', inv.client_id, 'invoice_overdue',
    'Invoice overdue',
    inv.invoice_number || ' is past due.',
    inv.project_id, inv.proposal_id, inv.contract_id, inv.id
  );
  perform public.notify_document(
    'admins', inv.client_id, 'invoice_overdue',
    'Invoice overdue',
    inv.invoice_number || ' is past due.',
    inv.project_id, inv.proposal_id, inv.contract_id, inv.id
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

create or replace function public.create_invoice(
  p_client_id uuid,
  p_project_id uuid default null,
  p_contract_id uuid default null,
  p_proposal_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  iid uuid;
  contract_status text;
  v_project uuid := p_project_id;
  v_proposal uuid := p_proposal_id;
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if not exists (select 1 from public.clients where id = p_client_id) then
    raise exception 'CLIENT_NOT_FOUND' using errcode = 'P0001';
  end if;
  if p_contract_id is not null then
    select c.project_id, c.proposal_id, r.status
      into v_project, v_proposal, contract_status
    from public.contracts c
    left join public.contract_revisions r on r.id = c.published_revision_id
    where c.id = p_contract_id and c.client_id = p_client_id;
    if not found then
      raise exception 'Not allowed' using errcode = '42501';
    end if;
    if contract_status is distinct from 'accepted' then
      raise exception 'INVALID_STATUS' using errcode = 'P0001';
    end if;
    v_project := coalesce(p_project_id, v_project);
    v_proposal := coalesce(p_proposal_id, v_proposal);
  end if;
  perform set_config('app.document_rpc', '1', true);
  insert into public.invoices (
    client_id, project_id, contract_id, proposal_id, invoice_number, created_by
  )
  values (
    p_client_id, v_project, p_contract_id, v_proposal,
    public.next_document_number('invoice'), auth.uid()
  )
  returning id into iid;
  insert into public.invoice_admin_notes (invoice_id, notes) values (iid, '');
  perform public.record_document_activity(p_client_id, v_project, 'invoice_created', 'Invoice created');
  return iid;
end;
$$;

create or replace function public.update_invoice_draft(
  p_invoice_id uuid,
  p_issue_date date,
  p_due_date date,
  p_currency text,
  p_tax_cents bigint,
  p_discount_cents bigint,
  p_notes text,
  p_project_id uuid default null,
  p_contract_id uuid default null,
  p_proposal_id uuid default null,
  p_admin_notes text default '',
  p_items jsonb default '[]'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.invoices;
  item jsonb;
  sort_i integer := 0;
  line_desc text;
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select * into inv from public.invoices where id = p_invoice_id for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if inv.status <> 'draft' then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;
  if inv.amount_paid_cents > 0 then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;
  if p_due_date < p_issue_date then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;
  if p_tax_cents < 0 or p_discount_cents < 0 then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;
  perform set_config('app.document_rpc', '1', true);
  update public.invoices
    set issue_date = p_issue_date,
        due_date = p_due_date,
        currency = coalesce(nullif(upper(trim(p_currency)), ''), 'USD'),
        tax_cents = p_tax_cents,
        discount_cents = p_discount_cents,
        notes = coalesce(p_notes, ''),
        project_id = p_project_id,
        contract_id = p_contract_id,
        proposal_id = p_proposal_id
    where id = inv.id;

  delete from public.invoice_items where invoice_id = inv.id;
  for item in
    select value from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    line_desc := coalesce(nullif(trim(item->>'name'), ''), nullif(trim(item->>'description'), ''));
    if line_desc is null then
      continue;
    end if;
    insert into public.invoice_items (
      invoice_id, description, quantity, unit_price_cents, sort_order
    )
    values (
      inv.id,
      line_desc,
      greatest(1, least(9999, coalesce(nullif(item->>'quantity', '')::integer, 1))),
      greatest(0, coalesce(nullif(item->>'unit_price_cents', '')::bigint, 0)),
      sort_i
    );
    sort_i := sort_i + 1;
  end loop;

  insert into public.invoice_admin_notes (invoice_id, notes)
  values (inv.id, coalesce(p_admin_notes, ''))
  on conflict (invoice_id) do update set notes = excluded.notes;

  perform public.recalc_invoice_totals(inv.id);
end;
$$;

create or replace function public.send_invoice(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.invoices;
  items jsonb;
  company text;
  contact text;
  email text;
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select * into inv from public.invoices where id = p_invoice_id for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if inv.status <> 'draft' then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.invoice_items where invoice_id = inv.id) then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;
  perform public.recalc_invoice_totals(inv.id);
  select * into inv from public.invoices where id = p_invoice_id;
  if inv.total_cents <= 0 then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;
  if inv.due_date < inv.issue_date then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', i.id,
    'description', i.description,
    'quantity', i.quantity,
    'unit_price_cents', i.unit_price_cents,
    'total_cents', i.total_cents,
    'sort_order', i.sort_order
  ) order by i.sort_order, i.id), '[]'::jsonb)
  into items
  from public.invoice_items i
  where i.invoice_id = inv.id;

  select business_name, contact_name, email
    into company, contact, email
  from public.clients where id = inv.client_id;

  perform set_config('app.document_rpc', '1', true);
  update public.invoices
    set status = 'sent',
        sent_at = now(),
        snapshot_items = items,
        bill_to = jsonb_build_object(
          'business_name', coalesce(company, ''),
          'contact_name', coalesce(contact, ''),
          'email', coalesce(email, '')
        )
    where id = inv.id;

  perform public.record_document_activity(
    inv.client_id, inv.project_id, 'invoice_sent', 'Invoice ' || inv.invoice_number || ' sent'
  );
  perform public.notify_document(
    'client', inv.client_id, 'invoice_ready',
    'New invoice available',
    inv.invoice_number || ' is ready to review.',
    inv.project_id, inv.proposal_id, inv.contract_id, inv.id
  );
  perform public.maybe_notify_invoice_overdue(inv.id);
end;
$$;

create or replace function public.cancel_invoice(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.invoices;
  effective text;
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select * into inv from public.invoices where id = p_invoice_id for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if inv.status in ('paid', 'cancelled') then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;
  if inv.amount_paid_cents > 0 or exists (
    select 1 from public.payments where invoice_id = inv.id and reversed_at is null
  ) then
    raise exception 'HAS_PAYMENTS' using errcode = 'P0001';
  end if;
  effective := public.invoice_effective_status(inv.status, inv.due_date, inv.amount_due_cents);
  if effective not in ('draft', 'sent', 'viewed', 'overdue') then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;
  perform set_config('app.document_rpc', '1', true);
  update public.invoices
    set status = 'cancelled', cancelled_at = now()
    where id = inv.id;
  perform public.record_document_activity(
    inv.client_id, inv.project_id, 'invoice_cancelled', 'Invoice ' || inv.invoice_number || ' cancelled'
  );
end;
$$;

create or replace function public.mark_invoice_viewed(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.invoices;
  effective text;
begin
  if not public.is_client() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select * into inv from public.invoices where id = p_invoice_id;
  if not found
    or inv.client_id is distinct from public.current_client_id()
    or inv.status in ('draft', 'cancelled')
  then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  effective := public.invoice_effective_status(inv.status, inv.due_date, inv.amount_due_cents);
  perform public.maybe_notify_invoice_overdue(inv.id);
  if inv.status <> 'sent' then
    return;
  end if;
  perform set_config('app.document_rpc', '1', true);
  update public.invoices
    set status = 'viewed',
        viewed_at = coalesce(viewed_at, now())
    where id = inv.id;
  perform public.record_document_activity(
    inv.client_id, inv.project_id, 'invoice_viewed', 'Invoice ' || inv.invoice_number || ' viewed'
  );
  perform public.notify_document(
    'admins', inv.client_id, 'invoice_viewed',
    'Invoice viewed',
    inv.invoice_number || ' was viewed.',
    inv.project_id, inv.proposal_id, inv.contract_id, inv.id
  );
end;
$$;

create or replace function public.record_invoice_payment(
  p_invoice_id uuid,
  p_amount_cents bigint,
  p_payment_date date default (timezone('utc', now()))::date,
  p_method text default 'bank_transfer',
  p_reference text default '',
  p_notes text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.invoices;
  pid uuid;
  label text;
  method text;
  effective text;
  became_paid boolean := false;
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select * into inv from public.invoices where id = p_invoice_id for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  effective := public.invoice_effective_status(inv.status, inv.due_date, inv.amount_due_cents);
  if inv.status in ('draft', 'cancelled', 'paid') or effective = 'draft' then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;
  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'PAYMENT_INVALID' using errcode = 'P0001';
  end if;
  if p_amount_cents > inv.amount_due_cents then
    raise exception 'PAYMENT_EXCEEDS_TOTAL' using errcode = 'P0001';
  end if;
  method := lower(trim(p_method));
  if method not in ('bank_transfer', 'cash', 'check', 'other') then
    raise exception 'PAYMENT_INVALID' using errcode = 'P0001';
  end if;
  select coalesce(nullif(trim(full_name), ''), coalesce(email, 'MotiveScripts'))
    into label
  from public.profiles where id = auth.uid();

  perform set_config('app.document_rpc', '1', true);
  insert into public.payments (
    invoice_id, amount_cents, currency, payment_date, payment_method,
    reference, notes, recorded_by, recorded_by_label
  )
  values (
    inv.id, p_amount_cents, inv.currency, coalesce(p_payment_date, (timezone('utc', now()))::date),
    method, coalesce(p_reference, ''), coalesce(p_notes, ''), auth.uid(), coalesce(label, 'MotiveScripts')
  )
  returning id into pid;

  perform public.recalc_invoice_totals(inv.id);
  select status = 'paid' into became_paid from public.invoices where id = inv.id;

  perform public.record_document_activity(
    inv.client_id, inv.project_id, 'payment_recorded',
    'Payment recorded on ' || inv.invoice_number
  );
  perform public.notify_document(
    'client', inv.client_id, 'payment_recorded',
    'Payment recorded',
    'A payment was recorded on ' || inv.invoice_number || '.',
    inv.project_id, inv.proposal_id, inv.contract_id, inv.id
  );
  if became_paid then
    perform public.record_document_activity(
      inv.client_id, inv.project_id, 'invoice_paid', 'Invoice ' || inv.invoice_number || ' paid'
    );
    perform public.notify_document(
      'client', inv.client_id, 'invoice_paid',
      'Invoice paid',
      inv.invoice_number || ' is paid in full.',
      inv.project_id, inv.proposal_id, inv.contract_id, inv.id
    );
    perform public.notify_document(
      'admins', inv.client_id, 'invoice_paid',
      'Invoice paid',
      inv.invoice_number || ' is paid in full.',
      inv.project_id, inv.proposal_id, inv.contract_id, inv.id
    );
  end if;
  return pid;
end;
$$;

create or replace function public.reverse_invoice_payment(p_payment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  pay public.payments;
  inv public.invoices;
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select * into pay from public.payments where id = p_payment_id for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if pay.reversed_at is not null then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;
  select * into inv from public.invoices where id = pay.invoice_id for update;
  if inv.status = 'cancelled' then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;
  perform set_config('app.document_rpc', '1', true);
  update public.payments
    set reversed_at = now(), reversed_by = auth.uid()
    where id = pay.id;
  perform public.recalc_invoice_totals(inv.id);
  perform public.record_document_activity(
    inv.client_id, inv.project_id, 'payment_recorded',
    'Payment reversed on ' || inv.invoice_number
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.payments enable row level security;
alter table public.invoice_admin_notes enable row level security;

revoke all on table public.invoices from anon, public;
revoke all on table public.invoice_items from anon, public;
revoke all on table public.payments from anon, public;
revoke all on table public.invoice_admin_notes from anon, authenticated, public;

grant select on table public.invoices to authenticated;
grant select on table public.invoice_items to authenticated;
grant select on table public.payments to authenticated;
grant select, insert, update on table public.invoice_admin_notes to authenticated;

create policy invoices_admin_all on public.invoices for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy invoices_client_select on public.invoices for select to authenticated
  using (
    public.is_client()
    and client_id = public.current_client_id()
    and status not in ('draft', 'cancelled')
  );

create policy invoice_items_admin_all on public.invoice_items for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy invoice_items_client_select on public.invoice_items for select to authenticated
  using (
    public.is_client()
    and exists (
      select 1 from public.invoices i
      where i.id = invoice_id
        and i.client_id = public.current_client_id()
        and i.status not in ('draft', 'cancelled')
    )
  );

create policy payments_admin_select on public.payments for select to authenticated
  using (public.is_admin());
create policy payments_client_select on public.payments for select to authenticated
  using (
    public.is_client()
    and exists (
      select 1 from public.invoices i
      where i.id = invoice_id
        and i.client_id = public.current_client_id()
        and i.status not in ('draft', 'cancelled')
    )
  );

create policy invoice_admin_notes_admin on public.invoice_admin_notes for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

revoke all on function public.recalc_invoice_totals(uuid) from public, anon, authenticated;
revoke all on function public.maybe_notify_invoice_overdue(uuid) from public, anon, authenticated;

grant execute on function public.invoice_effective_status(text, date, bigint) to authenticated;
grant execute on function public.create_invoice(uuid, uuid, uuid, uuid) to authenticated;
grant execute on function public.update_invoice_draft(uuid, date, date, text, bigint, bigint, text, uuid, uuid, uuid, text, jsonb) to authenticated;
grant execute on function public.send_invoice(uuid) to authenticated;
grant execute on function public.cancel_invoice(uuid) to authenticated;
grant execute on function public.mark_invoice_viewed(uuid) to authenticated;
grant execute on function public.record_invoice_payment(uuid, bigint, date, text, text, text) to authenticated;
grant execute on function public.reverse_invoice_payment(uuid) to authenticated;

grant execute on function public.notify_document(text, uuid, text, text, text, uuid, uuid, uuid, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- DEVELOPMENT ONLY invoice rows for the optional demo seed clients.
-- Skipped when those clients are absent (production / empty databases).
-- Do not treat this block as required schema. React never inserts demo invoices.
-- ---------------------------------------------------------------------------

do $$
declare
  y integer := extract(year from timezone('utc', now()))::integer;
  prefix text := 'MS-INV-' || y::text || '-';
begin
  if not exists (
    select 1 from public.clients where id = '20000000-0000-4000-8000-000000000001'
  ) then
    raise notice 'Skipping development invoice seed (demo clients not present).';
    return;
  end if;

  perform set_config('app.document_rpc', '1', true);

  insert into public.invoices (
    id, invoice_number, client_id, project_id, status, issue_date, due_date,
    currency, tax_cents, discount_cents, notes, created_at
  ) values
  (
    '80000000-0000-4000-8000-000000000001', prefix || '001',
    '20000000-0000-4000-8000-000000000004', '30000000-0000-4000-8000-000000000005',
    'draft', (timezone('utc', now()))::date, (timezone('utc', now()))::date + 21,
    'USD', 0, 0, 'Draft for Harbor & Pine website work.', now()
  ),
  (
    '80000000-0000-4000-8000-000000000002', prefix || '002',
    '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001',
    'sent', (timezone('utc', now()))::date - 3, (timezone('utc', now()))::date + 11,
    'USD', 0, 0, 'Net 14. Bank transfer to MotiveScripts.', now() - interval '3 days'
  ),
  (
    '80000000-0000-4000-8000-000000000003', prefix || '003',
    '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001',
    'sent', (timezone('utc', now()))::date - 20, (timezone('utc', now()))::date + 10,
    'USD', 0, 0, 'Remaining balance after the project deposit.', now() - interval '20 days'
  ),
  (
    '80000000-0000-4000-8000-000000000004', prefix || '004',
    '20000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000002',
    'sent', (timezone('utc', now()))::date - 40, (timezone('utc', now()))::date - 10,
    'USD', 0, 0, 'Redesign balance. Past due.', now() - interval '40 days'
  ),
  (
    '80000000-0000-4000-8000-000000000005', prefix || '005',
    '20000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000004',
    'sent', (timezone('utc', now()))::date - 60, (timezone('utc', now()))::date - 30,
    'USD', 0, 0, 'Landing page project — paid in full.', now() - interval '60 days'
  )
  on conflict (id) do nothing;

  insert into public.invoice_items (id, invoice_id, description, quantity, unit_price_cents, sort_order) values
  ('81000000-0000-4000-8000-000000000001', '80000000-0000-4000-8000-000000000001', 'Website Design', 1, 120000, 0),
  ('81000000-0000-4000-8000-000000000002', '80000000-0000-4000-8000-000000000001', 'Development', 1, 180000, 1),
  ('81000000-0000-4000-8000-000000000003', '80000000-0000-4000-8000-000000000002', 'Website Design', 1, 120000, 0),
  ('81000000-0000-4000-8000-000000000004', '80000000-0000-4000-8000-000000000002', 'Development', 1, 180000, 1),
  ('81000000-0000-4000-8000-000000000005', '80000000-0000-4000-8000-000000000002', 'Hosting', 12, 2000, 2),
  ('81000000-0000-4000-8000-000000000006', '80000000-0000-4000-8000-000000000003', 'Website Development', 1, 120000, 0),
  ('81000000-0000-4000-8000-000000000007', '80000000-0000-4000-8000-000000000004', 'Website Redesign', 1, 80000, 0),
  ('81000000-0000-4000-8000-000000000008', '80000000-0000-4000-8000-000000000005', 'Landing page', 1, 140000, 0)
  on conflict (id) do nothing;

  update public.invoices
    set status = 'sent',
        sent_at = created_at,
        snapshot_items = (
          select coalesce(jsonb_agg(jsonb_build_object(
            'id', i.id,
            'description', i.description,
            'quantity', i.quantity,
            'unit_price_cents', i.unit_price_cents,
            'total_cents', i.total_cents,
            'sort_order', i.sort_order
          ) order by i.sort_order), '[]'::jsonb)
          from public.invoice_items i
          where i.invoice_id = invoices.id
        ),
        bill_to = (
          select jsonb_build_object(
            'business_name', c.business_name,
            'contact_name', c.contact_name,
            'email', c.email
          )
          from public.clients c where c.id = invoices.client_id
        )
    where id in (
      '80000000-0000-4000-8000-000000000002',
      '80000000-0000-4000-8000-000000000003',
      '80000000-0000-4000-8000-000000000004',
      '80000000-0000-4000-8000-000000000005'
    )
    and status = 'sent';

  insert into public.payments (
    id, invoice_id, amount_cents, currency, payment_date, payment_method, reference, notes, recorded_by_label
  ) values
  (
    '82000000-0000-4000-8000-000000000001',
    '80000000-0000-4000-8000-000000000003',
    50000, 'USD', (timezone('utc', now()))::date - 5, 'bank_transfer', 'WIRE-ABC-1',
    'Partial payment toward website development.', 'MotiveScripts'
  ),
  (
    '82000000-0000-4000-8000-000000000002',
    '80000000-0000-4000-8000-000000000005',
    140000, 'USD', (timezone('utc', now()))::date - 28, 'bank_transfer', 'WIRE-SMITH-1',
    'Paid in full.', 'MotiveScripts'
  )
  on conflict (id) do nothing;

  perform public.recalc_invoice_totals('80000000-0000-4000-8000-000000000001');
  perform public.recalc_invoice_totals('80000000-0000-4000-8000-000000000002');
  perform public.recalc_invoice_totals('80000000-0000-4000-8000-000000000003');
  perform public.recalc_invoice_totals('80000000-0000-4000-8000-000000000004');
  perform public.recalc_invoice_totals('80000000-0000-4000-8000-000000000005');

  insert into public.document_number_counters (kind, year, last_value)
  values ('invoice', y, 5)
  on conflict (kind, year) do update
    set last_value = greatest(public.document_number_counters.last_value, excluded.last_value);

  insert into public.invoice_admin_notes (invoice_id, notes) values
  ('80000000-0000-4000-8000-000000000001', 'Internal: confirm hosting term before sending.'),
  ('80000000-0000-4000-8000-000000000003', 'Internal: remainder after deposit.')
  on conflict (invoice_id) do nothing;
end $$;
