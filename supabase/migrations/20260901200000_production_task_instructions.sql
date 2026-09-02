-- Richer instructions for the existing production task plan.
-- Does not add tasks, roles, or a second task system.

create or replace function public.production_scope_label(p_key text)
returns text
language sql
immutable
as $$
  select case p_key
    when 'homepage' then 'Homepage'
    when 'about' then 'About'
    when 'services' then 'Services'
    when 'contact' then 'Contact'
    when 'gallery' then 'Gallery / Portfolio'
    when 'testimonials' then 'Testimonials'
    when 'faq' then 'FAQ'
    when 'pricing' then 'Pricing'
    when 'team' then 'Team'
    when 'locations' then 'Locations'
    when 'blog' then 'Blog / News'
    when 'responsive' then 'Responsive design'
    when 'mobile' then 'Mobile optimization'
    when 'content' then 'Copywriting'
    when 'content_migration' then 'Content migration'
    when 'contact_form' then 'Contact form'
    when 'quote_form' then 'Quote request form'
    when 'booking_form' then 'Booking / appointment form'
    when 'payments' then 'Online payments'
    when 'ecommerce' then 'E-commerce'
    when 'customer_login' then 'Customer login'
    when 'maps' then 'Google Maps'
    when 'social' then 'Social media integration'
    when 'newsletter' then 'Newsletter signup'
    when 'live_chat' then 'Live chat'
    when 'seo' then 'SEO setup'
    when 'analytics' then 'Analytics'
    when 'hosting' then 'Hosting setup'
    when 'email' then 'Business email'
    when 'domain' then 'Domain'
    when 'performance' then 'Performance optimization'
    when 'security' then 'Security setup'
    else null
  end;
$$;

create or replace function public.production_scope_summary(p_keys text[])
returns text
language plpgsql
immutable
as $$
declare
  pages text[] := '{}';
  features text[] := '{}';
  other text[] := '{}';
  key text;
  kind text;
  label text;
  parts text[] := '{}';
begin
  if p_keys is null then
    return '';
  end if;
  foreach key in array p_keys
  loop
    kind := public.production_item_kind(key);
    label := public.production_scope_label(key);
    if label is null then
      continue;
    end if;
    if kind = 'page' then
      pages := pages || label;
    elsif kind = 'feature' then
      features := features || label;
    else
      other := other || label;
    end if;
  end loop;
  if coalesce(array_length(pages, 1), 0) > 0 then
    parts := parts || ('Pages: ' || array_to_string(pages, ', '));
  end if;
  if coalesce(array_length(features, 1), 0) > 0 then
    parts := parts || ('Features: ' || array_to_string(features, ', '));
  end if;
  if coalesce(array_length(other, 1), 0) > 0 then
    parts := parts || ('Also included: ' || array_to_string(other, ', '));
  end if;
  return array_to_string(parts, E'\n');
end;
$$;

create or replace function public.production_merge_scope_keys(p_keys text[], p_extra text[])
returns text[]
language plpgsql
immutable
as $$
declare
  keys text[] := coalesce(p_keys, '{}');
  extra text[] := coalesce(p_extra, '{}');
  key text;
begin
  foreach key in array extra
  loop
    if key is not null and not (key = any (keys)) then
      keys := keys || key;
    end if;
  end loop;
  return keys;
end;
$$;

create or replace function public.project_accepted_production_keys(p_project_id uuid)
returns text[]
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_proposal_id uuid;
  v_contract_id uuid;
  scope_text text := '';
  item_names text := '';
  contract_scope text := '';
  keys text[] := '{}';
