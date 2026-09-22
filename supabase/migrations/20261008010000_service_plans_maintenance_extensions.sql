-- Extends service_plans (built for recurring billing generally) into the backbone of the
-- Website Care maintenance program specifically: a pause state distinct from cancel, an included-
-- hours allowance, and provenance back to the plan tier it was assigned from.

alter table public.service_plans
  add column if not exists included_hours_monthly numeric(6,2) not null default 0 check (included_hours_monthly >= 0),
  add column if not exists plan_template_id uuid references public.maintenance_plan_templates (id) on delete set null,
  add column if not exists paused_at timestamptz;

alter table public.service_plans drop constraint if exists service_plans_status_check;
alter table public.service_plans
  add constraint service_plans_status_check check (status in ('pending', 'active', 'past_due', 'canceled', 'paused'));

comment on column public.service_plans.included_hours_monthly is
  'Hours of included work per billing cycle. Copied from the assigned plan template at creation time; editing the template later does not change it.';
comment on column public.service_plans.plan_template_id is
  'Which maintenance_plan_templates row this plan was assigned from, if any. Provenance only -- amount_cents/label/included_hours_monthly are this row''s own values, not read live from the template.';
comment on column public.service_plans.paused_at is
  'When this plan was paused. Null unless status = paused.';

-- Pause suspends billing collection (via Stripe pause_collection, set by the manage-service-plan
-- Edge Function) without canceling the subscription -- the client keeps their spot and resumes
-- at the same terms. Distinct from cancel_at (a scheduled, one-way end). Only an active plan can
-- be paused; only a paused one can be resumed. Called only from the manage-service-plan Edge
-- Function (service_role), exactly like set_service_plan_status_by_subscription and
-- set_service_plan_cancel_at -- the Stripe call and the local status change must stay in lockstep,
-- which only the Edge Function can guarantee.
create or replace function public.set_service_plan_paused(
  p_plan_id uuid,
  p_paused boolean
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  changed integer;
begin
  if p_paused then
    update public.service_plans
      set status = 'paused', paused_at = now()
      where id = p_plan_id and status = 'active';
  else
    update public.service_plans
      set status = 'active', paused_at = null
      where id = p_plan_id and status = 'paused';
  end if;
  get diagnostics changed = row_count;
  return changed > 0;
end;
$$;
revoke all on function public.set_service_plan_paused(uuid, boolean) from public, anon, authenticated;
grant execute on function public.set_service_plan_paused(uuid, boolean) to service_role;

comment on function public.set_service_plan_paused(uuid, boolean) is
  'Flips a plan between active and paused. Called only from manage-service-plan after Stripe''s pause_collection call succeeds.';

-- Assigning a template copies its current terms onto the plan row (see column comments above)
-- rather than the plan referencing the template live, so later template edits never change what
-- an existing subscriber already agreed to.
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
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
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
revoke all on function public.create_service_plan_from_template(uuid, uuid, uuid) from public, anon;
grant execute on function public.create_service_plan_from_template(uuid, uuid, uuid) to authenticated;
