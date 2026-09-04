-- Explicit per-project billing mode. Fixed projects can carry a budgeted-hours
-- target to compare against logged time; hourly projects carry a rate used to
-- generate invoice line items from time entries.

alter table public.projects
  add column if not exists billing_mode text not null default 'fixed'
    check (billing_mode in ('fixed', 'hourly')),
  add column if not exists hourly_rate_cents bigint
    check (hourly_rate_cents is null or hourly_rate_cents >= 0),
  add column if not exists budgeted_hours numeric(7,2)
    check (budgeted_hours is null or budgeted_hours >= 0);

comment on column public.projects.billing_mode is 'fixed or hourly. Drives Time tab framing and whether invoice items can be generated from time entries.';
comment on column public.projects.hourly_rate_cents is 'Rate used when generating invoice items from unbilled time entries. Only meaningful when billing_mode = hourly.';
comment on column public.projects.budgeted_hours is 'Optional target for fixed-fee projects, to compare against actual logged hours.';