begin
  select p.id
    into v_proposal_id
  from public.proposals p
  join public.proposal_revisions r on r.proposal_id = p.id and r.status = 'accepted'
  where p.project_id = p_project_id
  order by r.accepted_at desc nulls last
  limit 1;

  if v_proposal_id is null then
    select c.proposal_id, c.id
      into v_proposal_id, v_contract_id
    from public.contracts c
    join public.contract_revisions r on r.contract_id = c.id and r.status = 'accepted'
    where c.project_id = p_project_id
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

  if v_contract_id is null then
    select c.id
      into v_contract_id
    from public.contracts c
    where c.project_id = p_project_id
    order by c.created_at desc
    limit 1;
  end if;

  if coalesce(scope_text, '') = '' and v_contract_id is not null then
    select r.scope
      into contract_scope
    from public.contract_revisions r
    where r.contract_id = v_contract_id
      and r.status = 'accepted'
    order by r.accepted_at desc nulls last
    limit 1;
  end if;

  keys := public.production_scope_keys_from_text(scope_text);
  keys := public.production_merge_scope_keys(keys, public.production_scope_keys_from_text(item_names));
  if coalesce(array_length(keys, 1), 0) = 0 then
    keys := public.production_merge_scope_keys(keys, public.production_scope_keys_from_text(contract_scope));
  end if;
  return keys;
end;
$$;

create or replace function public.production_task_title_key(p_title text)
returns text
language sql
immutable
as $$
  select trim(both from regexp_replace(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(
              regexp_replace(
                regexp_replace(lower(trim(both from coalesce(p_title, ''))), '\s+', ' ', 'g'),
                '^build the ', 'build '
              ),
              '^implement the ', 'implement '
            ),
            '^design the ', 'design '
          ),
          '^test the ', 'test '
        ),
        '^add the ', 'add '
      ),
      '^connect the ', 'connect '
    ),
    '^install the ', 'install '
  ));
$$;

create or replace function public.production_task_instructions(p_title text, p_scope_summary text default '')
returns text
language plpgsql
immutable
as $$
declare
  title_key text := public.production_task_title_key(p_title);
  body text;
  subject text;
  page text;
  feature text;
begin
  if title_key = '' then
    return null;
  end if;

  body := case title_key
    when 'review approved scope' then $t$Objective
Confirm that production work matches what the client actually purchased.

What to do
- Review the accepted proposal.
- Review the approved project scope.
- Identify the pages included in the project.
- Identify included features and functionality.
- Check for special requirements or exclusions.
- Confirm that the production team understands what is being delivered.
- Report questions or discrepancies to the PM.

Before starting
The proposal must be accepted and the project scope must be available.

Deliverable
Confirmed production scope and any questions or discrepancies reported to the PM.

Done when
Purchased pages and required features are confirmed, discrepancies have been communicated, and the production team has enough information to proceed.$t$
    when 'confirm sitemap and requirements' then $t$Objective
Establish the page structure and requirements before design and development.

What to do
- Review the approved scope.
- Confirm the sitemap and page list.
- Identify the purpose of each purchased page.
- Identify required forms, CTAs, navigation, integrations, and other functionality.
- Identify any missing requirements.
- Communicate questions to the PM.

Before starting
The approved commercial scope should be available.

Deliverable
Confirmed sitemap and requirements.

Done when
The page structure and major requirements are confirmed.$t$
    when 'collect/confirm client content and assets' then $t$Objective
Make sure the team has the materials needed to design and build the website.

What to do
- Check for logo, brand assets, photos, and existing website content.
- Check contact information, business information, and social links.
- Check written copy and service descriptions.
- Identify anything missing and communicate it to the PM.
- Do not invent client content to fill gaps.

Before starting
The project should have an approved scope so you know which pages need assets.

Deliverable
Organized or confirmed project assets, plus a list of missing materials if applicable.

Done when
Required assets are available or the PM has documented what is still outstanding.$t$
    when 'prepare contact information' then $t$Objective
Confirm the contact details that will appear on the purchased pages.

What to do
- Collect phone, email, address, hours, and social links from the client record or supplied assets.
- Confirm the details with the PM if anything conflicts.
- Note which pages or forms should use the information.
- Do not invent contact details.

Deliverable
Confirmed contact information ready for content and development.

Done when
Required contact details are confirmed or missing items are documented with the PM.$t$
    when 'migrate approved content' then $t$Objective
Move the client's existing approved content into this project.

What to do
- Review the content-migration item in the accepted proposal.
- Identify the source pages or files.
- Copy only the content needed for purchased pages.
- Note outdated or missing items for the PM.
- Do not add new pages that were not purchased.

Deliverable
Migrated content organized for the purchased pages.

