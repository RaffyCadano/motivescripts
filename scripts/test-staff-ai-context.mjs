// Tests for the staff AI assistant's task-status summary (src/data/staffAiContext.ts).
//
//   node --test scripts/test-staff-ai-context.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildAccountingAiContext,
  buildSalesAiContext,
  buildStaffTaskContext,
  isStaffAiTemplate,
  STAFF_AI_TEMPLATES,
} from "../src/data/staffAiContext.ts";

const NOW = new Date(2026, 8, 28, 12, 0, 0); // Sep 28 2026, local

const task = (over) => ({
  id: "t1",
  title: "Fix nav bug",
  projectName: "Website Redesign",
  status: "In Progress",
  dueDate: "",
  blockedReason: null,
  description: "",
  ...over,
});

test("lists project names, or says none, and the total open-task count", () => {
  const withProjects = buildStaffTaskContext([task()], ["Website Redesign"], NOW);
  assert.match(withProjects, /^Projects: Website Redesign\.$/m);
  assert.match(withProjects, /^1 open task total\.$/m);

  const noProjects = buildStaffTaskContext([], [], NOW);
  assert.match(noProjects, /^Projects: none currently assigned\.$/m);
  assert.match(noProjects, /^0 open tasks total\.$/m);
});

test("a completed task never counts as open, blocked, overdue, or in review", () => {
  const summary = buildStaffTaskContext(
    [task({ status: "Completed", dueDate: "2026-09-01", blockedReason: "waiting_on_client" })],
    ["Website Redesign"],
    NOW,
  );
  assert.match(summary, /^0 open tasks total\.$/m);
  assert.ok(!summary.includes("Blocked"));
  assert.ok(!summary.includes("Overdue"));
});

test("blocked tasks show their reason, falling back to the description when no structured reason is set", () => {
  const withReason = buildStaffTaskContext(
    [task({ status: "Blocked", blockedReason: "waiting_on_client" })],
    ["Website Redesign"],
    NOW,
  );
  assert.match(withReason, /Blocked:\n- Fix nav bug \(Website Redesign\) — waiting on client/);

  const withDescriptionOnly = buildStaffTaskContext(
    [task({ status: "Blocked", blockedReason: null, description: "Need API keys from client" })],
    ["Website Redesign"],
    NOW,
  );
  assert.ok(withDescriptionOnly.includes("Need API keys from client"));
});

test("overdue tasks are separated from tasks merely due this week, and today is excluded from both", () => {
  const summary = buildStaffTaskContext(
    [
      task({ id: "a", title: "Overdue task", dueDate: "2026-09-20" }), // 8 days before NOW
      task({ id: "b", title: "Due soon task", dueDate: "2026-10-02" }), // 4 days after NOW
      task({ id: "c", title: "Due today task", dueDate: "2026-09-28" }), // NOW itself
      task({ id: "d", title: "Due next month", dueDate: "2026-11-15" }), // far out: neither bucket
    ],
    ["Website Redesign"],
    NOW,
  );
  assert.match(summary, /Overdue:\n- Overdue task \(Website Redesign\) — was due 2026-09-20/);
  assert.match(summary, /Due this week:\n- Due soon task \(Website Redesign\) — due 2026-10-02/);
  assert.ok(!summary.includes("Due today task"));
  assert.ok(!summary.includes("Due next month"));
});

test("waiting-in-review tasks are listed under their own heading", () => {
  const summary = buildStaffTaskContext([task({ status: "In Review" })], ["Website Redesign"], NOW);
  assert.match(summary, /Waiting in review:\n- Fix nav bug \(Website Redesign\)/);
});

test("an all-clear message appears only when nothing is blocked, overdue, due soon, or in review", () => {
  const clear = buildStaffTaskContext([task({ status: "Todo", dueDate: "" })], ["Website Redesign"], NOW);
  assert.ok(clear.includes("Nothing blocked, overdue, due this week, or waiting in review right now."));

  const notClear = buildStaffTaskContext([task({ status: "Blocked" })], ["Website Redesign"], NOW);
  assert.ok(!notClear.includes("Nothing blocked"));
});

test("the template allowlist matches what it claims to cover", () => {
  assert.deepEqual(STAFF_AI_TEMPLATES, [
    "developer",
    "designer",
    "content_writer",
    "team_member",
    "project_manager",
    "sales",
    "accounting",
    "admin",
  ]);
  for (const key of STAFF_AI_TEMPLATES) assert.equal(isStaffAiTemplate(key), true, key);
  assert.equal(isStaffAiTemplate("staff"), false);
  assert.equal(isStaffAiTemplate(null), false);
  assert.equal(isStaffAiTemplate(undefined), false);
});

// ---- Sales ---------------------------------------------------------------------------------------------------

const lead = (over) => ({ id: "l1", clientLabel: "Acme Co", status: "New", createdAt: "2026-09-01", convertedClientId: null, ...over });
const proposal = (over) => ({
  id: "p1",
  number: "MS-PRO-001",
  clientName: "Acme Co",
  effectiveStatus: "sent",
  sentAt: "2026-09-20",
  validUntil: "2026-10-20",
  createdAt: "2026-09-01",
  ...over,
});
const contract = (over) => ({
  id: "c1",
  number: "MS-CON-001",
  clientName: "Acme Co",
  effectiveStatus: "accepted",
  agencySigned: false,
  sentAt: null,
  acceptedAt: "2026-09-25",
  createdAt: "2026-09-01",
  ...over,
});

