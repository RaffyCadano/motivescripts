-- maintenance_plan_templates_select (20261008000000) only showed retired (is_active = false) tiers
-- to staff with invoices.manage. Project Manager and Sales were just given invoices.view (read-only
-- visibility into plan templates and recurring revenue), so they could reach /admin/maintenance-plans
-- but only ever saw active tiers -- retired ones silently missing, no error, just a shorter list
-- than Accounting/Admin see on the same page. Read access should see everything; only writing stays
-- invoices.manage-gated (maintenance_plan_templates_staff_write, unchanged).

drop policy if exists maintenance_plan_templates_select on public.maintenance_plan_templates;
create policy maintenance_plan_templates_select on public.maintenance_plan_templates for select to authenticated
  using (is_active or public.has_grant('invoices.view'));

comment on policy maintenance_plan_templates_select on public.maintenance_plan_templates is
  'Anyone with invoices.view sees every tier, active or retired -- editing still requires invoices.manage (maintenance_plan_templates_staff_write). Previously required invoices.manage just to see a retired tier, which silently shortened the list for invoices.view-only staff (Project Manager, Sales).';
