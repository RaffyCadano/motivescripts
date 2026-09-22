-- Reconciles the public "Website Care $99/mo flat" self-serve offer with the admin-editable
-- Essential/Business/Pro tiers added in 20261008000000: the public pricing page and the client's
-- self-serve "choose a plan after launch" flow now both read live from maintenance_plan_templates,
-- so editing a tier's price in Admin updates what's publicly offered too, instead of the two
-- staying permanently out of sync.

-- ---------------------------------------------------------------------------
-- 1. Public (anon) read of active tiers -- the pricing page is shown to logged-out visitors.
--    Same safe subset already readable by any signed-in user; no new columns exposed.
-- ---------------------------------------------------------------------------

drop policy if exists maintenance_plan_templates_anon_select on public.maintenance_plan_templates;
create policy maintenance_plan_templates_anon_select on public.maintenance_plan_templates for select to anon
  using (is_active);

grant select on public.maintenance_plan_templates to anon;

-- ---------------------------------------------------------------------------
-- 2. create_client_service_plan gains an optional template id, so a client choosing "Website Care"
--    themselves can pick a specific tier -- the amount/label/included hours all come from the
--    template row the Edge Function already validated (is_active), never trusted from the client
--    beyond which id they picked, exactly like every other field this function already protects.
-- ---------------------------------------------------------------------------

drop function if exists public.create_client_service_plan(uuid, uuid, text, text, bigint, uuid);

create or replace function public.create_client_service_plan(
  p_client_id uuid,
  p_project_id uuid,
  p_plan_type text,
  p_label text,
  p_amount_cents bigint,
  p_created_by uuid default null,
  p_template_id uuid default null,
  p_included_hours_monthly numeric default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  project_client uuid;
  project_name text;
  existing public.service_plans;
  new_id uuid;
begin
  -- Only the self-serve catalog. 'custom' plans stay admin-only.
  if p_plan_type not in ('care', 'hosting', 'seo_retainer') then
    raise exception 'INVALID_PLAN_TYPE' using errcode = 'P0001';
  end if;
  if p_amount_cents is null or p_amount_cents < 50 then
    raise exception 'INVALID_AMOUNT' using errcode = 'P0001';
  end if;
  if coalesce(trim(p_label), '') = '' then
    raise exception 'INVALID_LABEL' using errcode = 'P0001';
  end if;
  if p_plan_type = 'care' and p_template_id is null then
    raise exception 'INVALID_PLAN_TYPE' using errcode = 'P0001';
  end if;

  -- The project must belong to this client. A different client's project reads as not found.
  select client_id, name into project_client, project_name from public.projects where id = p_project_id;
  if project_client is null or project_client is distinct from p_client_id then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  if not public.project_launched(p_project_id) then
    raise exception 'NOT_LAUNCHED' using errcode = 'P0001';
  end if;

  -- One plan of a kind per project, whichever tier it is. If it is still waiting on checkout and the
  -- client started it, reuse it (so they can pick up where they left off). Anything else already
  -- open, including a plan an admin made, means they already have it.
  select * into existing
    from public.service_plans
    where client_id = p_client_id and project_id = p_project_id and plan_type = p_plan_type
      and status in ('pending', 'active', 'past_due')
    order by created_at desc
    limit 1
    for update;
  if found then
    if existing.status = 'pending' and existing.source = 'client_portal' then
      return jsonb_build_object('plan_id', existing.id, 'reused', true);
    end if;
    raise exception 'ALREADY_SUBSCRIBED' using errcode = 'P0001';
  end if;

  begin
    insert into public.service_plans (
      client_id, project_id, plan_type, label, amount_cents, created_by, source,
      plan_template_id, included_hours_monthly
    )
    values (
      p_client_id, p_project_id, p_plan_type, trim(p_label) || ' - ' || project_name, p_amount_cents, p_created_by, 'client_portal',
      p_template_id, coalesce(p_included_hours_monthly, 0)
    )
    returning id into new_id;
  exception when unique_violation then
    -- Lost a race with another request from the same client: use the plan that request created.
    select id into new_id
      from public.service_plans
      where client_id = p_client_id and project_id = p_project_id and plan_type = p_plan_type
        and source = 'client_portal' and status in ('pending', 'active', 'past_due')
      order by created_at desc
      limit 1;
    if new_id is null then
      raise;
    end if;
    return jsonb_build_object('plan_id', new_id, 'reused', true);
  end;

  perform public.record_document_activity(
    p_client_id, p_project_id, 'service_plan_created',
    trim(p_label) || ' plan chosen in the client portal'
  );

  return jsonb_build_object('plan_id', new_id, 'reused', false);
end;
$$;
revoke all on function public.create_client_service_plan(uuid, uuid, text, text, bigint, uuid, uuid, numeric) from public, anon, authenticated;
grant execute on function public.create_client_service_plan(uuid, uuid, text, text, bigint, uuid, uuid, numeric) to service_role;

comment on function public.create_client_service_plan(uuid, uuid, text, text, bigint, uuid, uuid, numeric) is
  'Creates (or reuses a pending) plan chosen by the client themselves. Requires the project to belong to the client and to be launched. A care plan must name an active maintenance_plan_templates tier. Called only from the manage-service-plan Edge Function, which sets the amount/label/hours from its own catalog or the named template.';