Done when
Approved source content is available to the team and gaps are documented.$t$
    when 'establish design direction' then $t$Objective
Define the visual direction for the website before completing the detailed page designs.

What to do
- Review the client's branding, requirements, and supplied assets.
- Determine typography, color usage, spacing, and layout principles.
- Establish visual hierarchy.
- Consider the client's industry and target audience.
- Keep the direction appropriate for the approved scope.

Before starting
Brand assets and the approved sitemap should be available, or missing items should already be flagged.

Deliverable
Initial visual and design direction.

Done when
The visual system is established and provides a consistent foundation for the website.$t$
    when 'design homepage' then $t$Objective
Create the primary homepage design based on the approved scope and design direction.

What to do
- Review the sitemap, available content, and established visual direction.
- Design the homepage layout, hero, and required content sections.
- Establish primary CTA placement.
- Design navigation and footer.
- Include trust or social-proof sections only when they are in scope.
- Use the correct branding and actual content where available.

Before starting
Discovery requirements, sitemap, design direction, and required assets should be available.

Deliverable
Completed homepage design.

Done when
Required homepage sections are designed, branding is consistent, hierarchy is clear, and the design is ready for review or implementation.$t$
    when 'design responsive/mobile layouts' then $t$Objective
Ensure the approved design works correctly across common screen sizes.

What to do
- Review the desktop designs for purchased pages.
- Adapt layouts for mobile.
- Check typography, spacing, navigation, images, and CTAs.
- Ensure content remains readable and usable.
- Do not design extra pages that are not in scope.

Deliverable
Responsive and mobile designs for the purchased pages.

Done when
The required pages have usable desktop and mobile layouts.$t$
    when 'write homepage copy' then $t$Objective
Create clear, client-appropriate copy for the homepage.

What to do
- Review the approved project scope, sitemap, and client-provided information.
- Identify the homepage's primary purpose.
- Write the headline, supporting copy, and section copy required by the design.
- Create clear calls-to-action.
- Keep the content aligned with the client's services and audience.
- Use accurate business information and proofread.

Deliverable
Homepage copy ready for client review.

Done when
All required homepage content has been written, proofread, and is ready for review.$t$
    when 'write services page copy' then $t$Objective
Create clear descriptions of the services included in the project.

What to do
- Review the client's actual services and the approved sitemap.
- Write descriptions only for services that belong on the purchased Services page.
- Make the copy easy to scan and include appropriate calls-to-action.
- Avoid unsupported claims.
- Proofread before handing off.

Deliverable
Approved-scope service copy.

Done when
All required services have complete copy ready for review.$t$
    when 'build homepage' then $t$Objective
Implement the approved homepage design as a functional website page.

What to do
- Review the approved design, content, and required assets.
- Implement the page structure, hero, sections, navigation, and CTAs.
- Integrate approved copy and images.
- Implement responsive behavior.
- Check desktop and mobile layouts.
- Do not add features that are not in the approved scope.

Before starting
Approved design, content, requirements, and required assets should be available.

Deliverable
Functional homepage in the external development environment.

Done when
The homepage matches the approved design, approved content is integrated, responsive layout works, links and CTAs work, and no obvious implementation issues remain.$t$
    when 'implement responsive layouts' then $t$Objective
Implement the purchased responsive and mobile behavior.

What to do
- Review the approved responsive designs.
- Implement layouts for common phone and desktop widths.
- Check navigation, type size, images, and CTAs.
- Fix overflow and unreadable content.

Deliverable
Working responsive layouts on the purchased pages.

Done when
Required pages are usable on desktop and mobile.$t$
    when 'integrate approved content' then $t$Objective
Replace temporary development content with approved client content.

What to do
- Review the approved content deliverables.
- Match content to the correct purchased pages and sections.
- Integrate the copy and check formatting, headings, and CTAs.
- Verify contact information.
- Remove placeholder or lorem content.

Deliverable
Purchased pages using approved client content.

Done when
Approved content is correctly integrated and no placeholder client-facing content remains.$t$
    when 'prepare/deploy staging' then $t$Objective
Make the current website available for QA and client review.

