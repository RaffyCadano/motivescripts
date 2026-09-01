-- DEVELOPMENT ONLY. Do not apply this file to production.
-- MotiveScripts demo records (ABC Landscaping, Harbor & Pine, Smith Auto, BrightPath, etc.).
-- Idempotent: inserts use fixed UUIDs and ON CONFLICT DO NOTHING.
-- Runtime application code never inserts this dataset.
-- Production databases should start with zero business records and show real empty states.
-- Optional local/staging: run this SQL in the Dashboard after schema migrations, never as a production migration.

insert into public.clients (
  id, contact_name, business_name, email, phone, industry, website, location, status, source, notes, activity, invoices, messages, last_activity_at, created_at
) values
('20000000-0000-4000-8000-000000000001', 'John Smith', 'ABC Landscaping', 'john@example.com', '(555) 555-5555', 'Landscaping', '', '', 'Active', 'Start a Project',
  '[{"id":"cnote-001","body":"Client prefers communication by email.","author":"Raffy","createdAt":null}]'::jsonb,
  '[{"id":"cact-001a","description":"Homepage V3 approved","createdAt":null,"icon":"file"},{"id":"cact-001c","description":"Client record created","createdAt":null,"icon":"created"}]'::jsonb,
  '[{"id":"inv-1042","number":"#1042","title":"Website Development","amount":"$1,200","status":"Partially Paid"},{"id":"inv-1038","number":"#1038","title":"Deposit","amount":"$1,200","status":"Paid"}]'::jsonb,
  '[{"id":"msg-a","sender":"John Smith","body":"Can we change the hero image?"},{"id":"msg-b","sender":"MotiveScripts","body":"Absolutely. We’ll update it."}]'::jsonb,
  now(), now() - interval '12 days'),
('20000000-0000-4000-8000-000000000002', 'Mike Johnson', 'Smith Auto', 'mike@smithauto.example', '(555) 014-2201', 'Auto', '', '', 'Active', 'Start a Project',
  '[]'::jsonb, '[{"id":"cact-002b","description":"Client record created","createdAt":null,"icon":"created"}]'::jsonb,
  '[{"id":"inv-1020","number":"#1020","title":"Design deposit","amount":"$800","status":"Paid"}]'::jsonb,
  '[{"id":"msg-c","sender":"Mike Johnson","body":"Can we add the inspection special?"}]'::jsonb,
  now() - interval '1 days', now() - interval '20 days'),
('20000000-0000-4000-8000-000000000003', 'Sarah Williams', 'XYZ Cleaning', 'sarah@xyzcleaning.example', '(555) 014-3308', 'Cleaning', '', '', 'Active', 'Start a Project',
  '[]'::jsonb, '[{"id":"cact-003b","description":"Client record created","createdAt":null,"icon":"created"}]'::jsonb,
  '[{"id":"inv-1011","number":"#1011","title":"Landing page","amount":"$1,400","status":"Paid"}]'::jsonb,
  '[{"id":"msg-d","sender":"MotiveScripts","body":"The landing page is live."}]'::jsonb,
  now() - interval '2 days', now() - interval '30 days'),
('20000000-0000-4000-8000-000000000004', 'Elena Park', 'Harbor & Pine Salon', 'elena@harborpine.example', '(555) 014-5580', 'Salon / barber', '', '', 'Active', 'Start a Project',
  '[]'::jsonb, '[{"id":"cact-hp-a","description":"Client converted from lead","createdAt":null,"icon":"converted"}]'::jsonb,
  '[]'::jsonb, '[]'::jsonb, now() - interval '5 days', now() - interval '5 days'),
('20000000-0000-4000-8000-000000000005', 'Luis Ortega', 'BrightPath Bookkeeping', 'luis@brightpath.example', '(555) 014-8801', 'Professional services', 'https://brightpath.example', 'Austin, TX', 'Inactive', 'Manual',
  '[]'::jsonb, '[{"id":"cact-004a","description":"Client marked inactive","createdAt":null,"icon":"status"}]'::jsonb,
  '[]'::jsonb, '[]'::jsonb, now() - interval '21 days', now() - interval '60 days'),
('20000000-0000-4000-8000-000000000006', 'Nina Cole', 'Cole Home Care', 'nina@colehome.example', '(555) 014-9902', 'Home services', '', '', 'Archived', 'Manual',
  '[]'::jsonb, '[{"id":"cact-005a","description":"Client archived","createdAt":null,"icon":"status"}]'::jsonb,
  '[]'::jsonb, '[]'::jsonb, now() - interval '40 days', now() - interval '90 days')
on conflict (id) do nothing;


