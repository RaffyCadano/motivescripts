-- Default proposal line prices. New proposals and newly added chips only.
-- Existing proposal_items, contracts, and invoices are not rewritten.

alter table public.agency_settings
  add column if not exists default_proposal_website_cents integer not null default 250000
    check (default_proposal_website_cents between 0 and 99999999),
  add column if not exists default_addon_quote_request_form_cents integer not null default 15000
    check (default_addon_quote_request_form_cents between 0 and 99999999),
  add column if not exists default_addon_booking_form_cents integer not null default 25000
    check (default_addon_booking_form_cents between 0 and 99999999),
  add column if not exists default_addon_social_media_cents integer not null default 10000
    check (default_addon_social_media_cents between 0 and 99999999),
  add column if not exists default_addon_business_email_cents integer not null default 10000
    check (default_addon_business_email_cents between 0 and 99999999),
  add column if not exists default_addon_domain_cents integer not null default 2500
    check (default_addon_domain_cents between 0 and 99999999),
  add column if not exists default_addon_hosting_setup_cents integer not null default 15000
    check (default_addon_hosting_setup_cents between 0 and 99999999);

comment on column public.agency_settings.default_proposal_website_cents is
  'Default website line price in integer cents. Used when creating a new proposal draft line. Existing documents are unchanged.';

create or replace function public.agency_cents_from_patch(p_patch jsonb, p_key text, p_fallback integer)
returns integer
language plpgsql
immutable
as $$
declare
  v integer;
begin
  if p_patch is null or not (p_patch ? p_key) then
    return p_fallback;
  end if;
  begin
    v := (p_patch->>p_key)::integer;
  exception when others then
    raise exception 'Enter a valid dollar amount.' using errcode = 'P0001';
  end;
  if v is null then
    return p_fallback;
  end if;
  if v < 0 or v > 99999999 then
    raise exception 'Price must be between $0.00 and $999,999.99.' using errcode = 'P0001';
  end if;
  return v;
end;
$$;

