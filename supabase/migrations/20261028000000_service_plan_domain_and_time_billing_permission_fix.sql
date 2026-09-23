-- Final sweep requested after 20261026000000/20261027000000 -- checked every remaining
-- is_admin()-only RPC against its caller's UI gating. Payroll (set_staff_pay_rate,
-- mark_time_entries_paid, set_staff_project_pay_rate, remove_staff_project_pay_rate), team
-- assignment, agency settings, and workspace purge are all correctly admin-only end to end (their
-- routes require the literal "admin" page-permission, or team.view/manage, which no non-admin
-- template holds -- there's no mismatch to have). admin_link_client_account and the current
-- set_current_file_version (security invoker, no is_admin() check at all) are likewise fine.
--
-- Two more real instances of the same bug found:
--   - set_service_plan_domain: same missing-gate pattern as create_service_plan /
--     create_service_plan_from_template (20261027000000) -- same component
--     (ClientRecurringPlansSection.tsx), same is_admin()-only check, no UI gating of its own.
--   - generate_invoice_items_from_time_entries: UI-gated correctly on canManage (invoices.manage)
--     in AdminInvoiceDetails.tsx ("Generate from time entries"), but the RPC itself still required
--     is_admin() -- Accounting (who holds invoices.manage) would see the button and hit a raw
--     "Not allowed".

create or replace function public.set_service_plan_domain(
  p_plan_id uuid,
  p_domain text,
  p_domain_expires_at date default null,
  p_ssl_expires_at date default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  plan public.service_plans;
begin
  select * into plan from public.service_plans where id = p_plan_id;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  perform public.assert_client_perm(plan.client_id, 'invoices.manage');
  update public.service_plans
    set domain = nullif(lower(trim(p_domain)), ''),
        domain_expires_at = p_domain_expires_at,
        ssl_expires_at = p_ssl_expires_at
    where id = p_plan_id;
end;
$$;

-- Also fixes a genuine pre-existing bug, found while testing the permission fix live: the original
-- body used a `with grouped as (...), inserted as (insert ... returning) select ... from inserted`
-- CTE for the invoice_items insert, then a SEPARATE, later `update ... from grouped` statement that
-- tried to reference the same CTE -- but a CTE's scope is the single SQL statement it's defined in,
-- not the rest of the function. That update always failed with "relation \"grouped\" does not
-- exist" -- meaning this function could never have completed successfully for anyone, admin or
-- not, since it shipped on 20260905040000. Fixed by materializing the grouped hours into a local
-- temp table once, then using that same temp table for both the insert and the update.
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
  select * into inv from public.invoices where id = p_invoice_id for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  perform public.assert_client_perm(inv.client_id, 'invoices.manage');
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

  create temporary table if not exists tmp_time_billing_groups (
    staff_id uuid, full_name text, total_hours numeric
  ) on commit drop;
  delete from tmp_time_billing_groups;

  insert into tmp_time_billing_groups (staff_id, full_name, total_hours)
  select te.staff_id, p.full_name, sum(te.hours)
  from public.time_entries te
  join public.profiles p on p.id = te.staff_id
  where te.project_id = inv.project_id
    and te.billed_at is null
    and te.entry_date <= p_through_date
  group by te.staff_id, p.full_name;

  insert into public.invoice_items (invoice_id, description, quantity, unit_price_cents, sort_order)
  select inv.id,
         coalesce(full_name, 'Staff') || ' — logged hours through ' || p_through_date,
         total_hours,
         coalesce(proj.hourly_rate_cents, 0),
         next_sort + row_number() over () - 1
  from tmp_time_billing_groups;
  get diagnostics billed_count = row_count;

  update public.time_entries te
    set billed_at = now(), invoice_id = inv.id
    from tmp_time_billing_groups g
    where te.staff_id = g.staff_id
      and te.project_id = inv.project_id
      and te.billed_at is null
      and te.entry_date <= p_through_date;

  drop table if exists tmp_time_billing_groups;

  perform set_config('app.document_rpc', '1', true);
  perform public.record_document_activity(inv.client_id, inv.project_id, 'invoice_time_billed',
    billed_count || ' time entry group(s) added to draft invoice.');

  return billed_count;
end;
$$;
