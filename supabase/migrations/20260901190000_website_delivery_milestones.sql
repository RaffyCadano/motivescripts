-- Keep the existing five project milestones. Rename Client Review to
-- QA & Client Review, refresh stock descriptions, and attach generated
-- review tasks to either name. Does not rewrite existing tasks.

create or replace function public.production_milestone_id(p_project_id uuid, p_kind text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select m.id
  from public.milestones m
  where m.project_id = p_project_id
    and (
      (p_kind = 'discovery' and lower(trim(m.name)) = 'discovery')
      or (p_kind = 'design' and lower(trim(m.name)) = 'design')
      or (p_kind = 'development' and lower(trim(m.name)) = 'development')
      or (
        p_kind = 'review'
        and lower(trim(m.name)) in ('client review', 'review', 'qa & client review', 'qa and client review')
      )
      or (p_kind = 'launch' and lower(trim(m.name)) = 'launch')
    )
  order by m.position
  limit 1;
$$;

update public.milestones
set name = 'QA & Client Review'
where lower(trim(name)) = 'client review';

update public.milestones
set description = 'Kickoff, confirm requirements, sitemap, content, and assets.'
where lower(trim(name)) = 'discovery'
  and description in (
    '',
    'Kickoff and collect logo, photos, and written content after they accept.'
  );

update public.milestones
set description = 'Create and approve the visual direction and page designs.'
where lower(trim(name)) = 'design'
  and description in ('', 'Layout, visual system, and page structure.');

update public.milestones
set description = 'Build the website, integrate approved design and content, and deploy to staging.'
where lower(trim(name)) = 'development'
  and description in ('', 'Build, integrate, and refine the site.');

update public.milestones
set description = 'Test the staging website, resolve issues, collect client feedback, and obtain approval.'
where lower(trim(name)) in ('qa & client review', 'qa and client review', 'client review', 'review')
  and description in (
    '',
    'Client feedback, revisions, and approval.',
    'Walkthrough, feedback, and approval.',
    'Client Review stage.'
  );

update public.milestones
set description = 'Move the approved website into production and complete handoff.'
where lower(trim(name)) = 'launch'
  and description in ('', 'Final QA, go-live, and handoff.');

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

  discovery_id := public.production_milestone_id(v_project_id, 'discovery');
  design_id := public.production_milestone_id(v_project_id, 'design');
  development_id := public.production_milestone_id(v_project_id, 'development');
  review_id := public.production_milestone_id(v_project_id, 'review');
  launch_id := public.production_milestone_id(v_project_id, 'launch');

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

revoke all on function public.production_milestone_id(uuid, text) from public, anon, authenticated;
revoke all on function public.prepare_project_production_from_paid_invoice(uuid) from public, anon, authenticated;
grant execute on function public.prepare_project_production_from_paid_invoice(uuid) to service_role;

comment on function public.production_milestone_id(uuid, text) is
  'Resolves a website-delivery milestone id, including QA & Client Review aliases.';

comment on function public.prepare_project_production_from_paid_invoice(uuid) is
  'Creates the initial production task plan from the accepted proposal when an invoice is fully paid. Uses catalog keys only. Safe to call more than once.';
