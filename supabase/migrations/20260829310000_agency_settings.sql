-- Phase 21.5: agency-level Settings. Singleton row. No secrets.
-- Writes go through SECURITY DEFINER RPCs. Direct table access is denied.

create table public.agency_settings (
  id integer primary key default 1 check (id = 1),
  agency_name text not null default 'MotiveScripts',
  business_email text not null default 'contact-us@motivescripts.com',
  phone text not null default '',
  website text not null default '',
  address text not null default '',
  timezone text not null default 'UTC',
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  logo_url text not null default '',
  primary_color text not null default '#0050f0',
  secondary_color text not null default '#001030',
  support_email text not null default 'support@motivescripts.com',
  email_from_name text not null default 'MotiveScripts',
  email_from_address text not null default 'no-reply@motivescripts.com',
  email_reply_to text not null default 'support@motivescripts.com',
  default_proposal_valid_days integer not null default 30
    check (default_proposal_valid_days between 1 and 365),
  default_proposal_introduction text not null default '',
  default_proposal_overview text not null default '',
  default_proposal_scope text not null default '',
  default_proposal_deliverables text not null default '',
  default_proposal_timeline text not null default '',
  default_proposal_payment_terms text not null default '',
  default_proposal_terms text not null default '',
  default_proposal_notes text not null default '',
  default_contract_terms text not null default '',
  default_invoice_due_days integer not null default 14
    check (default_invoice_due_days between 1 and 365),
  default_invoice_payment_terms text not null default '',
  default_invoice_notes text not null default '',
  client_portal_welcome_message text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

comment on table public.agency_settings is
  'Singleton agency configuration. Secrets (Stripe, Resend, service-role) are not stored here.';

insert into public.agency_settings (
  id,
  agency_name,
  business_email,
  support_email,
  email_from_name,
  email_from_address,
  email_reply_to,
  default_proposal_valid_days,
  default_proposal_introduction,
  default_proposal_overview,
  default_proposal_scope,
  default_proposal_deliverables,
  default_proposal_timeline,
  default_proposal_payment_terms,
  default_proposal_terms,
  default_proposal_notes,
  default_contract_terms,
  default_invoice_due_days,
  default_invoice_payment_terms,
  default_invoice_notes,
  client_portal_welcome_message
) values (
  1,
  'MotiveScripts',
  'contact-us@motivescripts.com',
  'support@motivescripts.com',
  'MotiveScripts',
  'no-reply@motivescripts.com',
  'support@motivescripts.com',
  30,
  $ms$Thank you for considering MotiveScripts. This proposal describes the website we recommend, what is included, and how we work together through launch.$ms$,
  $ms$We will design and develop a professional website for this business: clear pages, a straightforward path for visitors to get in touch, and a site that works well on phones and desktops.$ms$,
  $ms$Homepage
Responsive Website Design
Mobile Optimization$ms$,
  $ms$Use the Features buttons above to list standard inclusions, or write the deliverables here.$ms$,
  $ms$Typical timeline after we receive content and a kickoff confirmation:

Week 1 — Discovery and sitemap
Weeks 2–3 — Design direction
Weeks 4–5 — Build and review
Week 6 — Revisions, launch checklist, and go-live

Dates shift if content or feedback is delayed.$ms$,
  $ms$A 50% deposit is due to start. The remaining 50% is due before the website goes live.

After the deposit is paid and work has started, the client has 5 business days to change their mind and receive a refund of that deposit. After those 5 business days, the deposit cannot be refunded.

Invoices are issued from MotiveScripts and can be paid through the client portal. Work pauses if an invoice stays unpaid past the due date. This proposal does not charge a card by itself.$ms$,
  $ms$This proposal is an offer from MotiveScripts for the scope and investment shown. It is valid until the date on this document.

Accepting this proposal in the client portal confirms agreement to this scope, investment, and these terms. It is not a qualified digital signature and is not a substitute for legal advice.

The price covers the listed scope. New pages, features, or rounds of revision beyond what is written here may need an updated proposal.

The client provides logos, photos, and written content needed to complete the work. MotiveScripts provides the design and development described here.

After full payment, the client owns the final approved website work created uniquely for them. MotiveScripts tools, frameworks, and prior materials stay with MotiveScripts.

Either party may pause or end the work with written notice if the other party does not meet its responsibilities after a reasonable chance to fix the issue.$ms$,
  $ms$Questions before you accept? Reply in the client portal or email us and we will adjust this draft.$ms$,
  $ms$This agreement is a software workflow record of the business terms the Client reviewed in the MotiveScripts portal. It is not a substitute for counsel. Electronic acceptance here records the authenticated user’s agreement; it is not a qualified digital signature under every jurisdiction’s e-sign rules.$ms$,
  14,
  $ms$Invoices are issued from MotiveScripts and can be paid through the client portal. Work pauses if an invoice stays unpaid past the due date.$ms$,
  '',
  'Welcome to your MotiveScripts project portal.'
);

alter table public.agency_settings enable row level security;

revoke all on table public.agency_settings from public, anon, authenticated;

create or replace function public.agency_email_ok(p_value text)
returns boolean
language sql
immutable
as $$
  select p_value ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$';
$$;

create or replace function public.agency_color_ok(p_value text)
returns boolean
language sql
immutable
as $$
  select p_value ~ '^#[0-9A-Fa-f]{6}$';
$$;

create or replace function public.get_agency_settings()
returns public.agency_settings
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  row public.agency_settings;
begin
  if not public.is_agency() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select * into row from public.agency_settings where id = 1;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  return row;
end;
$$;

create or replace function public.get_client_portal_welcome()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  message text;
begin
  if not exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'client'
  ) and not public.is_agency() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select client_portal_welcome_message into message
  from public.agency_settings
  where id = 1;
  return coalesce(message, '');
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
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception 'Settings could not be saved.' using errcode = 'P0001';
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

