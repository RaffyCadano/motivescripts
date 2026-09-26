// The scope-reminder emails: the daily sweep (SQL) and the email function must agree on the kind, be locked to
// the service role, and stop after three reminders.
//
//   node --test scripts/test-scope-reminders.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const sql = readFileSync("supabase/migrations/20261109000000_scope_reminders.sql", "utf8");
const fn = readFileSync("supabase/functions/document-email/index.ts", "utf8");

test("the sweep sends the scope_reminder kind the email function accepts, with the stage as a string", () => {
  assert.ok(sql.includes("'kind', 'scope_reminder'"));
  assert.ok(sql.includes("(r.scope_reminders_sent + 1)::text"));
  assert.match(fn, /body\.kind !== "scope_reminder"/);
});

test("scope_reminder is service-role only, like the other cron-driven emails", () => {
  const guard = fn.slice(fn.indexOf('body.kind === "payment" ||'), fn.indexOf("if (!isServiceRole)"));
  assert.ok(guard.includes('body.kind === "scope_reminder"'));
});

test("three reminders at 2, 5 and 10 days, never back to back, and none once a scope or project exists", () => {
  assert.ok(sql.includes("scope_reminders_sent < 3"));
  assert.ok(sql.includes("array[2, 5, 10]"));
  assert.ok(sql.includes("interval '3 days'"));
  assert.ok(sql.includes("submitted_at is not null"));
  assert.ok(sql.includes("public.projects pr"));
  assert.ok(sql.includes("c.status = 'Active'"));
});

test("the third email is worded as the last reminder and links to the scope page", () => {
  assert.ok(fn.includes("Last reminder: complete your Website Scope"));
  assert.ok(fn.includes("/client/scope"));
});
