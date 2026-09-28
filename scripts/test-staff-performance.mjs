// Tests for the admin Overview's staff-performance selector (src/data/staffPerformance.ts).
//
//   node --test scripts/test-staff-performance.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildStaffPerformance, STAFF_INACTIVE_AFTER_DAYS } from "../src/data/staffPerformance.ts";

const NOW = new Date(2026, 8, 28, 12, 0, 0); // Sep 28 2026, local

const member = (over) => ({ id: "u1", fullName: "Jordan Lee", templateLabel: "Developer", isActive: true, ...over });
const task = (over) => ({
  id: "t1",
  assignedTo: "u1",
  status: "Completed",
  dueDate: "2026-09-10",
  completedAt: "2026-09-10T15:00:00Z",
  ...over,
});
const project = (tasks) => ({ tasks });

test("a staff member with no tasks ever assigned is left out entirely", () => {
  const rows = buildStaffPerformance([project([])], [member()], NOW);
  assert.deepEqual(rows, []);
});

test("completed on or before its due date counts on time; after counts late", () => {
  // Timestamps sit well clear of the due date on either side (not just hours) so the local-
  // calendar-day comparison can't flip across a real timezone offset.
  const rows = buildStaffPerformance(
    [
      project([
        task({ id: "a", dueDate: "2026-09-10", completedAt: "2026-09-10T12:00:00Z" }), // same day: on time
        task({ id: "b", dueDate: "2026-09-10", completedAt: "2026-09-08T12:00:00Z" }), // 2 days early: on time
        task({ id: "c", dueDate: "2026-09-10", completedAt: "2026-09-12T12:00:00Z" }), // 2 days late
      ]),
    ],
    [member()],
    NOW,
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].onTime, 2);
  assert.equal(rows[0].late, 1);
  assert.equal(rows[0].onTimeRate, 2 / 3);
});

test("a completed task with no due date is never judged on-time or late", () => {
  const rows = buildStaffPerformance(
    [project([task({ dueDate: "", completedAt: "2026-09-10T00:00:00Z" })])],
    [member()],
    NOW,
  );
  assert.equal(rows[0].completed, 1);
  assert.equal(rows[0].onTime, 0);
  assert.equal(rows[0].late, 0);
  assert.equal(rows[0].onTimeRate, null);
});

test("an open task past its due date counts as currently overdue; an open task not yet due does not", () => {
  const rows = buildStaffPerformance(
    [
      project([
        task({ id: "a", status: "In Progress", dueDate: "2026-09-01", completedAt: null }),
        task({ id: "b", status: "Todo", dueDate: "2026-10-15", completedAt: null }),
      ]),
    ],
    [member()],
    NOW,
  );
  assert.equal(rows[0].overdueNow, 1);
});

test("inactive means no completed task within the window, including never having completed one", () => {
  const recentlyActive = buildStaffPerformance(
    [project([task({ completedAt: "2026-09-20T00:00:00Z" })])], // 8 days before NOW
    [member()],
    NOW,
  );
  assert.equal(recentlyActive[0].isInactive, false);

  const staleActivity = buildStaffPerformance(
    [project([task({ completedAt: "2026-09-01T00:00:00Z" })])], // 27 days before NOW
    [member()],
    NOW,
  );
  assert.equal(staleActivity[0].isInactive, true);
  assert.ok(staleActivity[0].daysSinceLastCompleted >= STAFF_INACTIVE_AFTER_DAYS);

  const neverCompleted = buildStaffPerformance(
    [project([task({ status: "In Progress", dueDate: "2026-10-01", completedAt: null })])],
    [member()],
    NOW,
  );
  assert.equal(neverCompleted[0].isInactive, true);
  assert.equal(neverCompleted[0].daysSinceLastCompleted, null);
});

test("sorts inactive staff first, then most currently-overdue, then lowest on-time rate", () => {
  const projects = [
    project([
      // u1: active (completed something recently, within the window), no overdue.
      task({ id: "a", assignedTo: "u1", dueDate: "2026-09-25", completedAt: "2026-09-25T12:00:00Z" }),
      // u2: active (also completed something recently), but has 2 currently-overdue tasks.
      task({ id: "b", assignedTo: "u2", status: "In Progress", dueDate: "2026-09-01", completedAt: null }),
      task({ id: "c", assignedTo: "u2", status: "Blocked", dueDate: "2026-09-05", completedAt: null }),
      task({ id: "d", assignedTo: "u2", dueDate: "2026-09-25", completedAt: "2026-09-25T12:00:00Z" }),
      // u3: never completed anything -- inactive, should sort first regardless of the above.
      task({ id: "e", assignedTo: "u3", status: "Todo", dueDate: "2026-10-01", completedAt: null }),
    ]),
  ];
  const members = [member({ id: "u1" }), member({ id: "u2" }), member({ id: "u3" })];
  const rows = buildStaffPerformance(projects, members, NOW);
  assert.deepEqual(rows.map((row) => row.userId), ["u3", "u2", "u1"]);
});
