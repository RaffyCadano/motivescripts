-- Production Workflow spec, Section 14 (Handoff) and Section 15 (rollups):
-- adds a real, trackable Handoff step and gates the existing
-- projects.status = 'Completed' transition on it, instead of leaving
-- "Completed" settable at any time with no relationship to delivery state.
--
-- Design decision (documented per the spec's own Section 30/24 rules,
-- since no existing table/column already represents this):
--
--   Handoff is modeled as one more task, of a new task_type = 'handoff',
--   under the existing Launch milestone -- not a new table, not a new
--   project-level column, not a second workflow engine. The Launch
--   milestone's own stored description already says "Move the approved
--   website into production and complete handoff" (see
--   src/data/productionTaskInstructions.ts), so this is completing what the
--   milestone already claimed to cover, not inventing a new concept.
--
--   "Handoff complete" (project_handoff_complete, below) is vacuously true
--   for any project with zero handoff-typed tasks -- the exact same
--   "nothing to require" pattern project_payment_gate_open() already uses
--   for invoices. This is what makes the new completion gate safe for
--   history: every project that existed before this migration has zero
--   handoff tasks (the production-task generator only starts adding them to
--   NEW plans from this migration forward), so the gate never blocks a
--   historical project's Completed transition on a task that could never
--   have existed for it. Combined with the gate only firing on a genuinely
--   new transition INTO 'Completed' (never re-checking a project already at
--   'Completed'), no existing project can be newly locked out by this.
--
--   Alternative considered and rejected: a new `projects.handoff_status`
--   column. Rejected because it would duplicate the task/milestone system
--   that already tracks every other delivery phase, and because "is handoff
--   done" is naturally answered the same way "is development done" already
--   is (development_tasks_complete) -- by whether the relevant tasks are
--   Completed, not by a second hand-maintained flag that could drift from
--   the real task state.

-- ---------------------------------------------------------------------------
-- 1. New task_type value. Additive: existing values/rows are unaffected.
-- ---------------------------------------------------------------------------

alter table public.tasks drop constraint if exists tasks_task_type_check;
alter table public.tasks
  add constraint tasks_task_type_check check (
    task_type is null or task_type in (
      'discovery',
      'content_collection',
      'design',
      'production',
      'client_review',
      'qa',
      'handoff',
      'internal'
    )
  );

create or replace function public.classify_task_type(p_title text)
returns text
language sql
immutable
as $$
  select case lower(trim(coalesce(p_title, '')))
    when 'review approved scope' then 'discovery'
    when 'confirm sitemap and requirements' then 'discovery'
    when 'collect/confirm client content and assets' then 'content_collection'
    when 'prepare contact information' then 'content_collection'
    when 'migrate approved content' then 'content_collection'
    when 'establish design direction' then 'design'
    when 'design homepage' then 'design'
    when 'design responsive/mobile layouts' then 'design'
    when 'prepare/deploy staging' then 'client_review'
    when 'prepare staging for client review' then 'client_review'
    when 'address requested revisions' then 'client_review'
    when 'test staging website' then 'qa'
    when 'test responsive layouts' then 'qa'
    when 'final qa' then 'qa'
    when 'complete client handoff' then 'handoff'
    else case
      when lower(trim(coalesce(p_title, ''))) ~ '^design ' then 'design'
      when lower(trim(coalesce(p_title, ''))) ~ '^test ' then 'qa'
      when lower(trim(coalesce(p_title, ''))) ~ '^write .* copy$' then 'production'
      when lower(trim(coalesce(p_title, ''))) ~ '^build ' then 'production'
      when lower(trim(coalesce(p_title, ''))) ~ '^implement ' then 'production'
      when lower(trim(coalesce(p_title, ''))) ~ '^add ' then 'production'
      when lower(trim(coalesce(p_title, ''))) ~ '^set up ' then 'production'
      when lower(trim(coalesce(p_title, ''))) ~ '^install ' then 'production'
      when lower(trim(coalesce(p_title, ''))) ~ '^connect ' then 'production'
      else 'internal'
    end
  end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Add the actual "Complete client handoff" task to the Launch milestone
