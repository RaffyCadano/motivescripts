-- Roll unbilled time entries for an hourly project into a draft invoice's
-- line items (one line per staff member, grouped), and mark those entries
-- billed. Atomic: does the insert + billed-flag update server-side in one
-- transaction, unlike update_invoice_draft's delete-all-reinsert pattern,
-- so a client abandoning the draft mid-edit can never leave time entries
-- marked billed with nothing actually persisted.

create or replace function public.generate_invoice_items_from_time_entries(
  p_invoice_id uuid,
  p_through_date date default (timezone('utc', now()))::date
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.invoices;
  proj public.projects;
  billed_count integer := 0;
  next_sort integer;
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
  if inv.project_id is null then
    raise exception 'PROJECT_REQUIRED' using errcode = 'P0001';
  end if;
  select * into proj from public.projects where id = inv.project_id;
  if proj.billing_mode <> 'hourly' then
    raise exception 'NOT_HOURLY' using errcode = 'P0001';
  end if;

  select coalesce(max(sort_order), -1) + 1 into next_sort from public.invoice_items where invoice_id = inv.id;

  with grouped as (
    select te.staff_id, p.full_name, sum(te.hours) as total_hours
    from public.time_entries te
    join public.profiles p on p.id = te.staff_id
    where te.project_id = inv.project_id
      and te.billed_at is null
      and te.entry_date <= p_through_date
    group by te.staff_id, p.full_name
  ),
  inserted as (
    insert into public.invoice_items (invoice_id, description, quantity, unit_price_cents, sort_order)
    select inv.id,
           coalesce(full_name, 'Staff') || ' — logged hours through ' || p_through_date,
           total_hours,
           coalesce(proj.hourly_rate_cents, 0),
           next_sort + row_number() over () - 1
    from grouped
    returning 1
  )
  select count(*) into billed_count from inserted;

  update public.time_entries te
    set billed_at = now(), invoice_id = inv.id
    from grouped g
    where te.staff_id = g.staff_id
      and te.project_id = inv.project_id
      and te.billed_at is null
      and te.entry_date <= p_through_date;

  perform set_config('app.document_rpc', '1', true);
  perform public.record_document_activity(inv.client_id, inv.project_id, 'invoice_time_billed',
    billed_count || ' time entry group(s) added to draft invoice.');

  return billed_count;
end;
$$;

revoke all on function public.generate_invoice_items_from_time_entries(uuid, date) from public, anon;
grant execute on function public.generate_invoice_items_from_time_entries(uuid, date) to authenticated;
