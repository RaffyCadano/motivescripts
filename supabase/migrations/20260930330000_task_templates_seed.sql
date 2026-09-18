-- Seed task_templates with every task prepare_project_production_from_paid_invoice()
-- can generate today, preserving exact titles, descriptions, milestones,
-- task types, recommended roles, scope triggers, and ordering. This is a
-- compatibility migration: the goal is that the new template-driven
-- generator (20260930340000) produces an IDENTICAL production plan to
-- today's hardcoded function, for every existing scope combination. Admin
-- configurability comes after behavior parity, per the user's own
-- instruction.
--
-- `instructions` and `estimated_hours` are filled in by a single UPDATE
-- below that calls the existing production_task_instructions()/
-- production_task_estimated_hours() functions once per row, keyed off the
-- title -- this guarantees byte-for-byte fidelity with today's live text
-- without retyping ~700 lines of instructions by hand, and there is no risk
-- of a title/instructions mismatch since both come from the same title
-- value in the same statement.
--
-- Known pre-existing gap, preserved faithfully rather than "fixed": today
-- recommendedRoleForTaskTitle('complete client handoff') returns null
-- (src/data/taskRecommendedRoles.ts was never updated when the handoff task
-- was added in 20260930280000), so this seed also leaves recommended_role
-- null for that template. Admin can now trivially set it via the new UI --
-- worth doing, but not something this migration should silently change.

insert into public.task_templates
  (slug, title, description, milestone_key, task_type, recommended_role, requires_content_scope, sort_order)
