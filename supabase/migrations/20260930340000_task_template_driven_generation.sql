-- Replace the hardcoded task-definition section of
-- prepare_project_production_from_paid_invoice() with a loop over active
-- task_templates. Everything else -- the invoice/project/proposal lookup,
-- the production_plan_generated_at idempotency guard (this function still
-- only ever runs once per project), scope-key extraction via
-- canonical_commercial_item()/production_scope_keys_from_text() (untouched,
-- still the sole source of `keys`), and the closing
-- notification/activity/plan-generated-at update -- is byte-for-byte the
-- same as the current live version (20260930280000).
--
-- Per-template eligibility reproduces today's logic exactly:
--   - zero task_template_scope_items rows  => unconditional (always
--     generated), same as "Review approved scope" etc. today.
--   - one or more rows                     => eligible if ANY key is
--     present in the project's resolved keys (this already covers today's
--     has_pages/has_responsive aggregate checks, which are themselves just
--     "any of these keys present").
--   - requires_content_scope = true        => additionally requires
--     'content' or 'content_migration' in keys, reproducing the `if
--     has_content then ...` wrapper around the copywriting-task family.
--
-- try_insert_production_task's existing per-project title-uniqueness check
-- remains the idempotency mechanism -- unchanged, not weakened, not
-- replaced with a template-slug-based key (this migration does not
-- introduce a new idempotency scheme, only a new source of task
-- definitions feeding the exact same insert helper).

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
  discovery_due date;
  design_due date;
  development_due date;
  review_due date;
  launch_due date;
  pos integer := 0;
  inserted integer := 0;
  has_commercial_text boolean := false;
  v_summary text;
  tmpl record;
  v_milestone_id uuid;
  v_due_date date;
  v_eligible boolean;
  v_matched_key text;
  v_description text;
  v_task_id uuid;
  chk record;
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

  select m.id, m.due_date into discovery_id, discovery_due
  from public.milestones m
  where m.project_id = v_project_id and lower(m.name) = 'discovery'
  order by m.position
  limit 1;
  select m.id, m.due_date into design_id, design_due
  from public.milestones m
  where m.project_id = v_project_id and lower(m.name) = 'design'
  order by m.position
  limit 1;
  select m.id, m.due_date into development_id, development_due
  from public.milestones m
  where m.project_id = v_project_id and lower(m.name) = 'development'
  order by m.position
  limit 1;
  select m.id, m.due_date into review_id, review_due
  from public.milestones m
  where m.project_id = v_project_id
    and lower(trim(m.name)) in ('client review', 'review', 'qa & client review', 'qa and client review')
  order by m.position
  limit 1;
  select m.id, m.due_date into launch_id, launch_due
  from public.milestones m
  where m.project_id = v_project_id and lower(m.name) = 'launch'
  order by m.position
  limit 1;

  select coalesce(max(t.position), -1) + 1 into pos
  from public.tasks t
  where t.project_id = v_project_id;

  v_summary := public.production_scope_summary(keys);

  for tmpl in
    select
      t.id, t.slug, t.title, t.description, t.instructions, t.milestone_key,
      t.task_type, t.recommended_role, t.requires_content_scope,
      t.estimated_hours,
      array(
        select tsi.scope_item_key
        from public.task_template_scope_items tsi
        where tsi.task_template_id = t.id
      ) as trigger_keys
    from public.task_templates t
    where t.is_active
    order by
      case t.milestone_key
        when 'discovery' then 1
        when 'design' then 2
        when 'development' then 3
        when 'review' then 4
        when 'launch' then 5
      end,
      t.sort_order
  loop
    v_eligible := coalesce(array_length(tmpl.trigger_keys, 1), 0) = 0
      or (tmpl.trigger_keys && keys);
    if v_eligible and tmpl.requires_content_scope then
      v_eligible := keys && array['content', 'content_migration'];
    end if;
    if not v_eligible then
      continue;
    end if;

    v_milestone_id := case tmpl.milestone_key
      when 'discovery' then discovery_id
      when 'design' then design_id
      when 'development' then development_id
      when 'review' then review_id
      when 'launch' then launch_id
    end;
    v_due_date := case tmpl.milestone_key
      when 'discovery' then discovery_due
      when 'design' then design_due
      when 'development' then development_due
      when 'review' then review_due
      when 'launch' then launch_due
    end;

    v_matched_key := null;
    if coalesce(array_length(tmpl.trigger_keys, 1), 0) > 0 then
      select k into v_matched_key from unnest(tmpl.trigger_keys) as k where k = any (keys) limit 1;
    end if;

    v_description := coalesce(nullif(trim(coalesce(tmpl.instructions, '')), ''), tmpl.description);
    if coalesce(trim(v_summary), '') <> '' then
      v_description := v_description
        || E'\n\nThis project''s approved scope\n'
        || trim(v_summary)
        || E'\nDo not add pages or features that are not listed here.';
    end if;

    if public.try_insert_production_task(
      v_project_id, v_milestone_id, tmpl.title, v_description, pos,
      tmpl.estimated_hours, v_due_date, tmpl.task_type, tmpl.recommended_role,
      tmpl.id, v_matched_key
    ) then
      pos := pos + 1;
      inserted := inserted + 1;

      select id into v_task_id
      from public.tasks
      where project_id = v_project_id
        and lower(trim(title)) = lower(trim(tmpl.title))
      order by created_at desc
      limit 1;

      if v_task_id is not null then
        for chk in
          select title, description, sort_order
          from public.task_template_checklist_items
          where task_template_id = tmpl.id
          order by sort_order
        loop
          insert into public.task_checklist_items (task_id, project_id, label, position)
          values (v_task_id, v_project_id, chk.title, chk.sort_order);
        end loop;
      end if;
    end if;
  end loop;

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

comment on function public.prepare_project_production_from_paid_invoice(uuid) is
  'Generates the production task plan from an accepted proposal/contract''s scope, driven by admin-configurable task_templates + task_template_scope_items instead of hardcoded values() lists (see 20260930320000/20260930330000). Still runs at most once per project (production_plan_generated_at guard) and still extracts scope keys via canonical_commercial_item()/production_scope_keys_from_text(), unchanged.';