insert into public.leads (
  id, name, business_name, email, phone, industry, request, project_details, status, source, notes, activity, client_id, converted_at, created_at
) values
('10000000-0000-4000-8000-000000000001', 'John Smith', 'ABC Landscaping', 'john@example.com', '(555) 555-5555', 'Landscaping', 'New Website', 'We are looking for a modern website for our landscaping business.', 'New', 'Start a Project',
  '[{"id":"note-001","body":"Potential good fit for a 5-page business website.","author":"Raffy","createdAt":null}]'::jsonb,
  '[{"id":"act-001a","description":"Lead submitted project inquiry","createdAt":null}]'::jsonb,
  null, null, now() - interval '3 hours'),
('10000000-0000-4000-8000-000000000002', 'Mike Johnson', 'Smith Auto', 'mike@smithauto.example', '(555) 014-2201', 'Auto', 'Website Redesign', 'The current site is outdated. We need a cleaner shop site with service pages and hours.', 'Contacted', 'Start a Project',
  '[]'::jsonb, '[{"id":"act-002a","description":"Lead submitted project inquiry","createdAt":null}]'::jsonb,
  null, null, now() - interval '1 days'),
('10000000-0000-4000-8000-000000000003', 'Sarah Williams', 'XYZ Cleaning', 'sarah@xyzcleaning.example', '(555) 014-3308', 'Cleaning', 'New Website', 'Need a simple site that explains residential and commercial cleaning packages.', 'Qualified', 'Start a Project',
  '[]'::jsonb, '[{"id":"act-003a","description":"Lead submitted project inquiry","createdAt":null}]'::jsonb,
  null, null, now() - interval '2 days'),
('10000000-0000-4000-8000-000000000004', 'David Brown', 'Koala Trees Services', 'david@koalatrees.example', '(555) 014-4412', 'Tree service', 'Website Development', 'We need a site that can take service requests and show before-and-after work.', 'Proposal', 'Start a Project',
  '[]'::jsonb, '[{"id":"act-004a","description":"Lead submitted project inquiry","createdAt":null}]'::jsonb,
  null, null, now() - interval '3 days'),
('10000000-0000-4000-8000-000000000005', 'Elena Park', 'Harbor & Pine Salon', 'elena@harborpine.example', '(555) 014-5580', 'Salon / barber', 'New Website', 'A booking-friendly site for a small salon. Menu of services and a simple about page.', 'Won', 'Start a Project',
  '[]'::jsonb, '[{"id":"act-005b","description":"Lead converted to client","createdAt":null}]'::jsonb,
  '20000000-0000-4000-8000-000000000004', now() - interval '5 days', now() - interval '8 days'),
('10000000-0000-4000-8000-000000000006', 'Chris Nguyen', 'Northline Electrical', 'chris@northline.example', '(555) 014-6694', 'Contractor', 'Website Redesign', 'Reached out about a rebuild, then decided to wait until next year.', 'Lost', 'Manual',
  '[]'::jsonb, '[{"id":"act-006b","description":"Lead status changed to Lost","createdAt":null}]'::jsonb,
  null, null, now() - interval '10 days'),
('10000000-0000-4000-8000-000000000007', 'Priya Shah', 'Oak Street Kitchen', 'priya@oakstreet.example', '(555) 014-7703', 'Restaurant', 'New Website', 'Menu, hours, and a reservation note. Mobile-first for neighborhood traffic.', 'Contacted', 'Start a Project',
  '[]'::jsonb, '[{"id":"act-007a","description":"Lead submitted project inquiry","createdAt":null}]'::jsonb,
  null, null, now() - interval '4 days')
on conflict (id) do nothing;

update public.clients set source_lead_id = '10000000-0000-4000-8000-000000000005' where id = '20000000-0000-4000-8000-000000000004' and source_lead_id is null;


