-- ONE-OFF MOCK SCENARIO SEED. Not part of the schema, not development fixtures
-- like seed_demo_data.sql. This exists because the live workspace was wiped
-- clean via "Delete entire agency" and the user wants ONE realistic, fully
-- fleshed-out client engagement to browse in the live admin UI.
--
-- Fictional client: "Evergreen Grounds Landscaping" (same fictional business
-- used for the landscaping-starter-template repo: brand "EG", primary color
-- #2f5d3a, phone (555) 555-0123, email hello@evergreengrounds.example).
-- Everything else (staff names, dates, amounts, copy) is invented for this
-- seed and clearly fake.
--
-- SAFE TO DELETE AFTERWARD. Every row this script creates uses a fixed UUID
-- whose first 8 hex characters start with the letter 'e' (e1000000-...,
-- e2000000-..., through ef000000-...). To remove everything this script
-- created, delete by that id prefix from (in FK-safe order): activity,
-- payments, invoice_items, invoices, contract_revisions, contracts,
-- proposal_items, proposal_revisions, proposals, project_staff_assignments,
-- approvals, feedback, tasks, file_versions, deliverables, milestones,
-- project_development (by project_id), projects, clients, leads,
-- staff_profiles, profiles, auth.users. Or just re-run the admin's normal
-- "Delete entire agency" danger-zone action, which purges all of this too.
--
-- Idempotent: fixed UUIDs + `on conflict (id) do nothing` / `if not exists`
-- guards throughout. Re-running this script is harmless.
--
-- Verified against the LIVE linked Supabase schema (information_schema,
-- pg_constraint, pg_proc, pg_trigger) on 2026-09-06, not against migration
-- source alone -- several details below diverge from older migrations/the
-- seed_demo_data.sql reference (see the project chat notes for the full list),
-- most notably: public.clients no longer has notes/activity/invoices/messages
-- jsonb columns (that data now lives in real tables), tasks.recommended_role
-- from migration 20260901210001 does not exist on the live table, and
-- tasks.task_type is the real enum-like column to use instead
-- ('discovery' | 'content_collection' | 'design' | 'production' |
-- 'client_review' | 'qa' | 'internal').
--
-- Documents (proposals/contracts/invoices/invoice_items/payments) are
-- guarded by triggers that reject direct writes unless the same session
-- config the real RPCs set is active, so this script sets it once at the top
-- of the block: select set_config('app.document_rpc', '1', true) -- exactly
-- mirroring create_proposal/send_invoice/record_stripe_payment etc.
--
-- Staff members are real public.profiles rows (role = 'staff') with matching
-- public.staff_profiles rows so they show up normally in Team, task-assignee
-- pickers, and project rosters. public.profiles.id has a hard
-- `references auth.users(id) on delete cascade` foreign key, so this script
-- also inserts minimal matching auth.users rows for the 4 fictional staff
-- members (option (a) from the brief) rather than relying on the legacy
-- `tasks.assignee` free-text column alone -- that column still exists and is
-- still populated here for display compatibility, but using real profiles is
-- what makes these people assignable/visible like real team members.

do $$
declare
  -- staff (auth.users / profiles / staff_profiles)
  v_designer_id  uuid := 'e1000000-0000-4000-8000-000000000001';
  v_developer_id uuid := 'e1000000-0000-4000-8000-000000000002';
  v_writer_id    uuid := 'e1000000-0000-4000-8000-000000000003';
  v_qa_id        uuid := 'e1000000-0000-4000-8000-000000000004';

  -- lead / client / project
  v_lead_id    uuid := 'e2000000-0000-4000-8000-000000000001';
  v_client_id  uuid := 'e3000000-0000-4000-8000-000000000001';
  v_project_id uuid := 'e4000000-0000-4000-8000-000000000001';

  -- milestones
  v_ms_discovery uuid := 'e5000000-0000-4000-8000-000000000001';
  v_ms_design    uuid := 'e5000000-0000-4000-8000-000000000002';
  v_ms_dev       uuid := 'e5000000-0000-4000-8000-000000000003';
  v_ms_qa        uuid := 'e5000000-0000-4000-8000-000000000004';
  v_ms_launch    uuid := 'e5000000-0000-4000-8000-000000000005';

  -- deliverables / file versions
  v_deliv_logo uuid := 'e7000000-0000-4000-8000-000000000001';
  v_deliv_home uuid := 'e7000000-0000-4000-8000-000000000002';
  v_fv_logo1   uuid := 'e8000000-0000-4000-8000-000000000001';
  v_fv_home1   uuid := 'e8000000-0000-4000-8000-000000000002';
  v_fv_home2   uuid := 'e8000000-0000-4000-8000-000000000003';

  -- feedback / approvals
  v_feedback1 uuid := 'e9000000-0000-4000-8000-000000000001';
  v_approval1 uuid := 'ea000000-0000-4000-8000-000000000001';

  -- proposal
  v_proposal_id     uuid := 'eb000000-0000-4000-8000-000000000001';
  v_proposal_rev_id uuid := 'eb000000-0000-4000-8000-000000000101';
  v_pitem1 uuid := 'eb000000-0000-4000-8000-000000000201';
  v_pitem2 uuid := 'eb000000-0000-4000-8000-000000000202';
  v_pitem3 uuid := 'eb000000-0000-4000-8000-000000000203';

  -- contract
  v_contract_id     uuid := 'ec000000-0000-4000-8000-000000000001';
  v_contract_rev_id uuid := 'ec000000-0000-4000-8000-000000000101';

  -- invoice / payment
  v_invoice_id uuid := 'ed000000-0000-4000-8000-000000000001';
  v_iitem1 uuid := 'ed000000-0000-4000-8000-000000000201';
  v_iitem2 uuid := 'ed000000-0000-4000-8000-000000000202';
  v_iitem3 uuid := 'ed000000-0000-4000-8000-000000000203';
  v_payment_id uuid := 'ed000000-0000-4000-8000-000000000301';

  -- project staff assignments
  v_psa_designer  uuid := 'ef000000-0000-4000-8000-000000000001';
  v_psa_developer uuid := 'ef000000-0000-4000-8000-000000000002';
  v_psa_writer    uuid := 'ef000000-0000-4000-8000-000000000003';
  v_psa_qa        uuid := 'ef000000-0000-4000-8000-000000000004';

  -- tasks
  v_t1 uuid := 'e6000000-0000-4000-8000-000000000001';
  v_t2 uuid := 'e6000000-0000-4000-8000-000000000002';
  v_t3 uuid := 'e6000000-0000-4000-8000-000000000003';
  v_t4 uuid := 'e6000000-0000-4000-8000-000000000004';
  v_t5 uuid := 'e6000000-0000-4000-8000-000000000005';
  v_t6 uuid := 'e6000000-0000-4000-8000-000000000006';
  v_t7 uuid := 'e6000000-0000-4000-8000-000000000007';
  v_t8 uuid := 'e6000000-0000-4000-8000-000000000008';
  v_t9 uuid := 'e6000000-0000-4000-8000-000000000009';
  v_t10 uuid := 'e6000000-0000-4000-8000-000000000010';
  v_t11 uuid := 'e6000000-0000-4000-8000-000000000011';
  v_t12 uuid := 'e6000000-0000-4000-8000-000000000012';
  v_t13 uuid := 'e6000000-0000-4000-8000-000000000013';
  v_t14 uuid := 'e6000000-0000-4000-8000-000000000014';
  v_t15 uuid := 'e6000000-0000-4000-8000-000000000015';
  v_t16 uuid := 'e6000000-0000-4000-8000-000000000016';
  v_t17 uuid := 'e6000000-0000-4000-8000-000000000017';
  v_t18 uuid := 'e6000000-0000-4000-8000-000000000018';
  v_t19 uuid := 'e6000000-0000-4000-8000-000000000019';
  v_t20 uuid := 'e6000000-0000-4000-8000-000000000020';

  -- misc
  v_proposal_number text;
  v_contract_number text;
  v_invoice_number  text;
  v_contract_tpl jsonb;
  v_contract_snapshot jsonb;
  v_proposal_snapshot jsonb;
  v_invoice_snapshot jsonb;
  v_bill_to jsonb;
  v_template_repo_url text := 'https://github.com/RaffyCadano/landscaping-starter-template';
begin
  -- Everything below (proposal/contract/invoice/invoice_items/payments) is
  -- guarded by triggers that reject direct writes unless this is set, same
  -- as the real create_proposal/send_invoice/record_stripe_payment RPCs do.
  perform set_config('app.document_rpc', '1', true);

  -----------------------------------------------------------------------
  -- 1. Staff: auth.users -> handle_new_user trigger creates a default
  --    'client' profiles row -> we promote it to 'staff' -> staff_profiles.
  -----------------------------------------------------------------------
  insert into auth.users (
    id, instance_id, aud, role, email, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token, email_change, email_change_token_new,
    created_at, updated_at
  ) values
  (v_designer_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'ana.reyes@seed-evergreen.motivescripts.invalid', now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Ana Reyes"}'::jsonb,
   '', '', '', '', timestamptz '2025-02-03 09:00:00-07', timestamptz '2025-02-03 09:00:00-07'),
  (v_developer_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'marcus.chen@seed-evergreen.motivescripts.invalid', now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Marcus Chen"}'::jsonb,
   '', '', '', '', timestamptz '2024-11-11 09:00:00-07', timestamptz '2024-11-11 09:00:00-07'),
  (v_writer_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'priya.nair@seed-evergreen.motivescripts.invalid', now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Priya Nair"}'::jsonb,
   '', '', '', '', timestamptz '2025-05-19 09:00:00-07', timestamptz '2025-05-19 09:00:00-07'),
  (v_qa_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'devon.brooks@seed-evergreen.motivescripts.invalid', now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Devon Brooks"}'::jsonb,
   '', '', '', '', timestamptz '2025-03-24 09:00:00-07', timestamptz '2025-03-24 09:00:00-07')
  on conflict (id) do nothing;

  -- handle_new_user only ever assigns 'admin' or 'client'. Promote these four
  -- to 'staff' (narrowly scoped to exactly these fixed ids).
  update public.profiles
    set role = 'staff',
        full_name = case id
          when v_designer_id then 'Ana Reyes'
          when v_developer_id then 'Marcus Chen'
          when v_writer_id then 'Priya Nair'
          when v_qa_id then 'Devon Brooks'
          else full_name
        end,
        client_id = null
    where id in (v_designer_id, v_developer_id, v_writer_id, v_qa_id)
      and role is distinct from 'staff';

  insert into public.staff_profiles (user_id, job_title, template_key, is_active, created_at, updated_at)
  values
    (v_designer_id, 'Web Designer', 'designer', true, timestamptz '2025-02-03 09:05:00-07', timestamptz '2025-02-03 09:05:00-07'),
    (v_developer_id, 'Full-Stack Developer', 'developer', true, timestamptz '2024-11-11 09:05:00-07', timestamptz '2024-11-11 09:05:00-07'),
    (v_writer_id, 'Content Writer', 'content_writer', true, timestamptz '2025-05-19 09:05:00-07', timestamptz '2025-05-19 09:05:00-07'),
    (v_qa_id, 'QA Engineer', 'team_member', true, timestamptz '2025-03-24 09:05:00-07', timestamptz '2025-03-24 09:05:00-07')
  on conflict (user_id) do nothing;

  -- A real staff invite acceptance copies public.staff_template_permissions
  -- for the chosen template_key into public.staff_grants (see
  -- accept_staff_invitation in 20260829200000_team_management.sql). Without
  -- this, has_grant()/staff_may_project() return false for every permission
  -- for these users no matter what they're assigned to, and RLS hides all
  -- tasks/projects/milestones from them even though the raw rows exist.
  insert into public.staff_grants (user_id, permission_code)
  select sp.user_id, tp.permission_code
  from public.staff_profiles sp
  join public.staff_template_permissions tp on tp.template_key = sp.template_key
  where sp.user_id in (v_designer_id, v_developer_id, v_writer_id, v_qa_id)
  on conflict do nothing;

  -----------------------------------------------------------------------
  -- 2. Lead (as the public "Start a Project" form would have created it)
  -----------------------------------------------------------------------
  insert into public.leads (
    id, name, business_name, email, phone, industry, request, project_details,
    status, source, notes, activity, client_id, converted_at, created_at
  ) values (
    v_lead_id, 'Maria Delgado', 'Evergreen Grounds Landscaping',
    'hello@evergreengrounds.example', '(555) 555-0123', 'Landscaping',
    'Website Redesign',
    'We are a residential and commercial landscaping crew serving the greater Portland, OR area. Our current site is a single outdated page with no way to show our work or get quote requests. We want a modern site with a services list, a project gallery, and an easy way for people to request a quote.',
    'Won', 'Start a Project',
    '[{"id":"eg-note-001","body":"Great fit -- clear scope, responsive contact, ready to move fast.","author":"Raffy","createdAt":"2026-07-11T16:00:00-07:00"}]'::jsonb,
    '[{"id":"eg-act-001","description":"Lead submitted project inquiry","createdAt":"2026-07-10T09:14:00-07:00"},{"id":"eg-act-002","description":"Lead contacted by phone","createdAt":"2026-07-11T15:30:00-07:00"},{"id":"eg-act-003","description":"Lead qualified","createdAt":"2026-07-13T10:00:00-07:00"},{"id":"eg-act-004","description":"Proposal sent","createdAt":"2026-07-17T10:05:00-07:00"},{"id":"eg-act-005","description":"Lead converted to client","createdAt":"2026-07-16T14:00:00-07:00"}]'::jsonb,
    null, timestamptz '2026-07-16 14:00:00-07', timestamptz '2026-07-10 09:14:00-07'
  )
  on conflict (id) do nothing;

  -----------------------------------------------------------------------
  -- 3. Client, converted from that lead
  -----------------------------------------------------------------------
  insert into public.clients (
    id, contact_name, business_name, email, phone, industry, website, location,
    status, source, source_lead_id, last_activity_at, created_at
  ) values (
    v_client_id, 'Maria Delgado', 'Evergreen Grounds Landscaping',
    'hello@evergreengrounds.example', '(555) 555-0123', 'Landscaping',
    'https://evergreengrounds.example', 'Portland, OR',
    'Active', 'Start a Project', v_lead_id,
    timestamptz '2026-09-05 17:00:00-07', timestamptz '2026-07-16 14:00:00-07'
  )
  on conflict (id) do nothing;

  update public.leads
    set client_id = v_client_id, converted_at = timestamptz '2026-07-16 14:00:00-07'
    where id = v_lead_id and client_id is null;

  -----------------------------------------------------------------------
  -- 4. Project + project_development (starter-template link)
  -----------------------------------------------------------------------
  insert into public.projects (
    id, client_id, name, description, type, status, start_date, due_date,
    archived, approval_status, last_activity_at, created_at,
    production_plan_generated_at, staging_url, production_url, billing_mode
  ) values (
    v_project_id, v_client_id, 'Website Redesign',
    'Full redesign of the Evergreen Grounds Landscaping site: homepage, About, Services, Gallery, and Contact, built on the landscaping starter template, plus hosting and business email setup.',
    'Website Redesign', 'In Development',
    date '2026-07-21', date '2026-09-19', false, 'Approved',
    timestamptz '2026-09-05 12:00:00-07', timestamptz '2026-07-16 15:00:00-07',
    timestamptz '2026-07-24 10:05:00-07',
    'https://evergreen-grounds-staging.vercel.app',
    -- production_url stays null: the Launch milestone is still "Not Started"
    -- and "Deploy to production hosting" (v_t19) is still Todo in this story,
    -- so the site has not actually gone live yet -- only staging exists.
    null,
    'fixed'
  )
  on conflict (id) do nothing;

  insert into public.project_development (
    project_id, repository_url, repository_branch, hosting_provider,
    deployment_status, last_deployed_at, template_repository_url, updated_at
  ) values (
    v_project_id,
    'https://github.com/motivescripts-agency/evergreen-grounds-website',
    'main', 'Vercel', 'Staging', timestamptz '2026-08-20 16:00:00-07',
    v_template_repo_url, timestamptz '2026-08-20 16:00:00-07'
  )
  on conflict (project_id) do nothing;

  -----------------------------------------------------------------------
  -- 5. Milestones (standard 5-stage pattern)
  -----------------------------------------------------------------------
  insert into public.milestones (id, project_id, name, description, status, position, start_date, due_date)
  values
    (v_ms_discovery, v_project_id, 'Discovery', 'Kickoff, confirm requirements, sitemap, content, and assets.', 'Completed', 1, date '2026-07-24', date '2026-07-31'),
    (v_ms_design, v_project_id, 'Design', 'Create and approve the visual direction and page designs.', 'Completed', 2, date '2026-07-31', date '2026-08-11'),
    (v_ms_dev, v_project_id, 'Development', 'Build the website, integrate approved design and content, and deploy to staging.', 'In Progress', 3, date '2026-08-11', date '2026-09-10'),
    (v_ms_qa, v_project_id, 'QA & Client Review', 'Test the staging website, resolve issues, collect client feedback, and obtain approval.', 'Not Started', 4, null, date '2026-09-19'),
    (v_ms_launch, v_project_id, 'Launch', 'Move the approved website into production and complete handoff.', 'Not Started', 5, null, date '2026-09-26')
  on conflict (id) do nothing;

  -----------------------------------------------------------------------
  -- 6. Deliverables + file_versions (before tasks, so tasks can link to them)
  -----------------------------------------------------------------------
  insert into public.deliverables (id, project_id, name, description, category, status, created_at, updated_at)
  values
    (v_deliv_logo, v_project_id, 'Logo', 'Primary Evergreen Grounds logo lockup, in the EG brand green (#2f5d3a).', 'Branding', 'Approved', timestamptz '2026-07-26 11:00:00-07', timestamptz '2026-07-29 14:00:00-07'),
    (v_deliv_home, v_project_id, 'Homepage Design', 'Homepage layout: hero, services overview, project gallery teaser, and contact CTA.', 'Website Page', 'In Review', timestamptz '2026-08-06 10:00:00-07', timestamptz '2026-08-28 15:30:00-07')
  on conflict (id) do nothing;

  insert into public.file_versions (
    id, deliverable_id, version_number, label, description, is_current,
    file_name, file_type, file_size, uploaded_by, created_at
  ) values
    (v_fv_logo1, v_deliv_logo, 1, 'v1', 'Approved logo lockup.', true, 'evergreen-grounds-logo.svg', 'SVG', 42000, 'Ana Reyes', timestamptz '2026-07-26 11:00:00-07'),
    (v_fv_home1, v_deliv_home, 1, 'v1', 'First homepage concept.', false, 'homepage-v1.png', 'PNG', 1180000, 'Ana Reyes', timestamptz '2026-08-06 10:00:00-07'),
    (v_fv_home2, v_deliv_home, 2, 'v2', 'Updated with real gallery photos and final copy.', true, 'homepage-v2.png', 'PNG', 1420000, 'Marcus Chen', timestamptz '2026-08-28 15:30:00-07')
  on conflict (id) do nothing;

  insert into public.feedback (id, project_id, deliverable_id, version_id, client_id, message, status, created_by_name, created_at)
  values (
    v_feedback1, v_project_id, v_deliv_home, v_fv_home2, v_client_id,
    'This looks great! Can we make the phone number in the header a bit larger so it stands out on mobile?',
    'Open', 'Maria Delgado', timestamptz '2026-08-29 09:20:00-07'
  )
  on conflict (id) do nothing;

  insert into public.approvals (id, project_id, deliverable_id, version_id, client_id, status, approved_by_name, approved_at, created_at)
  values (
    v_approval1, v_project_id, v_deliv_logo, v_fv_logo1, v_client_id,
    'Approved', 'Maria Delgado', timestamptz '2026-07-29 14:00:00-07', timestamptz '2026-07-29 14:00:00-07'
  )
  on conflict (id) do nothing;

  -----------------------------------------------------------------------
  -- 7. Tasks (mixed Completed/In Progress/Todo, assigned across all 4 staff)
  -----------------------------------------------------------------------
  insert into public.tasks (
    id, project_id, milestone_id, title, description, status, priority,
    assignee, assigned_to, position, due_date, completed_at, created_at,
    task_type, estimated_hours, reference_url, deliverable_id
  ) values
    (v_t1, v_project_id, v_ms_discovery, 'Kickoff call with Evergreen Grounds', 'Confirm goals, timeline, and points of contact.', 'Completed', 'High', 'Marcus Chen', v_developer_id, 0, date '2026-07-24', timestamptz '2026-07-24 11:00:00-07', timestamptz '2026-07-21 09:00:00-07', 'discovery', 1, null, null),
    (v_t2, v_project_id, v_ms_discovery, 'Confirm sitemap and page list', 'Homepage, About, Services, Gallery, Contact.', 'Completed', 'Medium', 'Marcus Chen', v_developer_id, 1, date '2026-07-25', timestamptz '2026-07-25 16:00:00-07', timestamptz '2026-07-21 09:00:00-07', 'discovery', 2, null, null),
    (v_t3, v_project_id, v_ms_discovery, 'Collect logo, photos, and business info from client', 'Service area, crew photos, before/after project shots, hours.', 'Completed', 'Medium', 'Priya Nair', v_writer_id, 2, date '2026-07-28', timestamptz '2026-07-28 13:00:00-07', timestamptz '2026-07-21 09:00:00-07', 'content_collection', 3, null, null),
    (v_t4, v_project_id, v_ms_discovery, 'Write homepage and About page copy', 'Draft copy for client review.', 'Completed', 'Medium', 'Priya Nair', v_writer_id, 3, date '2026-07-30', timestamptz '2026-07-30 17:00:00-07', timestamptz '2026-07-21 09:00:00-07', 'content_collection', 4, null, null),

    (v_t5, v_project_id, v_ms_design, 'Establish design direction', 'Moodboard and style tile using the EG brand green (#2f5d3a), Poppins/Inter.', 'Completed', 'High', 'Ana Reyes', v_designer_id, 4, date '2026-08-02', timestamptz '2026-08-02 12:00:00-07', timestamptz '2026-07-31 09:00:00-07', 'design', 3, null, null),
    (v_t6, v_project_id, v_ms_design, 'Design logo concepts', 'Two directions for client review.', 'Completed', 'High', 'Ana Reyes', v_designer_id, 5, date '2026-08-04', timestamptz '2026-08-03 15:00:00-07', timestamptz '2026-07-31 09:00:00-07', 'design', 4, null, v_deliv_logo),
    (v_t7, v_project_id, v_ms_design, 'Design homepage layout', 'Hero, services overview, gallery teaser, contact CTA.', 'Completed', 'High', 'Ana Reyes', v_designer_id, 6, date '2026-08-08', timestamptz '2026-08-06 16:00:00-07', timestamptz '2026-07-31 09:00:00-07', 'design', 6, null, v_deliv_home),
    (v_t8, v_project_id, v_ms_design, 'Design About & Services page layouts', 'Match homepage visual system.', 'Completed', 'Medium', 'Ana Reyes', v_designer_id, 7, date '2026-08-10', timestamptz '2026-08-09 14:00:00-07', timestamptz '2026-07-31 09:00:00-07', 'design', 5, null, null),
    (v_t9, v_project_id, v_ms_design, 'Design responsive/mobile layouts', 'Phone and tablet breakpoints for all approved pages.', 'Completed', 'Medium', 'Ana Reyes', v_designer_id, 8, date '2026-08-11', timestamptz '2026-08-11 17:00:00-07', timestamptz '2026-07-31 09:00:00-07', 'design', 4, null, null),

    (v_t10, v_project_id, v_ms_dev, 'Set up project repository from starter template', 'Scaffold from the landscaping starter template and configure branding tokens.', 'Completed', 'Medium', 'Marcus Chen', v_developer_id, 9, date '2026-08-13', timestamptz '2026-08-13 10:00:00-07', timestamptz '2026-08-11 09:00:00-07', 'production', 2, v_template_repo_url, null),
    (v_t11, v_project_id, v_ms_dev, 'Build homepage', 'Implement the approved homepage design and copy.', 'Completed', 'High', 'Marcus Chen', v_developer_id, 10, date '2026-08-20', timestamptz '2026-08-20 16:00:00-07', timestamptz '2026-08-11 09:00:00-07', 'production', 8, null, v_deliv_home),
    (v_t12, v_project_id, v_ms_dev, 'Build About & Services pages', 'Implement from approved design and copy.', 'In Review', 'Medium', 'Marcus Chen', v_developer_id, 11, date '2026-09-08', null, timestamptz '2026-08-11 09:00:00-07', 'production', 6, null, null),
    (v_t13, v_project_id, v_ms_dev, 'Build Gallery / Portfolio page', 'Implement gallery grid with lightbox for before/after shots.', 'In Progress', 'Low', 'Marcus Chen', v_developer_id, 12, date '2026-09-10', null, timestamptz '2026-08-11 09:00:00-07', 'production', 5, null, null),
    (v_t14, v_project_id, v_ms_dev, 'Build Contact page with quote-request form', 'Waiting on the client to provide the quote-request notification email address before this can be finished.', 'Blocked', 'Medium', 'Marcus Chen', v_developer_id, 13, date '2026-09-12', null, timestamptz '2026-08-11 09:00:00-07', 'production', 4, null, null),
    (v_t15, v_project_id, v_ms_dev, 'Integrate approved photography and copy', 'Place final crew/project photos and approved copy across pages.', 'In Progress', 'Medium', 'Priya Nair', v_writer_id, 14, date '2026-09-09', null, timestamptz '2026-08-11 09:00:00-07', 'content_collection', 3, null, null),
    (v_t16, v_project_id, v_ms_dev, 'Mobile responsiveness pass', 'Verify phone/tablet layouts match approved design.', 'Todo', 'Medium', 'Marcus Chen', v_developer_id, 15, date '2026-09-13', null, timestamptz '2026-08-11 09:00:00-07', 'production', 4, null, null),

    (v_t17, v_project_id, v_ms_qa, 'Test staging site across devices and browsers', 'Cross-browser and cross-device QA pass on staging.', 'Todo', 'High', 'Devon Brooks', v_qa_id, 16, date '2026-09-17', null, timestamptz '2026-08-11 09:00:00-07', 'qa', 4, null, null),
    (v_t18, v_project_id, v_ms_qa, 'Client walkthrough and feedback session', 'Walk Maria through staging and log any revision requests.', 'Todo', 'High', 'Marcus Chen', v_developer_id, 17, date '2026-09-18', null, timestamptz '2026-08-11 09:00:00-07', 'client_review', 2, null, null),

    (v_t19, v_project_id, v_ms_launch, 'Deploy to production hosting', 'Point the domain at production and verify DNS/SSL.', 'Todo', 'High', 'Marcus Chen', v_developer_id, 18, date '2026-09-25', null, timestamptz '2026-08-11 09:00:00-07', 'production', 3, null, null),
    (v_t20, v_project_id, v_ms_launch, 'Final QA on live production site', 'Confirm production matches approved staging exactly.', 'Todo', 'High', 'Devon Brooks', v_qa_id, 19, date '2026-09-26', null, timestamptz '2026-08-11 09:00:00-07', 'qa', 2, null, null)
  on conflict (id) do nothing;

  -- Assigning tasks to these users above (assigned_to) already triggers an
  -- auto-insert into this table keyed on (project_id, user_id) -- not on id --
  -- so the conflict target here must match that real unique constraint, not
  -- the primary key, or this insert fails instead of no-oping.
  insert into public.project_staff_assignments (id, project_id, user_id, label, created_at)
  values
    (v_psa_designer, v_project_id, v_designer_id, 'Designer', timestamptz '2026-07-21 09:00:00-07'),
    (v_psa_developer, v_project_id, v_developer_id, 'Developer', timestamptz '2026-07-21 09:00:00-07'),
    (v_psa_writer, v_project_id, v_writer_id, 'Content Writer', timestamptz '2026-07-21 09:00:00-07'),
    (v_psa_qa, v_project_id, v_qa_id, 'QA', timestamptz '2026-07-21 09:00:00-07')
  on conflict (project_id, user_id) do nothing;

  -----------------------------------------------------------------------
  -- 8. Proposal (Accepted) with line items
  -----------------------------------------------------------------------
  if not exists (select 1 from public.proposals where id = v_proposal_id) then
    select public.next_document_number('proposal') into v_proposal_number;

    v_proposal_snapshot := jsonb_build_array(
      jsonb_build_object('id', v_pitem1, 'name', 'Website Design & Development', 'description', 'Homepage, About, Services, Gallery / Portfolio, and Contact pages. Responsive, mobile-optimized design built on the landscaping starter template.', 'quantity', 1, 'unit_price_cents', 280000, 'total_cents', 280000, 'sort_order', 0),
      jsonb_build_object('id', v_pitem2, 'name', 'Hosting Setup', 'description', 'One-time setup and configuration of managed hosting on Vercel.', 'quantity', 1, 'unit_price_cents', 20000, 'total_cents', 20000, 'sort_order', 1),
      jsonb_build_object('id', v_pitem3, 'name', 'Business Email', 'description', 'Professional email setup on the evergreengrounds.example domain.', 'quantity', 1, 'unit_price_cents', 10000, 'total_cents', 10000, 'sort_order', 2)
    );

    insert into public.proposals (id, client_id, project_id, proposal_number, created_by, created_at)
    values (v_proposal_id, v_client_id, v_project_id, v_proposal_number, null, timestamptz '2026-07-17 10:00:00-07');

    insert into public.proposal_revisions (
      id, proposal_id, revision_number, status, title, introduction, overview,
      scope, deliverables_text, timeline, payment_terms, terms, notes,
      investment_cents, valid_until, snapshot_items,
      sent_at, viewed_at, accepted_at, accepted_email, created_by, created_at
    ) values (
      v_proposal_rev_id, v_proposal_id, 1, 'accepted',
      'Evergreen Grounds Landscaping -- Website Redesign',
      'Thank you for the opportunity to redesign the Evergreen Grounds Landscaping website. This proposal covers a full redesign built to showcase your services and make it easy for homeowners and property managers to request a quote.',
      'A modern, mobile-friendly website replacing the current single-page site, with a clear services list, a project gallery, and a quote-request contact form.',
      E'Homepage\nResponsive Website Design\nMobile Optimization\nAbout\nServices\nGallery / Portfolio\nContact',
      'Homepage, About page, Services page, Gallery / Portfolio page, Contact page with quote-request form. Built on our landscaping starter template and customized with Evergreen Grounds branding (EG green #2f5d3a, Poppins/Inter).',
      'Discovery and content collection: 1 week. Design: 2 weeks. Development: 4-5 weeks. QA and client review: 1-2 weeks. Launch: within 1 week of final approval.',
      'Payment in full is due before development begins. Invoices are issued from MotiveScripts and can be paid securely through the client portal.',
      'This proposal is valid for 30 days from the date sent. Work outside this scope may require an updated proposal.',
      '',
      310000, date '2026-08-16', v_proposal_snapshot,
      timestamptz '2026-07-17 10:05:00-07', timestamptz '2026-07-18 08:30:00-07',
      timestamptz '2026-07-19 16:45:00-07', 'hello@evergreengrounds.example',
      null, timestamptz '2026-07-17 10:00:00-07'
    );

    insert into public.proposal_items (id, revision_id, name, description, quantity, unit_price_cents, sort_order)
    values
      (v_pitem1, v_proposal_rev_id, 'Website Design & Development', 'Homepage, About, Services, Gallery / Portfolio, and Contact pages. Responsive, mobile-optimized design built on the landscaping starter template.', 1, 280000, 0),
      (v_pitem2, v_proposal_rev_id, 'Hosting Setup', 'One-time setup and configuration of managed hosting on Vercel.', 1, 20000, 1),
      (v_pitem3, v_proposal_rev_id, 'Business Email', 'Professional email setup on the evergreengrounds.example domain.', 1, 10000, 2);

    update public.proposals
      set working_revision_id = v_proposal_rev_id, published_revision_id = v_proposal_rev_id
      where id = v_proposal_id;
  else
    -- Re-run: row already exists. Fetch its number so later steps (the
    -- contract text and the activity messages below) still have it.
    select proposal_number into v_proposal_number from public.proposals where id = v_proposal_id;
  end if;

  -----------------------------------------------------------------------
  -- 9. Contract (Signed/Accepted), generated from the accepted proposal
  -----------------------------------------------------------------------
  if not exists (select 1 from public.contracts where id = v_contract_id) then
    select public.next_document_number('contract') into v_contract_number;
    select public.website_contract_template('Evergreen Grounds Landscaping') into v_contract_tpl;

    v_contract_snapshot := jsonb_build_object(
      'title', v_contract_tpl->>'title',
      'parties', v_contract_tpl->>'parties',
      'scope', v_contract_tpl->>'scope',
      'responsibilities', v_contract_tpl->>'responsibilities',
      'timeline', v_contract_tpl->>'timeline',
      'compensation', v_contract_tpl->>'compensation',
      'payment_terms', v_contract_tpl->>'payment_terms',
      'confidentiality', v_contract_tpl->>'confidentiality',
      'intellectual_property', v_contract_tpl->>'intellectual_property',
      'revisions_policy', v_contract_tpl->>'revisions_policy',
      'termination', v_contract_tpl->>'termination',
      'general_terms', v_contract_tpl->>'general_terms',
      'effective_date', '2026-07-21',
      'expires_at', '2027-07-21',
      'agency_signed_at', '2026-07-19T17:05:00-07:00',
      'agency_signed_by', null,
      'agency_signed_name', 'MotiveScripts',
      'agency_signed_email', 'hello@motivescripts.example'
    );

    insert into public.contracts (id, client_id, project_id, proposal_id, contract_number, created_by, created_at)
    values (v_contract_id, v_client_id, v_project_id, v_proposal_id, v_contract_number, null, timestamptz '2026-07-19 17:00:00-07');

    insert into public.contract_revisions (
      id, contract_id, revision_number, status, title, parties, scope,
      responsibilities, timeline, compensation, payment_terms, confidentiality,
      intellectual_property, revisions_policy, termination, general_terms,
      effective_date, expires_at, snapshot,
      sent_at, viewed_at, accepted_at, accepted_email,
      agency_signed_at, agency_signed_name, agency_signed_email,
      created_by, created_at
    ) values (
      v_contract_rev_id, v_contract_id, 1, 'accepted',
      v_contract_tpl->>'title', v_contract_tpl->>'parties', v_contract_tpl->>'scope',
      v_contract_tpl->>'responsibilities', v_contract_tpl->>'timeline', v_contract_tpl->>'compensation',
      v_contract_tpl->>'payment_terms', v_contract_tpl->>'confidentiality',
      v_contract_tpl->>'intellectual_property', v_contract_tpl->>'revisions_policy',
      v_contract_tpl->>'termination', v_contract_tpl->>'general_terms',
      date '2026-07-21', date '2027-07-21', v_contract_snapshot,
      timestamptz '2026-07-19 17:10:00-07', timestamptz '2026-07-20 09:00:00-07',
      timestamptz '2026-07-21 11:20:00-07', 'hello@evergreengrounds.example',
      timestamptz '2026-07-19 17:05:00-07', 'MotiveScripts', 'hello@motivescripts.example',
      null, timestamptz '2026-07-19 17:00:00-07'
    );

    update public.contracts
      set working_revision_id = v_contract_rev_id, published_revision_id = v_contract_rev_id
      where id = v_contract_id;
  else
    -- Re-run: row already exists. Fetch its number for the activity messages below.
    select contract_number into v_contract_number from public.contracts where id = v_contract_id;
  end if;

  -----------------------------------------------------------------------
  -- 10. Invoice (Paid), generated from the contract, with a matching payment
  -----------------------------------------------------------------------
  if not exists (select 1 from public.invoices where id = v_invoice_id) then
    select public.next_document_number('invoice') into v_invoice_number;

    v_invoice_snapshot := jsonb_build_array(
      jsonb_build_object('id', v_iitem1, 'description', 'Website Design & Development', 'quantity', 1, 'unit_price_cents', 280000, 'total_cents', 280000, 'sort_order', 0),
      jsonb_build_object('id', v_iitem2, 'description', 'Hosting Setup', 'quantity', 1, 'unit_price_cents', 20000, 'total_cents', 20000, 'sort_order', 1),
      jsonb_build_object('id', v_iitem3, 'description', 'Business Email', 'quantity', 1, 'unit_price_cents', 10000, 'total_cents', 10000, 'sort_order', 2)
    );
    v_bill_to := jsonb_build_object(
      'business_name', 'Evergreen Grounds Landscaping',
      'contact_name', 'Maria Delgado',
      'email', 'hello@evergreengrounds.example'
    );

    insert into public.invoices (
      id, invoice_number, client_id, project_id, contract_id, proposal_id,
      status, issue_date, due_date, currency, notes, snapshot_items, bill_to,
      sent_at, viewed_at, created_by, created_at
    ) values (
      v_invoice_id, v_invoice_number, v_client_id, v_project_id, v_contract_id, v_proposal_id,
      'sent', date '2026-07-21', date '2026-08-04', 'USD',
      'Net 14. Payment due before development begins per the signed contract.',
      v_invoice_snapshot, v_bill_to,
      timestamptz '2026-07-21 11:35:00-07', timestamptz '2026-07-21 15:00:00-07',
      null, timestamptz '2026-07-21 11:30:00-07'
    );

    insert into public.invoice_items (id, invoice_id, description, quantity, unit_price_cents, sort_order)
    values
      (v_iitem1, v_invoice_id, 'Website Design & Development', 1, 280000, 0),
      (v_iitem2, v_invoice_id, 'Hosting Setup', 1, 20000, 1),
      (v_iitem3, v_invoice_id, 'Business Email', 1, 10000, 2);

    insert into public.payments (
      id, invoice_id, amount_cents, currency, payment_date, payment_method,
      provider, reference, notes, recorded_by, recorded_by_label,
      stripe_checkout_session_id, stripe_payment_intent_id, stripe_event_id,
      created_at
    ) values (
      v_payment_id, v_invoice_id, 310000, 'USD', date '2026-07-24', 'stripe',
      'stripe', 'cs_mock_evergreen_0001', 'Paid online via Stripe Checkout (mock/demo payment -- not a real charge).',
      null, 'Stripe',
      'cs_mock_evergreen_0001', 'pi_mock_evergreen_0001', 'evt_mock_evergreen_0001',
      timestamptz '2026-07-24 10:00:00-07'
    );

    -- Recomputes subtotal/total/paid/due and flips status to 'paid', exactly
    -- like the real record_invoice_payment/record_stripe_payment RPCs do
    -- after inserting a payment row.
    perform public.recalc_invoice_totals(v_invoice_id);

    -- recalc_invoice_totals stamps paid_at with now() (script run time).
    -- Backdate it to match the narrative payment date. Not one of the
    -- guard_invoice-restricted columns, so this is allowed unconditionally.
    update public.invoices set paid_at = timestamptz '2026-07-24 10:00:00-07' where id = v_invoice_id;
  else
    -- Re-run: row already exists. Fetch its number for the activity messages below.
    select invoice_number into v_invoice_number from public.invoices where id = v_invoice_id;
  end if;

  -----------------------------------------------------------------------
  -- 11. Activity timeline (project-scoped; icons match the 7-icon vocabulary
  --     used by src/data/agencyMappers.ts mapActivity: created, status, task,
  --     milestone, file, progress, review). Lead submission/conversion live
  --     on leads.activity/notes above since public.activity.project_id is
  --     NOT NULL and no project exists yet at that point.
  --
  --     Note: inserting/updating the tasks and milestones above already
  --     triggers real activity rows (tasks_notify_assignment/_status,
  --     milestones_notify_update) automatically -- those are timestamped at
  --     the moment this script runs (not backdated), so the feed will show a
  --     cluster of "task"/"milestone" entries dated today alongside the
  --     backdated document-lifecycle entries below.
  -----------------------------------------------------------------------
  insert into public.activity (id, project_id, actor_id, activity_type, message, metadata, created_at)
  values
    ('ee000000-0000-4000-8000-000000000001', v_project_id, null, 'project_created', 'Project created', '{"icon":"created"}'::jsonb, timestamptz '2026-07-16 15:00:00-07'),
    ('ee000000-0000-4000-8000-000000000002', v_project_id, null, 'proposal_sent', 'Proposal ' || v_proposal_number || ' sent', '{"icon":"status"}'::jsonb, timestamptz '2026-07-17 10:05:00-07'),
    ('ee000000-0000-4000-8000-000000000003', v_project_id, null, 'proposal_accepted', 'Proposal ' || v_proposal_number || ' accepted', '{"icon":"status"}'::jsonb, timestamptz '2026-07-19 16:45:00-07'),
    ('ee000000-0000-4000-8000-000000000004', v_project_id, null, 'contract_agency_signed', 'Contract ' || v_contract_number || ' signed by MotiveScripts', '{"icon":"status"}'::jsonb, timestamptz '2026-07-19 17:05:00-07'),
    ('ee000000-0000-4000-8000-000000000005', v_project_id, null, 'contract_sent', 'Contract ' || v_contract_number || ' sent', '{"icon":"status"}'::jsonb, timestamptz '2026-07-19 17:10:00-07'),
    ('ee000000-0000-4000-8000-000000000006', v_project_id, null, 'contract_accepted', 'Contract ' || v_contract_number || ' accepted', '{"icon":"status"}'::jsonb, timestamptz '2026-07-21 11:20:00-07'),
    ('ee000000-0000-4000-8000-000000000007', v_project_id, null, 'invoice_sent', 'Invoice ' || v_invoice_number || ' sent', '{"icon":"status"}'::jsonb, timestamptz '2026-07-21 11:35:00-07'),
    ('ee000000-0000-4000-8000-000000000008', v_project_id, null, 'payment_recorded', 'Online payment received on ' || v_invoice_number, '{"icon":"status"}'::jsonb, timestamptz '2026-07-24 10:00:00-07'),
    ('ee000000-0000-4000-8000-000000000009', v_project_id, null, 'invoice_paid', 'Invoice ' || v_invoice_number || ' paid', '{"icon":"status"}'::jsonb, timestamptz '2026-07-24 10:00:01-07'),
    ('ee000000-0000-4000-8000-000000000010', v_project_id, null, 'production_plan_generated', 'Production plan generated -- 20 tasks across 5 milestones', '{"icon":"created"}'::jsonb, timestamptz '2026-07-24 10:05:00-07'),
    ('ee000000-0000-4000-8000-000000000011', v_project_id, v_designer_id, 'version_created', 'Logo v1 uploaded', jsonb_build_object('icon', 'file', 'deliverable_id', v_deliv_logo, 'version_id', v_fv_logo1), timestamptz '2026-07-26 11:00:00-07'),
    ('ee000000-0000-4000-8000-000000000012', v_project_id, null, 'version_approved', 'Logo v1 approved', jsonb_build_object('icon', 'review', 'deliverable_id', v_deliv_logo, 'version_id', v_fv_logo1), timestamptz '2026-07-29 14:00:00-07'),
    ('ee000000-0000-4000-8000-000000000013', v_project_id, v_designer_id, 'version_created', 'Homepage Design v1 uploaded', jsonb_build_object('icon', 'file', 'deliverable_id', v_deliv_home, 'version_id', v_fv_home1), timestamptz '2026-08-06 10:00:00-07'),
    ('ee000000-0000-4000-8000-000000000014', v_project_id, null, 'milestone_progress', 'Development milestone is about 60% complete', '{"icon":"progress"}'::jsonb, timestamptz '2026-08-25 09:00:00-07'),
    ('ee000000-0000-4000-8000-000000000015', v_project_id, v_developer_id, 'version_created', 'Homepage Design v2 uploaded for review', jsonb_build_object('icon', 'file', 'deliverable_id', v_deliv_home, 'version_id', v_fv_home2), timestamptz '2026-08-28 15:30:00-07'),
    ('ee000000-0000-4000-8000-000000000016', v_project_id, null, 'changes_requested', 'Client requested a change on Homepage Design v2', jsonb_build_object('icon', 'review', 'deliverable_id', v_deliv_home, 'version_id', v_fv_home2), timestamptz '2026-08-29 09:20:00-07')
  on conflict (id) do nothing;

  -----------------------------------------------------------------------
  -- 12. Payroll: pay rate + payout contact per staff member (feeds the
  --     read-only "Pay & payout info" section on the Team Profile page),
  --     plus one already-paid cycle for the developer so the payment
  --     history list isn't always empty. staff_pay_rates has no separate
  --     id (PK is user_id); the one payroll_payments row below sits under
  --     the "ec" (contract) id block as a documented exception, since every
  --     other e1-ef prefix was already claimed by the time this section
  --     was added.
  -----------------------------------------------------------------------
  insert into public.staff_pay_rates (user_id, pay_rate_cents, zelle_contact, paypal_email, updated_at)
  values
    (v_designer_id, 4500, 'raffyespiritu.cadano+designer@gmail.com', null, timestamptz '2026-07-01 09:00:00-07'),
    (v_developer_id, 5500, null, 'raffyespiritu.cadano+developer@gmail.com', timestamptz '2026-07-01 09:00:00-07'),
    (v_writer_id, 3500, 'raffyespiritu.cadano+writer@gmail.com', null, timestamptz '2026-07-01 09:00:00-07'),
    (v_qa_id, 4000, null, null, timestamptz '2026-07-01 09:00:00-07')
  on conflict (user_id) do update
    set pay_rate_cents = excluded.pay_rate_cents,
        zelle_contact = excluded.zelle_contact,
        paypal_email = excluded.paypal_email,
        updated_at = excluded.updated_at;

  insert into public.payroll_payments (
    id, staff_id, amount_cents, hours, pay_rate_cents, through_date, payment_date,
    method, reference, notes, recorded_by, recorded_by_label, created_at
  ) values (
    'ec000000-0000-4000-8000-000000000201', v_developer_id, 22000, 40, 5500,
    date '2026-08-11', date '2026-08-12', 'paypal', 'mock-payout-0001',
    'First two-week cycle -- Discovery + Development setup.', null, 'Admin',
    timestamptz '2026-08-12 10:00:00-07'
  )
  on conflict (id) do nothing;

  -- Backs the payment above with real time_entries (40h total, matching the
  -- payment's hours exactly) -- without these, the Time page correctly shows
  -- "No time logged yet" right next to a $220 payment, which reads as a bug.
  -- Mirrors exactly what mark_time_entries_paid() itself writes on a real
  -- payroll run: payroll_paid_at + payroll_payment_id set together.
  insert into public.time_entries (
    id, project_id, task_id, staff_id, entry_date, hours, note,
    payroll_paid_at, payroll_payment_id, created_by, created_at
  ) values
    ('e6000000-0000-4000-8000-100000000001', v_project_id, v_t10, v_developer_id, date '2026-08-01', 8, 'Repo setup + branding tokens', timestamptz '2026-08-12 10:00:00-07', 'ec000000-0000-4000-8000-000000000201', v_developer_id, timestamptz '2026-08-01 17:00:00-07'),
    ('e6000000-0000-4000-8000-100000000002', v_project_id, v_t11, v_developer_id, date '2026-08-04', 8, 'Homepage build', timestamptz '2026-08-12 10:00:00-07', 'ec000000-0000-4000-8000-000000000201', v_developer_id, timestamptz '2026-08-04 17:00:00-07'),
    ('e6000000-0000-4000-8000-100000000003', v_project_id, v_t11, v_developer_id, date '2026-08-06', 8, 'Homepage build continued', timestamptz '2026-08-12 10:00:00-07', 'ec000000-0000-4000-8000-000000000201', v_developer_id, timestamptz '2026-08-06 17:00:00-07'),
    ('e6000000-0000-4000-8000-100000000004', v_project_id, v_t11, v_developer_id, date '2026-08-08', 8, 'Nav + footer implementation', timestamptz '2026-08-12 10:00:00-07', 'ec000000-0000-4000-8000-000000000201', v_developer_id, timestamptz '2026-08-08 17:00:00-07'),
    ('e6000000-0000-4000-8000-100000000005', v_project_id, v_t11, v_developer_id, date '2026-08-11', 8, 'Staging deploy', timestamptz '2026-08-12 10:00:00-07', 'ec000000-0000-4000-8000-000000000201', v_developer_id, timestamptz '2026-08-11 17:00:00-07')
  on conflict (id) do nothing;

end $$;
