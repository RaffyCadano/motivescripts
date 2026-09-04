-- Estimated effort per task, in hours. Used by the PM capacity/workload view
-- to forecast staffing load — not tied to actual logged time.

alter table public.tasks
  add column if not exists estimated_hours numeric(6,2)
    check (estimated_hours is null or estimated_hours >= 0);

comment on column public.tasks.estimated_hours is
  'PM-entered effort estimate in hours. Forward-looking planning input, not actual time logged.';
