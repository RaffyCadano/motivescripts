-- When an invoice first becomes fully paid, create an initial production task plan
-- from the accepted commercial scope (proposal, then contract). Idempotent.
-- Does not change project status, delete tasks, or run on partial/reversed payments.

alter table public.projects
  add column if not exists production_plan_generated_at timestamptz;

comment on column public.projects.production_plan_generated_at is
  'Set when the paid-invoice production task plan has been generated. Prevents duplicates after reversal or a later invoice.';

create or replace function public.canonical_commercial_item(p_label text)
returns text
language sql
immutable
as $$
  select case lower(trim(both from coalesce(p_label, '')))
    when 'homepage' then 'homepage'
    when 'responsive website design' then 'responsive'
    when 'responsive design' then 'responsive'
    when 'mobile optimization' then 'mobile'
    when 'mobile-optimized website' then 'mobile'
    when 'about' then 'about'
    when 'about page' then 'about'
    when 'services' then 'services'
    when 'services page' then 'services'
    when 'contact' then 'contact'
    when 'contact page' then 'contact'
    when 'gallery / portfolio' then 'gallery'
    when 'gallery' then 'gallery'
    when 'testimonials' then 'testimonials'
    when 'faq' then 'faq'
    when 'faq page' then 'faq'
    when 'pricing' then 'pricing'
    when 'pricing page' then 'pricing'
    when 'team' then 'team'
    when 'team page' then 'team'
    when 'locations' then 'locations'
    when 'locations page' then 'locations'
    when 'blog / news' then 'blog'
    when 'blog' then 'blog'
    when 'contact form' then 'contact_form'
    when 'quote request form' then 'quote_form'
    when 'booking / appointment form' then 'booking_form'
    when 'booking form' then 'booking_form'
    when 'booking' then 'booking_form'
    when 'online payments' then 'payments'
    when 'e-commerce / online store' then 'ecommerce'
    when 'e-commerce' then 'ecommerce'
    when 'online store' then 'ecommerce'
    when 'customer login' then 'customer_login'
    when 'google maps' then 'maps'
    when 'google maps integration' then 'maps'
    when 'social media integration' then 'social'
    when 'newsletter signup' then 'newsletter'
    when 'live chat' then 'live_chat'
    when 'seo setup' then 'seo'
    when 'basic seo' then 'seo'
    when 'analytics' then 'analytics'
    when 'hosting setup' then 'hosting'
    when 'business email' then 'email'
    when 'domain' then 'domain'
    when 'performance optimization' then 'performance'
    when 'security setup' then 'security'
    when 'website' then null
    when 'website design & development' then null
    when 'other' then null
    else null
  end;
$$;

create or replace function public.try_insert_production_task(
  p_project_id uuid,
  p_milestone_id uuid,
  p_title text,
  p_description text,
  p_position integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.tasks
    where project_id = p_project_id
      and lower(trim(title)) = lower(trim(p_title))
  ) then
    return false;
  end if;

  insert into public.tasks (
    project_id,
    milestone_id,
    title,
    description,
    status,
    priority,
    assignee,
    assigned_to,
    position,
    due_date,
    completed_at
  )
  values (
    p_project_id,
    p_milestone_id,
    p_title,
    coalesce(p_description, ''),
    'Todo',
    'Medium',
    '',
    null,
    p_position,
    null,
    null
  );
  return true;
