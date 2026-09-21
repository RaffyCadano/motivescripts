// Tests for the QA / Tester Dashboard selectors (src/data/qaOverview.ts).
//
//   node --test scripts/test-qa-overview.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import { isQaTask, outstandingFailedChecks, qaProgress, qaResultCounts } from "../src/data/qaOverview.ts";

const qa = (over = {}) => ({ title: "Test staging website", taskType: "qa", recommendedRole: "team_member", status: "Todo", qaResult: null, ...over });

test("QA tasks are recognised by task type or by the Team Member recommended role", () => {
  assert.equal(isQaTask({ title: "Anything", taskType: "qa", recommendedRole: null }), true);
  assert.equal(isQaTask({ title: "Verify production website", taskType: "internal", recommendedRole: "team_member" }), true);
  assert.equal(isQaTask({ title: "Test staging website", taskType: null, recommendedRole: null }), true);
  assert.equal(isQaTask({ title: "Build homepage", taskType: "production", recommendedRole: "developer" }), false);
});

test("result counts: open QA tasks are 'to test', completed ones split by recorded result", () => {
  const counts = qaResultCounts([
    qa({ status: "Todo" }),
    qa({ status: "In Progress" }),
    qa({ status: "Completed", qaResult: "pass" }),
    qa({ status: "Completed", qaResult: "fail" }),
    qa({ status: "Completed", qaResult: "fail" }),
    qa({ status: "Completed", qaResult: null }),
    { title: "Build homepage", taskType: "production", recommendedRole: "developer", status: "Completed", qaResult: null },
  ]);
  assert.deepEqual(counts, { toTest: 2, passed: 1, failed: 2 });
});

test("QA progress counts only QA tasks, and total 0 is never a fake 100%", () => {
  const project = { tasks: [qa({ status: "Completed" }), qa({ status: "Todo" }), { title: "Build homepage", taskType: "production", recommendedRole: "developer", status: "Completed" }] };
  assert.deepEqual(qaProgress(project), { total: 2, completed: 1 });
  assert.deepEqual(qaProgress({ tasks: [] }), { total: 0, completed: 0 });
});

test("a failed check stays outstanding until a later pass on the same project", () => {
  const failed = qa({ id: "f", projectId: "p1", status: "Completed", qaResult: "fail", completedAt: "2026-09-10T00:00:00Z" });
  const retested = qa({ id: "g", projectId: "p2", status: "Completed", qaResult: "fail", completedAt: "2026-09-10T00:00:00Z" });
  const other = qa({ id: "h", projectId: "p3", status: "Completed", qaResult: "fail", completedAt: "2026-09-12T00:00:00Z" });
  const projects = [
    { id: "p1", tasks: [{ projectId: "p1", qaResult: "pass", completedAt: "2026-09-05T00:00:00Z" }] }, // pass is OLDER than the fail
    { id: "p2", tasks: [{ projectId: "p2", qaResult: "pass", completedAt: "2026-09-11T00:00:00Z" }] }, // re-test passed
    { id: "p3", tasks: [] },
  ];
  const result = outstandingFailedChecks([failed, retested, other], projects);
  assert.deepEqual(result.map((task) => task.id), ["h", "f"]); // newest first; p2 resolved
});

test("only completed failed QA tasks are failed checks", () => {
  const open = qa({ id: "a", projectId: "p", status: "In Progress", qaResult: null, completedAt: "2026-09-10T00:00:00Z" });
  const passed = qa({ id: "b", projectId: "p", status: "Completed", qaResult: "pass", completedAt: "2026-09-10T00:00:00Z" });
  assert.deepEqual(outstandingFailedChecks([open, passed], [{ id: "p", tasks: [] }]), []);
});
