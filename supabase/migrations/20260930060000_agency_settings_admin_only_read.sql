-- Audit finding (Phase 19): get_agency_settings() only required is_agency()
-- (any active staff), while update_agency_settings() already required
-- is_admin(). Any non-admin staff member (PM, Developer, etc.) navigating
-- directly to /admin/settings could read full agency settings -- business
-- contact info, currency/timezone, invoice/proposal default terms, Stripe
-- processor label. Read-only exposure, not a write hole, but the settings
-- page has always been intended as admin-only (nav hides it from everyone
-- else, and only admins could ever save). Tightening the read RPC to match
-- the write RPC and the page's actual intent.
--
-- get_client_portal_welcome() is untouched -- it's already correctly scoped
-- (client OR agency staff) and only exposes one welcome-message field, a
-- deliberately narrower case.

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
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select * into row from public.agency_settings where id = 1;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  return row;
end;
$$;