test("sales: a converted or non-new lead is never a follow-up, oldest new lead sorts first", () => {
  const summary = buildSalesAiContext(
    {
      leads: [
        lead({ id: "old", clientLabel: "Old Co", createdAt: "2026-09-01" }), // 27 days old
        lead({ id: "new", clientLabel: "New Co", createdAt: "2026-09-25" }), // 3 days old
        lead({ id: "converted", clientLabel: "Won Co", convertedClientId: "client-1" }),
        lead({ id: "contacted", clientLabel: "Contacted Co", status: "Contacted" }),
      ],
      proposals: [],
      contracts: [],
    },
    NOW,
  );
  assert.match(summary, /2 lead\(s\) waiting for a first response/);
  const oldIndex = summary.indexOf("Old Co");
  const newIndex = summary.indexOf("New Co");
  assert.ok(oldIndex > -1 && newIndex > -1 && oldIndex < newIndex, "oldest lead should be listed first");
  assert.ok(!summary.includes("Won Co"));
  assert.ok(!summary.includes("Contacted Co"));
});

test("sales: proposals only count as awaiting while sent/viewed, not once accepted or declined", () => {
  const summary = buildSalesAiContext(
    { leads: [], proposals: [proposal({ effectiveStatus: "viewed" }), proposal({ id: "p2", effectiveStatus: "accepted" })], contracts: [] },
    NOW,
  );
  assert.match(summary, /1 proposal\(s\) sent, awaiting the client/);
  assert.match(summary, /MS-PRO-001 \(Acme Co\), sent \d+ days? ago/);
});

test("sales: distinguishes a contract needing our own signature from one awaiting the client", () => {
  const summary = buildSalesAiContext(
    {
      leads: [],
      proposals: [],
      contracts: [contract({ effectiveStatus: "accepted", agencySigned: false }), contract({ id: "c2", effectiveStatus: "sent", agencySigned: false })],
    },
    NOW,
  );
  assert.match(summary, /1 contract\(s\) the client accepted, waiting on our signature/);
  assert.match(summary, /1 contract\(s\) sent, awaiting the client/);
});

test("sales: an all-clear message appears only when nothing is open", () => {
  const clear = buildSalesAiContext({ leads: [], proposals: [], contracts: [] }, NOW);
  assert.ok(clear.includes("No new leads waiting for a first response."));
  assert.ok(clear.includes("No proposals or contracts currently awaiting anyone."));
});

test("sales: a long list is capped with a remaining count rather than growing unbounded", () => {
  const manyLeads = Array.from({ length: 12 }, (_, i) => lead({ id: `l${i}`, clientLabel: `Co ${i}` }));
  const summary = buildSalesAiContext({ leads: manyLeads, proposals: [], contracts: [] }, NOW);
  assert.match(summary, /…and 4 more\./);
});

// ---- Accounting -----------------------------------------------------------------------------------------------

const invoice = (over) => ({
  id: "i1",
  number: "MS-INV-001",
  clientName: "Acme Co",
  effectiveStatus: "overdue",
  amountDueCents: 50_000,
  dueDate: "2026-09-10",
  createdAt: "2026-09-01",
  ...over,
});

test("accounting: overdue invoices are totalled and sorted most-overdue first", () => {
  const summary = buildAccountingAiContext(
    [
      invoice({ id: "a", dueDate: "2026-09-20", amountDueCents: 10_000 }), // 8 days overdue
      invoice({ id: "b", dueDate: "2026-09-01", amountDueCents: 20_000 }), // 27 days overdue
    ],
    NOW,
  );
  assert.match(summary, /2 overdue invoice\(s\), \$300\.00 total/);
  const firstLine = summary.split("\n").find((line) => line.startsWith("-"));
  assert.match(firstLine, /^- MS-INV-001 \(Acme Co\), \$200\.00, 27 day\(s\) overdue/);
});

test("accounting: due-soon excludes anything already overdue and anything more than 7 days out", () => {
  const summary = buildAccountingAiContext(
    [
      invoice({ id: "a", effectiveStatus: "sent", dueDate: "2026-10-02" }), // 4 days out
      invoice({ id: "b", effectiveStatus: "sent", dueDate: "2026-10-20" }), // far out
    ],
    NOW,
  );
  assert.match(summary, /1 invoice\(s\) due within 7 days/);
  assert.ok(!summary.includes("2026-10-20"));
});

test("accounting: draft invoices never sent are called out, oldest first", () => {
  const summary = buildAccountingAiContext(
    [invoice({ id: "a", effectiveStatus: "draft", createdAt: "2026-09-05" }), invoice({ id: "b", effectiveStatus: "draft", createdAt: "2026-09-01" })],
    NOW,
  );
  assert.match(summary, /2 draft invoice\(s\) never sent/);
});

test("accounting: no overdue invoices says so explicitly rather than staying silent", () => {
  const summary = buildAccountingAiContext([invoice({ effectiveStatus: "paid" })], NOW);
  assert.ok(summary.includes("No overdue invoices."));
});
