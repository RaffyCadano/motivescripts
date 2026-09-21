// Tests for the Sales Dashboard selectors (src/data/salesOverview.ts).
//
//   node --test scripts/test-sales-overview.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  acceptedThisMonth,
  contractsNeedingAction,
  daysSince,
  leadStatusCounts,
  leadsPerDay,
  leadsToFollowUp,
  openProposalValueCents,
  proposalsAwaitingResponse,
} from "../src/data/salesOverview.ts";

const NOW = new Date(2026, 8, 21, 14, 0, 0); // Sep 21 2026, local

const at = (year, month, day, hour = 10) => new Date(year, month, day, hour).toISOString();

test("daysSince counts local calendar days, not 24h blocks", () => {
  assert.equal(daysSince(at(2026, 8, 21, 1), NOW), 0);
  assert.equal(daysSince(at(2026, 8, 20, 23), NOW), 1);
  assert.equal(daysSince("2026-09-14", NOW), 7);
  assert.equal(daysSince("2026-09-28", NOW), -7);
  assert.equal(daysSince("not a date", NOW), 0);
});

test("lead status counts keep pipeline order and include zeros", () => {
  const counts = leadStatusCounts([{ status: "New" }, { status: "New" }, { status: "Won" }, { status: "Lost" }]);
  assert.deepEqual(counts, [
    { status: "New", count: 2 },
    { status: "Contacted", count: 0 },
    { status: "Qualified", count: 0 },
    { status: "Proposal", count: 0 },
    { status: "Won", count: 1 },
    { status: "Lost", count: 1 },
  ]);
});

test("leads per day covers exactly N days ending today, with zero days included", () => {
  const rows = leadsPerDay(
    [{ createdAt: at(2026, 8, 21) }, { createdAt: at(2026, 8, 21, 16) }, { createdAt: at(2026, 8, 19) }, { createdAt: at(2026, 7, 1) }],
    7,
    NOW,
  );
  assert.equal(rows.length, 7);
  assert.equal(rows[6].date, "2026-09-21");
  assert.equal(rows[6].value, 2);
  assert.equal(rows[4].date, "2026-09-19");
  assert.equal(rows[4].value, 1);
  assert.equal(rows.reduce((sum, row) => sum + row.value, 0), 3); // the August lead is outside the window
});

test("follow-up leads are new, unconverted, and ordered longest-waiting first", () => {
  const rows = leadsToFollowUp(
    [
      { id: "fresh", status: "New", createdAt: at(2026, 8, 21), convertedClientId: null },
      { id: "old", status: "New", createdAt: at(2026, 8, 10), convertedClientId: null },
      { id: "contacted", status: "Contacted", createdAt: at(2026, 8, 1), convertedClientId: null },
      { id: "converted", status: "New", createdAt: at(2026, 8, 2), convertedClientId: "c1" },
    ],
    NOW,
  );
  assert.deepEqual(rows.map((row) => [row.lead.id, row.ageDays]), [["old", 11], ["fresh", 0]]);
});

test("proposals awaiting response are sent/viewed only, longest-waiting first, with expiry countdown", () => {
  const rows = proposalsAwaitingResponse(
    [
      { id: "a", effectiveStatus: "sent", sentAt: at(2026, 8, 18), validUntil: "2026-09-28", createdAt: "" },
      { id: "b", effectiveStatus: "viewed", sentAt: at(2026, 8, 11), validUntil: null, createdAt: "" },
      { id: "c", effectiveStatus: "accepted", sentAt: at(2026, 8, 1), validUntil: null, createdAt: "" },
      { id: "d", effectiveStatus: "expired", sentAt: at(2026, 7, 1), validUntil: "2026-08-15", createdAt: "" },
      { id: "e", effectiveStatus: "draft", sentAt: null, validUntil: null, createdAt: "" },
    ],
    NOW,
  );
  assert.deepEqual(rows.map((row) => row.proposal.id), ["b", "a"]);
  assert.equal(rows[0].daysSinceSent, 10);
  assert.equal(rows[1].daysUntilExpiry, 7);
  assert.equal(rows[0].daysUntilExpiry, null);
});

test("open proposal value sums only sent/viewed proposals", () => {
  const value = openProposalValueCents([
    { effectiveStatus: "sent", investmentCents: 250_000 },
    { effectiveStatus: "viewed", investmentCents: 100_000 },
    { effectiveStatus: "accepted", investmentCents: 900_000 },
    { effectiveStatus: "draft", investmentCents: 50_000 },
  ]);
  assert.equal(value, 350_000);
});

test("accepted this month only counts acceptances in the current calendar month", () => {
  const result = acceptedThisMonth(
    [
      { effectiveStatus: "accepted", acceptedAt: at(2026, 8, 3), investmentCents: 400_000 },
      { effectiveStatus: "accepted", acceptedAt: at(2026, 8, 20), investmentCents: 100_000 },
      { effectiveStatus: "accepted", acceptedAt: at(2026, 7, 28), investmentCents: 700_000 }, // August
      { effectiveStatus: "sent", acceptedAt: null, investmentCents: 300_000 },
    ],
    NOW,
  );
  assert.deepEqual(result, { count: 2, valueCents: 500_000 });
});

test("contracts: our missing signature comes first, then unanswered ones by age", () => {
  const rows = contractsNeedingAction(
    [
      { id: "wait-old", effectiveStatus: "sent", agencySigned: false, sentAt: at(2026, 8, 5), acceptedAt: null, createdAt: "" },
      { id: "wait-new", effectiveStatus: "viewed", agencySigned: false, sentAt: at(2026, 8, 19), acceptedAt: null, createdAt: "" },
      { id: "sign", effectiveStatus: "accepted", agencySigned: false, sentAt: at(2026, 8, 10), acceptedAt: at(2026, 8, 18), createdAt: "" },
      { id: "done", effectiveStatus: "accepted", agencySigned: true, sentAt: at(2026, 8, 1), acceptedAt: at(2026, 8, 2), createdAt: "" },
      { id: "draft", effectiveStatus: "draft", agencySigned: false, sentAt: null, acceptedAt: null, createdAt: "" },
    ],
    NOW,
  );
  assert.deepEqual(rows.map((row) => [row.contract.id, row.action, row.ageDays]), [
    ["sign", "needs_signature", 3],
    ["wait-old", "awaiting_client", 16],
    ["wait-new", "awaiting_client", 2],
  ]);
});
