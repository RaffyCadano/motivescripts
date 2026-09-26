// Admin account deletion: the guards in the SQL, the readable errors in the app, and the settings notes.
//
//   node --test scripts/test-admin-accounts.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { accountRoleLabel, deleteAccountErrorMessage } from "../src/data/accounts.ts";

const sql = readFileSync("supabase/migrations/20261115000000_admin_accounts.sql", "utf8");

test("only admins can list or delete accounts", () => {
  assert.equal((sql.match(/if not public\.is_admin\(\) then/g) ?? []).length, 2);
  assert.ok(sql.includes("revoke all on function public.admin_delete_account(uuid, text) from public, anon"));
  assert.ok(!/grant execute[^;]*to anon/i.test(sql));
});

test("every refusal the database can raise has its own readable message", () => {
  for (const code of ["CONFIRMATION_REQUIRED", "CANNOT_DELETE_SELF", "LAST_ADMIN", "ACTIVE_PLAN", "HAS_RECORDS", "NOT_FOUND"]) {
    assert.ok(sql.includes(`'${code}'`), `${code} is not raised`);
    assert.notEqual(deleteAccountErrorMessage(`P0001: ${code}`), "Unable to delete this account.", code);
  }
  assert.equal(deleteAccountErrorMessage("something else"), "Unable to delete this account.");
  assert.equal(deleteAccountErrorMessage(undefined), "Unable to delete this account.");
});

test("the deletion is recorded before it happens, and only admins can read the record", () => {
  assert.ok(sql.indexOf("insert into public.account_deletions") < sql.indexOf("delete from auth.users"));
  assert.ok(sql.includes("for select to authenticated using (public.is_admin())"));
});

test("roles read as people say them", () => {
  assert.equal(accountRoleLabel({ role: "client", templateKey: null }), "Client");
  assert.equal(accountRoleLabel({ role: "admin", templateKey: "admin" }), "Admin");
  assert.equal(accountRoleLabel({ role: "staff", templateKey: "developer" }), "Developer");
  assert.equal(accountRoleLabel({ role: "staff", templateKey: "project_manager" }), "Project Manager");
  assert.equal(accountRoleLabel({ role: "staff", templateKey: null }), "Staff");
});

test("the Accounts page is admin-only in the nav and the client and staff settings explain how to delete an account", () => {
  const nav = readFileSync("src/data/adminNav.ts", "utf8");
  assert.ok(nav.includes('"/admin/accounts": "admin"'));
  const security = readFileSync("src/components/settings/AccountSecuritySection.tsx", "utf8");
  assert.ok(security.includes("please cancel your MotiveScripts subscription first"));
  assert.ok(security.includes("contact MotiveScripts"));
  assert.ok(security.includes("contact a MotiveScripts administrator"));
});
