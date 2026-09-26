// The client reminder emails (proposal, contract, invoice, invite, discovery, review, info request): the daily
// sweep (SQL) and the email function must agree, be locked to the service role, and never repeat a reminder.
//
//   node --test scripts/test-client-reminders.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const sql = readFileSync("supabase/migrations/20261110000000_client_reminders.sql", "utf8");
const fn = readFileSync("supabase/functions/document-email/index.ts", "utf8");
const kinds = ["proposal", "contract", "invoice", "invite", "discovery", "review", "info_request"];

test("every kind the sweep queues has a branch in the email function", () => {
  for (const kind of kinds) {
    assert.ok(sql.includes(`'${kind}'`), `sweep is missing ${kind}`);
    assert.ok(fn.includes(`remind === "${kind}"`) || (kind === "info_request" && fn.includes('remind === "info_request"')), `email function is missing ${kind}`);
  }
  assert.ok(sql.includes("'kind', 'client_reminder'"));
  assert.match(fn, /body\.kind !== "client_reminder"/);
});

test("client_reminder is service-role only", () => {
  const guard = fn.slice(fn.indexOf('body.kind === "payment" ||'), fn.indexOf("if (!isServiceRole)"));
  assert.ok(guard.includes('body.kind === "client_reminder"'));
});

test("a reminder is never repeated, never goes back a stage, and is spaced out", () => {
  assert.ok(sql.includes("l.stage >= cand.stage"));
  assert.ok(sql.includes("interval '2 days'"));
  assert.ok(sql.includes("primary key (kind, entity_id, stage)"));
});

test("only Active clients, live items and unpaid non-recurring invoices are reminded", () => {
  assert.ok((sql.match(/c\.status = 'Active'/g) ?? []).length >= 7);
  assert.ok(sql.includes("i.service_plan_id is null"));
  assert.ok(sql.includes("i.amount_due_cents > 0"));
  assert.ok(sql.includes("inv.status = 'pending'"));
  assert.ok(sql.includes("not pr.archived"));
});

test("the email function skips an item that was dealt with after the reminder was queued", () => {
  assert.ok((fn.match(/skipped: "not_waiting"/g) ?? []).length >= 6);
});

test("every automated client email is logged for staff, with the provider's message id", () => {
  const log = readFileSync("supabase/migrations/20261111000000_client_email_log.sql", "utf8");
  assert.ok(log.includes("provider_id text"));
  assert.ok(log.includes("staff_may_client(client_id, 'clients.view')"));
  assert.ok(!/grant[^;]*insert[^;]*to authenticated/i.test(log));
  for (const kind of ["invoice_overdue", "scope_reminder", "launch_trial", "reminder_${remind}"]) {
    assert.ok(fn.includes(kind), `${kind} is not logged`);
  }
  assert.ok((fn.match(/await sendLogged\(/g) ?? []).length >= 5);
  assert.ok(fn.includes("return typeof sentBody?.id"));
});