What to do
- Confirm the current development build is ready.
- Deploy using the agency's external hosting process.
- Verify the staging URL loads correctly.
- Communicate staging availability to the PM.
- MotiveScripts does not perform the deployment.

Deliverable
Accessible staging website.

Done when
The staging website is accessible and ready for QA.$t$
    when 'prepare staging for client review' then $t$Objective
Coordinate the client's review of the staging website.

What to do
- Confirm staging is available.
- Confirm internal QA has been completed.
- Provide the client with the staging website through the existing portal.
- Monitor client feedback.
- Organize revision requests.
- The client should use the existing portal feedback and approval tools.

Deliverable
Client review in progress through the portal.

Done when
Client feedback has been collected and the project is ready for revisions or approval.$t$
    when 'address requested revisions' then $t$Objective
Resolve approved client revision requests.

What to do
- Review client feedback.
- Clarify unclear requests with the PM.
- Determine whether each request is within project scope.
- Implement approved in-scope revisions.
- Update staging.
- Notify the PM when revisions are ready for review.

Deliverable
Updated staging website with approved revisions.

Done when
Approved in-scope revisions have been completed and are available for review.$t$
    when 'test staging website' then $t$Objective
Verify the staging website works correctly on desktop.

What to do
- Check page layout, navigation, typography, images, buttons, and links.
- Check forms and other purchased functionality.
- Check spacing and broken elements.
- Check the browser console when something looks wrong.
- Report issues through the existing task or feedback tools.
- Do not test features that are not in the approved scope.

Before starting
Staging should be available.

Deliverable
Documented desktop QA result.

Done when
The assigned desktop test has been completed and issues have been documented.$t$
    when 'test responsive layouts' then $t$Objective
Verify the staging website works correctly on mobile screen sizes.

What to do
- Check responsive layout, navigation, and text readability.
- Check images, buttons, forms, and spacing.
- Check for horizontal overflow and broken sections.
- Report issues through the existing task or feedback tools.

Deliverable
Documented mobile QA result.

Done when
Mobile testing is complete and issues have been documented.$t$
    when 'deploy production' then $t$Objective
Deploy the approved website to the agency's production hosting environment.

What to do
- Confirm client approval and that final QA is complete.
- Deploy through the agency's external hosting process.
- Verify the production site and production URL.
- Update the MotiveScripts project production URL or development metadata where appropriate.
- Inform the PM.
- MotiveScripts does not perform the deployment.

Deliverable
Live production website.

Done when
The website is live and the production URL has been verified.$t$
    when 'verify production website' then $t$Objective
Confirm the production website is functioning correctly after launch.

What to do
- Open the production URL and confirm the site loads.
- Check navigation, major purchased pages, forms, and important CTAs.
- Confirm there are no obvious deployment issues.
- Confirm the client portal can show the production URL where applicable.

Deliverable
Verified live website.

Done when
The live website has been verified.$t$
    when 'final qa' then $t$Objective
Perform the final verification before production launch.

What to do
- Check desktop and mobile layout.
- Check navigation, forms, links, images, and contact information.
- Check required content and major purchased functionality.
- Check production configuration.
- Confirm no blocking launch issues remain.

Deliverable
Final pre-launch QA result.

