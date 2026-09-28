// Tests for the staff AI assistant's task-status summary (src/data/staffAiContext.ts).
//
//   node --test scripts/test-staff-ai-context.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildStaffTaskContext, isStaffAiPilotTemplate, STAFF_AI_PILOT_TEMPLATES } from "../src/data/staffAiContext.ts";

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

test("the pilot template allowlist matches what it claims to allow", () => {
  assert.deepEqual(STAFF_AI_PILOT_TEMPLATES, ["developer", "project_manager"]);
  assert.equal(isStaffAiPilotTemplate("developer"), true);
  assert.equal(isStaffAiPilotTemplate("project_manager"), true);
  assert.equal(isStaffAiPilotTemplate("designer"), false);
  assert.equal(isStaffAiPilotTemplate(null), false);
  assert.equal(isStaffAiPilotTemplate(undefined), false);
});
