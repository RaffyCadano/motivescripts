// Tests for the client portal's plan-offer helper (src/data/clientPlanOffer.ts).
//
//   node --test scripts/test-client-plan-offer.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import { clientCancelMode, hasNoOpenPlans, planOfferState, scheduledEnd } from "../src/data/clientPlanOffer.ts";
import { adminCancelOptions } from "../src/data/servicePlans.ts";

const plan = (over) => ({ id: "p1", planType: "care", projectId: "proj", status: "pending", ...over });

test("with no plans, every plan is available to choose", () => {
  assert.deepEqual(planOfferState("care", "proj", []), { kind: "available" });
});

test("a plan waiting on checkout offers to continue it", () => {
  assert.deepEqual(planOfferState("care", "proj", [plan({ id: "abc", status: "pending" })]), { kind: "pending", planId: "abc" });
});

test("an active or past-due plan is already theirs, and wins over a leftover pending one", () => {
  assert.deepEqual(planOfferState("care", "proj", [plan({ status: "active" })]), { kind: "subscribed", status: "active" });
  assert.deepEqual(planOfferState("care", "proj", [plan({ status: "past_due" })]), { kind: "subscribed", status: "past_due" });
  assert.deepEqual(planOfferState("care", "proj", [plan({ id: "old", status: "pending" }), plan({ id: "live", status: "active" })]), {
    kind: "subscribed",
    status: "active",
  });
});

test("a canceled plan can be chosen again", () => {
  assert.deepEqual(planOfferState("care", "proj", [plan({ status: "canceled" })]), { kind: "available" });
});

test("plans of other types or on other projects do not count", () => {
  assert.deepEqual(planOfferState("care", "proj", [plan({ planType: "hosting", status: "active" })]), { kind: "available" });
  assert.deepEqual(planOfferState("care", "proj", [plan({ projectId: "other", status: "active" })]), { kind: "available" });
  assert.deepEqual(planOfferState("care", "proj", [plan({ projectId: null, status: "active" })]), { kind: "available" });
});

test("the launch nudge shows only when the client has no open plan at all", () => {
  assert.equal(hasNoOpenPlans([]), true);
  assert.equal(hasNoOpenPlans([{ status: "canceled" }]), true);
  assert.equal(hasNoOpenPlans([{ status: "canceled" }, { status: "pending" }]), false);
  assert.equal(hasNoOpenPlans([{ status: "active" }]), false);
});

test("canceling: an active plan ends at period end, a past-due one ends now, a pending one is just abandoned, and there is nothing to cancel otherwise", () => {
  assert.equal(clientCancelMode({ status: "active", cancelAt: null }), "period_end");
  assert.equal(clientCancelMode({ status: "past_due", cancelAt: null }), "now");
  assert.equal(clientCancelMode({ status: "past_due", cancelAt: "2026-10-21T00:00:00Z" }), "now");
  assert.equal(clientCancelMode({ status: "pending", cancelAt: null }), "abandon");
  // already scheduled, or already canceled: no cancel button
  assert.equal(clientCancelMode({ status: "active", cancelAt: "2026-10-21T00:00:00Z" }), null);
  assert.equal(clientCancelMode({ status: "canceled", cancelAt: null }), null);
});

test("a scheduled end date only counts while the plan is still running", () => {
  assert.equal(scheduledEnd({ status: "active", cancelAt: "2026-10-21T00:00:00Z" }), "2026-10-21T00:00:00Z");
  assert.equal(scheduledEnd({ status: "past_due", cancelAt: "2026-10-21T00:00:00Z" }), "2026-10-21T00:00:00Z");
  assert.equal(scheduledEnd({ status: "active", cancelAt: null }), null);
  assert.equal(scheduledEnd({ status: "canceled", cancelAt: "2026-10-21T00:00:00Z" }), null);
  assert.equal(scheduledEnd({ status: "pending", cancelAt: "2026-10-21T00:00:00Z" }), null);
});

test("admin cancel choices: active plans can end at period end or now, past-due only now, scheduled ones can be undone, pending ones can only be cleared", () => {
  assert.deepEqual(adminCancelOptions({ status: "active", cancelAt: null }), { abandon: false, atPeriodEnd: true, now: true, undo: false });
  assert.deepEqual(adminCancelOptions({ status: "active", cancelAt: "2026-10-21T00:00:00Z" }), { abandon: false, atPeriodEnd: false, now: true, undo: true });
  assert.deepEqual(adminCancelOptions({ status: "past_due", cancelAt: null }), { abandon: false, atPeriodEnd: false, now: true, undo: false });
  assert.deepEqual(adminCancelOptions({ status: "pending", cancelAt: null }), { abandon: true, atPeriodEnd: false, now: false, undo: false });
  assert.deepEqual(adminCancelOptions({ status: "canceled", cancelAt: "2026-10-21T00:00:00Z" }), { abandon: false, atPeriodEnd: false, now: false, undo: false });
});