values
  -- Discovery
  ('review-approved-scope', 'Review approved scope', 'Read the accepted proposal and confirm the purchased pages and features before production starts.', 'discovery', 'discovery', 'project_manager', false, 0),
  ('confirm-sitemap-and-requirements', 'Confirm sitemap and requirements', 'Confirm the page list and requirements from the accepted commercial scope.', 'discovery', 'discovery', 'project_manager', false, 1),
  ('collect-confirm-client-content-and-assets', 'Collect/confirm client content and assets', 'Collect or confirm logos, photos, and written content needed for the purchased pages.', 'discovery', 'content_collection', 'project_manager', false, 2),
  ('write-homepage-copy', 'Write homepage copy', 'Write homepage copy included in the accepted proposal.', 'discovery', 'production', 'content_writer', true, 3),
  ('write-about-page-copy', 'Write About page copy', 'Write About page copy included in the accepted proposal.', 'discovery', 'production', 'content_writer', true, 4),
  ('write-services-page-copy', 'Write Services page copy', 'Write Services page copy included in the accepted proposal.', 'discovery', 'production', 'content_writer', true, 5),
  ('write-contact-page-copy', 'Write Contact page copy', 'Write Contact page copy included in the accepted proposal.', 'discovery', 'production', 'content_writer', true, 6),
  ('write-gallery-portfolio-copy', 'Write Gallery / Portfolio copy', 'Write gallery or portfolio copy included in the accepted proposal.', 'discovery', 'production', 'content_writer', true, 7),
  ('write-testimonials-page-copy', 'Write Testimonials page copy', 'Write testimonials copy included in the accepted proposal.', 'discovery', 'production', 'content_writer', true, 8),
  ('write-faq-page-copy', 'Write FAQ page copy', 'Write FAQ copy included in the accepted proposal.', 'discovery', 'production', 'content_writer', true, 9),
  ('write-pricing-page-copy', 'Write Pricing page copy', 'Write pricing copy included in the accepted proposal.', 'discovery', 'production', 'content_writer', true, 10),
  ('write-team-page-copy', 'Write Team page copy', 'Write team copy included in the accepted proposal.', 'discovery', 'production', 'content_writer', true, 11),
  ('write-locations-page-copy', 'Write Locations page copy', 'Write locations copy included in the accepted proposal.', 'discovery', 'production', 'content_writer', true, 12),
  ('write-blog-news-copy', 'Write Blog / News copy', 'Write blog or news copy included in the accepted proposal.', 'discovery', 'production', 'content_writer', true, 13),
  ('prepare-contact-information', 'Prepare contact information', 'Prepare the contact details included with the purchased content work.', 'discovery', 'content_collection', null, true, 14),
  ('migrate-approved-content', 'Migrate approved content', 'Migrate the content included in the accepted proposal.', 'discovery', 'content_collection', 'content_writer', true, 15),

  -- Design
  ('establish-design-direction', 'Establish design direction', 'Set the visual direction for the website based on the approved scope.', 'design', 'design', 'designer', false, 0),
  ('design-homepage', 'Design homepage', 'Design the homepage layout and content structure.', 'design', 'design', 'designer', false, 1),
  ('design-about-page', 'Design About page', 'Design the About page from the accepted proposal.', 'design', 'design', 'designer', false, 2),
  ('design-services-page', 'Design Services page', 'Design the Services page from the accepted proposal.', 'design', 'design', 'designer', false, 3),
  ('design-contact-page', 'Design Contact page', 'Design the Contact page from the accepted proposal.', 'design', 'design', 'designer', false, 4),
  ('design-gallery-portfolio-page', 'Design Gallery / Portfolio page', 'Design the gallery or portfolio page from the accepted proposal.', 'design', 'design', 'designer', false, 5),
  ('design-testimonials-page', 'Design Testimonials page', 'Design the testimonials page from the accepted proposal.', 'design', 'design', 'designer', false, 6),
  ('design-faq-page', 'Design FAQ page', 'Design the FAQ page from the accepted proposal.', 'design', 'design', 'designer', false, 7),
  ('design-pricing-page', 'Design Pricing page', 'Design the Pricing page from the accepted proposal.', 'design', 'design', 'designer', false, 8),
  ('design-team-page', 'Design Team page', 'Design the Team page from the accepted proposal.', 'design', 'design', 'designer', false, 9),
  ('design-locations-page', 'Design Locations page', 'Design the Locations page from the accepted proposal.', 'design', 'design', 'designer', false, 10),
  ('design-blog-news-page', 'Design Blog / News page', 'Design the blog or news page from the accepted proposal.', 'design', 'design', 'designer', false, 11),
  ('design-responsive-mobile-layouts', 'Design responsive/mobile layouts', 'Design layouts that work on phones and desktops.', 'design', 'design', 'designer', false, 12),

  -- Development
  ('build-homepage', 'Build homepage', 'Implement the homepage from the approved design.', 'development', 'production', 'developer', false, 0),
  ('build-about-page', 'Build About page', 'Implement the About page from the accepted proposal.', 'development', 'production', 'developer', false, 1),
  ('build-services-page', 'Build Services page', 'Implement the Services page from the accepted proposal.', 'development', 'production', 'developer', false, 2),
  ('build-contact-page', 'Build Contact page', 'Implement the Contact page from the accepted proposal.', 'development', 'production', 'developer', false, 3),
  ('build-gallery-portfolio-page', 'Build Gallery / Portfolio page', 'Implement the gallery or portfolio page from the accepted proposal.', 'development', 'production', 'developer', false, 4),
  ('build-testimonials-page', 'Build Testimonials page', 'Implement the testimonials page from the accepted proposal.', 'development', 'production', 'developer', false, 5),
  ('build-faq-page', 'Build FAQ page', 'Implement the FAQ page from the accepted proposal.', 'development', 'production', 'developer', false, 6),
  ('build-pricing-page', 'Build Pricing page', 'Implement the pricing page from the accepted proposal.', 'development', 'production', 'developer', false, 7),
  ('build-team-page', 'Build Team page', 'Implement the team page from the accepted proposal.', 'development', 'production', 'developer', false, 8),
  ('build-locations-page', 'Build Locations page', 'Implement the locations page from the accepted proposal.', 'development', 'production', 'developer', false, 9),
  ('build-blog-news-page', 'Build Blog / News page', 'Implement the blog or news page from the accepted proposal.', 'development', 'production', 'developer', false, 10),
  ('implement-responsive-layouts', 'Implement responsive layouts', 'Implement the responsive and mobile layouts included in the accepted proposal.', 'development', 'production', 'developer', false, 11),
  ('implement-contact-form', 'Implement contact form', 'Add the contact form included in the accepted proposal.', 'development', 'production', 'developer', false, 12),
  ('implement-quote-request-form', 'Implement quote request form', 'Add the quote request form included in the accepted proposal.', 'development', 'production', 'developer', false, 13),
  ('implement-booking-appointment-form', 'Implement booking / appointment form', 'Add the booking form included in the accepted proposal.', 'development', 'production', 'developer', false, 14),
  ('implement-online-payments', 'Implement online payments', 'Add the online payment functionality included in the accepted proposal.', 'development', 'production', 'developer', false, 15),
  ('implement-ecommerce-functionality', 'Implement e-commerce functionality', 'Add the e-commerce functionality included in the accepted proposal.', 'development', 'production', 'developer', false, 16),
  ('implement-customer-login', 'Implement customer login', 'Add the customer login included in the accepted proposal.', 'development', 'production', 'developer', false, 17),
  ('add-google-maps', 'Add Google Maps', 'Add the Google Maps integration included in the accepted proposal.', 'development', 'production', 'developer', false, 18),
  ('add-social-media-integration', 'Add social media integration', 'Connect the social profiles included in the accepted proposal.', 'development', 'production', 'developer', false, 19),
  ('add-newsletter-signup', 'Add newsletter signup', 'Add the newsletter signup included in the accepted proposal.', 'development', 'production', 'developer', false, 20),
  ('add-live-chat', 'Add live chat', 'Add the live chat included in the accepted proposal.', 'development', 'production', 'developer', false, 21),
  ('set-up-seo', 'Set up SEO', 'Complete the SEO setup included in the accepted proposal.', 'development', 'production', 'developer', false, 22),
  ('install-analytics', 'Install analytics', 'Install the analytics included in the accepted proposal.', 'development', 'production', 'developer', false, 23),
  ('set-up-hosting', 'Set up hosting', 'Complete the hosting setup included in the accepted proposal.', 'development', 'production', 'developer', false, 24),
  ('set-up-business-email', 'Set up business email', 'Set up the business email included in the accepted proposal.', 'development', 'production', 'developer', false, 25),
  ('connect-the-domain', 'Connect the domain', 'Connect the domain included in the accepted proposal.', 'development', 'production', 'developer', false, 26),
  ('performance-optimization', 'Performance optimization', 'Complete the performance work included in the accepted proposal.', 'development', 'production', 'developer', false, 27),
  ('security-setup', 'Security setup', 'Complete the security setup included in the accepted proposal.', 'development', 'production', 'developer', false, 28),
  ('integrate-approved-content', 'Integrate approved content', 'Place the approved client content on the purchased pages.', 'development', 'internal', 'developer', false, 29),
  ('prepare-deploy-staging', 'Prepare/deploy staging', 'Prepare the staging website for internal QA and client review. Hosting stays external.', 'development', 'client_review', 'developer', false, 30),

  -- Review
  ('prepare-staging-for-client-review', 'Prepare staging for client review', 'Make the staging website ready for the client to review.', 'review', 'client_review', 'project_manager', false, 0),
  ('address-requested-revisions', 'Address requested revisions', 'Complete approved revision requests from client review.', 'review', 'client_review', 'developer', false, 1),
  ('test-staging-website', 'Test staging website', 'QA the staging website against the accepted proposal.', 'review', 'qa', 'team_member', false, 2),
  ('test-responsive-layouts', 'Test responsive layouts', 'QA phone and desktop layouts included in the accepted proposal.', 'review', 'qa', 'team_member', false, 3),
  ('test-contact-form', 'Test contact form', 'QA this purchased feature on staging.', 'review', 'qa', 'team_member', false, 4),
  ('test-quote-request-form', 'Test quote request form', 'QA this purchased feature on staging.', 'review', 'qa', 'team_member', false, 5),
  ('test-booking-appointment-form', 'Test booking / appointment form', 'QA this purchased feature on staging.', 'review', 'qa', 'team_member', false, 6),
  ('test-online-payments', 'Test online payments', 'QA this purchased feature on staging.', 'review', 'qa', 'team_member', false, 7),
  ('test-ecommerce-functionality', 'Test e-commerce functionality', 'QA this purchased feature on staging.', 'review', 'qa', 'team_member', false, 8),
  ('test-customer-login', 'Test customer login', 'QA this purchased feature on staging.', 'review', 'qa', 'team_member', false, 9),
  ('test-google-maps', 'Test Google Maps', 'QA this purchased feature on staging.', 'review', 'qa', 'team_member', false, 10),
  ('test-social-media-links', 'Test social media links', 'QA this purchased feature on staging.', 'review', 'qa', 'team_member', false, 11),
  ('test-newsletter-signup', 'Test newsletter signup', 'QA this purchased feature on staging.', 'review', 'qa', 'team_member', false, 12),
  ('test-live-chat', 'Test live chat', 'QA this purchased feature on staging.', 'review', 'qa', 'team_member', false, 13),

  -- Launch
  ('deploy-production', 'Deploy production', 'Deploy the approved website to the production URL. Hosting stays external.', 'launch', 'internal', 'developer', false, 0),
  ('verify-production-website', 'Verify production website', 'Confirm the live website matches the approved staging version.', 'launch', 'internal', 'team_member', false, 1),
  ('final-qa', 'Final QA', 'Complete final QA on the production website before handoff.', 'launch', 'qa', 'team_member', false, 2),
  ('complete-client-handoff', 'Complete client handoff', 'Deliver final assets/credentials and confirm the client has everything needed to own the live website.', 'launch', 'handoff', null, false, 3);

