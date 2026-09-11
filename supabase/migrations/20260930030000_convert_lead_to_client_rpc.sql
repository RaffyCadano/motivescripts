-- Audit finding: lead-to-client conversion was three separate plain writes
-- from the browser (insert clients, update client_staff_data, update leads)
-- with no transaction and no server-side dedupe -- only a stale in-memory
-- check (`lead.convertedClientId`). A double-click or two tabs before state
-- refreshed could create two client rows for one lead.
--
-- Moves the whole conversion into one SECURITY DEFINER RPC, matching the
-- existing pattern for other multi-step document actions (create_contract,
-- create_invoice): a `for update` row lock on the source row serializes
-- concurrent calls, and an idempotency check makes a repeat call a no-op
-- that returns the existing client instead of creating a second one.
-- clients.source_lead_id gets a unique constraint as a DB-level backstop
-- for any other write path. Verified no existing duplicates in Sandbox data
-- before adding it.

create unique index if not exists clients_source_lead_id_uidx
  on public.clients (source_lead_id)
  where source_lead_id is not null;

create or replace function public.convert_lead_to_client(p_lead_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  lead_row public.leads;
  existing_client_id uuid;
  new_client_id uuid;
  now_ts timestamptz := now();
begin
  if not (public.has_grant('leads.manage') and public.has_grant('clients.manage')) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select * into lead_row from public.leads where id = p_lead_id for update;
  if not found then
    raise exception 'LEAD_NOT_FOUND' using errcode = 'P0001';
  end if;

  -- Idempotent: a repeat call (double-click, second tab) after the first
  -- has committed just returns the client that already exists instead of
  -- raising or creating a duplicate.
  if lead_row.client_id is not null then
    return lead_row.client_id;
  end if;

  select id into existing_client_id from public.clients where source_lead_id = p_lead_id;
  if existing_client_id is not null then
    update public.leads
      set status = 'Won', client_id = existing_client_id, converted_at = coalesce(converted_at, now_ts)
      where id = p_lead_id;
    return existing_client_id;
  end if;

  insert into public.clients (
    contact_name, business_name, email, phone, industry, website, location, status, source, source_lead_id
  )
  values (
    lead_row.name, lead_row.business_name, lead_row.email, lead_row.phone, lead_row.industry,
    '', '', 'Active', lead_row.source, p_lead_id
  )
  returning id into new_client_id;

  update public.client_staff_data
    set activity = jsonb_build_array(
      jsonb_build_object('id', 'cact-' || substr(gen_random_uuid()::text, 1, 8), 'description', 'Client converted from lead', 'createdAt', now_ts, 'icon', 'converted'),
      jsonb_build_object('id', 'cact-' || substr(gen_random_uuid()::text, 1, 8), 'description', 'Client record created', 'createdAt', now_ts, 'icon', 'created')
    )
  where client_id = new_client_id;

  update public.leads
    set status = 'Won',
        client_id = new_client_id,
        converted_at = now_ts,
        activity = jsonb_build_array(
          jsonb_build_object('id', 'act-' || substr(gen_random_uuid()::text, 1, 8), 'description', 'Lead converted to client', 'createdAt', now_ts)
        ) || coalesce(lead_row.activity, '[]'::jsonb)
  where id = p_lead_id;

  return new_client_id;
end;
$$;

revoke all on function public.convert_lead_to_client(uuid) from public, anon;
grant execute on function public.convert_lead_to_client(uuid) to authenticated;

comment on function public.convert_lead_to_client(uuid) is
  'Converts a lead to a client atomically (requires leads.manage + clients.manage). Idempotent: a repeat call returns the already-converted client instead of creating a duplicate.';
