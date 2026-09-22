-- Makes "SEO maintenance" genuinely Pro-exclusive: previously it was just the 'seo' request_type
-- category, which every tier can already submit -- nothing distinguished Pro. Adds a second,
-- independent monthly recurring task (parallel to 20261015000000's Monthly maintenance review,
-- same idempotent pattern) for a dedicated SEO check, gated by its own admin-editable tier flag so
-- a tier can offer SEO review without the general maintenance review, or vice versa.

alter table public.maintenance_plan_templates
  add column if not exists seo_included boolean not null default false;

comment on column public.maintenance_plan_templates.seo_included is
  '"SEO maintenance": a plan on this tier gets a recurring SEO review task auto-created on the 1st of each month (create_monthly_seo_review_tasks), independent of review_included.';

update public.maintenance_plan_templates set seo_included = true where name = 'Pro';

create or replace function public.create_monthly_seo_review_tasks()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month_start date := date_trunc('month', (timezone('utc', now()))::date)::date;
  v_plan record;
  v_title text;
begin
  v_title := 'Monthly SEO review — ' || to_char(v_month_start, 'FMMonth YYYY');

  for v_plan in
    select sp.id as plan_id, sp.project_id, sp.client_id, sp.label
    from public.service_plans sp
    join public.maintenance_plan_templates mpt on mpt.id = sp.plan_template_id
    where sp.plan_type = 'care'
      and sp.status in ('active', 'past_due')
      and mpt.seo_included
      and sp.project_id is not null
  loop
    begin
      -- Idempotent per project per month, same guard as create_monthly_maintenance_review_tasks.
      if exists (
        select 1 from public.tasks
        where project_id = v_plan.project_id
          and title = v_title
          and created_at >= v_month_start
      ) then
        continue;
      end if;

      insert into public.tasks (project_id, title, description, status, priority)
      values (
        v_plan.project_id,
        v_title,
        'Scheduled monthly SEO check for the ' || v_plan.label || ' Website Care plan: review search visibility and rankings, check for technical SEO issues (broken links, missing metadata, slow pages), and note opportunities to raise as a care request.',
        'Todo',
        'Medium'
      );
    exception
      when others then
        raise warning 'create_monthly_seo_review_tasks: failed for plan %: %', v_plan.plan_id, sqlerrm;
    end;
  end loop;
end;
$$;

comment on function public.create_monthly_seo_review_tasks() is
  'Scheduled via pg_cron (same job as create_monthly_maintenance_review_tasks, 1st of each month). Creates one "Monthly SEO review" task per project on a seo_included tier (Pro, by default) -- idempotent per project per month.';

revoke all on function public.create_monthly_seo_review_tasks() from public, anon, authenticated;

-- Extend the existing monthly job to also run the SEO review -- same exception-safe DO-block
-- pattern the daily job (notify-task-deadlines) already uses for its own multiple functions, so
-- one failing never blocks or rolls back the other.
select cron.unschedule(jobid) from cron.job where jobname = 'create-monthly-maintenance-reviews';
select cron.schedule(
  'create-monthly-maintenance-reviews',
  '0 13 1 * *',
  $$
  do $do$ begin perform public.create_monthly_maintenance_review_tasks(); exception when others then raise warning 'create_monthly_maintenance_review_tasks failed: %', sqlerrm; end $do$;
  do $do$ begin perform public.create_monthly_seo_review_tasks(); exception when others then raise warning 'create_monthly_seo_review_tasks failed: %', sqlerrm; end $do$;
  $$
);