-- Scope triggers. A template with zero rows here is unconditional (always
-- generated) -- matches every "always enqueue" call in today's function.
insert into public.task_template_scope_items (task_template_id, scope_item_key)
select t.id, v.scope_item_key
from public.task_templates t
join (values
  ('write-homepage-copy', 'homepage'),
  ('write-about-page-copy', 'about'),
  ('write-services-page-copy', 'services'),
  ('write-contact-page-copy', 'contact'),
  ('write-gallery-portfolio-copy', 'gallery'),
  ('write-testimonials-page-copy', 'testimonials'),
  ('write-faq-page-copy', 'faq'),
  ('write-pricing-page-copy', 'pricing'),
  ('write-team-page-copy', 'team'),
  ('write-locations-page-copy', 'locations'),
  ('write-blog-news-copy', 'blog'),
  ('prepare-contact-information', 'contact'),
  ('migrate-approved-content', 'content_migration'),

  ('design-homepage', 'homepage'),
  ('design-about-page', 'about'),
  ('design-services-page', 'services'),
  ('design-contact-page', 'contact'),
  ('design-gallery-portfolio-page', 'gallery'),
  ('design-testimonials-page', 'testimonials'),
  ('design-faq-page', 'faq'),
  ('design-pricing-page', 'pricing'),
  ('design-team-page', 'team'),
  ('design-locations-page', 'locations'),
  ('design-blog-news-page', 'blog'),
  ('design-responsive-mobile-layouts', 'responsive'),
  ('design-responsive-mobile-layouts', 'mobile'),

  ('build-homepage', 'homepage'),
  ('build-about-page', 'about'),
  ('build-services-page', 'services'),
  ('build-contact-page', 'contact'),
  ('build-gallery-portfolio-page', 'gallery'),
  ('build-testimonials-page', 'testimonials'),
  ('build-faq-page', 'faq'),
  ('build-pricing-page', 'pricing'),
  ('build-team-page', 'team'),
  ('build-locations-page', 'locations'),
  ('build-blog-news-page', 'blog'),
  ('implement-responsive-layouts', 'responsive'),
  ('implement-responsive-layouts', 'mobile'),
  ('implement-contact-form', 'contact_form'),
  ('implement-quote-request-form', 'quote_form'),
  ('implement-booking-appointment-form', 'booking_form'),
  ('implement-online-payments', 'payments'),
  ('implement-ecommerce-functionality', 'ecommerce'),
  ('implement-customer-login', 'customer_login'),
  ('add-google-maps', 'maps'),
  ('add-social-media-integration', 'social'),
  ('add-newsletter-signup', 'newsletter'),
  ('add-live-chat', 'live_chat'),
  ('set-up-seo', 'seo'),
  ('install-analytics', 'analytics'),
  ('set-up-hosting', 'hosting'),
  ('set-up-business-email', 'email'),
  ('connect-the-domain', 'domain'),
  ('performance-optimization', 'performance'),
  ('security-setup', 'security'),
  ('integrate-approved-content', 'homepage'),
  ('integrate-approved-content', 'about'),
  ('integrate-approved-content', 'services'),
  ('integrate-approved-content', 'contact'),
  ('integrate-approved-content', 'gallery'),
  ('integrate-approved-content', 'testimonials'),
  ('integrate-approved-content', 'faq'),
  ('integrate-approved-content', 'pricing'),
  ('integrate-approved-content', 'team'),
  ('integrate-approved-content', 'locations'),
  ('integrate-approved-content', 'blog'),

  ('test-responsive-layouts', 'responsive'),
  ('test-responsive-layouts', 'mobile'),
  ('test-contact-form', 'contact_form'),
  ('test-quote-request-form', 'quote_form'),
  ('test-booking-appointment-form', 'booking_form'),
  ('test-online-payments', 'payments'),
  ('test-ecommerce-functionality', 'ecommerce'),
  ('test-customer-login', 'customer_login'),
  ('test-google-maps', 'maps'),
  ('test-social-media-links', 'social'),
  ('test-newsletter-signup', 'newsletter'),
  ('test-live-chat', 'live_chat')
) as v(slug, scope_item_key) on v.slug = t.slug;

-- Fill in instructions and estimated_hours from the existing, still-live
-- title-keyed functions -- byte-for-byte identical to what a task with this
-- exact title gets today, with zero manual retyping.
update public.task_templates
set instructions = public.production_task_instructions(title, ''),
    estimated_hours = public.production_task_estimated_hours(title);
