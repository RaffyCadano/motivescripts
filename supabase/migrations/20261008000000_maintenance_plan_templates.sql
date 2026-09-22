-- Website Care plan tiers (Essential / Business / Pro, or whatever the agency wants to call
-- them) as an admin-editable catalog. This is a TEMPLATE only -- assigning one to a client
-- copies its price/label/included hours onto that client's service_plans row (see
-- 20261008010000_service_plans_maintenance_extensions.sql), so editing a template later never
-- retroactively changes what an existing subscriber is already paying for, the same principle
-- Stripe applies to prices on a product. An admin can still build a fully custom plan without a
-- template, exactly as service_plans already allows today.

create table public.maintenance_plan_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  description text not null default '',
  monthly_price_cents bigint not null check (monthly_price_cents >= 50),
  included_hours numeric(6,2) not null default 0 check (included_hours >= 0),
  -- Free-form list of what the tier includes ("Hosting", "SSL", "Uptime monitoring", ...). Kept
  -- as jsonb rather than a separate table -- there is no need to query into it, only to display
  -- and edit it as a whole, and it keeps the admin editor a single form.
  included_services jsonb not null default '[]'::jsonb,
  overage_rate_cents bigint check (overage_rate_cents is null or overage_rate_cents >= 0),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);

create index maintenance_plan_templates_active_idx on public.maintenance_plan_templates (is_active, sort_order);

create trigger maintenance_plan_templates_set_updated_at
  before update on public.maintenance_plan_templates
  for each row execute function public.set_updated_at();

alter table public.maintenance_plan_templates enable row level security;

-- Any signed-in user may see active tiers (a client choosing a plan needs to see what's on
-- offer); only staff with invoices.manage may see retired ones or write at all, matching the
-- financial-config precedent already used for other admin-only settings.
create policy maintenance_plan_templates_select on public.maintenance_plan_templates for select to authenticated
  using (is_active or public.has_grant('invoices.manage'));

create policy maintenance_plan_templates_staff_write on public.maintenance_plan_templates for all to authenticated
  using (public.has_grant('invoices.manage'))
  with check (public.has_grant('invoices.manage'));

revoke all on public.maintenance_plan_templates from public, anon;
grant select on public.maintenance_plan_templates to authenticated;
grant insert, update, delete on public.maintenance_plan_templates to authenticated;
grant all on public.maintenance_plan_templates to service_role;

comment on table public.maintenance_plan_templates is
  'Admin-editable Website Care plan tier catalog. A template is a starting point copied onto a service_plans row when assigned -- editing it later does not change existing subscribers.';

-- Seed three example tiers so the admin screen is never empty on a fresh install. All fully
-- editable/retirable -- these are starting points, not fixed products.
insert into public.maintenance_plan_templates
  (name, description, monthly_price_cents, included_hours, included_services, overage_rate_cents, sort_order)
values
  (
    'Essential',
    'Keeps the site online, secure, and backed up.',
    4900, 0,
    '["Hosting", "SSL certificate", "Uptime monitoring", "Automated backups", "Basic technical maintenance", "Basic email support"]'::jsonb,
    9000, 10
  ),
  (
    'Business',
    'Everything in Essential, plus regular content updates and priority support.',
    14900, 2,
    '["Everything in Essential", "Content updates", "Minor design changes", "Performance monitoring", "Priority support", "2 hours of included updates/month"]'::jsonb,
    8500, 20
  ),
  (
    'Pro',
    'Everything in Business, plus more hours and proactive SEO/performance work.',
    29900, 5,
    '["Everything in Business", "5 hours of included updates/month", "Advanced monitoring", "SEO maintenance", "Priority support", "Monthly maintenance review"]'::jsonb,
    8000, 30
  );