Done when
No blocking launch issues remain.$t$
    else null
  end;

  if body is null and title_key like 'write % copy' then
    subject := trim(both from substring(title_key from 7 for greatest(length(title_key) - 11, 0)));
    page := case
      when subject in ('homepage') then 'homepage'
      when subject in ('about', 'about page') then 'About page'
      when subject in ('services', 'services page') then 'Services page'
      when subject in ('contact', 'contact page') then 'Contact page'
      when subject in ('gallery / portfolio', 'gallery') then 'Gallery / Portfolio page'
      when subject in ('testimonials', 'testimonials page') then 'Testimonials page'
      when subject in ('faq', 'faq page') then 'FAQ page'
      when subject in ('pricing', 'pricing page') then 'Pricing page'
      when subject in ('team', 'team page') then 'Team page'
      when subject in ('locations', 'locations page') then 'Locations page'
      when subject in ('blog / news', 'blog') then 'Blog / News page'
      else initcap(subject)
    end;
    body := replace($t$Objective
Create clear, client-appropriate copy for the {page}.

What to do
- Review the approved project scope and sitemap.
- Review client-provided information for this page.
- Identify the page's purpose and required sections.
- Write the headline, supporting copy, and calls-to-action.
- Use accurate business information. Do not invent facts.
- Keep the copy aligned with the client's services and audience.
- Proofread before handing off.

Before starting
The approved scope should include this page. Client notes and assets should be available, or missing items should already be flagged to the PM.

Deliverable
{page_cap} copy ready for review.

Done when
All required sections for this page are written, proofread, and ready for review.$t$,
      '{page}', page);
    body := replace(body, '{page_cap}', upper(left(page, 1)) || substr(page, 2));
  elsif body is null and title_key like 'design %' and title_key <> 'design responsive/mobile layouts' then
    subject := trim(both from substring(title_key from 8));
    page := case
      when subject in ('homepage') then 'homepage'
      when subject in ('about', 'about page') then 'About page'
      when subject in ('services', 'services page') then 'Services page'
      when subject in ('contact', 'contact page') then 'Contact page'
      when subject in ('gallery / portfolio', 'gallery / portfolio page', 'gallery') then 'Gallery / Portfolio page'
      when subject in ('testimonials', 'testimonials page') then 'Testimonials page'
      when subject in ('faq', 'faq page') then 'FAQ page'
      when subject in ('pricing', 'pricing page') then 'Pricing page'
      when subject in ('team', 'team page') then 'Team page'
      when subject in ('locations', 'locations page') then 'Locations page'
      when subject in ('blog / news', 'blog / news page', 'blog') then 'Blog / News page'
      else initcap(subject)
    end;
    body := replace($t$Objective
Create the {page} design from the approved scope and visual direction.

What to do
- Review the sitemap, available content, and established visual direction.
- Design the {page} layout and required sections.
- Place primary CTAs and navigation consistently with the rest of the site.
- Use the correct branding and actual content where available.
- Keep the hierarchy clear and do not add sections that are not in scope.

Before starting
Discovery requirements, sitemap, design direction, and required assets should be available.

Deliverable
Completed {page} design.

Done when
Required sections are designed, branding is consistent, and the layout is ready for review or implementation.$t$,
      '{page}', page);
  elsif body is null and title_key like 'build %' then
    subject := trim(both from substring(title_key from 7));
    page := case
      when subject in ('homepage') then 'homepage'
      when subject in ('about', 'about page') then 'About page'
      when subject in ('services', 'services page') then 'Services page'
      when subject in ('contact', 'contact page') then 'Contact page'
      when subject in ('gallery / portfolio', 'gallery / portfolio page', 'gallery') then 'Gallery / Portfolio page'
      when subject in ('testimonials', 'testimonials page') then 'Testimonials page'
      when subject in ('faq', 'faq page') then 'FAQ page'
      when subject in ('pricing', 'pricing page') then 'Pricing page'
      when subject in ('team', 'team page') then 'Team page'
      when subject in ('locations', 'locations page') then 'Locations page'
      when subject in ('blog / news', 'blog / news page', 'blog') then 'Blog / News page'
      else initcap(subject)
    end;
    body := replace($t$Objective
Implement the approved {page} as a functional page in the external development environment.

What to do
- Review the approved design, content, and required assets.
- Implement the page structure, navigation, and CTAs.
- Integrate approved copy and images.
- Implement responsive behavior.
- Check desktop and mobile layouts.
- Do not add pages or features that are not in the approved scope.

Before starting
Approved design, content, requirements, and required assets should be available.

Deliverable
Functional {page} in the external development environment.

Done when
The page matches the approved design, approved content is integrated, responsive layout works, and no obvious implementation issues remain.$t$,
      '{page}', page);
  elsif body is null and (
    title_key like 'implement %'
    or title_key like 'add %'
    or title_key like 'set up %'
    or title_key like 'install %'
    or title_key like 'connect %'
    or title_key in ('performance optimization', 'security setup', 'implement online store')
  ) and title_key <> 'implement responsive layouts' then
    feature := case title_key
      when 'implement online store' then 'e-commerce functionality'
      when 'implement e-commerce functionality' then 'e-commerce functionality'
      when 'performance optimization' then 'performance optimization'
      when 'security setup' then 'security setup'
      else trim(both from regexp_replace(title_key, '^(implement|add|set up|install|connect) ', ''))
    end;
    body := replace($t$Objective
Add the {feature} included in the approved project scope.

What to do
- Review the approved requirement for {feature}.
- Confirm the intended behavior, fields, and destinations with the PM if anything is unclear.
- Implement only what the accepted proposal includes.
- Use approved copy, branding, and contact details.
- Check the feature on desktop and mobile.
- Do not add extra functionality that was not purchased.

Before starting
The feature must be listed in the approved scope. Required assets or account details should be available.

Deliverable
Working {feature} on the staging website.

Done when
{feature_cap} works as purchased, uses approved content, and has no obvious implementation issues.$t$,
      '{feature}', feature);
    body := replace(body, '{feature_cap}', upper(left(feature, 1)) || substr(feature, 2));
  elsif body is null and title_key like 'test %' and title_key not in ('test staging website', 'test responsive layouts') then
    feature := trim(both from substring(title_key from 6));
    body := replace($t$Objective
Verify that {feature} works on the staging website.

What to do
- Test {feature} against the approved scope only.
- Check the happy path and obvious error states.
- Confirm labels, links, and destinations.
- Check desktop and mobile if the feature is user-facing.
- Report issues through the existing task or feedback tools.

Before starting
Staging should be available and the feature should already be implemented.

Deliverable
Documented test result for {feature}.

Done when
{feature_cap} has been tested and any issues are documented.$t$,
      '{feature}', feature);
    body := replace(body, '{feature_cap}', upper(left(feature, 1)) || substr(feature, 2));
  end if;

  if body is null then
    return null;
  end if;

  if coalesce(trim(p_scope_summary), '') <> '' then
    body := body
      || E'\n\nThis project''s approved scope\n'
      || trim(p_scope_summary)
      || E'\nDo not add pages or features that are not listed here.';
  end if;

  return body;
