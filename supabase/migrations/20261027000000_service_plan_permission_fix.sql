-- Found in the same "check all templates" sweep as 20261026000000: create_service_plan and
-- create_service_plan_from_template both require public.is_admin() -- literal role = 'admin' --
-- which is STRICTER than every other permission check in this codebase, including the generic
-- "staff" template (which holds every grant except team.*, but is role = 'staff', not 'admin', so
-- is_admin() is false for it too). Neither function, nor their shared caller component
-- (ClientRecurringPlansSection.tsx, rendered on /admin/clients/:id, gated only on clients.view --
-- held by nearly every template), has any permission check of its own, so any staff member who can
-- view a client's page sees "Assign a Website Care plan" / "Add a custom plan" and would hit a raw
-- "Not allowed" -- including the generic Staff template itself, not just Sales/PM/Accounting.
--
-- Fix: assert_client_perm(p_client_id, 'invoices.manage'), matching
-- maintenance_plan_templates_staff_write's choice of permission for Care-plan financial config.

create or replace function public.create_service_plan(
  p_client_id uuid,
  p_project_id uuid,
  p_plan_type text,
  p_label text,
  p_amount_cents bigint
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  plan_id uuid;
  project_client uuid;
begin
  perform public.assert_client_perm(p_client_id, 'invoices.manage');
  if p_amount_cents is null or p_amount_cents < 50 then
    raise exception 'INVALID_AMOUNT' using errcode = 'P0001';
  end if;
  if p_plan_type not in ('care', 'seo_retainer', 'hosting', 'custom') then
    raise exception 'INVALID_PLAN_TYPE' using errcode = 'P0001';
  end if;
  if coalesce(trim(p_label), '') = '' then
    raise exception 'INVALID_LABEL' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.clients where id = p_client_id) then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if p_project_id is not null then
    select client_id into project_client from public.projects where id = p_project_id;
    if project_client is null or project_client is distinct from p_client_id then
      raise exception 'Not allowed' using errcode = '42501';
    end if;
  end if;

  insert into public.service_plans (client_id, project_id, plan_type, label, amount_cents, created_by)
  values (p_client_id, p_project_id, p_plan_type, trim(p_label), p_amount_cents, auth.uid())
  returning id into plan_id;

  perform public.record_document_activity(
    p_client_id, p_project_id, 'service_plan_created',
    trim(p_label) || ' plan created'
  );

  return plan_id;
end;
$$;

create or replace function public.create_service_plan_from_template(
  p_client_id uuid,
  p_project_id uuid,
  p_template_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  tmpl public.maintenance_plan_templates;
  plan_id uuid;
  project_client uuid;
begin
  perform public.assert_client_perm(p_client_id, 'invoices.manage');
  select * into tmpl from public.maintenance_plan_templates where id = p_template_id and is_active;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.clients where id = p_client_id) then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if p_project_id is not null then
    select client_id into project_client from public.projects where id = p_project_id;
    if project_client is null or project_client is distinct from p_client_id then
      raise exception 'Not allowed' using errcode = '42501';
    end if;
  end if;

  insert into public.service_plans (
    client_id, project_id, plan_type, label, amount_cents, included_hours_monthly, plan_template_id, created_by
  ) values (
    p_client_id, p_project_id, 'care', tmpl.name, tmpl.monthly_price_cents, tmpl.included_hours, tmpl.id, auth.uid()
  ) returning id into plan_id;

  perform public.record_document_activity(
    p_client_id, p_project_id, 'service_plan_created',
    tmpl.name || ' plan created'
  );

  return plan_id;
end;
$$;
