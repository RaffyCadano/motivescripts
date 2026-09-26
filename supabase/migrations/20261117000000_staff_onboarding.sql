-- Staff onboarding: what a new team member fills in the first time they sign in, before they can work.
--
--   * a row exists only once someone has finished onboarding, so "no row" means "still to do";
--   * they can read their own row and admins can read every row, but nobody writes to the table directly:
--     the only way in is submit_staff_onboarding(), which checks the answers, and the only way out is
--     admin_reset_staff_onboarding(), which makes someone do it again (a new agreement, wrong payout details);
--   * the exact agreement text they accepted is kept on the row, with their typed name and the time, as the
--     record of what they agreed to.
--
-- Tax forms and bank numbers are deliberately not collected here: only a Zelle contact or a PayPal email, the
-- same two payout details the Payroll page already records.

create table if not exists public.staff_onboarding (
  user_id uuid primary key references public.staff_profiles (user_id) on delete cascade,
  legal_name text not null check (length(btrim(legal_name)) between 2 and 120),
  phone text not null check (length(btrim(phone)) between 5 and 40),
  emergency_name text not null default '' check (length(emergency_name) <= 120),
  emergency_phone text not null default '' check (length(emergency_phone) <= 40),
  zelle_contact text not null default '' check (length(zelle_contact) <= 160),
  paypal_email text not null default '' check (length(paypal_email) <= 160),
  agreement_version text not null check (length(agreement_version) between 1 and 40),
  agreement_text text not null check (length(agreement_text) between 1 and 20000),
  signed_name text not null check (length(btrim(signed_name)) between 2 and 120),
  agreement_accepted_at timestamptz not null default now(),
  completed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (btrim(zelle_contact) <> '' or btrim(paypal_email) <> '')
);

alter table public.staff_onboarding enable row level security;

revoke all on public.staff_onboarding from public, anon, authenticated;
grant select on public.staff_onboarding to authenticated;

drop policy if exists staff_onboarding_select on public.staff_onboarding;
create policy staff_onboarding_select on public.staff_onboarding
  for select to authenticated
  using (public.is_admin() or user_id = auth.uid());

comment on table public.staff_onboarding is
  'One row per team member who has finished onboarding. No row = still to do. Written only by submit_staff_onboarding().';

create or replace function public.submit_staff_onboarding(
  p_legal_name text,
  p_phone text,
  p_emergency_name text,
  p_emergency_phone text,
  p_zelle_contact text,
  p_paypal_email text,
  p_agreement_version text,
  p_agreement_text text,
  p_signed_name text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  legal text := btrim(coalesce(p_legal_name, ''));
  signed text := btrim(coalesce(p_signed_name, ''));
  zelle text := btrim(coalesce(p_zelle_contact, ''));
  paypal text := btrim(coalesce(p_paypal_email, ''));
begin
  if uid is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if not exists (select 1 from public.staff_profiles where user_id = uid and is_active) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if length(legal) < 2 then
    raise exception 'NAME_REQUIRED' using errcode = 'P0001';
  end if;
  if length(btrim(coalesce(p_phone, ''))) < 5 then
    raise exception 'PHONE_REQUIRED' using errcode = 'P0001';
  end if;
  if zelle = '' and paypal = '' then
    raise exception 'PAYOUT_REQUIRED' using errcode = 'P0001';
  end if;
  if paypal <> '' and paypal !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'PAYPAL_INVALID' using errcode = 'P0001';
  end if;
  if coalesce(btrim(p_agreement_text), '') = '' or coalesce(btrim(p_agreement_version), '') = '' then
    raise exception 'AGREEMENT_REQUIRED' using errcode = 'P0001';
  end if;
  -- Typing the full legal name again is the signature.
  if lower(regexp_replace(signed, '\s+', ' ', 'g')) <> lower(regexp_replace(legal, '\s+', ' ', 'g')) then
    raise exception 'SIGNATURE_MISMATCH' using errcode = 'P0001';
  end if;

  insert into public.staff_onboarding as o (
    user_id, legal_name, phone, emergency_name, emergency_phone, zelle_contact, paypal_email,
    agreement_version, agreement_text, signed_name
  ) values (
    uid, legal, btrim(p_phone), btrim(coalesce(p_emergency_name, '')), btrim(coalesce(p_emergency_phone, '')),
    zelle, paypal, btrim(p_agreement_version), p_agreement_text, signed
  )
  on conflict (user_id) do update set
    legal_name = excluded.legal_name,
    phone = excluded.phone,
    emergency_name = excluded.emergency_name,
    emergency_phone = excluded.emergency_phone,
    zelle_contact = excluded.zelle_contact,
    paypal_email = excluded.paypal_email,
    agreement_version = excluded.agreement_version,
    agreement_text = excluded.agreement_text,
    signed_name = excluded.signed_name,
    agreement_accepted_at = now(),
    completed_at = now(),
    updated_at = now();
end;
$$;

revoke all on function public.submit_staff_onboarding(text, text, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.submit_staff_onboarding(text, text, text, text, text, text, text, text, text) to authenticated;

-- An admin makes someone do onboarding again (the agreement changed, or the payout details are wrong).
create or replace function public.admin_reset_staff_onboarding(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  delete from public.staff_onboarding where user_id = p_user_id;
end;
$$;

revoke all on function public.admin_reset_staff_onboarding(uuid) from public, anon;
grant execute on function public.admin_reset_staff_onboarding(uuid) to authenticated;
