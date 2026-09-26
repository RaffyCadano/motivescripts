// Deleting a client and everything: the guards and the order in the SQL, the file-removal function, and the
// wording on the confirmation screen.
//
//   node --test scripts/test-client-deletion.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { deleteClientErrorMessage, deletionSummaryLines } from "../src/data/clientDeletion.ts";

const sql = readFileSync("supabase/migrations/20261116000000_admin_delete_client.sql", "utf8");
const fn = readFileSync("supabase/functions/admin-client-files/index.ts", "utf8");
const repo = readFileSync("src/data/clientDeletionRepository.ts", "utf8");

test("only admins can preview, check or delete, and no one but the service role can list the stored files", () => {
  assert.ok((sql.match(/if not public\.is_admin\(\) then/g) ?? []).length >= 3);
  assert.ok(sql.includes("revoke all on function public.admin_client_storage_paths(uuid) from public, anon, authenticated"));
  assert.ok(sql.includes("grant execute on function public.admin_client_storage_paths(uuid) to service_role"));
  assert.ok(!/grant execute[^;]*to anon/i.test(sql));
});

test("every refusal is raised by the check, and the delete runs the same check first", () => {
  for (const code of ["CONFIRMATION_REQUIRED", "ACTIVE_PLAN", "WEBSITE_LIVE", "NOT_FOUND"]) {
    assert.ok(sql.includes(`'${code}'`), `${code} is not raised`);
    assert.notEqual(deleteClientErrorMessage(`P0001: ${code}`), "Unable to delete this client.", code);
  }
  assert.ok(sql.includes("perform public.admin_client_delete_check(p_client_id, p_confirmation, p_leave_website_live)"));
});

test("child records go before their parents, so no foreign key can block the delete", () => {
  const order = [
    "delete from public.messages",
    "delete from public.conversations",
    "delete from public.payments",
    "delete from public.invoices",
    "delete from public.contract_revisions",
    "delete from public.contracts",
    "delete from public.proposal_revisions",
    "delete from public.proposals",
    "delete from public.file_versions",
    "delete from public.deliverables",
    "delete from public.tasks",
    "delete from public.projects",
    "delete from auth.users",
    "delete from public.clients",
  ].map((statement) => sql.indexOf(statement));
  assert.ok(order.every((index) => index > 0), "a delete statement is missing");
  assert.deepEqual([...order].sort((a, b) => a - b), order);
});

test("the deletion is recorded, and only admins can read the record", () => {
  assert.ok(sql.includes("insert into public.client_deletions"));
  assert.ok(sql.includes("for select to authenticated using (public.is_admin())"));
});

test("files are removed only after every guard passes, by an admin, and the records are deleted only if the files went", () => {
  assert.ok(fn.indexOf("rpc(\"admin_client_delete_check\"") < fn.indexOf("rpc(\"admin_client_storage_paths\""));
  assert.ok(fn.includes('rpc("is_admin")'));
  assert.ok(fn.includes("failed === 0"));
  assert.ok(repo.indexOf("admin-client-files") < repo.indexOf("admin_delete_client"));
  assert.ok(repo.includes("if (!files?.ok)"));
});

test("the confirmation lists what goes, with counts, and leaves out what the client does not have", () => {
  const lines = deletionSummaryLines({
    businessName: "Bravo", projects: 2, tasks: 14, files: 6, storedFiles: 8, proposals: 1, contracts: 0, invoices: 3, paidCents: 250000,
    conversations: 0, timeEntries: 9, careRequests: 0, portalAccounts: 2, hasActivePlan: false, liveWebsites: [],
  });
  assert.deepEqual(lines, [
    "2 projects, with 14 tasks",
    "6 file versions and 8 stored files",
    "1 proposal",
    "3 invoices and their payment records, $2,500.00 paid",
    "9 logged time entries",
    "2 portal logins (they will no longer be able to sign in)",
  ]);
  assert.deepEqual(
    deletionSummaryLines({ businessName: "x", projects: 0, tasks: 0, files: 0, storedFiles: 0, proposals: 0, contracts: 0, invoices: 0, paidCents: 0, conversations: 0, timeEntries: 0, careRequests: 0, portalAccounts: 0, hasActivePlan: false, liveWebsites: [] }),
    [],
  );
});
