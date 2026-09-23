-- Staff permission scopes hadn't been revisited since Website Care's subscription-plan features
-- (plan templates, care requests, recurring-revenue dashboard, website monitoring, automated
-- backups) were added this session -- all of them reuse the existing projects.*/invoices.*
-- permission codes rather than introducing new ones, so no template automatically gained access to
-- them. Three gaps confirmed with the agency owner:
--
-- 1. Project Manager could trigger a client into choosing a Website Care plan (the Launch Center
--    bridge) but couldn't see the plan templates or the recurring-revenue dashboard themselves.
--    invoices.view (read-only -- invoices.manage, which can edit tiers/pricing, stays
--    Accounting/Admin-only).
-- 2. Accounting had no way to see Care requests at all, even though billing_decision
--    (included vs. billable) is fundamentally a billing call. projects.view -- note this is
--    coarse-grained in this system (no page-level permission split), so it also opens the full
--    project detail page for whatever clients Accounting is assigned to, not Care requests alone;
--    confirmed as acceptable.
-- 3. Sales wanted visibility into recurring revenue (MRR) as a company-wide growth metric.
--    invoices.view.

insert into public.staff_template_permissions (template_key, permission_code) values
  ('project_manager', 'invoices.view'),
  ('accounting', 'projects.view'),
  ('sales', 'invoices.view')
on conflict do nothing;

-- staff_template_permissions is only the DEFAULT for a template -- a real staff member's actual
-- access lives in staff_grants, a per-user snapshot taken when they're invited/assigned that
-- template (see accept_staff_invitation and update_staff_template, both in this file's parent
-- migration). Adding a row above does nothing for anyone already on these templates unless it's
-- also backfilled into staff_grants here. Purely additive (on conflict do nothing) -- this can
-- only grant a permission that literally didn't exist for these templates before this migration,
-- never remove or override a staff member's own customized grants.
insert into public.staff_grants (user_id, permission_code)
select sp.user_id, 'invoices.view'
from public.staff_profiles sp
where sp.template_key in ('project_manager', 'sales')
on conflict do nothing;

insert into public.staff_grants (user_id, permission_code)
select sp.user_id, 'projects.view'
from public.staff_profiles sp
where sp.template_key = 'accounting'
on conflict do nothing;
