-- Widen invoice_items.quantity from integer to numeric so hourly line items
-- generated from logged time entries (e.g. 7.5h) don't get silently floored.
-- Scope verified: the only other quantity-cast site in the migrations is
-- proposal_items/contract_items (an unrelated table), not touched here.

alter table public.invoice_items drop column total_cents;
alter table public.invoice_items
  alter column quantity type numeric(10,2) using quantity::numeric(10,2),
  drop constraint if exists invoice_items_quantity_check,
  add constraint invoice_items_quantity_check check (quantity > 0 and quantity <= 9999);
alter table public.invoice_items
  add column total_cents bigint generated always as (round(quantity * unit_price_cents)) stored;

comment on column public.invoice_items.total_cents is 'Generated round(quantity * unit_price_cents). Never accept a browser total.';
comment on column public.invoice_items.quantity is 'Numeric to support fractional (hourly) quantities. Still clamped to (0, 9999].';

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
      greatest(0.01, least(9999, coalesce(nullif(item->>'quantity', '')::numeric(10,2), 1))),
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