end;
$$;

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
  deliverables_text text := '';
  item_names text := '';
  contract_scope text := '';
  combined text := '';
  line text;
  key text;
  keys text[] := '{}';
  custom_titles text[] := '{}';
  custom_title text;
  discovery_id uuid;
  design_id uuid;
  development_id uuid;
  pos integer := 0;
  inserted integer := 0;
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
    select r.scope, r.deliverables_text
      into scope_text, deliverables_text
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
    scope_text := coalesce(contract_scope, '');
  end if;

  if coalesce(scope_text, '') = ''
    and coalesce(deliverables_text, '') = ''
    and coalesce(item_names, '') = ''
  then
    return 0;
  end if;

  combined := concat_ws(
    E'\n',
    replace(replace(coalesce(scope_text, ''), E'\r\n', E'\n'), E'\r', E'\n'),
    replace(replace(coalesce(deliverables_text, ''), E'\r\n', E'\n'), E'\r', E'\n'),
    replace(replace(coalesce(item_names, ''), E'\r\n', E'\n'), E'\r', E'\n')
  );

  foreach line in array string_to_array(combined, E'\n')
  loop
    line := trim(both from line);
    if line = '' or length(line) > 80 then
      continue;
    end if;
    if line ilike 'Use the Scope buttons%' or line ilike 'Use the Features buttons%' then
      continue;
    end if;
    key := public.canonical_commercial_item(line);
    if key is not null then
      if not (key = any (keys)) then
        keys := keys || key;
      end if;
    elsif lower(line) not in ('other', 'website', 'website design & development') then
      custom_title := 'Build ' || line;
      if not (custom_title = any (custom_titles)) then
        custom_titles := custom_titles || custom_title;
      end if;
    end if;
  end loop;

  if coalesce(array_length(keys, 1), 0) = 0 and coalesce(array_length(custom_titles, 1), 0) = 0 then
    return 0;
  end if;

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

  select coalesce(max(t.position), -1) + 1 into pos
  from public.tasks t
  where t.project_id = v_project_id;

  if public.try_insert_production_task(
    v_project_id, discovery_id,
    'Review approved scope',
    'Read the accepted proposal and confirm the purchased pages and features before production starts.',
    pos
  ) then inserted := inserted + 1; pos := pos + 1; end if;

  if public.try_insert_production_task(
    v_project_id, discovery_id,
    'Confirm sitemap and requirements',
    'Confirm the page list and requirements from the accepted commercial scope.',
    pos
  ) then inserted := inserted + 1; pos := pos + 1; end if;

  if public.try_insert_production_task(
    v_project_id, discovery_id,
    'Collect/confirm client content and assets',
    'Collect or confirm logos, photos, and written content needed to build the purchased pages.',
    pos
  ) then inserted := inserted + 1; pos := pos + 1; end if;

  if public.try_insert_production_task(
    v_project_id, design_id,
    'Establish design direction',
    'Set the visual direction for the website based on the approved scope.',
    pos
  ) then inserted := inserted + 1; pos := pos + 1; end if;

  if 'homepage' = any (keys) then
    if public.try_insert_production_task(
      v_project_id, design_id,
      'Design homepage',
      'Design the homepage layout and content structure.',
      pos
    ) then inserted := inserted + 1; pos := pos + 1; end if;
  end if;

  if 'responsive' = any (keys) or 'mobile' = any (keys) then
    if public.try_insert_production_task(
      v_project_id, design_id,
      'Design responsive/mobile layouts',
      'Design layouts that work on phones and desktops.',
      pos
    ) then inserted := inserted + 1; pos := pos + 1; end if;
  end if;

  if 'homepage' = any (keys) then
    if public.try_insert_production_task(
      v_project_id, development_id,
      'Build the homepage',
      'Implement the homepage from the approved design.',
      pos
    ) then inserted := inserted + 1; pos := pos + 1; end if;
  end if;
  if 'about' = any (keys) then
    if public.try_insert_production_task(
      v_project_id, development_id,
      'Build the About page',
      'Implement the About page from the accepted proposal.',
      pos
    ) then inserted := inserted + 1; pos := pos + 1; end if;
  end if;
  if 'services' = any (keys) then
    if public.try_insert_production_task(
      v_project_id, development_id,
      'Build the Services page',
      'Implement the Services page from the accepted proposal.',
      pos
    ) then inserted := inserted + 1; pos := pos + 1; end if;
  end if;
  if 'contact' = any (keys) then
    if public.try_insert_production_task(
      v_project_id, development_id,
      'Build the Contact page',
      'Implement the Contact page from the accepted proposal.',
      pos
    ) then inserted := inserted + 1; pos := pos + 1; end if;
  end if;
  if 'gallery' = any (keys) then
    if public.try_insert_production_task(
      v_project_id, development_id,
      'Build the Gallery / Portfolio page',
      'Implement the gallery or portfolio page from the accepted proposal.',
      pos
    ) then inserted := inserted + 1; pos := pos + 1; end if;
  end if;
  if 'testimonials' = any (keys) then
    if public.try_insert_production_task(
      v_project_id, development_id,
      'Build the Testimonials page',
      'Implement the testimonials page from the accepted proposal.',
      pos
    ) then inserted := inserted + 1; pos := pos + 1; end if;
  end if;
  if 'faq' = any (keys) then
    if public.try_insert_production_task(
      v_project_id, development_id,
      'Build the FAQ page',
      'Implement the FAQ page from the accepted proposal.',
      pos
    ) then inserted := inserted + 1; pos := pos + 1; end if;
  end if;
  if 'pricing' = any (keys) then
    if public.try_insert_production_task(
      v_project_id, development_id,
      'Build the Pricing page',
      'Implement the pricing page from the accepted proposal.',
      pos
    ) then inserted := inserted + 1; pos := pos + 1; end if;
  end if;
  if 'team' = any (keys) then
    if public.try_insert_production_task(
      v_project_id, development_id,
      'Build the Team page',
      'Implement the team page from the accepted proposal.',
      pos
    ) then inserted := inserted + 1; pos := pos + 1; end if;
  end if;
  if 'locations' = any (keys) then
    if public.try_insert_production_task(
      v_project_id, development_id,
      'Build the Locations page',
      'Implement the locations page from the accepted proposal.',
      pos
    ) then inserted := inserted + 1; pos := pos + 1; end if;
  end if;
  if 'blog' = any (keys) then
    if public.try_insert_production_task(
      v_project_id, development_id,
      'Build the Blog / News page',
      'Implement the blog or news page from the accepted proposal.',
      pos
    ) then inserted := inserted + 1; pos := pos + 1; end if;
  end if;

  if 'contact_form' = any (keys) then
    if public.try_insert_production_task(
      v_project_id, development_id,
      'Implement the contact form',
      'Add the contact form included in the accepted proposal.',
      pos
    ) then inserted := inserted + 1; pos := pos + 1; end if;
  end if;
  if 'quote_form' = any (keys) then
    if public.try_insert_production_task(
      v_project_id, development_id,
      'Implement the quote request form',
      'Add the quote request form included in the accepted proposal.',
      pos
    ) then inserted := inserted + 1; pos := pos + 1; end if;
  end if;
  if 'booking_form' = any (keys) then
    if public.try_insert_production_task(
      v_project_id, development_id,
      'Implement the booking / appointment form',
      'Add the booking form included in the accepted proposal.',
      pos
    ) then inserted := inserted + 1; pos := pos + 1; end if;
  end if;
  if 'payments' = any (keys) then
    if public.try_insert_production_task(
      v_project_id, development_id,
      'Implement online payments',
      'Add the online payment functionality included in the accepted proposal.',
      pos
    ) then inserted := inserted + 1; pos := pos + 1; end if;
  end if;
  if 'ecommerce' = any (keys) then
    if public.try_insert_production_task(
      v_project_id, development_id,
      'Implement the online store',
      'Add the e-commerce functionality included in the accepted proposal.',
      pos
    ) then inserted := inserted + 1; pos := pos + 1; end if;
  end if;
  if 'customer_login' = any (keys) then
    if public.try_insert_production_task(
      v_project_id, development_id,
      'Implement customer login',
      'Add the customer login included in the accepted proposal.',
      pos
    ) then inserted := inserted + 1; pos := pos + 1; end if;
  end if;
  if 'maps' = any (keys) then
    if public.try_insert_production_task(
      v_project_id, development_id,
      'Add Google Maps',
      'Add the Google Maps integration included in the accepted proposal.',
      pos
    ) then inserted := inserted + 1; pos := pos + 1; end if;
  end if;
  if 'social' = any (keys) then
    if public.try_insert_production_task(
      v_project_id, development_id,
      'Add social media integration',
      'Connect the social profiles included in the accepted proposal.',
      pos
    ) then inserted := inserted + 1; pos := pos + 1; end if;
  end if;
  if 'newsletter' = any (keys) then
    if public.try_insert_production_task(
      v_project_id, development_id,
      'Add newsletter signup',
      'Add the newsletter signup included in the accepted proposal.',
      pos
    ) then inserted := inserted + 1; pos := pos + 1; end if;
  end if;
  if 'live_chat' = any (keys) then
    if public.try_insert_production_task(
      v_project_id, development_id,
      'Add live chat',
      'Add the live chat included in the accepted proposal.',
      pos
    ) then inserted := inserted + 1; pos := pos + 1; end if;
  end if;
  if 'seo' = any (keys) then
    if public.try_insert_production_task(
      v_project_id, development_id,
      'Set up SEO',
      'Complete the SEO setup included in the accepted proposal.',
      pos
    ) then inserted := inserted + 1; pos := pos + 1; end if;
  end if;
  if 'analytics' = any (keys) then
    if public.try_insert_production_task(
      v_project_id, development_id,
      'Install analytics',
      'Install the analytics included in the accepted proposal.',
      pos
    ) then inserted := inserted + 1; pos := pos + 1; end if;
  end if;
  if 'hosting' = any (keys) then
    if public.try_insert_production_task(
      v_project_id, development_id,
      'Set up hosting',
      'Complete the hosting setup included in the accepted proposal.',
      pos
    ) then inserted := inserted + 1; pos := pos + 1; end if;
  end if;
  if 'email' = any (keys) then
    if public.try_insert_production_task(
      v_project_id, development_id,
      'Set up business email',
      'Set up the business email included in the accepted proposal.',
      pos
    ) then inserted := inserted + 1; pos := pos + 1; end if;
  end if;
  if 'domain' = any (keys) then
    if public.try_insert_production_task(
      v_project_id, development_id,
      'Connect the domain',
      'Connect the domain included in the accepted proposal.',
      pos
    ) then inserted := inserted + 1; pos := pos + 1; end if;
  end if;
  if 'performance' = any (keys) then
    if public.try_insert_production_task(
      v_project_id, development_id,
      'Performance optimization',
      'Complete the performance work included in the accepted proposal.',
      pos
    ) then inserted := inserted + 1; pos := pos + 1; end if;
  end if;
  if 'security' = any (keys) then
    if public.try_insert_production_task(
      v_project_id, development_id,
      'Security setup',
      'Complete the security setup included in the accepted proposal.',
      pos
    ) then inserted := inserted + 1; pos := pos + 1; end if;
  end if;

  if custom_titles is not null then
    foreach custom_title in array custom_titles
    loop
      if public.try_insert_production_task(
        v_project_id, development_id,
        custom_title,
        'Included in the accepted commercial scope.',
        pos
      ) then inserted := inserted + 1; pos := pos + 1; end if;
    end loop;
  end if;

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

