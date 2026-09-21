// Tests for the per-person payroll & hours selectors (src/data/staffPayrollOverview.ts).
//
//   node --test scripts/test-staff-payroll-overview.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  hoursByProjectRows,
  hoursLoggedThisMonth,
  recentEntries,
  recentPayments,
  totalPaidCents,
  unpaidOwed,
} from "../src/data/staffPayrollOverview.ts";

const NOW = new Date(2026, 8, 21, 14, 0, 0); // Sep 21 2026
const entry = (over) => ({ id: "e", projectId: "p1", taskId: null, staffId: "u", entryDate: "2026-09-21", hours: 1, note: "", billedAt: null, invoiceId: null, payrollPaidAt: null, createdAt: "2026-09-21T10:00:00Z", ...over });

test("hours this month counts only the current calendar month", () => {
  const hours = hoursLoggedThisMonth(
    [entry({ entryDate: "2026-09-01", hours: 2.5 }), entry({ entryDate: "2026-09-21", hours: 1.25 }), entry({ entryDate: "2026-08-31", hours: 8 })],
    NOW,
  );
  assert.equal(hours, 3.75);
});

test("hours by project splits total and unpaid, applies overrides, and sorts by unpaid then total", () => {
  const rows = hoursByProjectRows(
    [
      entry({ projectId: "a", hours: 4, payrollPaidAt: "2026-09-10T00:00:00Z" }),
      entry({ projectId: "a", hours: 2 }),
      entry({ projectId: "b", hours: 5, payrollPaidAt: "2026-09-10T00:00:00Z" }),
      entry({ projectId: "c", hours: 3 }),
    ],
    5000,
    new Map([["c", 7000]]),
  );
  assert.deepEqual(rows.map((row) => [row.projectId, row.hours, row.unpaidHours, row.rateCents, row.hasOverride]), [
    ["c", 3, 3, 7000, true],
    ["a", 6, 2, 5000, false],
    ["b", 5, 0, 5000, false],
  ]);
});

test("owed is priced per project: override rate where set, default rate otherwise", () => {
  const owed = unpaidOwed(
    [entry({ projectId: "a", hours: 2 }), entry({ projectId: "c", hours: 3 }), entry({ projectId: "a", hours: 9, payrollPaidAt: "2026-09-01T00:00:00Z" })],
    5000,
    new Map([["c", 7000]]),
  );
  assert.deepEqual(owed, { hours: 5, amountCents: 2 * 5000 + 3 * 7000 });
});

test("owed is null when unpaid hours exist on a project with no rate at all", () => {
  const owed = unpaidOwed([entry({ projectId: "a", hours: 2 })], null, new Map());
  assert.deepEqual(owed, { hours: 2, amountCents: null });
  // ...but an override alone is enough to price that project
  assert.deepEqual(unpaidOwed([entry({ projectId: "a", hours: 2 })], null, new Map([["a", 6000]])), { hours: 2, amountCents: 12000 });
});

test("nothing unpaid means nothing owed, even with no rate set", () => {
  assert.deepEqual(unpaidOwed([entry({ hours: 3, payrollPaidAt: "2026-09-01T00:00:00Z" })], null, new Map()), { hours: 0, amountCents: 0 });
  assert.deepEqual(unpaidOwed([], null, new Map()), { hours: 0, amountCents: 0 });
});

test("fractional hours are priced without floating-point drift", () => {
  const owed = unpaidOwed([entry({ hours: 0.1 }), entry({ hours: 0.2 })], 4500, new Map());
  assert.equal(owed.hours, 0.3);
  assert.equal(owed.amountCents, 1350);
});

test("total paid sums payment amounts", () => {
  assert.equal(totalPaidCents([{ amountCents: 22500 }, { amountCents: 10000 }]), 32500);
  assert.equal(totalPaidCents([]), 0);
});

test("recent entries and payments are newest first and capped", () => {
  const entries = recentEntries(
    [
      entry({ id: "old", entryDate: "2026-09-01" }),
      entry({ id: "new-late", entryDate: "2026-09-20", createdAt: "2026-09-20T18:00:00Z" }),
      entry({ id: "new-early", entryDate: "2026-09-20", createdAt: "2026-09-20T08:00:00Z" }),
    ],
    2,
  );
  assert.deepEqual(entries.map((item) => item.id), ["new-late", "new-early"]);
  const payments = recentPayments(
    [
      { id: "a", paymentDate: "2026-08-01", createdAt: "2026-08-01T00:00:00Z" },
      { id: "b", paymentDate: "2026-09-05", createdAt: "2026-09-05T00:00:00Z" },
    ],
    5,
  );
  assert.deepEqual(payments.map((item) => item.id), ["b", "a"]);
});
