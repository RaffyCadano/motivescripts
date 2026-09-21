// Tests for the Designer Dashboard selectors (src/data/designerOverview.ts).
//
//   node --test scripts/test-designer-overview.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  checkpointRows,
  deliverableStatusCounts,
  designPhaseProgress,
  openFeedbackFor,
} from "../src/data/designerOverview.ts";

test("design progress counts only tasks under the Design milestone (name or alias match)", () => {
  const project = {
    milestones: [
      { id: "m-disc", name: "Discovery" },
      { id: "m-design", name: "Design" },
      { id: "m-dev", name: "Development" },
    ],
    tasks: [
      { id: "t1", milestoneId: "m-design", status: "Completed" },
      { id: "t2", milestoneId: "m-design", status: "In Progress" },
      { id: "t3", milestoneId: "m-design", status: "Completed" },
      { id: "t4", milestoneId: "m-dev", status: "Completed" },
      { id: "t5", milestoneId: "m-disc", status: "Todo" },
    ],
  };
  assert.deepEqual(designPhaseProgress(project), { total: 3, completed: 2 });
});

test("no design tasks means total 0, never a fake 100%", () => {
  const empty = designPhaseProgress({ milestones: [{ id: "m1", name: "Design" }], tasks: [] });
  assert.deepEqual(empty, { total: 0, completed: 0 });
  const noMilestone = designPhaseProgress({ milestones: [], tasks: [{ id: "t", milestoneId: "x", status: "Completed" }] });
  assert.equal(noMilestone.total, 0);
});

test("file status counts keep a stable order, include zeros, and skip Archived", () => {
  const counts = deliverableStatusCounts([
    { status: "Approved" },
    { status: "Approved" },
    { status: "Needs Changes" },
    { status: "Archived" },
    { status: "Draft" },
  ]);
  assert.deepEqual(counts, [
    { status: "Draft", count: 1 },
    { status: "In Review", count: 0 },
    { status: "Needs Changes", count: 1 },
    { status: "Approved", count: 2 },
  ]);
});

test("checkpoints: Not uploaded when nothing is tagged", () => {
  const rows = checkpointRows([]);
  assert.deepEqual(rows.map((row) => row.checkpoint), ["initial_concept", "logo_brand", "overall_design", "final_website"]);
  assert.ok(rows.every((row) => row.state === "Not uploaded" && row.deliverableId === null));
});

test("checkpoint is Approved when ANY non-archived deliverable with it is Approved (server rule)", () => {
  const rows = checkpointRows([
    { id: "a", status: "Needs Changes", designCheckpoint: "overall_design", updatedAt: "2026-09-10T00:00:00Z" },
    { id: "b", status: "Approved", designCheckpoint: "overall_design", updatedAt: "2026-09-01T00:00:00Z" },
  ]);
  const overall = rows.find((row) => row.checkpoint === "overall_design");
  assert.equal(overall.state, "Approved");
  assert.equal(overall.deliverableId, "b");
});

test("otherwise the most recently updated non-archived deliverable decides, archived ones are ignored", () => {
  const rows = checkpointRows([
    { id: "old", status: "In Review", designCheckpoint: "logo_brand", updatedAt: "2026-09-01T00:00:00Z" },
    { id: "new", status: "Needs Changes", designCheckpoint: "logo_brand", updatedAt: "2026-09-12T00:00:00Z" },
    { id: "gone", status: "Archived", designCheckpoint: "logo_brand", updatedAt: "2026-09-20T00:00:00Z" },
    { id: "other", status: "Approved", designCheckpoint: null, updatedAt: "2026-09-20T00:00:00Z" },
  ]);
  const brand = rows.find((row) => row.checkpoint === "logo_brand");
  assert.equal(brand.state, "Needs Changes");
  assert.equal(brand.deliverableId, "new");
  assert.equal(rows.find((row) => row.checkpoint === "final_website").state, "Not uploaded");
});

test("open feedback keeps only unresolved items on the designer's own projects", () => {
  const feedback = [
    { id: 1, status: "Open", projectId: "mine" },
    { id: 2, status: "Resolved", projectId: "mine" },
    { id: 3, status: "Open", projectId: "someone-elses" },
  ];
  assert.deepEqual(openFeedbackFor(feedback, new Set(["mine"])).map((item) => item.id), [1]);
});