create or replace function public.invoices_after_paid_prepare_production()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    perform public.prepare_project_production_from_paid_invoice(new.id);
  exception
    when others then
      raise warning 'Production plan was not created for invoice %: %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

drop trigger if exists invoices_after_paid_prepare_production on public.invoices;
create trigger invoices_after_paid_prepare_production
after update of status on public.invoices
for each row
when (new.status = 'paid' and old.status is distinct from 'paid')
execute function public.invoices_after_paid_prepare_production();

revoke all on function public.canonical_commercial_item(text) from public, anon, authenticated;
revoke all on function public.try_insert_production_task(uuid, uuid, text, text, integer) from public, anon, authenticated;
revoke all on function public.prepare_project_production_from_paid_invoice(uuid) from public, anon, authenticated;
revoke all on function public.invoices_after_paid_prepare_production() from public, anon, authenticated;

grant execute on function public.prepare_project_production_from_paid_invoice(uuid) to service_role;

comment on function public.prepare_project_production_from_paid_invoice(uuid) is
  'Creates the initial production task plan from the accepted proposal when an invoice is fully paid. Safe to call more than once.';

-- Existing fully paid projects with no tasks yet get one plan. Projects that already
-- have a task list are left alone (treated as an existing production plan).
do $$
declare
  rec record;
begin
  for rec in
    select i.id
    from public.invoices i
    join public.projects p on p.id = coalesce(
      i.project_id,
      (select c.project_id from public.contracts c where c.id = i.contract_id),
      (select pr.project_id from public.proposals pr where pr.id = i.proposal_id)
    )
    where i.status = 'paid'
      and coalesce(p.archived, false) = false
      and p.production_plan_generated_at is null
      and not exists (select 1 from public.tasks t where t.project_id = p.id)
  loop
    perform public.prepare_project_production_from_paid_invoice(rec.id);
  end loop;
end;
$$;
