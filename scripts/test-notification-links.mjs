// Every notification type the database allows must have its own link in notificationHref() and a place in the
// NotificationType union, so a new type can never silently fall through to the Messages page.
//
//   node --test scripts/test-notification-links.mjs
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";

const dir = "supabase/migrations";
const latest = readdirSync(dir)
  .filter((name) => name.endsWith(".sql"))
  .sort()
  .reverse()
  .map((name) => readFileSync(`${dir}/${name}`, "utf8"))
  .find((sql) => /add constraint notifications_type_check/i.test(sql));
assert.ok(latest, "a migration that defines notifications_type_check");
const block = latest.slice(latest.search(/add constraint notifications_type_check/i));
const types = [...block.slice(0, block.indexOf("]));")).matchAll(/'([a-z_]+)'/g)].map((match) => match[1]);

const messaging = readFileSync("src/data/messaging.ts", "utf8");
const database = readFileSync("src/types/database.ts", "utf8");

test("the latest type constraint was parsed", () => {
  assert.ok(types.length > 40, `parsed ${types.length} types`);
  assert.ok(types.includes("website_paused"));
});

for (const type of types) {
  test(`notification type ${type} has a link and is in the TypeScript union`, () => {
    assert.ok(messaging.includes(`case "${type}":`), `notificationHref has no case for ${type}`);
    assert.ok(database.includes(`| "${type}"`), `NotificationType lacks ${type}`);
  });
}

test("notification links to deletable records cascade or clear, so deleting a project or file never fails", () => {
  const sql = readFileSync(`${dir}/20261108000000_notification_audit_fixes.sql`, "utf8").replace(/\s+/g, " ");
  const tables = { deliverable_id: "deliverables", proposal_id: "proposals", contract_id: "contracts", invoice_id: "invoices", message_id: "messages", conversation_id: "conversations" };
  for (const [column, table] of Object.entries(tables)) {
    assert.ok(sql.includes(`foreign key (${column}) references public.${table} (id) on delete cascade`), column);
  }
  assert.ok(sql.includes("foreign key (project_id) references public.projects (id) on delete set null"));
  assert.ok(sql.includes("purge-old-notifications"));
});
