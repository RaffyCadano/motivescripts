// Tests for the Content Writer Dashboard selectors (src/data/contentWriterOverview.ts).
//
//   node --test scripts/test-content-writer-overview.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  contentFilesFor,
  copyPageFor,
  copyPipeline,
  copyProgress,
  isCopyTask,
} from "../src/data/contentWriterOverview.ts";

test("a task recommended for the content writer is a copy task", () => {
  assert.equal(isCopyTask({ title: "Prepare contact information", recommendedRole: "content_writer" }), true);
  assert.equal(isCopyTask({ title: "Write homepage copy", recommendedRole: "designer" }), false);
  assert.equal(isCopyTask({ title: "Build homepage", recommendedRole: "developer" }), false);
});

test("older tasks without a recommended role are recognised by their 'Write <page> copy' title", () => {
  assert.equal(isCopyTask({ title: "Write Services page copy", recommendedRole: null }), true);
  assert.equal(isCopyTask({ title: "Write the About copy", recommendedRole: null }), true);
  assert.equal(isCopyTask({ title: "Build homepage", recommendedRole: null }), false);
});

test("copy progress counts only copy tasks, and total 0 is never a fake 100%", () => {
  const project = {
    tasks: [
      { title: "Write homepage copy", recommendedRole: "content_writer", status: "Completed" },
      { title: "Write Services page copy", recommendedRole: "content_writer", status: "In Progress" },
      { title: "Design homepage", recommendedRole: "designer", status: "Completed" },
      { title: "Build homepage", recommendedRole: "developer", status: "Completed" },
    ],
  };
  assert.deepEqual(copyProgress(project), { total: 2, completed: 1 });
  assert.deepEqual(copyProgress({ tasks: [{ title: "Build homepage", recommendedRole: "developer", status: "Completed" }] }), {
    total: 0,
    completed: 0,
  });
});

test("the page name comes from 'Write <page> copy' titles and is null for other content tasks", () => {
  assert.equal(copyPageFor({ title: "Write Services page copy" }), "Services page");
  assert.equal(copyPageFor({ title: "Write homepage copy" }), "homepage");
  assert.equal(copyPageFor({ title: "Prepare contact information" }), null);
  assert.equal(copyPageFor({ title: "Migrate approved content" }), null);
});

test("pipeline lists only copy tasks: open work first, then by earliest due date, completed last", () => {
  const cw = "content_writer";
  const rows = copyPipeline([
    { title: "a-done", recommendedRole: cw, status: "Completed", dueDate: "2026-09-01" },
    { title: "b-todo-late", recommendedRole: cw, status: "Todo", dueDate: "2026-09-30" },
    { title: "c-todo-none", recommendedRole: cw, status: "Todo", dueDate: "" },
    { title: "d-progress", recommendedRole: cw, status: "In Progress", dueDate: "2026-09-25" },
    { title: "e-todo-soon", recommendedRole: cw, status: "Todo", dueDate: "2026-09-22" },
    { title: "f-review", recommendedRole: cw, status: "In Review", dueDate: "2026-09-23" },
    { title: "g-not-copy", recommendedRole: "developer", status: "In Progress", dueDate: "2026-09-20" },
  ]);
  assert.deepEqual(
    rows.map((row) => row.title),
    ["d-progress", "f-review", "e-todo-soon", "b-todo-late", "c-todo-none", "a-done"],
  );
});

test("content files are Content or Document files on the writer's projects, excluding archived", () => {
  const files = [
    { id: 1, category: "Content", projectId: "mine", status: "Approved" },
    { id: 2, category: "Document", projectId: "mine", status: "Needs Changes" },
    { id: 3, category: "Design", projectId: "mine", status: "Approved" },
    { id: 4, category: "Content", projectId: "mine", status: "Archived" },
    { id: 5, category: "Content", projectId: "someone-elses", status: "Draft" },
  ];
  assert.deepEqual(contentFilesFor(files, new Set(["mine"])).map((item) => item.id), [1, 2]);
});
