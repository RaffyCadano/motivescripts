// Email copies of staff alerts: the type-to-group mapping (SQL), the four switch groups (TypeScript and the
// preferences table) and the email function must agree, and only team members are ever emailed from this path.
//
//   node --test scripts/test-staff-email-alerts.mjs
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { emailAlertCategories, applyEmailAlertRows, defaultEmailAlertPreferences } from "../src/data/emailAlertPreferences.ts";

const sql = readFileSync("supabase/migrations/20261112000000_staff_email_alerts.sql", "utf8");
const fn = readFileSync("supabase/functions/document-email/index.ts", "utf8");

const mapping = [...sql.matchAll(/when '([a-z_]+)' then '([a-z_]+)'/g)].map((m) => ({ type: m[1], category: m[2] }));

const dir = "supabase/migrations";
const latestTypeSql = readdirSync(dir)
  .filter((n) => n.endsWith(".sql"))
  .sort()
  .reverse()
  .map((n) => readFileSync(`${dir}/${n}`, "utf8"))
  .find((s) => /add constraint notifications_type_check/i.test(s));
const allowedTypes = new Set([...latestTypeSql.slice(latestTypeSql.search(/add constraint notifications_type_check/i)).split("]));")[0].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]));

test("every emailed type is a real notification type, in one of the four groups", () => {
  assert.ok(mapping.length >= 25, `parsed ${mapping.length} mappings`);
  const groups = new Set(emailAlertCategories.map((c) => c.key));
  for (const { type, category } of mapping) {
    assert.ok(allowedTypes.has(type), `${type} is not a notification type`);
    assert.ok(groups.has(category), `${type} maps to unknown group ${category}`);
  }
  for (const group of groups) assert.ok(mapping.some((m) => m.category === group), `nothing is emailed in ${group}`);
});

test("the requested alerts are all emailed", () => {
  const emailed = new Set(mapping.map((m) => m.type));
  for (const type of [
    "proposal_accepted", "contract_accepted", "invoice_paid", "payment_received",
    "feedback_received", "changes_requested", "version_approved", "care_request_submitted", "task_response_submitted",
    "website_down", "website_slow", "backup_failed", "website_paused", "domain_expiring_soon", "domain_expired", "ssl_expiring_soon", "ssl_expired",
    "task_assigned", "task_due_soon", "task_overdue", "qa_failed", "qa_passed", "payroll_paid",
  ]) {
    assert.ok(emailed.has(type), `${type} is not emailed`);
  }
  // messages already have their own email; the bell-only chatter stays bell-only
  assert.ok(!emailed.has("new_message"));
  assert.ok(!emailed.has("project_update"));
});

test("the switch groups match the preferences table and default to on", () => {
  const check = sql.match(/category in \(([^)]*)\)/)[1];
  for (const { key } of emailAlertCategories) assert.ok(check.includes(`'${key}'`), key);
  assert.deepEqual(Object.values(defaultEmailAlertPreferences()), [true, true, true, true]);
  assert.equal(applyEmailAlertRows([{ category: "money", enabled: false }, { category: "bogus", enabled: false }]).money, false);
  assert.equal(applyEmailAlertRows([{ category: "bogus", enabled: false }]).site_alerts, true);
});

test("the trigger only emails admins and staff, never blocks the notification, and the function is service-role only", () => {
  assert.ok(sql.includes("p.role in ('admin', 'staff')"));
  assert.ok(sql.includes("exception when others then"));
  assert.ok(sql.includes("'kind', 'staff_notification'"));
  const guard = fn.slice(fn.indexOf('body.kind === "payment" ||'), fn.indexOf("if (!isServiceRole)"));
  assert.ok(guard.includes('body.kind === "staff_notification"'));
});

test("the function honours the switch, skips inactive staff, and throttles repeating reminders to one a week", () => {
  const branch = fn.slice(fn.indexOf('body.kind === "staff_notification") {'));
  assert.ok(branch.includes('skipped: "switched_off"'));
  assert.ok(branch.includes('skipped: "inactive"'));
  assert.ok(branch.includes('skipped: "throttled"'));
  for (const t of ["task_overdue", "domain_expired", "ssl_expired"]) assert.ok(branch.includes(`"${t}"`), t);
  assert.ok(branch.includes("7 * 24 * 60 * 60 * 1000"));
});

test("admins can read the staff email log (and only admins, besides the person themselves)", () => {
  const policy = readFileSync("supabase/migrations/20261113000000_staff_email_log_admin_read.sql", "utf8");
  assert.ok(policy.includes("for select to authenticated"));
  assert.ok(policy.includes("public.is_admin()"));
  assert.ok(!/for (insert|update|delete|all)/i.test(policy));
});
