// Client project accounts: the checklist of third-party accounts a client needs, with no password field.
//
//   node --test scripts/test-client-project-accounts.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  clientAccountDisplayName,
  clientAccountServiceLabel,
  clientAccountStatusLabel,
  sortClientProjectAccounts,
  validateClientProjectAccountDraft,
  emptyClientProjectAccountDraft,
} from "../src/data/clientProjectAccounts.ts";

const sql = readFileSync("supabase/migrations/20261122000000_client_project_accounts.sql", "utf8");

test("a row shows its label if one was given, else the plain service name", () => {
  assert.equal(clientAccountDisplayName({ service: "vercel", label: "" }), "Vercel");
  assert.equal(clientAccountDisplayName({ service: "vercel", label: "  Frontend project  " }), "Frontend project");
  assert.equal(clientAccountServiceLabel("github"), "GitHub");
  assert.equal(clientAccountStatusLabel("needs_invite"), "Needs invite");
});

test("a custom 'other' account must be named, but a known service does not need one", () => {
  assert.equal(validateClientProjectAccountDraft({ ...emptyClientProjectAccountDraft, service: "other", label: "" }), "Name this account so you know what it is.");
  assert.equal(validateClientProjectAccountDraft({ ...emptyClientProjectAccountDraft, service: "other", label: "Domain registrar" }), null);
  assert.equal(validateClientProjectAccountDraft({ ...emptyClientProjectAccountDraft, service: "vercel", loginUrl: "", username: "", label: "" }), "Add a login link, a username, or a name.");
  assert.equal(validateClientProjectAccountDraft({ ...emptyClientProjectAccountDraft, service: "vercel", username: "client@biz.com" }), null);
});

test("rows needing an invite sort to the top, then invited, then active, each group alphabetical", () => {
  const rows = [
    { id: "1", service: "email", label: "", status: "active" },
    { id: "2", service: "vercel", label: "", status: "needs_invite" },
    { id: "3", service: "github", label: "", status: "invited" },
    { id: "4", service: "domain", label: "", status: "needs_invite" },
  ];
  const sorted = sortClientProjectAccounts(rows);
  assert.deepEqual(sorted.map((r) => r.id), ["4", "2", "3", "1"]);
});

test("the table stores no password column, and only staff with projects.manage can write to it", () => {
  assert.ok(!/\bpassword\w*\s+text\b/i.test(sql), "no password column is defined");
  assert.ok(sql.includes("using (public.staff_may_project(project_id, 'projects.view'))"));
  assert.ok(sql.includes("with check (public.staff_may_project(project_id, 'projects.manage'))"));
  assert.ok(sql.includes("revoke all on public.client_project_accounts from public, anon"));
  assert.ok(!/grant[^;]*to anon/i.test(sql));
});