--    template. create-or-replace of the existing plan-generation function
--    (20260901180000_production_plan_from_accepted_scope.sql, left
--    untouched) -- body is otherwise byte-for-byte identical, with one new
--    enqueue_production_task call after "Final QA". This function only
--    ever runs once per project (guarded by production_plan_generated_at),
--    triggered by a newly-paid invoice, so this change only affects
--    projects that generate their production plan from this point forward
--    -- no historical project's already-generated task list is touched.
-- ---------------------------------------------------------------------------

create or replace function public.prepare_project_production_from_paid_invoice(p_invoice_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.invoices;
  v_project_id uuid;
  generated_at timestamptz;
  v_proposal_id uuid;
  scope_text text := '';
  item_names text := '';
  contract_scope text := '';
  keys text[] := '{}';
  extra text[];
  key text;
  discovery_id uuid;
  design_id uuid;
  development_id uuid;
  review_id uuid;
  launch_id uuid;
  pos integer := 0;
  inserted integer := 0;
  has_commercial_text boolean := false;
  has_pages boolean := false;
  has_responsive boolean := false;
  has_content boolean := false;
  rec record;
begin
  select * into inv from public.invoices where id = p_invoice_id;
  if not found or inv.status is distinct from 'paid' then
    return 0;
  end if;

  v_project_id := inv.project_id;
  if v_project_id is null and inv.contract_id is not null then
    select c.project_id into v_project_id from public.contracts c where c.id = inv.contract_id;
  end if;
  if v_project_id is null and inv.proposal_id is not null then
    select p.project_id into v_project_id from public.proposals p where p.id = inv.proposal_id;
  end if;
  if v_project_id is null then
    return 0;
  end if;

  select pr.production_plan_generated_at
    into generated_at
  from public.projects pr
  where pr.id = v_project_id
    and coalesce(pr.archived, false) = false;
  if not found or generated_at is not null then
    return 0;
  end if;

  v_proposal_id := inv.proposal_id;
  if v_proposal_id is null and inv.contract_id is not null then
    select c.proposal_id into v_proposal_id from public.contracts c where c.id = inv.contract_id;
  end if;
  if v_proposal_id is null then
    select p.id
      into v_proposal_id
    from public.proposals p
    join public.proposal_revisions r on r.proposal_id = p.id and r.status = 'accepted'
    where p.project_id = v_project_id
    order by r.accepted_at desc nulls last
    limit 1;
  end if;

  if v_proposal_id is not null then
    select r.scope
      into scope_text
    from public.proposal_revisions r
    where r.proposal_id = v_proposal_id
      and r.status = 'accepted'
    order by r.accepted_at desc nulls last
    limit 1;

    select string_agg(i.name, E'\n' order by i.sort_order)
      into item_names
    from public.proposal_items i
    join public.proposal_revisions r on r.id = i.revision_id
    where r.proposal_id = v_proposal_id
      and r.status = 'accepted';
  end if;

  if coalesce(scope_text, '') = '' and inv.contract_id is not null then
    select r.scope
      into contract_scope
    from public.contract_revisions r
    where r.contract_id = inv.contract_id
      and r.status = 'accepted'
    order by r.accepted_at desc nulls last
    limit 1;
  end if;

  has_commercial_text :=
    coalesce(trim(scope_text), '') <> ''
    or coalesce(trim(item_names), '') <> ''
    or coalesce(trim(contract_scope), '') <> '';
  if not has_commercial_text then
    return 0;
  end if;

  keys := public.production_scope_keys_from_text(scope_text);
  extra := public.production_scope_keys_from_text(item_names);
  if extra is not null then
    foreach key in array extra
    loop
      if key is not null and not (key = any (keys)) then
        keys := keys || key;
      end if;
    end loop;
  end if;
  if coalesce(array_length(keys, 1), 0) = 0 then
    extra := public.production_scope_keys_from_text(contract_scope);
    if extra is not null then
      foreach key in array extra
      loop
        if key is not null and not (key = any (keys)) then
          keys := keys || key;
        end if;
      end loop;
    end if;
  end if;

  has_pages := keys && array[
    'homepage', 'about', 'services', 'contact', 'gallery',
    'testimonials', 'faq', 'pricing', 'team', 'locations', 'blog'
  ];
  has_responsive := keys && array['responsive', 'mobile'];
  has_content := keys && array['content', 'content_migration'];

  select m.id into discovery_id
  from public.milestones m
  where m.project_id = v_project_id and lower(m.name) = 'discovery'
  order by m.position
  limit 1;
  select m.id into design_id
  from public.milestones m
  where m.project_id = v_project_id and lower(m.name) = 'design'
  order by m.position
  limit 1;
  select m.id into development_id
  from public.milestones m
  where m.project_id = v_project_id and lower(m.name) = 'development'
  order by m.position
  limit 1;
  select m.id into review_id
  from public.milestones m
  where m.project_id = v_project_id
    and lower(trim(m.name)) in ('client review', 'review', 'qa & client review', 'qa and client review')
  order by m.position
  limit 1;
  select m.id into launch_id
  from public.milestones m
  where m.project_id = v_project_id and lower(m.name) = 'launch'
  order by m.position
  limit 1;

  select coalesce(max(t.position), -1) + 1 into pos
  from public.tasks t
  where t.project_id = v_project_id;

  select e.p_pos, e.p_inserted into pos, inserted
  from public.enqueue_production_task(
    v_project_id, discovery_id,
    'Review approved scope',
    'Read the accepted proposal and confirm the purchased pages and features before production starts.',
    pos, inserted
  ) e;
  select e.p_pos, e.p_inserted into pos, inserted
  from public.enqueue_production_task(
    v_project_id, discovery_id,
    'Confirm sitemap and requirements',
    'Confirm the page list and requirements from the accepted commercial scope.',
    pos, inserted
  ) e;
  select e.p_pos, e.p_inserted into pos, inserted
  from public.enqueue_production_task(
    v_project_id, discovery_id,
    'Collect/confirm client content and assets',
    'Collect or confirm logos, photos, and written content needed for the purchased pages.',
    pos, inserted
  ) e;

  if has_content then
    for rec in
      select * from (values
        ('homepage', 'Write homepage copy', 'Write homepage copy included in the accepted proposal.'),
        ('about', 'Write About page copy', 'Write About page copy included in the accepted proposal.'),
        ('services', 'Write Services page copy', 'Write Services page copy included in the accepted proposal.'),
        ('contact', 'Write Contact page copy', 'Write Contact page copy included in the accepted proposal.'),
        ('gallery', 'Write Gallery / Portfolio copy', 'Write gallery or portfolio copy included in the accepted proposal.'),
        ('testimonials', 'Write Testimonials page copy', 'Write testimonials copy included in the accepted proposal.'),
        ('faq', 'Write FAQ page copy', 'Write FAQ copy included in the accepted proposal.'),
        ('pricing', 'Write Pricing page copy', 'Write pricing copy included in the accepted proposal.'),
        ('team', 'Write Team page copy', 'Write team copy included in the accepted proposal.'),
        ('locations', 'Write Locations page copy', 'Write locations copy included in the accepted proposal.'),
        ('blog', 'Write Blog / News copy', 'Write blog or news copy included in the accepted proposal.')
      ) as t(page_key, title, description)
    loop
      if rec.page_key = any (keys) then
        select e.p_pos, e.p_inserted into pos, inserted
        from public.enqueue_production_task(
          v_project_id, discovery_id, rec.title, rec.description, pos, inserted
        ) e;
      end if;
    end loop;
    if 'contact' = any (keys) then
      select e.p_pos, e.p_inserted into pos, inserted
      from public.enqueue_production_task(
        v_project_id, discovery_id,
        'Prepare contact information',
        'Prepare the contact details included with the purchased content work.',
        pos, inserted
      ) e;
    end if;
    if 'content_migration' = any (keys) then
      select e.p_pos, e.p_inserted into pos, inserted
      from public.enqueue_production_task(
        v_project_id, discovery_id,
        'Migrate approved content',
        'Migrate the content included in the accepted proposal.',
        pos, inserted
      ) e;
    end if;
  end if;

  select e.p_pos, e.p_inserted into pos, inserted
  from public.enqueue_production_task(
    v_project_id, design_id,
    'Establish design direction',
    'Set the visual direction for the website based on the approved scope.',
    pos, inserted
  ) e;

  for rec in
    select * from (values
      ('homepage', 'Design homepage', 'Design the homepage layout and content structure.'),
      ('about', 'Design About page', 'Design the About page from the accepted proposal.'),
      ('services', 'Design Services page', 'Design the Services page from the accepted proposal.'),
      ('contact', 'Design Contact page', 'Design the Contact page from the accepted proposal.'),
      ('gallery', 'Design Gallery / Portfolio page', 'Design the gallery or portfolio page from the accepted proposal.'),
      ('testimonials', 'Design Testimonials page', 'Design the testimonials page from the accepted proposal.'),
      ('faq', 'Design FAQ page', 'Design the FAQ page from the accepted proposal.'),
      ('pricing', 'Design Pricing page', 'Design the Pricing page from the accepted proposal.'),
      ('team', 'Design Team page', 'Design the Team page from the accepted proposal.'),
      ('locations', 'Design Locations page', 'Design the Locations page from the accepted proposal.'),
      ('blog', 'Design Blog / News page', 'Design the blog or news page from the accepted proposal.')
    ) as t(page_key, title, description)
  loop
    if rec.page_key = any (keys) then
      select e.p_pos, e.p_inserted into pos, inserted
      from public.enqueue_production_task(
        v_project_id, design_id, rec.title, rec.description, pos, inserted
      ) e;
    end if;
  end loop;

  if has_responsive then
    select e.p_pos, e.p_inserted into pos, inserted
    from public.enqueue_production_task(
      v_project_id, design_id,
      'Design responsive/mobile layouts',
      'Design layouts that work on phones and desktops.',
      pos, inserted
    ) e;
  end if;

  for rec in
    select * from (values
      ('homepage', 'Build homepage', 'Implement the homepage from the approved design.'),
      ('about', 'Build About page', 'Implement the About page from the accepted proposal.'),
      ('services', 'Build Services page', 'Implement the Services page from the accepted proposal.'),
      ('contact', 'Build Contact page', 'Implement the Contact page from the accepted proposal.'),
      ('gallery', 'Build Gallery / Portfolio page', 'Implement the gallery or portfolio page from the accepted proposal.'),
      ('testimonials', 'Build Testimonials page', 'Implement the testimonials page from the accepted proposal.'),
      ('faq', 'Build FAQ page', 'Implement the FAQ page from the accepted proposal.'),
      ('pricing', 'Build Pricing page', 'Implement the pricing page from the accepted proposal.'),
      ('team', 'Build Team page', 'Implement the team page from the accepted proposal.'),
      ('locations', 'Build Locations page', 'Implement the locations page from the accepted proposal.'),
      ('blog', 'Build Blog / News page', 'Implement the blog or news page from the accepted proposal.')
    ) as t(page_key, title, description)
  loop
    if rec.page_key = any (keys) then
      select e.p_pos, e.p_inserted into pos, inserted
      from public.enqueue_production_task(
        v_project_id, development_id, rec.title, rec.description, pos, inserted
      ) e;
    end if;
  end loop;

  if has_responsive then
    select e.p_pos, e.p_inserted into pos, inserted
    from public.enqueue_production_task(
      v_project_id, development_id,
      'Implement responsive layouts',
      'Implement the responsive and mobile layouts included in the accepted proposal.',
      pos, inserted
    ) e;
  end if;

  for rec in
    select * from (values
      ('contact_form', 'Implement contact form', 'Add the contact form included in the accepted proposal.'),
      ('quote_form', 'Implement quote request form', 'Add the quote request form included in the accepted proposal.'),
      ('booking_form', 'Implement booking / appointment form', 'Add the booking form included in the accepted proposal.'),
      ('payments', 'Implement online payments', 'Add the online payment functionality included in the accepted proposal.'),
      ('ecommerce', 'Implement e-commerce functionality', 'Add the e-commerce functionality included in the accepted proposal.'),
      ('customer_login', 'Implement customer login', 'Add the customer login included in the accepted proposal.'),
      ('maps', 'Add Google Maps', 'Add the Google Maps integration included in the accepted proposal.'),
      ('social', 'Add social media integration', 'Connect the social profiles included in the accepted proposal.'),
      ('newsletter', 'Add newsletter signup', 'Add the newsletter signup included in the accepted proposal.'),
      ('live_chat', 'Add live chat', 'Add the live chat included in the accepted proposal.'),
      ('seo', 'Set up SEO', 'Complete the SEO setup included in the accepted proposal.'),
      ('analytics', 'Install analytics', 'Install the analytics included in the accepted proposal.'),
      ('hosting', 'Set up hosting', 'Complete the hosting setup included in the accepted proposal.'),
      ('email', 'Set up business email', 'Set up the business email included in the accepted proposal.'),
      ('domain', 'Connect the domain', 'Connect the domain included in the accepted proposal.'),
      ('performance', 'Performance optimization', 'Complete the performance work included in the accepted proposal.'),
      ('security', 'Security setup', 'Complete the security setup included in the accepted proposal.')
    ) as t(feature_key, title, description)
  loop
    if rec.feature_key = any (keys) then
      select e.p_pos, e.p_inserted into pos, inserted
      from public.enqueue_production_task(
        v_project_id, development_id, rec.title, rec.description, pos, inserted
      ) e;
    end if;
  end loop;

  if has_pages then
    select e.p_pos, e.p_inserted into pos, inserted
    from public.enqueue_production_task(
      v_project_id, development_id,
      'Integrate approved content',
      'Place the approved client content on the purchased pages.',
      pos, inserted
    ) e;
  end if;

  select e.p_pos, e.p_inserted into pos, inserted
  from public.enqueue_production_task(
    v_project_id, development_id,
    'Prepare/deploy staging',
    'Prepare the staging website for internal QA and client review. Hosting stays external.',
    pos, inserted
  ) e;

  select e.p_pos, e.p_inserted into pos, inserted
  from public.enqueue_production_task(
    v_project_id, review_id,
    'Prepare staging for client review',
    'Make the staging website ready for the client to review.',
    pos, inserted
  ) e;
  select e.p_pos, e.p_inserted into pos, inserted
  from public.enqueue_production_task(
    v_project_id, review_id,
    'Address requested revisions',
    'Complete approved revision requests from client review.',
    pos, inserted
  ) e;
  select e.p_pos, e.p_inserted into pos, inserted
  from public.enqueue_production_task(
    v_project_id, review_id,
    'Test staging website',
    'QA the staging website against the accepted proposal.',
    pos, inserted
  ) e;
  if has_responsive then
    select e.p_pos, e.p_inserted into pos, inserted
    from public.enqueue_production_task(
      v_project_id, review_id,
      'Test responsive layouts',
      'QA phone and desktop layouts included in the accepted proposal.',
      pos, inserted
    ) e;
  end if;
  for rec in
    select * from (values
      ('contact_form', 'Test contact form'),
      ('quote_form', 'Test quote request form'),
      ('booking_form', 'Test booking / appointment form'),
      ('payments', 'Test online payments'),
      ('ecommerce', 'Test e-commerce functionality'),
      ('customer_login', 'Test customer login'),
      ('maps', 'Test Google Maps'),
      ('social', 'Test social media links'),
      ('newsletter', 'Test newsletter signup'),
      ('live_chat', 'Test live chat')
    ) as t(feature_key, title)
  loop
    if rec.feature_key = any (keys) then
      select e.p_pos, e.p_inserted into pos, inserted
      from public.enqueue_production_task(
        v_project_id, review_id,
        rec.title,
        'QA this purchased feature on staging.',
        pos, inserted
      ) e;
    end if;
  end loop;

  select e.p_pos, e.p_inserted into pos, inserted
  from public.enqueue_production_task(
    v_project_id, launch_id,
    'Deploy production',
    'Deploy the approved website to the production URL. Hosting stays external.',
    pos, inserted
  ) e;
  select e.p_pos, e.p_inserted into pos, inserted
  from public.enqueue_production_task(
    v_project_id, launch_id,
    'Verify production website',
    'Confirm the live website matches the approved staging version.',
    pos, inserted
  ) e;
  select e.p_pos, e.p_inserted into pos, inserted
  from public.enqueue_production_task(
    v_project_id, launch_id,
    'Final QA',
    'Complete final QA on the production website before handoff.',
    pos, inserted
  ) e;
  select e.p_pos, e.p_inserted into pos, inserted
  from public.enqueue_production_task(
    v_project_id, launch_id,
    'Complete client handoff',
    'Deliver final assets/credentials and confirm the client has everything needed to own the live website.',
    pos, inserted
  ) e;

  update public.projects
    set production_plan_generated_at = now(),
        last_activity_at = now()
    where id = v_project_id;

  perform public.record_document_activity(
    inv.client_id,
    v_project_id,
    'production_ready',
    'Payment received — project ready for production'
  );

  insert into public.notifications (user_id, type, title, body, project_id, invoice_id)
  select a.user_id,
    'project_update',
    'Payment received — project ready for production',
    'Payment was received. The initial production task plan is ready on this project.',
    v_project_id,
    inv.id
  from public.project_staff_assignments a
  where a.project_id = v_project_id
    and a.user_id is distinct from auth.uid();

  return inserted;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Handoff-complete check, mirroring project_payment_gate_open()'s "zero
--    is not blocking" shape and development_tasks_complete()'s "all Completed"
--    shape.
-- ---------------------------------------------------------------------------

create or replace function public.project_handoff_complete(p_project_id uuid)
returns boolean
language sql
stable
as $$
  select coalesce(bool_and(t.status = 'Completed'), true)
  from public.tasks t
  join public.milestones m on m.id = t.milestone_id
  where t.project_id = p_project_id
    and public.milestone_workflow_key(m.name) = 'launch'
    and t.task_type = 'handoff';
$$;

comment on function public.project_handoff_complete(uuid) is
  'True when every handoff-typed Launch-milestone task is Completed, OR when the project has no handoff task at all (every project that existed before 20260930280000 -- historical compatibility, same pattern as project_payment_gate_open()). Never blocks a project that could never have had this task.';

revoke all on function public.project_handoff_complete(uuid) from public, anon;

-- ---------------------------------------------------------------------------
-- 4. Project Completion gate: projects.status -> 'Completed' requires the
--    project to actually be live in production and handed off. Restricted
--    to Admin/PM (staff_may_coordinate_project), same audience as the
--    launch gate -- completing delivery is a PM/Admin decision, not any
--    staff member with plain projects.manage. Only fires on a genuinely new
--    transition into 'Completed' (insert-or-update, mirroring the
--    20260930160000 fix for the equivalent launch-gate bug) -- a project
--    already at 'Completed' before this migration is never re-checked, so
--    no historical project can be newly invalidated.
-- ---------------------------------------------------------------------------

create or replace function public.enforce_project_completion_gate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deployed boolean;
begin
  if new.status = 'Completed' and (TG_OP = 'INSERT' or old.status is distinct from 'Completed') then
    if not public.staff_may_coordinate_project(new.id) then
      raise exception 'Not allowed' using errcode = '42501';
    end if;

    select pd.deployment_status = 'Production'
      into v_deployed
    from public.project_development pd
    where pd.project_id = new.id;

    if not coalesce(v_deployed, false) then
      raise exception 'Cannot complete this project: it has not launched to production yet.' using errcode = '42501';
    end if;
    if not public.project_handoff_complete(new.id) then
      raise exception 'Cannot complete this project: handoff is not finished.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

comment on function public.enforce_project_completion_gate() is
  'Blocks projects.status -> Completed unless the project has actually launched (project_development.deployment_status = Production) and project_handoff_complete() is true. Section 14/15 of the production workflow spec: Completed must reflect real delivery state, not just a status field a PM can set at will.';

drop trigger if exists projects_completion_gate on public.projects;
create trigger projects_completion_gate
  before insert or update on public.projects
  for each row execute function public.enforce_project_completion_gate();

revoke all on function public.enforce_project_completion_gate() from public, anon;

-- ---------------------------------------------------------------------------
-- 5. Notifications: Project Completed (Handoff done) and Development
--    Completed. Both new notification types, purely additive to the check
--    constraint (20260930120000 already established the pattern of
--    widening this constraint for new workflow transitions).
-- ---------------------------------------------------------------------------

alter table public.notifications
  drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
    check (type = any (array[
      'new_message', 'feedback_received', 'changes_requested', 'version_ready_for_review',
      'version_approved', 'project_update', 'proposal_ready', 'proposal_viewed',
      'proposal_accepted', 'proposal_declined', 'contract_ready', 'contract_viewed',
      'contract_accepted', 'contract_declined', 'invoice_ready', 'invoice_viewed',
      'payment_recorded', 'payment_received', 'invoice_paid', 'invoice_overdue',
      'task_assigned', 'task_status_changed', 'project_assigned', 'milestone_updated',
      'task_info_requested', 'task_response_submitted', 'plan_past_due', 'plan_canceled',
      'task_comment_added', 'task_due_soon', 'task_overdue', 'payroll_paid',
      'domain_expiring_soon', 'domain_expired', 'ssl_expiring_soon', 'ssl_expired',
      'qa_failed', 'qa_passed', 'client_review_ready', 'launch_completed',
      'development_completed', 'project_completed'
    ]));

create or replace function public.notify_project_completed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status <> 'Completed' or (TG_OP = 'UPDATE' and old.status is not distinct from 'Completed') then
    return new;
  end if;
  insert into public.activity (project_id, actor_id, activity_type, message, metadata)
  values (new.id, auth.uid(), 'project_completed', new.name || ' has been marked complete. Delivery and handoff are done.', jsonb_build_object('icon', 'status'));
  if new.client_id is not null then
    perform public.notify_client_users(
      new.client_id, 'project_completed',
      new.name || ' is complete',
      'Your project has been delivered and handed off. Thank you for working with us.',
      null, null, new.id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists projects_notify_completed on public.projects;
create trigger projects_notify_completed
  after insert or update on public.projects
  for each row execute function public.notify_project_completed();

revoke all on function public.notify_project_completed() from public, anon;

-- Development-complete notification: fires exactly once per real
-- transition, off the Development milestone's OWN status column (already
-- recomputed by rollup_one_milestone whenever it's actually warranted) --
-- not off individual task writes, so this can never fire more than once for
-- the same completion and never needs to duplicate development_tasks_complete()'s
-- own logic.

create or replace function public.notify_development_milestone_complete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project public.projects;
begin
  if public.milestone_workflow_key(new.name) <> 'development'
     or new.status <> 'Completed'
     or old.status is not distinct from 'Completed'
  then
    return new;
  end if;
  select * into v_project from public.projects where id = new.project_id;
  if v_project.id is null then
    return new;
  end if;
  insert into public.activity (project_id, actor_id, activity_type, message, metadata)
  values (new.project_id, auth.uid(), 'development_completed', 'Development is complete on ' || v_project.name || '. QA is now available.', jsonb_build_object('icon', 'milestone'));
  perform public.notify_agency(
    'projects.manage', v_project.client_id, 'development_completed',
    'Development complete: ' || v_project.name,
    'Development is complete. QA is now available.',
    null, null, new.project_id
  );
  return new;
end;
$$;

drop trigger if exists milestones_notify_development_complete on public.milestones;
create trigger milestones_notify_development_complete
  after update of status on public.milestones
  for each row execute function public.notify_development_milestone_complete();

revoke all on function public.notify_development_milestone_complete() from public, anon;

-- ---------------------------------------------------------------------------
-- 6. Client-safe delivery gates RPC: extend with handoff/completion so the
--    client portal can show a real "Delivered" step (Section 20). Return
--    signature is changing (2 new columns), so the function must be
--    dropped before being recreated.
-- ---------------------------------------------------------------------------

drop function if exists public.client_project_delivery_gates(uuid);

create or replace function public.client_project_delivery_gates(p_project_id uuid)
returns table (
  design_approved boolean,
  development_complete boolean,
  qa_passed boolean,
  client_review_complete boolean,
  final_approved boolean,
  is_launched boolean,
  is_completed boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.owns_project(p_project_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  return query
  select
    public.project_checkpoint_approved(p_project_id, 'overall_design'),
    public.development_tasks_complete(p_project_id),
    public.qa_latest_result(p_project_id) is not distinct from 'pass',
    public.project_client_review_complete(p_project_id),
    public.project_checkpoint_approved(p_project_id, 'final_website'),
    coalesce(
      (select pd.deployment_status = 'Production' from public.project_development pd where pd.project_id = p_project_id),
      false
    ),
    coalesce((select p.status = 'Completed' from public.projects p where p.id = p_project_id), false);
end;
$$;

comment on function public.client_project_delivery_gates(uuid) is
  'Client-safe view of the launch/completion checklist gates. Adds is_completed (project delivered and handed off) alongside the original 6 columns from 20260930240000.';

revoke all on function public.client_project_delivery_gates(uuid) from public, anon;
grant execute on function public.client_project_delivery_gates(uuid) to authenticated;
