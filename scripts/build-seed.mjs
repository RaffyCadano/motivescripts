/**
 * DEVELOPMENT ONLY.
 * Writes supabase/dev-seed/seed_demo_data.sql
 * Do not point this script at supabase/migrations — production must not auto-apply demo rows.
 * Deterministic UUIDs are defined in this file (const I).
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function id(prefix, n) {
  return `${prefix}-0000-4000-8000-${String(n).padStart(12, "0")}`;
}

const I = {
  lead001: id("10000000", 1),
  lead002: id("10000000", 2),
  lead003: id("10000000", 3),
  lead004: id("10000000", 4),
  lead005: id("10000000", 5),
  lead006: id("10000000", 6),
  lead007: id("10000000", 7),
  client001: id("20000000", 1),
  client002: id("20000000", 2),
  client003: id("20000000", 3),
  clientHarbor: id("20000000", 4),
  client004: id("20000000", 5),
  client005: id("20000000", 6),
  projAbc: id("30000000", 1),
  projSmithRedesign: id("30000000", 2),
  projXyz: id("30000000", 3),
  projSmithLanding: id("30000000", 4),
  projHarbor: id("30000000", 5),
  projBrightpath: id("30000000", 6),
  delAbcHome: id("60000000", 1),
  delAbcAbout: id("60000000", 2),
  delAbcLogo: id("60000000", 3),
  delAbcBrand: id("60000000", 4),
  delHpHome: id("60000000", 5),
  delHpAbout: id("60000000", 6),
  delHpLogo: id("60000000", 7),
  delHpBrand: id("60000000", 8),
  delSmHome: id("60000000", 9),
  delSlLanding: id("60000000", 10),
  verAbcHome1: id("70000000", 1),
  verAbcHome2: id("70000000", 2),
  verAbcHome3: id("70000000", 3),
  verAbcAbout1: id("70000000", 4),
  verAbcAbout2: id("70000000", 5),
  verAbcLogo1: id("70000000", 6),
  verAbcBrand1: id("70000000", 7),
  verAbcBrand2: id("70000000", 8),
  verHpHome1: id("70000000", 9),
  verHpHome2: id("70000000", 10),
  verHpHome3: id("70000000", 11),
  verHpAbout1: id("70000000", 12),
  verHpAbout2: id("70000000", 13),
  verHpLogo1: id("70000000", 14),
  verHpBrand1: id("70000000", 15),
  verHpBrand2: id("70000000", 16),
  verSmHome1: id("70000000", 17),
  verSmHome2: id("70000000", 18),
  verSl1: id("70000000", 19),
};

function ms(projectKey, n) {
  const projectNum = {
    abc: 1,
    sm: 2,
    xyz: 3,
    sl: 4,
    hp: 5,
    bp: 6,
  }[projectKey];
  return id("40000000", projectNum * 10 + n);
}

function taskId(n) {
  return id("50000000", n);
}

function act(n) {
  return id("a0000000", n);
}

function q(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function days(n) {
  if (n === 0) return "now()";
  if (n > 0) return `now() - interval '${n} days'`;
  return `now() + interval '${-n} days'`;
}

function hours(n) {
  return `now() - interval '${n} hours'`;
}

function d(n) {
  return `(${days(n)})::date`;
}

function futureDate(n) {
  return `(now() + interval '${n} days')::date`;
}

const sql = [];
sql.push(`-- DEVELOPMENT ONLY. Do not apply this file to production.
-- MotiveScripts demo records (ABC Landscaping, Harbor & Pine, Smith Auto, BrightPath, etc.).
-- Idempotent: inserts use fixed UUIDs and ON CONFLICT DO NOTHING.
-- Runtime application code never inserts this dataset.
-- Production databases should start with zero business records and show real empty states.
-- Optional local/staging: run this SQL in the Dashboard after schema migrations, never as a production migration.

insert into public.clients (
  id, contact_name, business_name, email, phone, industry, website, location, status, source, notes, activity, invoices, messages, last_activity_at, created_at
) values
(${q(I.client001)}, 'John Smith', 'ABC Landscaping', 'john@example.com', '(555) 555-5555', 'Landscaping', '', '', 'Active', 'Start a Project',
  '[{"id":"cnote-001","body":"Client prefers communication by email.","author":"Raffy","createdAt":null}]'::jsonb,
  '[{"id":"cact-001a","description":"Homepage V3 approved","createdAt":null,"icon":"file"},{"id":"cact-001c","description":"Client record created","createdAt":null,"icon":"created"}]'::jsonb,
  '[{"id":"inv-1042","number":"#1042","title":"Website Development","amount":"$1,200","status":"Partially Paid"},{"id":"inv-1038","number":"#1038","title":"Deposit","amount":"$1,200","status":"Paid"}]'::jsonb,
  '[{"id":"msg-a","sender":"John Smith","body":"Can we change the hero image?"},{"id":"msg-b","sender":"MotiveScripts","body":"Absolutely. We’ll update it."}]'::jsonb,
  ${days(0)}, ${days(12)}),
(${q(I.client002)}, 'Mike Johnson', 'Smith Auto', 'mike@smithauto.example', '(555) 014-2201', 'Auto', '', '', 'Active', 'Start a Project',
  '[]'::jsonb, '[{"id":"cact-002b","description":"Client record created","createdAt":null,"icon":"created"}]'::jsonb,
  '[{"id":"inv-1020","number":"#1020","title":"Design deposit","amount":"$800","status":"Paid"}]'::jsonb,
  '[{"id":"msg-c","sender":"Mike Johnson","body":"Can we add the inspection special?"}]'::jsonb,
  ${days(1)}, ${days(20)}),
(${q(I.client003)}, 'Sarah Williams', 'XYZ Cleaning', 'sarah@xyzcleaning.example', '(555) 014-3308', 'Cleaning', '', '', 'Active', 'Start a Project',
  '[]'::jsonb, '[{"id":"cact-003b","description":"Client record created","createdAt":null,"icon":"created"}]'::jsonb,
  '[{"id":"inv-1011","number":"#1011","title":"Landing page","amount":"$1,400","status":"Paid"}]'::jsonb,
  '[{"id":"msg-d","sender":"MotiveScripts","body":"The landing page is live."}]'::jsonb,
  ${days(2)}, ${days(30)}),
(${q(I.clientHarbor)}, 'Elena Park', 'Harbor & Pine Salon', 'elena@harborpine.example', '(555) 014-5580', 'Salon / barber', '', '', 'Active', 'Start a Project',
  '[]'::jsonb, '[{"id":"cact-hp-a","description":"Client converted from lead","createdAt":null,"icon":"converted"}]'::jsonb,
  '[]'::jsonb, '[]'::jsonb, ${days(5)}, ${days(5)}),
(${q(I.client004)}, 'Luis Ortega', 'BrightPath Bookkeeping', 'luis@brightpath.example', '(555) 014-8801', 'Professional services', 'https://brightpath.example', 'Austin, TX', 'Inactive', 'Manual',
  '[]'::jsonb, '[{"id":"cact-004a","description":"Client marked inactive","createdAt":null,"icon":"status"}]'::jsonb,
  '[]'::jsonb, '[]'::jsonb, ${days(21)}, ${days(60)}),
(${q(I.client005)}, 'Nina Cole', 'Cole Home Care', 'nina@colehome.example', '(555) 014-9902', 'Home services', '', '', 'Archived', 'Manual',
  '[]'::jsonb, '[{"id":"cact-005a","description":"Client archived","createdAt":null,"icon":"status"}]'::jsonb,
  '[]'::jsonb, '[]'::jsonb, ${days(40)}, ${days(90)})
on conflict (id) do nothing;
`);

sql.push(`
insert into public.leads (
  id, name, business_name, email, phone, industry, request, project_details, status, source, notes, activity, client_id, converted_at, created_at
) values
(${q(I.lead001)}, 'John Smith', 'ABC Landscaping', 'john@example.com', '(555) 555-5555', 'Landscaping', 'New Website', 'We are looking for a modern website for our landscaping business.', 'New', 'Start a Project',
  '[{"id":"note-001","body":"Potential good fit for a 5-page business website.","author":"Raffy","createdAt":null}]'::jsonb,
  '[{"id":"act-001a","description":"Lead submitted project inquiry","createdAt":null}]'::jsonb,
  null, null, ${hours(3)}),
(${q(I.lead002)}, 'Mike Johnson', 'Smith Auto', 'mike@smithauto.example', '(555) 014-2201', 'Auto', 'Website Redesign', 'The current site is outdated. We need a cleaner shop site with service pages and hours.', 'Contacted', 'Start a Project',
  '[]'::jsonb, '[{"id":"act-002a","description":"Lead submitted project inquiry","createdAt":null}]'::jsonb,
  null, null, ${days(1)}),
(${q(I.lead003)}, 'Sarah Williams', 'XYZ Cleaning', 'sarah@xyzcleaning.example', '(555) 014-3308', 'Cleaning', 'New Website', 'Need a simple site that explains residential and commercial cleaning packages.', 'Qualified', 'Start a Project',
  '[]'::jsonb, '[{"id":"act-003a","description":"Lead submitted project inquiry","createdAt":null}]'::jsonb,
  null, null, ${days(2)}),
(${q(I.lead004)}, 'David Brown', 'Koala Trees Services', 'david@koalatrees.example', '(555) 014-4412', 'Tree service', 'Website Development', 'We need a site that can take service requests and show before-and-after work.', 'Proposal', 'Start a Project',
  '[]'::jsonb, '[{"id":"act-004a","description":"Lead submitted project inquiry","createdAt":null}]'::jsonb,
  null, null, ${days(3)}),
(${q(I.lead005)}, 'Elena Park', 'Harbor & Pine Salon', 'elena@harborpine.example', '(555) 014-5580', 'Salon / barber', 'New Website', 'A booking-friendly site for a small salon. Menu of services and a simple about page.', 'Won', 'Start a Project',
  '[]'::jsonb, '[{"id":"act-005b","description":"Lead converted to client","createdAt":null}]'::jsonb,
  ${q(I.clientHarbor)}, ${days(5)}, ${days(8)}),
(${q(I.lead006)}, 'Chris Nguyen', 'Northline Electrical', 'chris@northline.example', '(555) 014-6694', 'Contractor', 'Website Redesign', 'Reached out about a rebuild, then decided to wait until next year.', 'Lost', 'Manual',
  '[]'::jsonb, '[{"id":"act-006b","description":"Lead status changed to Lost","createdAt":null}]'::jsonb,
  null, null, ${days(10)}),
(${q(I.lead007)}, 'Priya Shah', 'Oak Street Kitchen', 'priya@oakstreet.example', '(555) 014-7703', 'Restaurant', 'New Website', 'Menu, hours, and a reservation note. Mobile-first for neighborhood traffic.', 'Contacted', 'Start a Project',
  '[]'::jsonb, '[{"id":"act-007a","description":"Lead submitted project inquiry","createdAt":null}]'::jsonb,
  null, null, ${days(4)})
on conflict (id) do nothing;

update public.clients set source_lead_id = ${q(I.lead005)} where id = ${q(I.clientHarbor)} and source_lead_id is null;
`);

sql.push(`
insert into public.projects (
  id, client_id, name, description, type, status, start_date, due_date, archived, approval_status, last_activity_at, created_at
) values
(${q(I.projAbc)}, ${q(I.client001)}, 'Website Redesign', 'Full site redesign for a landscaping company, including services, gallery, and contact.', 'Website Redesign', 'In Development', ${d(12)}, ${futureDate(18)}, false, 'Pending', ${days(0)}, ${days(12)}),
(${q(I.projSmithRedesign)}, ${q(I.client002)}, 'Business Website', 'Refresh the shop site and service pages for Smith Auto.', 'Website Redesign', 'Client Review', ${d(18)}, ${futureDate(6)}, false, 'Pending', ${days(1)}, ${days(18)}),
(${q(I.projXyz)}, ${q(I.client003)}, 'Landing Page', 'One-page site for residential and commercial cleaning packages.', 'Landing Page', 'Planning', ${d(2)}, ${futureDate(23)}, false, 'Pending', ${days(0)}, ${days(2)}),
(${q(I.projSmithLanding)}, ${q(I.client002)}, 'Winter Service Landing Page', 'Seasonal campaign page for winter inspections.', 'Landing Page', 'Completed', ${d(16)}, ${d(4)}, false, 'Approved', ${days(4)}, ${days(16)}),
(${q(I.projHarbor)}, ${q(I.clientHarbor)}, 'Harbor & Pine Website', 'Booking-friendly salon site with services and about.', 'Website', 'Planning', ${d(5)}, ${futureDate(34)}, false, 'Pending', ${days(1)}, ${days(5)}),
(${q(I.projBrightpath)}, ${q(I.client004)}, 'BrightPath Marketing Site', 'Simple professional-services site. Paused while the client revisits budget.', 'Website', 'On Hold', ${d(40)}, ${futureDate(60)}, false, 'Pending', ${days(21)}, ${days(40)})
on conflict (id) do nothing;
`);

const milestones = [
  [ms("abc", 1), I.projAbc, "Discovery", "Kickoff, goals, and content collection.", "Completed", 1, 12, 9],
  [ms("abc", 2), I.projAbc, "Design", "Homepage and inner-page layouts.", "Completed", 2, 9, 5],
  [ms("abc", 3), I.projAbc, "Development", "Build the approved designs in code.", "In Progress", 3, 5, -13],
  [ms("abc", 4), I.projAbc, "Client Review", "Walkthrough, feedback, and approval.", "Not Started", 4, null, -16],
  [ms("abc", 5), I.projAbc, "Launch", "Go-live and handoff.", "Not Started", 5, null, -18],
  [ms("sm", 1), I.projSmithRedesign, "Discovery", "Discovery stage.", "Completed", 1, 18, 16],
  [ms("sm", 2), I.projSmithRedesign, "Design", "Design stage.", "Completed", 2, 16, 10],
  [ms("sm", 3), I.projSmithRedesign, "Development", "Development stage.", "Completed", 3, 10, 2],
  [ms("sm", 4), I.projSmithRedesign, "Client Review", "Client Review stage.", "In Progress", 4, 2, -4],
  [ms("sm", 5), I.projSmithRedesign, "Launch", "Launch stage.", "Not Started", 5, null, -6],
  [ms("xyz", 1), I.projXyz, "Discovery", "Discovery stage.", "In Progress", 1, 2, -5],
  [ms("xyz", 2), I.projXyz, "Design", "Design stage.", "Not Started", 2, null, -12],
  [ms("xyz", 3), I.projXyz, "Development", "Development stage.", "Not Started", 3, null, -18],
  [ms("xyz", 4), I.projXyz, "Client Review", "Client Review stage.", "Not Started", 4, null, -21],
  [ms("xyz", 5), I.projXyz, "Launch", "Launch stage.", "Not Started", 5, null, -23],
  [ms("sl", 1), I.projSmithLanding, "Discovery", "Discovery stage.", "Completed", 1, 16, 14],
  [ms("sl", 2), I.projSmithLanding, "Development", "Development stage.", "Completed", 2, 14, 6],
  [ms("sl", 3), I.projSmithLanding, "Launch", "Launch stage.", "Completed", 3, 6, 4],
  [ms("hp", 1), I.projHarbor, "Discovery", "Discovery stage.", "Not Started", 1, null, null],
  [ms("hp", 2), I.projHarbor, "Design", "Design stage.", "Not Started", 2, null, null],
  [ms("hp", 3), I.projHarbor, "Development", "Development stage.", "Not Started", 3, null, null],
  [ms("hp", 4), I.projHarbor, "Client Review", "Client Review stage.", "Not Started", 4, null, null],
  [ms("hp", 5), I.projHarbor, "Launch", "Launch stage.", "Not Started", 5, null, null],
  [ms("bp", 1), I.projBrightpath, "Discovery", "Discovery stage.", "Completed", 1, null, null],
  [ms("bp", 2), I.projBrightpath, "Design", "Design stage.", "Not Started", 2, null, null],
  [ms("bp", 3), I.projBrightpath, "Development", "Development stage.", "Not Started", 3, null, null],
  [ms("bp", 4), I.projBrightpath, "Client Review", "Client Review stage.", "Not Started", 4, null, null],
  [ms("bp", 5), I.projBrightpath, "Launch", "Launch stage.", "Not Started", 5, null, null],
];

sql.push(`
insert into public.milestones (id, project_id, name, description, status, position, start_date, due_date)
values
${milestones
  .map(
    ([id, project, name, desc, status, pos, start, due]) =>
      `(${q(id)}, ${q(project)}, ${q(name)}, ${q(desc)}, ${q(status)}, ${pos}, ${start == null ? "null" : d(start)}, ${due == null ? "null" : due < 0 ? futureDate(-due) : d(due)})`,
  )
  .join(",\n")}
on conflict (id) do nothing;
`);

const tasks = [
  [1, I.projAbc, ms("abc", 1), "Kickoff call", "Completed", "High", "You", 11, 11],
  [2, I.projAbc, ms("abc", 1), "Collect photos", "Completed", "Medium", "Alex", 10, 10],
  [3, I.projAbc, ms("abc", 2), "Homepage design", "Completed", "High", "Jordan", 7, 6],
  [4, I.projAbc, ms("abc", 2), "Inner page layouts", "Completed", "Medium", "Jordan", 5, 5],
  [5, I.projAbc, ms("abc", 3), "Setup project", "Completed", "High", "You", 4, 4],
  [6, I.projAbc, ms("abc", 3), "Build homepage", "Completed", "High", "You", 2, 1],
  [7, I.projAbc, ms("abc", 3), "Build navigation", "Completed", "Medium", "Alex", 1, 0],
  [8, I.projAbc, ms("abc", 3), "Build contact page", "Todo", "Medium", "Alex", -4, null],
  [9, I.projAbc, ms("abc", 3), "Mobile optimization", "Todo", "High", "You", -11, null],
  [10, I.projAbc, ms("abc", 3), "SEO setup", "Todo", "Low", "Taylor", -14, null],
  [11, I.projSmithRedesign, ms("sm", 1), "Audit current site", "Completed", "Medium", "You", 17, 17],
  [12, I.projSmithRedesign, ms("sm", 2), "Homepage mockup", "Completed", "High", "Jordan", 12, 12],
  [13, I.projSmithRedesign, ms("sm", 2), "Service page layouts", "Completed", "Medium", "Jordan", 10, 10],
  [14, I.projSmithRedesign, ms("sm", 3), "Build homepage", "Completed", "High", "Alex", 6, 6],
  [15, I.projSmithRedesign, ms("sm", 3), "Build service pages", "Completed", "High", "You", 4, 4],
  [16, I.projSmithRedesign, ms("sm", 3), "Hours and inspection special", "Completed", "Medium", "Taylor", 3, 3],
  [17, I.projSmithRedesign, ms("sm", 3), "Mobile pass", "Completed", "Medium", "Alex", 2, 2],
  [18, I.projSmithRedesign, ms("sm", 4), "Internal QA", "Completed", "High", "You", 1, 1],
  [19, I.projSmithRedesign, ms("sm", 4), "Send review link", "Completed", "Medium", "You", 1, 1],
  [20, I.projSmithRedesign, ms("sm", 4), "Collect client notes", "Todo", "High", "You", -3, null],
  [21, I.projXyz, ms("xyz", 1), "Confirm packages", "Completed", "High", "You", 1, 0],
  [22, I.projXyz, ms("xyz", 1), "Gather photos", "Todo", "Medium", "Alex", -3, null],
  [23, I.projXyz, ms("xyz", 1), "Write service copy", "Todo", "Medium", "Taylor", -5, null],
  [24, I.projXyz, ms("xyz", 2), "Landing page layout", "Todo", "High", "Jordan", -10, null],
  [25, I.projXyz, ms("xyz", 3), "Build landing page", "Todo", "High", "You", -16, null],
  [26, I.projXyz, ms("xyz", 3), "Form and click-to-call", "Todo", "Medium", "Alex", -17, null],
  [27, I.projXyz, ms("xyz", 4), "Client walkthrough", "Todo", "Medium", "You", -20, null],
  [28, I.projXyz, ms("xyz", 5), "Publish", "Todo", "High", "You", -23, null],
  [29, I.projXyz, ms("xyz", 1), "Review competitors", "Todo", "Low", "Taylor", -2, null],
  [30, I.projXyz, ms("xyz", 2), "Mobile layout check", "Todo", "Medium", "Jordan", -11, null],
  [31, I.projSmithLanding, ms("sl", 1), "Campaign brief", "Completed", "Medium", "You", 15, 15],
  [32, I.projSmithLanding, ms("sl", 2), "Build landing page", "Completed", "High", "Alex", 8, 8],
  [33, I.projSmithLanding, ms("sl", 2), "Connect form", "Completed", "Medium", "Alex", 6, 6],
  [34, I.projSmithLanding, ms("sl", 3), "Publish campaign", "Completed", "High", "You", 4, 4],
  [35, I.projHarbor, ms("hp", 1), "Confirm service menu", "Todo", "High", "You", -3, null],
  [36, I.projHarbor, ms("hp", 1), "Collect salon photos", "Todo", "Medium", "Alex", -7, null],
  [37, I.projBrightpath, ms("bp", 1), "Kickoff notes", "Completed", "Medium", "You", 38, 38],
  [38, I.projBrightpath, ms("bp", 2), "Homepage wireframe", "Todo", "High", "Jordan", -70, null],
];

sql.push(`
insert into public.tasks (id, project_id, milestone_id, title, description, status, priority, assignee, due_date, completed_at, created_at)
values
${tasks
  .map(
    ([n, project, milestone, title, status, priority, assignee, due, completed]) =>
      `(${q(taskId(n))}, ${q(project)}, ${q(milestone)}, ${q(title)}, '', ${q(status)}, ${q(priority)}, ${q(assignee)}, ${due < 0 ? futureDate(-due) : d(due)}, ${completed == null ? "null" : days(completed)}, ${days(14)})`,
  )
  .join(",\n")}
on conflict (id) do nothing;
`);

sql.push(`
insert into public.deliverables (id, project_id, name, description, category, status, archived_at, created_at, updated_at)
values
(${q(I.delAbcHome)}, ${q(I.projAbc)}, 'Website Homepage', 'Homepage design including hero, navigation, CTA, and responsive layout.', 'Website Page', 'In Review', null, ${days(12)}, ${days(0)}),
(${q(I.delAbcAbout)}, ${q(I.projAbc)}, 'About Page', 'About page design and story content.', 'Website Page', 'Approved', null, ${days(10)}, ${days(1)}),
(${q(I.delAbcLogo)}, ${q(I.projAbc)}, 'Logo', 'Primary website logo.', 'Branding', 'Approved', null, ${days(11)}, ${days(8)}),
(${q(I.delAbcBrand)}, ${q(I.projAbc)}, 'Brand Assets', 'Color, type, and supporting marks.', 'Asset', 'Needs Changes', null, ${days(11)}, ${days(3)}),
(${q(I.delHpHome)}, ${q(I.projHarbor)}, 'Website Homepage', 'Homepage design and content for the salon site.', 'Website Page', 'In Review', null, ${days(5)}, ${days(2)}),
(${q(I.delHpAbout)}, ${q(I.projHarbor)}, 'About Page', 'About page design.', 'Website Page', 'Draft', null, ${days(4)}, ${days(1)}),
(${q(I.delHpLogo)}, ${q(I.projHarbor)}, 'Logo', 'Primary website logo.', 'Branding', 'In Review', null, ${days(5)}, ${days(5)}),
(${q(I.delHpBrand)}, ${q(I.projHarbor)}, 'Brand Assets', 'Palette and supporting marks.', 'Asset', 'Draft', null, ${days(5)}, ${days(4)}),
(${q(I.delSmHome)}, ${q(I.projSmithRedesign)}, 'Website Homepage', 'Shop homepage currently in client review.', 'Website Page', 'In Review', null, ${days(14)}, ${days(1)}),
(${q(I.delSlLanding)}, ${q(I.projSmithLanding)}, 'Landing Page', 'Winter inspection campaign page.', 'Website Page', 'Approved', null, ${days(10)}, ${days(4)})
on conflict (id) do nothing;
`);

const versions = [
  [I.verAbcHome1, I.delAbcHome, 1, "homepage-v1.png", "PNG", 1120000, "First homepage pass.", false, "Jordan", 12],
  [I.verAbcHome2, I.delAbcHome, 2, "homepage-revision-v2.png", "PNG", 1340000, "Revised hero and services.", false, "Jordan", 1],
  [I.verAbcHome3, I.delAbcHome, 3, "homepage-final-v3.png", "PNG", 2410000, "Current homepage for client review.", true, "You", 0],
  [I.verAbcAbout1, I.delAbcAbout, 1, "about-v1.png", "PNG", 980000, "Initial about layout.", false, "Alex", 10],
  [I.verAbcAbout2, I.delAbcAbout, 2, "about-v2.png", "PNG", 1050000, "Updated team copy.", true, "Alex", 1],
  [I.verAbcLogo1, I.delAbcLogo, 1, "logo-final.svg", "SVG", 48000, "Approved logo lockup.", true, "Taylor", 8],
  [I.verAbcBrand1, I.delAbcBrand, 1, "brand-assets-v1.zip", "ZIP", 4200000, "First asset pack.", false, "Taylor", 9],
  [I.verAbcBrand2, I.delAbcBrand, 2, "brand-assets-v2.zip", "ZIP", 4720000, "Includes usage notes.", true, "Taylor", 3],
  [I.verHpHome1, I.delHpHome, 1, "harbor-home-v1.png", "PNG", 1080000, "First homepage concept.", false, "Jordan", 5],
  [I.verHpHome2, I.delHpHome, 2, "harbor-home-v2.png", "PNG", 1220000, "Booking CTA added.", false, "Jordan", 3],
  [I.verHpHome3, I.delHpHome, 3, "harbor-home-v3.png", "PNG", 1410000, "Current homepage draft.", true, "You", 2],
  [I.verHpAbout1, I.delHpAbout, 1, "harbor-about-v1.png", "PNG", 860000, "First about layout.", false, "Alex", 4],
  [I.verHpAbout2, I.delHpAbout, 2, "harbor-about-v2.png", "PNG", 910000, "Photo crop update.", true, "Alex", 1],
  [I.verHpLogo1, I.delHpLogo, 1, "harbor-logo.svg", "SVG", 36000, "Wordmark for the site header.", true, "Taylor", 5],
  [I.verHpBrand1, I.delHpBrand, 1, "harbor-brand-v1.zip", "ZIP", 2100000, "Initial brand pack.", false, "Taylor", 5],
  [I.verHpBrand2, I.delHpBrand, 2, "harbor-brand-v2.zip", "ZIP", 2400000, "Includes social avatars.", true, "Taylor", 4],
  [I.verSmHome1, I.delSmHome, 1, "smith-home-v1.png", "PNG", 1500000, "First shop homepage.", false, "Alex", 12],
  [I.verSmHome2, I.delSmHome, 2, "smith-home-v2.png", "PNG", 1620000, "Inspection special added.", true, "You", 1],
  [I.verSl1, I.delSlLanding, 1, "winter-landing-final.png", "PNG", 1180000, "Published campaign layout.", true, "Alex", 4],
];

sql.push(`
insert into public.file_versions (
  id, deliverable_id, version_number, label, description, is_current, file_name, file_type, file_size, uploaded_by, created_at
) values
${versions
  .map(
    ([id, del, num, file, type, size, desc, current, by, age]) =>
      `(${q(id)}, ${q(del)}, ${num}, ${q("v" + num)}, ${q(desc)}, ${current}, ${q(file)}, ${q(type)}, ${size}, ${q(by)}, ${days(age)})`,
  )
  .join(",\n")}
on conflict (id) do nothing;
`);

sql.push(`
insert into public.feedback (id, project_id, deliverable_id, version_id, client_id, message, status, created_by_name, created_at, resolved_at)
values
(${q(id("80000000", 1))}, ${q(I.projAbc)}, ${q(I.delAbcBrand)}, ${q(I.verAbcBrand2)}, ${q(I.client001)},
  'Please replace the dark background with the lighter version from the brand guide.', 'Open', 'John Smith', ${days(2)}, null),
(${q(id("80000000", 2))}, ${q(I.projAbc)}, ${q(I.delAbcAbout)}, ${q(I.verAbcAbout1)}, ${q(I.client001)},
  'Please increase the spacing between the story and the team photos.', 'Resolved', 'John Smith', ${days(6)}, ${days(3)})
on conflict (id) do nothing;

insert into public.approvals (id, project_id, deliverable_id, version_id, client_id, status, approved_by_name, approved_at, created_at)
values
(${q(id("90000000", 1))}, ${q(I.projAbc)}, ${q(I.delAbcAbout)}, ${q(I.verAbcAbout2)}, ${q(I.client001)}, 'Approved', 'ABC Landscaping', ${days(1)}, ${days(1)}),
(${q(id("90000000", 2))}, ${q(I.projAbc)}, ${q(I.delAbcLogo)}, ${q(I.verAbcLogo1)}, ${q(I.client001)}, 'Approved', 'ABC Landscaping', ${days(8)}, ${days(8)}),
(${q(id("90000000", 3))}, ${q(I.projAbc)}, ${q(I.delAbcHome)}, ${q(I.verAbcHome2)}, ${q(I.client001)}, 'Approved', 'ABC Landscaping', ${days(1)}, ${days(1)})
on conflict (id) do nothing;
`);

const activities = [
  [1, I.projAbc, "version_sent_for_review", "Website Homepage v3 sent for review.", "review", 0],
  [2, I.projAbc, "task_completed", "Task “Build navigation” completed", "task", 0],
  [3, I.projAbc, "changes_requested", "Client requested changes on Brand Assets v2.", "review", 2],
  [4, I.projAbc, "version_approved", "About Page v2 approved.", "review", 1],
  [5, I.projAbc, "version_created", "Version 3 uploaded", "file", 0],
  [6, I.projAbc, "task_completed", "Task “Build homepage” completed", "task", 1],
  [7, I.projAbc, "milestone_created", "Development milestone started", "milestone", 5],
  [8, I.projAbc, "project_created", "Project created", "created", 12],
  [9, I.projSmithRedesign, "version_created", "Version 2 uploaded", "file", 1],
  [10, I.projSmithRedesign, "status_changed", "Project status changed to Client Review", "status", 1],
  [11, I.projSmithRedesign, "project_created", "Project created", "created", 18],
  [12, I.projXyz, "task_completed", "Task “Confirm packages” completed", "task", 0],
  [13, I.projXyz, "project_created", "Project created", "created", 2],
  [14, I.projSmithLanding, "version_created", "Version 1 uploaded", "file", 4],
  [15, I.projSmithLanding, "status_changed", "Project status changed to Completed", "status", 4],
  [16, I.projSmithLanding, "project_created", "Project created", "created", 16],
  [17, I.projHarbor, "version_created", "Version 2 uploaded", "file", 1],
  [18, I.projHarbor, "version_created", "Version 3 uploaded", "file", 2],
  [19, I.projHarbor, "deliverable_created", "Deliverable created", "file", 5],
  [20, I.projHarbor, "project_created", "Project created", "created", 5],
  [21, I.projBrightpath, "status_changed", "Project status changed to On Hold", "status", 21],
  [22, I.projBrightpath, "project_created", "Project created", "created", 40],
];

sql.push(`
insert into public.activity (id, project_id, activity_type, message, metadata, created_at)
values
${activities
  .map(
    ([n, project, type, message, icon, age]) =>
      `(${q(act(n))}, ${q(project)}, ${q(type)}, ${q(message)}, ${q(JSON.stringify({ icon }))}::jsonb, ${days(age)})`,
  )
  .join(",\n")}
on conflict (id) do nothing;
`);

const out = sql.join("\n");
const dest = join(dirname(fileURLToPath(import.meta.url)), "..", "supabase", "dev-seed", "seed_demo_data.sql");
writeFileSync(dest, out);
console.log("wrote", dest);
