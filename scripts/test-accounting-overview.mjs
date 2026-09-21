// Tests for the Accounting Dashboard selectors (src/data/accountingOverview.ts).
//
//   node --test scripts/test-accounting-overview.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  collectedPerDay,
  collectedThisMonth,
  draftInvoices,
  invoiceStatusCounts,
  invoicesDueSoon,
  outstandingByClient,
  overdueInvoices,
  recentPayments,
} from "../src/data/accountingOverview.ts";

const NOW = new Date(2026, 8, 21, 14, 0, 0); // Sep 21 2026, local
const pay = (over) => ({ id: "p", invoiceId: "i", amountCents: 10_000, paymentDate: "2026-09-21", method: "stripe", reversedAt: null, ...over });

test("invoice status counts keep workflow order, include zeros, and skip cancelled", () => {
  const counts = invoiceStatusCounts([
    { effectiveStatus: "paid" },
    { effectiveStatus: "paid" },
    { effectiveStatus: "overdue" },
    { effectiveStatus: "draft" },
    { effectiveStatus: "cancelled" },
  ]);
  assert.deepEqual(counts.map((row) => [row.status, row.count]), [
    ["draft", 1],
    ["sent", 0],
    ["viewed", 0],
    ["partially_paid", 0],
    ["overdue", 1],
    ["paid", 2],
  ]);
  assert.equal(counts[3].label, "Part paid");
});

test("collected per day covers N days ending today, adds same-day payments, and ignores reversed ones", () => {
  const rows = collectedPerDay(
    [
      pay({ id: "a", amountCents: 50_000, paymentDate: "2026-09-21" }),
      pay({ id: "b", amountCents: 25_000, paymentDate: "2026-09-21T09:30:00" }),
      pay({ id: "c", amountCents: 99_900, paymentDate: "2026-09-20", reversedAt: "2026-09-20T12:00:00Z" }),
      pay({ id: "d", amountCents: 10_000, paymentDate: "2026-09-18" }),
      pay({ id: "old", amountCents: 70_000, paymentDate: "2026-01-01" }),
    ],
    7,
    NOW,
  );
  assert.equal(rows.length, 7);
  assert.equal(rows[6].date, "2026-09-21");
  assert.equal(rows[6].value, 75_000);
  assert.equal(rows[5].value, 0); // the only payment on the 20th was reversed
  assert.equal(rows[3].value, 10_000);
  assert.equal(rows.reduce((sum, row) => sum + row.value, 0), 85_000);
});

test("collected this month counts only this calendar month's non-reversed payments", () => {
  const total = collectedThisMonth(
    [
      pay({ amountCents: 40_000, paymentDate: "2026-09-02" }),
      pay({ amountCents: 10_000, paymentDate: "2026-09-21" }),
      pay({ amountCents: 90_000, paymentDate: "2026-08-31" }),
      pay({ amountCents: 30_000, paymentDate: "2026-09-10", reversedAt: "2026-09-11T00:00:00Z" }),
    ],
    NOW,
  );
  assert.equal(total, 50_000);
});

test("overdue invoices are most-overdue first and never show less than 1 day", () => {
  const rows = overdueInvoices(
    [
      { id: "a", effectiveStatus: "overdue", amountDueCents: 1, dueDate: "2026-09-10" },
      { id: "b", effectiveStatus: "overdue", amountDueCents: 1, dueDate: "2026-08-30" },
      { id: "c", effectiveStatus: "overdue", amountDueCents: 1, dueDate: "2026-09-21" },
      { id: "d", effectiveStatus: "sent", amountDueCents: 1, dueDate: "2026-09-01" },
    ],
    NOW,
  );
  assert.deepEqual(rows.map((row) => [row.invoice.id, row.daysOverdue]), [["b", 22], ["a", 11], ["c", 1]]);
});

test("due soon: awaiting-payment invoices due today through 6 days out, soonest first, never overdue ones", () => {
  const rows = invoicesDueSoon(
    [
      { id: "later", effectiveStatus: "sent", amountDueCents: 1, dueDate: "2026-09-27" }, // in 6 days: included
      { id: "today", effectiveStatus: "viewed", amountDueCents: 1, dueDate: "2026-09-21" },
      { id: "tooFar", effectiveStatus: "sent", amountDueCents: 1, dueDate: "2026-09-28" }, // in 7 days: excluded
      { id: "part", effectiveStatus: "partially_paid", amountDueCents: 1, dueDate: "2026-09-23" },
      { id: "overdue", effectiveStatus: "overdue", amountDueCents: 1, dueDate: "2026-09-20" },
      { id: "draft", effectiveStatus: "draft", amountDueCents: 1, dueDate: "2026-09-22" },
      { id: "paid", effectiveStatus: "paid", amountDueCents: 0, dueDate: "2026-09-22" },
    ],
    7,
    NOW,
  );
  assert.deepEqual(rows.map((row) => [row.invoice.id, row.daysUntilDue]), [["today", 0], ["part", 2], ["later", 6]]);
});

test("drafts are listed oldest first", () => {
  const rows = draftInvoices([
    { id: "new", effectiveStatus: "draft", createdAt: "2026-09-20T00:00:00Z" },
    { id: "old", effectiveStatus: "draft", createdAt: "2026-08-01T00:00:00Z" },
    { id: "sent", effectiveStatus: "sent", createdAt: "2026-07-01T00:00:00Z" },
  ]);
  assert.deepEqual(rows.map((row) => row.id), ["old", "new"]);
});

test("outstanding by client sums what is owed per client, largest first, and skips drafts, paid and cancelled", () => {
  const rows = outstandingByClient(
    [
      { clientId: "a", effectiveStatus: "sent", amountDueCents: 100_000 },
      { clientId: "a", effectiveStatus: "overdue", amountDueCents: 50_000 },
      { clientId: "b", effectiveStatus: "partially_paid", amountDueCents: 200_000 },
      { clientId: "c", effectiveStatus: "draft", amountDueCents: 900_000 },
      { clientId: "d", effectiveStatus: "paid", amountDueCents: 0 },
      { clientId: "e", effectiveStatus: "cancelled", amountDueCents: 700_000 },
    ],
    5,
  );
  assert.deepEqual(rows, [
    { clientId: "b", amountDueCents: 200_000, invoiceCount: 1 },
    { clientId: "a", amountDueCents: 150_000, invoiceCount: 2 },
  ]);
});

test("recent payments are newest first and exclude reversed ones", () => {
  const rows = recentPayments(
    [
      pay({ id: "old", paymentDate: "2026-09-01" }),
      pay({ id: "new", paymentDate: "2026-09-20" }),
      pay({ id: "reversed", paymentDate: "2026-09-21", reversedAt: "2026-09-21T00:00:00Z" }),
    ],
    5,
  );
  assert.deepEqual(rows.map((row) => row.id), ["new", "old"]);
});
