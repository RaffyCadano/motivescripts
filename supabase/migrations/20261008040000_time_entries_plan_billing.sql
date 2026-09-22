-- Lets staff logging time against a Website Care task tag it as covered by the client's plan
-- (included) or as billable overage, against the specific plan it applies to. Reuses the existing
-- time-tracking flow instead of a parallel maintenance-usage table -- "hours used this period" is
-- just a sum over these two new columns. No RLS change needed: time_entries' existing policies
-- already scope by project/staff, which is all that's needed here too.

alter table public.time_entries
  add column if not exists service_plan_id uuid references public.service_plans (id) on delete set null,
  add column if not exists billing_type text not null default 'included' check (billing_type in ('included', 'billable'));

create index if not exists time_entries_service_plan_idx
  on public.time_entries (service_plan_id, entry_date)
  where service_plan_id is not null;

comment on column public.time_entries.service_plan_id is
  'When this time entry is Website Care work, the plan it counts against. Null for ordinary project time.';
comment on column public.time_entries.billing_type is
  'included: counts against the plan''s included_hours_monthly allowance. billable: overage work, billed separately (does not consume the allowance).';