create or replace function public.update_own_profile(
  p_full_name text default null,
  p_job_title text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_agency() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if p_full_name is not null then
    if char_length(trim(p_full_name)) > 120 then
      raise exception 'Name is too long.' using errcode = 'P0001';
    end if;
    update public.profiles
    set full_name = trim(p_full_name)
    where id = auth.uid();
  end if;
  if p_job_title is not null then
    if char_length(trim(p_job_title)) > 80 then
      raise exception 'Job title is too long.' using errcode = 'P0001';
    end if;
    update public.staff_profiles
    set job_title = trim(p_job_title),
        updated_at = now()
    where user_id = auth.uid();
  end if;
end;
$$;

-- New proposals only: validity comes from Settings. Existing revisions are unchanged.
create or replace function public.create_proposal(
  p_client_id uuid,
  p_project_id uuid default null,
  p_title text default 'Website proposal'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  pid uuid;
  rid uuid;
  v_days integer := 30;
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if not exists (select 1 from public.clients where id = p_client_id) then
    raise exception 'CLIENT_NOT_FOUND' using errcode = 'P0001';
  end if;
  select least(greatest(coalesce(default_proposal_valid_days, 30), 1), 365)
    into v_days
  from public.agency_settings
  where id = 1;
  if v_days is null then
    v_days := 30;
  end if;
  perform set_config('app.document_rpc', '1', true);
  insert into public.proposals (client_id, project_id, proposal_number, created_by)
  values (p_client_id, p_project_id, public.next_document_number('proposal'), auth.uid())
  returning id into pid;

  insert into public.proposal_revisions (
    proposal_id, revision_number, status, title, created_by, valid_until
  )
  values (
    pid, 1, 'draft', coalesce(nullif(trim(p_title), ''), 'Website proposal'), auth.uid(),
    (current_date + v_days)
  )
  returning id into rid;

  update public.proposals set working_revision_id = rid where id = pid;
  perform public.record_document_activity(p_client_id, p_project_id, 'proposal_created', 'Proposal created');
  return pid;
end;
$$;

-- New contracts only: Settings terms replace the template general_terms when set.
create or replace function public.create_contract(
  p_client_id uuid,
  p_project_id uuid default null,
  p_proposal_id uuid default null,
  p_title text default 'Website Development Agreement'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  cid uuid;
  rid uuid;
  company text;
  tmpl jsonb;
  pub public.proposal_revisions;
  prop public.proposals;
  copy_scope text := '';
  copy_timeline text := '';
  copy_payment text := '';
  copy_compensation text := '';
  v_project_id uuid := p_project_id;
  v_terms text;
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if not exists (select 1 from public.clients where id = p_client_id) then
    raise exception 'CLIENT_NOT_FOUND' using errcode = 'P0001';
  end if;
  if p_proposal_id is not null then
    select * into prop from public.proposals where id = p_proposal_id;
    if not found or prop.client_id is distinct from p_client_id then
      raise exception 'Not allowed' using errcode = '42501';
    end if;
    if prop.published_revision_id is null then
      raise exception 'INVALID_STATUS' using errcode = 'P0001';
    end if;
    select * into pub from public.proposal_revisions where id = prop.published_revision_id;
    if pub.status <> 'accepted' then
      raise exception 'INVALID_STATUS' using errcode = 'P0001';
    end if;
    copy_scope := pub.scope;
    copy_timeline := pub.timeline;
    copy_payment := pub.payment_terms;
    copy_compensation :=
      'Investment: $' || (pub.investment_cents / 100)::text || '.' || lpad((pub.investment_cents % 100)::text, 2, '0');
    v_project_id := coalesce(p_project_id, prop.project_id);
  end if;
  select business_name into company from public.clients where id = p_client_id;
  tmpl := public.website_contract_template(company);
  select nullif(trim(default_contract_terms), '') into v_terms
  from public.agency_settings
  where id = 1;
  perform set_config('app.document_rpc', '1', true);
  insert into public.contracts (client_id, project_id, proposal_id, contract_number, created_by)
  values (p_client_id, v_project_id, p_proposal_id, public.next_document_number('contract'), auth.uid())
  returning id into cid;

  insert into public.contract_revisions (
    contract_id, revision_number, status, title, parties, scope, responsibilities, timeline,
    compensation, payment_terms, confidentiality, intellectual_property, revisions_policy,
    termination, general_terms, effective_date, created_by
  )
  values (
    cid, 1, 'draft',
    coalesce(nullif(trim(p_title), ''), tmpl->>'title'),
    tmpl->>'parties',
    coalesce(nullif(trim(copy_scope), ''), tmpl->>'scope'),
    tmpl->>'responsibilities',
    coalesce(nullif(trim(copy_timeline), ''), tmpl->>'timeline'),
    coalesce(nullif(trim(copy_compensation), ''), tmpl->>'compensation'),
    coalesce(nullif(trim(copy_payment), ''), tmpl->>'payment_terms'),
    tmpl->>'confidentiality',
    tmpl->>'intellectual_property',
    tmpl->>'revisions_policy',
    tmpl->>'termination',
    coalesce(v_terms, tmpl->>'general_terms'),
    current_date,
    auth.uid()
  )
  returning id into rid;

  update public.contracts set working_revision_id = rid where id = cid;
  perform public.record_document_activity(p_client_id, v_project_id, 'contract_created', 'Contract created');
  return cid;
end;
$$;

revoke all on function public.agency_email_ok(text) from public, anon, authenticated;
revoke all on function public.agency_color_ok(text) from public, anon, authenticated;
revoke all on function public.get_agency_settings() from public, anon;
revoke all on function public.get_client_portal_welcome() from public, anon;
revoke all on function public.update_agency_settings(jsonb) from public, anon;
revoke all on function public.update_own_profile(text, text) from public, anon;

grant execute on function public.get_agency_settings() to authenticated;
grant execute on function public.get_client_portal_welcome() to authenticated;
grant execute on function public.update_agency_settings(jsonb) to authenticated;
grant execute on function public.update_own_profile(text, text) to authenticated;
