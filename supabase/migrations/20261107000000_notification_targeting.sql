-- Notification targeting: who gets which in-app notification.
--
-- 1. Website pause / unpause / host-pause-failed and the QA and development-complete alerts are for the
--    people who act on them (Admin, Project Manager, Developer), not for every production role assigned to
--    the client. Enforced inside notify_agency() so every caller, including the vercel-site-control edge
--    function, gets it.
-- 2. "Client responded to a request", the discovery updates and "payment received, project ready" went only
--    to staff assigned to the project. Admins and project managers who are not assigned now hear about them
--    too (notify_project_admins).
-- 3. New-lead notifications went to admins only. Anyone holding the leads.view permission (Sales) gets them.

-- ---------------------------------------------------------------------------
-- 1. Type -> staff templates, applied inside notify_agency
-- ---------------------------------------------------------------------------

create or replace function public.notification_staff_templates(p_type text)
returns text[]
language sql
immutable
as $$
  select case
    when p_type in (
      'website_paused', 'website_unpaused', 'host_pause_failed',
      'qa_failed', 'qa_passed', 'development_completed'
    ) then array['project_manager', 'developer', 'staff']
    else null
  end;
$$;

revoke all on function public.notification_staff_templates(text) from public, anon, authenticated;

create or replace function public.notify_agency(
  p_perm text,
  p_client_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_conversation_id uuid default null,
  p_message_id uuid default null,
  p_project_id uuid default null,
  p_deliverable_id uuid default null,
  p_proposal_id uuid default null,
  p_contract_id uuid default null,
  p_invoice_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
begin
  insert into public.notifications (
    user_id, type, title, body, conversation_id, message_id, project_id, deliverable_id,
    proposal_id, contract_id, invoice_id
  )
  select
    p.id,
    p_type,
    p_title,
    coalesce(p_body, ''),
    p_conversation_id,
    p_message_id,
    p_project_id,
    p_deliverable_id,
    p_proposal_id,
    p_contract_id,
    p_invoice_id
  from public.profiles p
  left join public.staff_profiles s on s.user_id = p.id
  where p.id is distinct from auth.uid()
    and (
      (p.role = 'admin' and coalesce(s.is_active, true))
      or (
        p.role = 'staff'
        and coalesce(s.is_active, false)
        and exists (
          select 1 from public.staff_grants g
          where g.user_id = p.id and g.permission_code = p_perm
        )
        and (
          public.notification_staff_templates(p_type) is null
          or s.template_key = any (public.notification_staff_templates(p_type))
        )
        and (
          case
            when p_perm = 'messages.view' and s.template_key in ('developer', 'designer', 'content_writer') then
              p_project_id is not null
              and exists (
                select 1
                from public.project_staff_assignments a
                where a.user_id = p.id and a.project_id = p_project_id
              )
            when p_perm = 'messages.view' and s.template_key = 'team_member' then
              false
            else
              p_client_id is null
              or exists (
                select 1 from public.client_staff_assignments a
                where a.user_id = p.id and a.client_id = p_client_id
              )
              or exists (
                select 1
                from public.project_staff_assignments a
                join public.projects pr on pr.id = a.project_id
                where a.user_id = p.id and pr.client_id = p_client_id
              )
          end
        )
      )
    )
  on conflict (user_id, message_id) do nothing;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 2. Admins and project managers who are not assigned to the project
-- ---------------------------------------------------------------------------

create or replace function public.notify_project_admins(
  p_project_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_invoice_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_project_id is null then
    return;
  end if;
  insert into public.notifications (user_id, type, title, body, project_id, invoice_id)
  select p.id, p_type, p_title, coalesce(p_body, ''), p_project_id, p_invoice_id
  from public.profiles p
  left join public.staff_profiles s on s.user_id = p.id
  where p.id is distinct from auth.uid()
    and (
      (p.role = 'admin' and coalesce(s.is_active, true))
      or (
        p.role = 'staff'
        and coalesce(s.is_active, false)
        and s.template_key = 'project_manager'
        and exists (
          select 1
          from public.projects pr
          join public.client_staff_assignments c on c.client_id = pr.client_id and c.user_id = p.id
          where pr.id = p_project_id
        )
      )
    )
    -- staff already assigned to the project were notified directly
    and not exists (
      select 1 from public.project_staff_assignments a
      where a.project_id = p_project_id and a.user_id = p.id
    );
end;
$$;

revoke all on function public.notify_project_admins(uuid, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.notify_project_admins(uuid, text, text, text, uuid) to service_role;

CREATE OR REPLACE FUNCTION public.discovery_intake_notify_staff()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  project_name text;
  notify_title text;
  notify_body text;
begin
  if tg_op = 'UPDATE' then
    if new.status = 'submitted' and (old.status is distinct from 'submitted') then
      notify_title := 'Discovery intake submitted';
      notify_body := 'The client submitted project discovery information.';
    elsif new.status = 'submitted' and old.status = 'more_information_needed' then
      notify_title := 'Discovery intake updated';
      notify_body := 'The client responded to your discovery follow-up request.';
    else
      return new;
    end if;
  else
    return new;
  end if;

  select name into project_name from public.projects where id = new.project_id;

  insert into public.notifications (user_id, type, title, body, project_id)
  select distinct psa.user_id, 'project_update', notify_title,
    coalesce(project_name, 'A project') || ' · ' || notify_body,
    new.project_id
  from public.project_staff_assignments psa
  where psa.project_id = new.project_id
    and psa.user_id is not null;

  -- Admins and project managers who are not assigned to the project would otherwise never hear about this.
  perform public.notify_project_admins(
    new.project_id, 'project_update', notify_title,
    coalesce(project_name, 'A project') || ' · ' || notify_body
  );

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.task_client_requests_notify_staff()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  project_name text;
  task_title text;
begin
  if tg_op <> 'UPDATE' or new.status <> 'submitted' or old.status = 'submitted' then
    return new;
  end if;

  select p.name, t.title into project_name, task_title
  from public.projects p
  join public.tasks t on t.id = new.task_id
  where p.id = new.project_id;

  insert into public.notifications (user_id, type, title, body, project_id)
  select distinct psa.user_id, 'task_response_submitted', 'Client responded to a request',
    coalesce(project_name, 'A project') || ' · ' || coalesce(task_title, 'A task') || ': the client submitted a response.',
    new.project_id
  from public.project_staff_assignments psa
  where psa.project_id = new.project_id
    and psa.user_id is not null;

  perform public.notify_project_admins(
    new.project_id, 'task_response_submitted', 'Client responded to a request',
    coalesce(project_name, 'A project') || ' · ' || coalesce(task_title, 'A task') || ': the client submitted a response.'
  );

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.prepare_project_production_from_paid_invoice(p_invoice_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  perform public.notify_project_admins(
    v_project_id, 'project_update', 'Payment received — project ready for production',
    'Payment was received. The initial production task plan is ready on this project.',
    inv.id
  );

  return inserted;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 3. New leads reach everyone who may view leads
-- ---------------------------------------------------------------------------

create or replace function public.notify_admins_new_lead()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  -- Only leads that arrive without a signed-in user (the public Start a Project form runs as the service
  -- role). A lead someone adds by hand does not notify anyone about their own action.
  if auth.uid() is not null then
    return new;
  end if;

  begin
    insert into public.notifications (user_id, type, title, body, lead_id)
    select
      p.id,
      'lead_submitted',
      'New lead: ' || coalesce(nullif(trim(new.business_name), ''), nullif(trim(new.name), ''), 'New inquiry'),
      left(coalesce(nullif(trim(new.request), ''), 'New project inquiry'), 200),
      new.id
    from public.profiles p
    left join public.staff_profiles s on s.user_id = p.id
    where p.role = 'admin'
       or (
         p.role = 'staff'
         and coalesce(s.is_active, false)
         and exists (
           select 1 from public.staff_grants g
           where g.user_id = p.id and g.permission_code = 'leads.view'
         )
       );
  exception when others then
    -- Capturing the lead must never fail because a notification could not be written.
    null;
  end;

  return new;
end;
$function$;
