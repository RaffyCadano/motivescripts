// Tests for the care-requests admin queue's sort/filter logic (src/data/careRequests.ts).
//
//   node --test scripts/test-care-requests.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import { filterCareRequests, sortCareRequests } from "../src/data/careRequests.ts";

function request(overrides = {}) {
  return {
    id: "id",
    clientId: "client-1",
    projectId: "project-1",
    submittedBy: null,
    message: "message",
    priority: "Medium",
    status: "New",
    category: "quick_update",
    hasActiveCarePlan: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    resolvedAt: null,
    ...overrides,
  };
}

test("open requests sort before Done ones, regardless of priority", () => {
  const done = request({ id: "done-urgent", status: "Done", priority: "Urgent", createdAt: "2026-01-01T00:00:00.000Z" });
  const open = request({ id: "open-low", status: "New", priority: "Low", createdAt: "2026-01-05T00:00:00.000Z" });
  const sorted = sortCareRequests([done, open]);
  assert.deepEqual(sorted.map((r) => r.id), ["open-low", "done-urgent"]);
});

test("within the same open/done bucket, higher priority sorts first", () => {
  const low = request({ id: "low", priority: "Low" });
  const urgent = request({ id: "urgent", priority: "Urgent" });
  const medium = request({ id: "medium", priority: "Medium" });
  const high = request({ id: "high", priority: "High" });
  const sorted = sortCareRequests([low, urgent, medium, high]);
  assert.deepEqual(sorted.map((r) => r.id), ["urgent", "high", "medium", "low"]);
});

test("within the same priority, the oldest request sorts first", () => {
  const newer = request({ id: "newer", createdAt: "2026-01-05T00:00:00.000Z" });
  const older = request({ id: "older", createdAt: "2026-01-01T00:00:00.000Z" });
  const sorted = sortCareRequests([newer, older]);
  assert.deepEqual(sorted.map((r) => r.id), ["older", "newer"]);
});

test("filters combine: status, priority, and client all narrow independently", () => {
  const requests = [
    request({ id: "a", status: "New", priority: "High", clientId: "client-1" }),
    request({ id: "b", status: "Done", priority: "High", clientId: "client-1" }),
    request({ id: "c", status: "New", priority: "Low", clientId: "client-1" }),
    request({ id: "d", status: "New", priority: "High", clientId: "client-2" }),
  ];
  assert.deepEqual(
    filterCareRequests(requests, { status: "New", priority: "All", clientId: "All" }).map((r) => r.id),
    ["a", "c", "d"],
  );
  assert.deepEqual(
    filterCareRequests(requests, { status: "All", priority: "High", clientId: "All" }).map((r) => r.id),
    ["a", "b", "d"],
  );
  assert.deepEqual(
    filterCareRequests(requests, { status: "New", priority: "High", clientId: "client-1" }).map((r) => r.id),
    ["a"],
  );
  assert.deepEqual(
    filterCareRequests(requests, { status: "All", priority: "All", clientId: "All" }).map((r) => r.id),
    ["a", "b", "c", "d"],
  );
});

test("category filters requests too, and is optional (omitting it doesn't narrow anything)", () => {
  const requests = [
    request({ id: "quick", category: "quick_update" }),
    request({ id: "big", category: "new_addition" }),
  ];
  assert.deepEqual(
    filterCareRequests(requests, { status: "All", priority: "All", clientId: "All", category: "new_addition" }).map((r) => r.id),
    ["big"],
  );
  assert.deepEqual(
    filterCareRequests(requests, { status: "All", priority: "All", clientId: "All" }).map((r) => r.id),
    ["quick", "big"],
  );
  assert.deepEqual(
    filterCareRequests(requests, { status: "All", priority: "All", clientId: "All", category: "All" }).map((r) => r.id),
    ["quick", "big"],
  );
});