end;
$$;

create or replace function public.enqueue_production_task(
  p_project_id uuid,
  p_milestone_id uuid,
  p_title text,
  p_description text,
  inout p_pos integer,
  inout p_inserted integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_description text;
  v_summary text;
begin
  v_summary := public.production_scope_summary(public.project_accepted_production_keys(p_project_id));
  v_description := public.production_task_instructions(p_title, v_summary);
  if public.try_insert_production_task(
    p_project_id,
    p_milestone_id,
    p_title,
    coalesce(v_description, p_description),
    p_pos
  ) then
    p_inserted := coalesce(p_inserted, 0) + 1;
    p_pos := coalesce(p_pos, 0) + 1;
  end if;
end;
$$;

update public.tasks t
set description = public.production_task_instructions(
  t.title,
  public.production_scope_summary(public.project_accepted_production_keys(t.project_id))
)
where t.status is distinct from 'Completed'
  and public.production_task_instructions(t.title, '') is not null
  and (
    coalesce(trim(t.description), '') = ''
    or (
      t.description not ilike '%Objective%'
      and t.description not ilike '%Done when%'
      and char_length(trim(t.description)) < 160
    )
  );

revoke all on function public.production_scope_label(text) from public, anon, authenticated;
revoke all on function public.production_scope_summary(text[]) from public, anon, authenticated;
revoke all on function public.production_merge_scope_keys(text[], text[]) from public, anon, authenticated;
revoke all on function public.project_accepted_production_keys(uuid) from public, anon, authenticated;
revoke all on function public.production_task_title_key(text) from public, anon, authenticated;
revoke all on function public.production_task_instructions(text, text) from public, anon, authenticated;
revoke all on function public.enqueue_production_task(uuid, uuid, text, text, integer, integer) from public, anon, authenticated;

comment on function public.production_task_instructions(text, text) is
  'Structured instructions for existing production task titles. Null when the title is not a known production task.';

comment on function public.enqueue_production_task(uuid, uuid, text, text, integer, integer) is
  'Inserts a production task and stores structured instructions when the title is a known production task.';