create or replace function public.update_agency_settings(p_patch jsonb)
returns public.agency_settings
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.agency_settings;
  current public.agency_settings;
  v_name text;
  v_business_email text;
  v_phone text;
  v_website text;
  v_address text;
  v_timezone text;
  v_currency text;
  v_primary text;
  v_secondary text;
  v_support text;
  v_from_name text;
  v_from_email text;
  v_reply text;
  v_proposal_days integer;
  v_invoice_days integer;
  v_website_cents integer;
  v_quote_cents integer;
  v_booking_cents integer;
  v_social_cents integer;
  v_email_cents integer;
  v_domain_cents integer;
  v_hosting_cents integer;
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception 'Settings could not be saved.' using errcode = 'P0001';
  end if;

  select * into current from public.agency_settings where id = 1;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  v_name := trim(coalesce(p_patch->>'agency_name', ''));
  v_business_email := lower(trim(coalesce(p_patch->>'business_email', '')));
  v_phone := trim(coalesce(p_patch->>'phone', ''));
  v_website := trim(coalesce(p_patch->>'website', ''));
  v_address := trim(coalesce(p_patch->>'address', ''));
  v_timezone := trim(coalesce(p_patch->>'timezone', ''));
  v_currency := upper(trim(coalesce(p_patch->>'currency', '')));
  v_primary := trim(coalesce(p_patch->>'primary_color', ''));
  v_secondary := trim(coalesce(p_patch->>'secondary_color', ''));
  v_support := lower(trim(coalesce(p_patch->>'support_email', '')));
  v_from_name := trim(coalesce(p_patch->>'email_from_name', ''));
  v_from_email := lower(trim(coalesce(p_patch->>'email_from_address', '')));
  v_reply := lower(trim(coalesce(p_patch->>'email_reply_to', '')));

  if v_name = '' or char_length(v_name) > 120 then
    raise exception 'Enter an agency name (120 characters or fewer).' using errcode = 'P0001';
  end if;
  if not public.agency_email_ok(v_business_email) then
    raise exception 'Enter a valid business email.' using errcode = 'P0001';
  end if;
  if char_length(v_phone) > 40 then
    raise exception 'Phone is too long.' using errcode = 'P0001';
  end if;
  if char_length(v_website) > 200 then
    raise exception 'Website is too long.' using errcode = 'P0001';
  end if;
  if char_length(v_address) > 500 then
    raise exception 'Address is too long.' using errcode = 'P0001';
  end if;
  if v_timezone = '' or char_length(v_timezone) > 64 then
    raise exception 'Choose a timezone.' using errcode = 'P0001';
  end if;
  if v_currency !~ '^[A-Z]{3}$' then
    raise exception 'Currency must be a 3-letter code such as USD.' using errcode = 'P0001';
  end if;
  if not public.agency_color_ok(v_primary) then
    raise exception 'Primary color must be a hex value such as #0050f0.' using errcode = 'P0001';
  end if;
  if not public.agency_color_ok(v_secondary) then
    raise exception 'Secondary color must be a hex value such as #001030.' using errcode = 'P0001';
  end if;
  if not public.agency_email_ok(v_support) then
    raise exception 'Enter a valid support email.' using errcode = 'P0001';
  end if;
  if v_from_name = '' or char_length(v_from_name) > 120 then
    raise exception 'Enter an email from name.' using errcode = 'P0001';
  end if;
  if not public.agency_email_ok(v_from_email) then
    raise exception 'Enter a valid from email.' using errcode = 'P0001';
  end if;
  if not public.agency_email_ok(v_reply) then
    raise exception 'Enter a valid reply-to email.' using errcode = 'P0001';
  end if;

  begin
    v_proposal_days := greatest(1, least(365, coalesce((p_patch->>'default_proposal_valid_days')::integer, 30)));
  exception when others then
    raise exception 'Proposal validity must be between 1 and 365 days.' using errcode = 'P0001';
  end;
  begin
    v_invoice_days := greatest(1, least(365, coalesce((p_patch->>'default_invoice_due_days')::integer, 14)));
  exception when others then
    raise exception 'Invoice due period must be between 1 and 365 days.' using errcode = 'P0001';
  end;

  v_website_cents := public.agency_cents_from_patch(p_patch, 'default_proposal_website_cents', current.default_proposal_website_cents);
  v_quote_cents := public.agency_cents_from_patch(p_patch, 'default_addon_quote_request_form_cents', current.default_addon_quote_request_form_cents);
  v_booking_cents := public.agency_cents_from_patch(p_patch, 'default_addon_booking_form_cents', current.default_addon_booking_form_cents);
  v_social_cents := public.agency_cents_from_patch(p_patch, 'default_addon_social_media_cents', current.default_addon_social_media_cents);
  v_email_cents := public.agency_cents_from_patch(p_patch, 'default_addon_business_email_cents', current.default_addon_business_email_cents);
  v_domain_cents := public.agency_cents_from_patch(p_patch, 'default_addon_domain_cents', current.default_addon_domain_cents);
  v_hosting_cents := public.agency_cents_from_patch(p_patch, 'default_addon_hosting_setup_cents', current.default_addon_hosting_setup_cents);

  update public.agency_settings
  set
    agency_name = v_name,
    business_email = v_business_email,
    phone = v_phone,
    website = v_website,
    address = v_address,
    timezone = v_timezone,
    currency = v_currency,
    primary_color = v_primary,
    secondary_color = v_secondary,
    support_email = v_support,
    email_from_name = v_from_name,
    email_from_address = v_from_email,
    email_reply_to = v_reply,
    default_proposal_valid_days = v_proposal_days,
    default_proposal_introduction = left(coalesce(p_patch->>'default_proposal_introduction', ''), 20000),
    default_proposal_overview = left(coalesce(p_patch->>'default_proposal_overview', ''), 20000),
    default_proposal_scope = left(coalesce(p_patch->>'default_proposal_scope', ''), 20000),
    default_proposal_deliverables = left(coalesce(p_patch->>'default_proposal_deliverables', ''), 20000),
    default_proposal_timeline = left(coalesce(p_patch->>'default_proposal_timeline', ''), 20000),
    default_proposal_payment_terms = left(coalesce(p_patch->>'default_proposal_payment_terms', ''), 20000),
    default_proposal_terms = left(coalesce(p_patch->>'default_proposal_terms', ''), 20000),
    default_proposal_notes = left(coalesce(p_patch->>'default_proposal_notes', ''), 20000),
    default_contract_terms = left(coalesce(p_patch->>'default_contract_terms', ''), 20000),
    default_invoice_due_days = v_invoice_days,
    default_invoice_payment_terms = left(coalesce(p_patch->>'default_invoice_payment_terms', ''), 20000),
    default_invoice_notes = left(coalesce(p_patch->>'default_invoice_notes', ''), 20000),
    client_portal_welcome_message = left(coalesce(p_patch->>'client_portal_welcome_message', ''), 2000),
    default_proposal_website_cents = v_website_cents,
    default_addon_quote_request_form_cents = v_quote_cents,
    default_addon_booking_form_cents = v_booking_cents,
    default_addon_social_media_cents = v_social_cents,
    default_addon_business_email_cents = v_email_cents,
    default_addon_domain_cents = v_domain_cents,
    default_addon_hosting_setup_cents = v_hosting_cents,
    updated_at = now(),
    updated_by = auth.uid()
  where id = 1
  returning * into row;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  return row;
end;
$$;

revoke all on function public.agency_cents_from_patch(jsonb, text, integer) from public, anon, authenticated;
grant execute on function public.update_agency_settings(jsonb) to authenticated;
