-- Client self-serve plan selection: once a client's website has launched, the client can choose an optional
-- monthly plan (Website Care, Hosting, SEO Retainer) from their portal and pay through Stripe Checkout, with
-- no admin step. Everything here is called only from the manage-service-plan Edge Function (service role),
-- which takes the plan type from the client but ALWAYS sets the amount and label itself, never from the client.
--
-- "Launched" is the same fact the rest of the app uses (see notify_launch_completed and
-- client_project_delivery_gates): project_development.deployment_status = 'Production'.

-- ---------------------------------------------------------------------------
-- Where a plan came from, and one open self-serve plan per type per project
-- ---------------------------------------------------------------------------

alter table public.service_plans
  add column if not exists source text not null default 'admin' check (source in ('admin', 'client_portal'));

comment on column public.service_plans.source is
  'admin: created by an admin on the client''s Plans tab. client_portal: chosen by the client themselves after launch.';

-- A double click, a second tab, or a retry can never create two open self-serve plans of the same kind for the
-- same project.
create unique index if not exists service_plans_client_portal_open_uidx
  on public.service_plans (client_id, plan_type, project_id)
  where source = 'client_portal' and status in ('pending', 'active', 'past_due');

-- ---------------------------------------------------------------------------
-- Launch check (server-side source of truth for the gate)
-- ---------------------------------------------------------------------------

create or replace function public.project_launched(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select pd.deployment_status = 'Production' from public.project_development pd where pd.project_id = p_project_id),
    false
  );
$$;
revoke all on function public.project_launched(uuid) from public, anon, authenticated;
grant execute on function public.project_launched(uuid) to service_role;

comment on function public.project_launched(uuid) is
  'True once the project''s website is live (project_development.deployment_status = Production, which only the launch gate can set).';

-- ---------------------------------------------------------------------------
-- Create (or reuse) the client's own plan
-- ---------------------------------------------------------------------------

create or replace function public.create_client_service_plan(
  p_client_id uuid,
  p_project_id uuid,
  p_plan_type text,
  p_label text,
  p_amount_cents bigint,
  p_created_by uuid default null
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

  -- The project must belong to this client. A different client's project reads as not found.
  select client_id, name into project_client, project_name from public.projects where id = p_project_id;
  if project_client is null or project_client is distinct from p_client_id then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  if not public.project_launched(p_project_id) then
    raise exception 'NOT_LAUNCHED' using errcode = 'P0001';
  end if;

  -- One plan of a kind per project. If it is still waiting on checkout and the client started it, reuse it
  -- (so they can pick up where they left off). Anything else already open, including a plan an admin made,
  -- means they already have it.
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
    insert into public.service_plans (client_id, project_id, plan_type, label, amount_cents, created_by, source)
    values (p_client_id, p_project_id, p_plan_type, trim(p_label) || ' - ' || project_name, p_amount_cents, p_created_by, 'client_portal')
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
revoke all on function public.create_client_service_plan(uuid, uuid, text, text, bigint, uuid) from public, anon, authenticated;
grant execute on function public.create_client_service_plan(uuid, uuid, text, text, bigint, uuid) to service_role;

comment on function public.create_client_service_plan(uuid, uuid, text, text, bigint, uuid) is
  'Creates (or reuses a pending) plan chosen by the client themselves. Requires the project to belong to the client and to be launched. Called only from the manage-service-plan Edge Function, which sets the amount and label from its own catalog.';

-- ---------------------------------------------------------------------------
-- Activation can also find the plan by the id Stripe carries in the session metadata
-- ---------------------------------------------------------------------------
-- Activation used to match only on the checkout session id we stored. If that ever fails to match, the client
-- has a live, charging subscription while the plan stays Pending. The session metadata carries the plan id, so
-- match on either, and report whether a row was activated so the webhook can flag a miss.

drop function if exists public.activate_service_plan(text, text, text);

create or replace function public.activate_service_plan(
  p_stripe_checkout_session_id text,
  p_stripe_subscription_id text,
  p_stripe_customer_id text,
  p_service_plan_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  changed integer;
begin
  update public.service_plans
    set status = 'active',
        stripe_subscription_id = p_stripe_subscription_id,
        stripe_customer_id = p_stripe_customer_id
    where status = 'pending'
      and (
        stripe_checkout_session_id = p_stripe_checkout_session_id
        or (p_service_plan_id is not null and id = p_service_plan_id)
      );
  get diagnostics changed = row_count;
  return changed > 0;
end;
$$;
revoke all on function public.activate_service_plan(text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.activate_service_plan(text, text, text, uuid) to service_role;