insert into public.projects (
  id, client_id, name, description, type, status, start_date, due_date, archived, approval_status, last_activity_at, created_at
) values
('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'Website Redesign', 'Full site redesign for a landscaping company, including services, gallery, and contact.', 'Website Redesign', 'In Development', (now() - interval '12 days')::date, (now() + interval '18 days')::date, false, 'Pending', now(), now() - interval '12 days'),
('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 'Business Website', 'Refresh the shop site and service pages for Smith Auto.', 'Website Redesign', 'Client Review', (now() - interval '18 days')::date, (now() + interval '6 days')::date, false, 'Pending', now() - interval '1 days', now() - interval '18 days'),
('30000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000003', 'Landing Page', 'One-page site for residential and commercial cleaning packages.', 'Landing Page', 'Planning', (now() - interval '2 days')::date, (now() + interval '23 days')::date, false, 'Pending', now(), now() - interval '2 days'),
('30000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000002', 'Winter Service Landing Page', 'Seasonal campaign page for winter inspections.', 'Landing Page', 'Completed', (now() - interval '16 days')::date, (now() - interval '4 days')::date, false, 'Approved', now() - interval '4 days', now() - interval '16 days'),
('30000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000004', 'Harbor & Pine Website', 'Booking-friendly salon site with services and about.', 'Website', 'Planning', (now() - interval '5 days')::date, (now() + interval '34 days')::date, false, 'Pending', now() - interval '1 days', now() - interval '5 days'),
('30000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000005', 'BrightPath Marketing Site', 'Simple professional-services site. Paused while the client revisits budget.', 'Website', 'On Hold', (now() - interval '40 days')::date, (now() + interval '60 days')::date, false, 'Pending', now() - interval '21 days', now() - interval '40 days')
on conflict (id) do nothing;


insert into public.milestones (id, project_id, name, description, status, position, start_date, due_date)
values
('40000000-0000-4000-8000-000000000011', '30000000-0000-4000-8000-000000000001', 'Discovery', 'Kickoff, goals, and content collection.', 'Completed', 1, (now() - interval '12 days')::date, (now() - interval '9 days')::date),
('40000000-0000-4000-8000-000000000012', '30000000-0000-4000-8000-000000000001', 'Design', 'Homepage and inner-page layouts.', 'Completed', 2, (now() - interval '9 days')::date, (now() - interval '5 days')::date),
('40000000-0000-4000-8000-000000000013', '30000000-0000-4000-8000-000000000001', 'Development', 'Build the approved designs in code.', 'In Progress', 3, (now() - interval '5 days')::date, (now() + interval '13 days')::date),
('40000000-0000-4000-8000-000000000014', '30000000-0000-4000-8000-000000000001', 'QA & Client Review', 'Test the staging website, resolve issues, collect client feedback, and obtain approval.', 'Not Started', 4, null, (now() + interval '16 days')::date),
('40000000-0000-4000-8000-000000000015', '30000000-0000-4000-8000-000000000001', 'Launch', 'Go-live and handoff.', 'Not Started', 5, null, (now() + interval '18 days')::date),
('40000000-0000-4000-8000-000000000021', '30000000-0000-4000-8000-000000000002', 'Discovery', 'Discovery stage.', 'Completed', 1, (now() - interval '18 days')::date, (now() - interval '16 days')::date),
('40000000-0000-4000-8000-000000000022', '30000000-0000-4000-8000-000000000002', 'Design', 'Design stage.', 'Completed', 2, (now() - interval '16 days')::date, (now() - interval '10 days')::date),
('40000000-0000-4000-8000-000000000023', '30000000-0000-4000-8000-000000000002', 'Development', 'Development stage.', 'Completed', 3, (now() - interval '10 days')::date, (now() - interval '2 days')::date),
('40000000-0000-4000-8000-000000000024', '30000000-0000-4000-8000-000000000002', 'QA & Client Review', 'Test the staging website, resolve issues, collect client feedback, and obtain approval.', 'In Progress', 4, (now() - interval '2 days')::date, (now() + interval '4 days')::date),
('40000000-0000-4000-8000-000000000025', '30000000-0000-4000-8000-000000000002', 'Launch', 'Launch stage.', 'Not Started', 5, null, (now() + interval '6 days')::date),
('40000000-0000-4000-8000-000000000031', '30000000-0000-4000-8000-000000000003', 'Discovery', 'Discovery stage.', 'In Progress', 1, (now() - interval '2 days')::date, (now() + interval '5 days')::date),
('40000000-0000-4000-8000-000000000032', '30000000-0000-4000-8000-000000000003', 'Design', 'Design stage.', 'Not Started', 2, null, (now() + interval '12 days')::date),
('40000000-0000-4000-8000-000000000033', '30000000-0000-4000-8000-000000000003', 'Development', 'Development stage.', 'Not Started', 3, null, (now() + interval '18 days')::date),
('40000000-0000-4000-8000-000000000034', '30000000-0000-4000-8000-000000000003', 'QA & Client Review', 'Test the staging website, resolve issues, collect client feedback, and obtain approval.', 'Not Started', 4, null, (now() + interval '21 days')::date),
('40000000-0000-4000-8000-000000000035', '30000000-0000-4000-8000-000000000003', 'Launch', 'Launch stage.', 'Not Started', 5, null, (now() + interval '23 days')::date),
('40000000-0000-4000-8000-000000000041', '30000000-0000-4000-8000-000000000004', 'Discovery', 'Discovery stage.', 'Completed', 1, (now() - interval '16 days')::date, (now() - interval '14 days')::date),
('40000000-0000-4000-8000-000000000042', '30000000-0000-4000-8000-000000000004', 'Development', 'Development stage.', 'Completed', 2, (now() - interval '14 days')::date, (now() - interval '6 days')::date),
('40000000-0000-4000-8000-000000000043', '30000000-0000-4000-8000-000000000004', 'Launch', 'Launch stage.', 'Completed', 3, (now() - interval '6 days')::date, (now() - interval '4 days')::date),
('40000000-0000-4000-8000-000000000051', '30000000-0000-4000-8000-000000000005', 'Discovery', 'Discovery stage.', 'Not Started', 1, null, null),
('40000000-0000-4000-8000-000000000052', '30000000-0000-4000-8000-000000000005', 'Design', 'Design stage.', 'Not Started', 2, null, null),
('40000000-0000-4000-8000-000000000053', '30000000-0000-4000-8000-000000000005', 'Development', 'Development stage.', 'Not Started', 3, null, null),
('40000000-0000-4000-8000-000000000054', '30000000-0000-4000-8000-000000000005', 'QA & Client Review', 'Test the staging website, resolve issues, collect client feedback, and obtain approval.', 'Not Started', 4, null, null),
('40000000-0000-4000-8000-000000000055', '30000000-0000-4000-8000-000000000005', 'Launch', 'Launch stage.', 'Not Started', 5, null, null),
('40000000-0000-4000-8000-000000000061', '30000000-0000-4000-8000-000000000006', 'Discovery', 'Discovery stage.', 'Completed', 1, null, null),
('40000000-0000-4000-8000-000000000062', '30000000-0000-4000-8000-000000000006', 'Design', 'Design stage.', 'Not Started', 2, null, null),
('40000000-0000-4000-8000-000000000063', '30000000-0000-4000-8000-000000000006', 'Development', 'Development stage.', 'Not Started', 3, null, null),
('40000000-0000-4000-8000-000000000064', '30000000-0000-4000-8000-000000000006', 'QA & Client Review', 'Test the staging website, resolve issues, collect client feedback, and obtain approval.', 'Not Started', 4, null, null),
('40000000-0000-4000-8000-000000000065', '30000000-0000-4000-8000-000000000006', 'Launch', 'Launch stage.', 'Not Started', 5, null, null)
on conflict (id) do nothing;


insert into public.tasks (id, project_id, milestone_id, title, description, status, priority, assignee, due_date, completed_at, created_at)
values
('50000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000011', 'Kickoff call', '', 'Completed', 'High', 'You', (now() - interval '11 days')::date, now() - interval '11 days', now() - interval '14 days'),
('50000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000011', 'Collect photos', '', 'Completed', 'Medium', 'Alex', (now() - interval '10 days')::date, now() - interval '10 days', now() - interval '14 days'),
('50000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000012', 'Homepage design', '', 'Completed', 'High', 'Jordan', (now() - interval '7 days')::date, now() - interval '6 days', now() - interval '14 days'),
('50000000-0000-4000-8000-000000000004', '30000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000012', 'Inner page layouts', '', 'Completed', 'Medium', 'Jordan', (now() - interval '5 days')::date, now() - interval '5 days', now() - interval '14 days'),
('50000000-0000-4000-8000-000000000005', '30000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000013', 'Setup project', '', 'Completed', 'High', 'You', (now() - interval '4 days')::date, now() - interval '4 days', now() - interval '14 days'),
('50000000-0000-4000-8000-000000000006', '30000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000013', 'Build homepage', '', 'Completed', 'High', 'You', (now() - interval '2 days')::date, now() - interval '1 days', now() - interval '14 days'),
('50000000-0000-4000-8000-000000000007', '30000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000013', 'Build navigation', '', 'Completed', 'Medium', 'Alex', (now() - interval '1 days')::date, now(), now() - interval '14 days'),
('50000000-0000-4000-8000-000000000008', '30000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000013', 'Build contact page', '', 'Todo', 'Medium', 'Alex', (now() + interval '4 days')::date, null, now() - interval '14 days'),
('50000000-0000-4000-8000-000000000009', '30000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000013', 'Mobile optimization', '', 'Todo', 'High', 'You', (now() + interval '11 days')::date, null, now() - interval '14 days'),
('50000000-0000-4000-8000-000000000010', '30000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000013', 'SEO setup', '', 'Todo', 'Low', 'Taylor', (now() + interval '14 days')::date, null, now() - interval '14 days'),
('50000000-0000-4000-8000-000000000011', '30000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000021', 'Audit current site', '', 'Completed', 'Medium', 'You', (now() - interval '17 days')::date, now() - interval '17 days', now() - interval '14 days'),
('50000000-0000-4000-8000-000000000012', '30000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000022', 'Homepage mockup', '', 'Completed', 'High', 'Jordan', (now() - interval '12 days')::date, now() - interval '12 days', now() - interval '14 days'),
('50000000-0000-4000-8000-000000000013', '30000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000022', 'Service page layouts', '', 'Completed', 'Medium', 'Jordan', (now() - interval '10 days')::date, now() - interval '10 days', now() - interval '14 days'),
('50000000-0000-4000-8000-000000000014', '30000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000023', 'Build homepage', '', 'Completed', 'High', 'Alex', (now() - interval '6 days')::date, now() - interval '6 days', now() - interval '14 days'),
('50000000-0000-4000-8000-000000000015', '30000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000023', 'Build service pages', '', 'Completed', 'High', 'You', (now() - interval '4 days')::date, now() - interval '4 days', now() - interval '14 days'),
('50000000-0000-4000-8000-000000000016', '30000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000023', 'Hours and inspection special', '', 'Completed', 'Medium', 'Taylor', (now() - interval '3 days')::date, now() - interval '3 days', now() - interval '14 days'),
('50000000-0000-4000-8000-000000000017', '30000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000023', 'Mobile pass', '', 'Completed', 'Medium', 'Alex', (now() - interval '2 days')::date, now() - interval '2 days', now() - interval '14 days'),
('50000000-0000-4000-8000-000000000018', '30000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000024', 'Internal QA', '', 'Completed', 'High', 'You', (now() - interval '1 days')::date, now() - interval '1 days', now() - interval '14 days'),
('50000000-0000-4000-8000-000000000019', '30000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000024', 'Send review link', '', 'Completed', 'Medium', 'You', (now() - interval '1 days')::date, now() - interval '1 days', now() - interval '14 days'),
('50000000-0000-4000-8000-000000000020', '30000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000024', 'Collect client notes', '', 'Todo', 'High', 'You', (now() + interval '3 days')::date, null, now() - interval '14 days'),
('50000000-0000-4000-8000-000000000021', '30000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000031', 'Confirm packages', '', 'Completed', 'High', 'You', (now() - interval '1 days')::date, now(), now() - interval '14 days'),
('50000000-0000-4000-8000-000000000022', '30000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000031', 'Gather photos', '', 'Todo', 'Medium', 'Alex', (now() + interval '3 days')::date, null, now() - interval '14 days'),
('50000000-0000-4000-8000-000000000023', '30000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000031', 'Write service copy', '', 'Todo', 'Medium', 'Taylor', (now() + interval '5 days')::date, null, now() - interval '14 days'),
('50000000-0000-4000-8000-000000000024', '30000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000032', 'Landing page layout', '', 'Todo', 'High', 'Jordan', (now() + interval '10 days')::date, null, now() - interval '14 days'),
('50000000-0000-4000-8000-000000000025', '30000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000033', 'Build landing page', '', 'Todo', 'High', 'You', (now() + interval '16 days')::date, null, now() - interval '14 days'),
('50000000-0000-4000-8000-000000000026', '30000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000033', 'Form and click-to-call', '', 'Todo', 'Medium', 'Alex', (now() + interval '17 days')::date, null, now() - interval '14 days'),
('50000000-0000-4000-8000-000000000027', '30000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000034', 'Client walkthrough', '', 'Todo', 'Medium', 'You', (now() + interval '20 days')::date, null, now() - interval '14 days'),
('50000000-0000-4000-8000-000000000028', '30000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000035', 'Publish', '', 'Todo', 'High', 'You', (now() + interval '23 days')::date, null, now() - interval '14 days'),
('50000000-0000-4000-8000-000000000029', '30000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000031', 'Review competitors', '', 'Todo', 'Low', 'Taylor', (now() + interval '2 days')::date, null, now() - interval '14 days'),
('50000000-0000-4000-8000-000000000030', '30000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000032', 'Mobile layout check', '', 'Todo', 'Medium', 'Jordan', (now() + interval '11 days')::date, null, now() - interval '14 days'),
('50000000-0000-4000-8000-000000000031', '30000000-0000-4000-8000-000000000004', '40000000-0000-4000-8000-000000000041', 'Campaign brief', '', 'Completed', 'Medium', 'You', (now() - interval '15 days')::date, now() - interval '15 days', now() - interval '14 days'),
('50000000-0000-4000-8000-000000000032', '30000000-0000-4000-8000-000000000004', '40000000-0000-4000-8000-000000000042', 'Build landing page', '', 'Completed', 'High', 'Alex', (now() - interval '8 days')::date, now() - interval '8 days', now() - interval '14 days'),
('50000000-0000-4000-8000-000000000033', '30000000-0000-4000-8000-000000000004', '40000000-0000-4000-8000-000000000042', 'Connect form', '', 'Completed', 'Medium', 'Alex', (now() - interval '6 days')::date, now() - interval '6 days', now() - interval '14 days'),
('50000000-0000-4000-8000-000000000034', '30000000-0000-4000-8000-000000000004', '40000000-0000-4000-8000-000000000043', 'Publish campaign', '', 'Completed', 'High', 'You', (now() - interval '4 days')::date, now() - interval '4 days', now() - interval '14 days'),
('50000000-0000-4000-8000-000000000035', '30000000-0000-4000-8000-000000000005', '40000000-0000-4000-8000-000000000051', 'Confirm service menu', '', 'Todo', 'High', 'You', (now() + interval '3 days')::date, null, now() - interval '14 days'),
('50000000-0000-4000-8000-000000000036', '30000000-0000-4000-8000-000000000005', '40000000-0000-4000-8000-000000000051', 'Collect salon photos', '', 'Todo', 'Medium', 'Alex', (now() + interval '7 days')::date, null, now() - interval '14 days'),
('50000000-0000-4000-8000-000000000037', '30000000-0000-4000-8000-000000000006', '40000000-0000-4000-8000-000000000061', 'Kickoff notes', '', 'Completed', 'Medium', 'You', (now() - interval '38 days')::date, now() - interval '38 days', now() - interval '14 days'),
('50000000-0000-4000-8000-000000000038', '30000000-0000-4000-8000-000000000006', '40000000-0000-4000-8000-000000000062', 'Homepage wireframe', '', 'Todo', 'High', 'Jordan', (now() + interval '70 days')::date, null, now() - interval '14 days')
on conflict (id) do nothing;


insert into public.deliverables (id, project_id, name, description, category, status, archived_at, created_at, updated_at)
values
('60000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'Website Homepage', 'Homepage design including hero, navigation, CTA, and responsive layout.', 'Website Page', 'In Review', null, now() - interval '12 days', now()),
('60000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000001', 'About Page', 'About page design and story content.', 'Website Page', 'Approved', null, now() - interval '10 days', now() - interval '1 days'),
('60000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000001', 'Logo', 'Primary website logo.', 'Branding', 'Approved', null, now() - interval '11 days', now() - interval '8 days'),
('60000000-0000-4000-8000-000000000004', '30000000-0000-4000-8000-000000000001', 'Brand Assets', 'Color, type, and supporting marks.', 'Asset', 'Needs Changes', null, now() - interval '11 days', now() - interval '3 days'),
('60000000-0000-4000-8000-000000000005', '30000000-0000-4000-8000-000000000005', 'Website Homepage', 'Homepage design and content for the salon site.', 'Website Page', 'In Review', null, now() - interval '5 days', now() - interval '2 days'),
('60000000-0000-4000-8000-000000000006', '30000000-0000-4000-8000-000000000005', 'About Page', 'About page design.', 'Website Page', 'Draft', null, now() - interval '4 days', now() - interval '1 days'),
('60000000-0000-4000-8000-000000000007', '30000000-0000-4000-8000-000000000005', 'Logo', 'Primary website logo.', 'Branding', 'In Review', null, now() - interval '5 days', now() - interval '5 days'),
('60000000-0000-4000-8000-000000000008', '30000000-0000-4000-8000-000000000005', 'Brand Assets', 'Palette and supporting marks.', 'Asset', 'Draft', null, now() - interval '5 days', now() - interval '4 days'),
('60000000-0000-4000-8000-000000000009', '30000000-0000-4000-8000-000000000002', 'Website Homepage', 'Shop homepage currently in client review.', 'Website Page', 'In Review', null, now() - interval '14 days', now() - interval '1 days'),
('60000000-0000-4000-8000-000000000010', '30000000-0000-4000-8000-000000000004', 'Landing Page', 'Winter inspection campaign page.', 'Website Page', 'Approved', null, now() - interval '10 days', now() - interval '4 days')
on conflict (id) do nothing;


insert into public.file_versions (
  id, deliverable_id, version_number, label, description, is_current, file_name, file_type, file_size, uploaded_by, created_at
) values
('70000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000001', 1, 'v1', 'First homepage pass.', false, 'homepage-v1.png', 'PNG', 1120000, 'Jordan', now() - interval '12 days'),
('70000000-0000-4000-8000-000000000002', '60000000-0000-4000-8000-000000000001', 2, 'v2', 'Revised hero and services.', false, 'homepage-revision-v2.png', 'PNG', 1340000, 'Jordan', now() - interval '1 days'),
('70000000-0000-4000-8000-000000000003', '60000000-0000-4000-8000-000000000001', 3, 'v3', 'Current homepage for client review.', true, 'homepage-final-v3.png', 'PNG', 2410000, 'You', now()),
('70000000-0000-4000-8000-000000000004', '60000000-0000-4000-8000-000000000002', 1, 'v1', 'Initial about layout.', false, 'about-v1.png', 'PNG', 980000, 'Alex', now() - interval '10 days'),
('70000000-0000-4000-8000-000000000005', '60000000-0000-4000-8000-000000000002', 2, 'v2', 'Updated team copy.', true, 'about-v2.png', 'PNG', 1050000, 'Alex', now() - interval '1 days'),
('70000000-0000-4000-8000-000000000006', '60000000-0000-4000-8000-000000000003', 1, 'v1', 'Approved logo lockup.', true, 'logo-final.svg', 'SVG', 48000, 'Taylor', now() - interval '8 days'),
('70000000-0000-4000-8000-000000000007', '60000000-0000-4000-8000-000000000004', 1, 'v1', 'First asset pack.', false, 'brand-assets-v1.zip', 'ZIP', 4200000, 'Taylor', now() - interval '9 days'),
('70000000-0000-4000-8000-000000000008', '60000000-0000-4000-8000-000000000004', 2, 'v2', 'Includes usage notes.', true, 'brand-assets-v2.zip', 'ZIP', 4720000, 'Taylor', now() - interval '3 days'),
('70000000-0000-4000-8000-000000000009', '60000000-0000-4000-8000-000000000005', 1, 'v1', 'First homepage concept.', false, 'harbor-home-v1.png', 'PNG', 1080000, 'Jordan', now() - interval '5 days'),
('70000000-0000-4000-8000-000000000010', '60000000-0000-4000-8000-000000000005', 2, 'v2', 'Booking CTA added.', false, 'harbor-home-v2.png', 'PNG', 1220000, 'Jordan', now() - interval '3 days'),
('70000000-0000-4000-8000-000000000011', '60000000-0000-4000-8000-000000000005', 3, 'v3', 'Current homepage draft.', true, 'harbor-home-v3.png', 'PNG', 1410000, 'You', now() - interval '2 days'),
('70000000-0000-4000-8000-000000000012', '60000000-0000-4000-8000-000000000006', 1, 'v1', 'First about layout.', false, 'harbor-about-v1.png', 'PNG', 860000, 'Alex', now() - interval '4 days'),
('70000000-0000-4000-8000-000000000013', '60000000-0000-4000-8000-000000000006', 2, 'v2', 'Photo crop update.', true, 'harbor-about-v2.png', 'PNG', 910000, 'Alex', now() - interval '1 days'),
('70000000-0000-4000-8000-000000000014', '60000000-0000-4000-8000-000000000007', 1, 'v1', 'Wordmark for the site header.', true, 'harbor-logo.svg', 'SVG', 36000, 'Taylor', now() - interval '5 days'),
('70000000-0000-4000-8000-000000000015', '60000000-0000-4000-8000-000000000008', 1, 'v1', 'Initial brand pack.', false, 'harbor-brand-v1.zip', 'ZIP', 2100000, 'Taylor', now() - interval '5 days'),
('70000000-0000-4000-8000-000000000016', '60000000-0000-4000-8000-000000000008', 2, 'v2', 'Includes social avatars.', true, 'harbor-brand-v2.zip', 'ZIP', 2400000, 'Taylor', now() - interval '4 days'),
('70000000-0000-4000-8000-000000000017', '60000000-0000-4000-8000-000000000009', 1, 'v1', 'First shop homepage.', false, 'smith-home-v1.png', 'PNG', 1500000, 'Alex', now() - interval '12 days'),
('70000000-0000-4000-8000-000000000018', '60000000-0000-4000-8000-000000000009', 2, 'v2', 'Inspection special added.', true, 'smith-home-v2.png', 'PNG', 1620000, 'You', now() - interval '1 days'),
('70000000-0000-4000-8000-000000000019', '60000000-0000-4000-8000-000000000010', 1, 'v1', 'Published campaign layout.', true, 'winter-landing-final.png', 'PNG', 1180000, 'Alex', now() - interval '4 days')
on conflict (id) do nothing;


insert into public.feedback (id, project_id, deliverable_id, version_id, client_id, message, status, created_by_name, created_at, resolved_at)
values
('80000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000004', '70000000-0000-4000-8000-000000000008', '20000000-0000-4000-8000-000000000001',
  'Please replace the dark background with the lighter version from the brand guide.', 'Open', 'John Smith', now() - interval '2 days', null),
('80000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000002', '70000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000001',
  'Please increase the spacing between the story and the team photos.', 'Resolved', 'John Smith', now() - interval '6 days', now() - interval '3 days')
on conflict (id) do nothing;

insert into public.approvals (id, project_id, deliverable_id, version_id, client_id, status, approved_by_name, approved_at, created_at)
values
('90000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000002', '70000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000001', 'Approved', 'ABC Landscaping', now() - interval '1 days', now() - interval '1 days'),
('90000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000003', '70000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000001', 'Approved', 'ABC Landscaping', now() - interval '8 days', now() - interval '8 days'),
('90000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', 'Approved', 'ABC Landscaping', now() - interval '1 days', now() - interval '1 days')
on conflict (id) do nothing;


insert into public.activity (id, project_id, activity_type, message, metadata, created_at)
values
('a0000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'version_sent_for_review', 'Website Homepage v3 sent for review.', '{"icon":"review"}'::jsonb, now()),
('a0000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000001', 'task_completed', 'Task “Build navigation” completed', '{"icon":"task"}'::jsonb, now()),
('a0000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000001', 'changes_requested', 'Client requested changes on Brand Assets v2.', '{"icon":"review"}'::jsonb, now() - interval '2 days'),
('a0000000-0000-4000-8000-000000000004', '30000000-0000-4000-8000-000000000001', 'version_approved', 'About Page v2 approved.', '{"icon":"review"}'::jsonb, now() - interval '1 days'),
('a0000000-0000-4000-8000-000000000005', '30000000-0000-4000-8000-000000000001', 'version_created', 'Version 3 uploaded', '{"icon":"file"}'::jsonb, now()),
('a0000000-0000-4000-8000-000000000006', '30000000-0000-4000-8000-000000000001', 'task_completed', 'Task “Build homepage” completed', '{"icon":"task"}'::jsonb, now() - interval '1 days'),
('a0000000-0000-4000-8000-000000000007', '30000000-0000-4000-8000-000000000001', 'milestone_created', 'Development milestone started', '{"icon":"milestone"}'::jsonb, now() - interval '5 days'),
('a0000000-0000-4000-8000-000000000008', '30000000-0000-4000-8000-000000000001', 'project_created', 'Project created', '{"icon":"created"}'::jsonb, now() - interval '12 days'),
('a0000000-0000-4000-8000-000000000009', '30000000-0000-4000-8000-000000000002', 'version_created', 'Version 2 uploaded', '{"icon":"file"}'::jsonb, now() - interval '1 days'),
('a0000000-0000-4000-8000-000000000010', '30000000-0000-4000-8000-000000000002', 'status_changed', 'Project status changed to Client Review', '{"icon":"status"}'::jsonb, now() - interval '1 days'),
('a0000000-0000-4000-8000-000000000011', '30000000-0000-4000-8000-000000000002', 'project_created', 'Project created', '{"icon":"created"}'::jsonb, now() - interval '18 days'),
('a0000000-0000-4000-8000-000000000012', '30000000-0000-4000-8000-000000000003', 'task_completed', 'Task “Confirm packages” completed', '{"icon":"task"}'::jsonb, now()),
('a0000000-0000-4000-8000-000000000013', '30000000-0000-4000-8000-000000000003', 'project_created', 'Project created', '{"icon":"created"}'::jsonb, now() - interval '2 days'),
('a0000000-0000-4000-8000-000000000014', '30000000-0000-4000-8000-000000000004', 'version_created', 'Version 1 uploaded', '{"icon":"file"}'::jsonb, now() - interval '4 days'),
('a0000000-0000-4000-8000-000000000015', '30000000-0000-4000-8000-000000000004', 'status_changed', 'Project status changed to Completed', '{"icon":"status"}'::jsonb, now() - interval '4 days'),
('a0000000-0000-4000-8000-000000000016', '30000000-0000-4000-8000-000000000004', 'project_created', 'Project created', '{"icon":"created"}'::jsonb, now() - interval '16 days'),
('a0000000-0000-4000-8000-000000000017', '30000000-0000-4000-8000-000000000005', 'version_created', 'Version 2 uploaded', '{"icon":"file"}'::jsonb, now() - interval '1 days'),
('a0000000-0000-4000-8000-000000000018', '30000000-0000-4000-8000-000000000005', 'version_created', 'Version 3 uploaded', '{"icon":"file"}'::jsonb, now() - interval '2 days'),
('a0000000-0000-4000-8000-000000000019', '30000000-0000-4000-8000-000000000005', 'deliverable_created', 'Deliverable created', '{"icon":"file"}'::jsonb, now() - interval '5 days'),
('a0000000-0000-4000-8000-000000000020', '30000000-0000-4000-8000-000000000005', 'project_created', 'Project created', '{"icon":"created"}'::jsonb, now() - interval '5 days'),
('a0000000-0000-4000-8000-000000000021', '30000000-0000-4000-8000-000000000006', 'status_changed', 'Project status changed to On Hold', '{"icon":"status"}'::jsonb, now() - interval '21 days'),
('a0000000-0000-4000-8000-000000000022', '30000000-0000-4000-8000-000000000006', 'project_created', 'Project created', '{"icon":"created"}'::jsonb, now() - interval '40 days')
on conflict (id) do nothing;
