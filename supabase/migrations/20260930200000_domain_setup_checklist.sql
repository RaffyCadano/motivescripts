-- Auto-seeds the standard domain-setup checklist onto the existing "Connect
-- the domain" production task (already generated per-project by
-- prepare_project_production_from_paid_invoice -> enqueue_production_task,
-- see 20260901160000_project_website_delivery.sql and the Launch milestone
-- catalog in prepare_project_production_from_paid_invoice). Reuses the
-- existing task_checklist_items mechanism -- already rendered on every task
-- via TaskChecklistSection.tsx -- rather than inventing new schema or UI.
--
-- The three items are exactly the steps: get the registrar account set up
-- (under the client's own email/billing), get the agency access to manage
-- it, then do the actual DNS work (the @ apex record and www, pointed at
-- hosting). Nothing here automates any of that -- it's a checklist, not an
-- integration -- matching how domain_status/hosting_status on
-- project_development are already manually-maintained status fields, not
-- automation.

create or replace function public.seed_domain_task_checklist()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(trim(new.title)) = 'connect the domain' then
    insert into public.task_checklist_items (task_id, project_id, label, position)
    values
      (new.id, new.project_id, 'Registrar account exists, under the client''s own email/billing (they create it, or you create it for them with their info)', 0),
      (new.id, new.project_id, 'Agency has access to manage the domain (registrar sharing/permissions, or shared login)', 1),
      (new.id, new.project_id, 'DNS configured: the @ (root) record and www point to hosting', 2);
  end if;
  return new;
end;
$$;

drop trigger if exists tasks_seed_domain_checklist on public.tasks;
create trigger tasks_seed_domain_checklist
  after insert on public.tasks
  for each row execute function public.seed_domain_task_checklist();

revoke all on function public.seed_domain_task_checklist() from public, anon;

-- One-time backfill: any existing "Connect the domain" task (from a project
-- that already generated its production tasks before this migration) that
-- doesn't have this checklist yet gets it now. Purely additive -- never
-- touches a task that already has checklist items of its own.
insert into public.task_checklist_items (task_id, project_id, label, position)
select t.id, t.project_id, item.label, item.position
from public.tasks t
cross join (
  values
    ('Registrar account exists, under the client''s own email/billing (they create it, or you create it for them with their info)', 0),
    ('Agency has access to manage the domain (registrar sharing/permissions, or shared login)', 1),
    ('DNS configured: the @ (root) record and www point to hosting', 2)
) as item(label, position)
where lower(trim(t.title)) = 'connect the domain'
  and not exists (select 1 from public.task_checklist_items existing where existing.task_id = t.id);
