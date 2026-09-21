// Tests for the Stripe subscription-invoice helpers (supabase/functions/_shared/stripeSubscription.ts).
//
//   node --test scripts/test-stripe-subscription.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isUnreadableSubscriptionInvoice,
  paidDateFromInvoice,
  planStatusForSubscriptionStatus,
  scheduledCancelAt,
  subscriptionIdFromInvoice,
} from "../supabase/functions/_shared/stripeSubscription.ts";

test("finds the subscription id in the older API shape (invoice.subscription)", () => {
  assert.equal(subscriptionIdFromInvoice({ subscription: "sub_123" }), "sub_123");
  assert.equal(subscriptionIdFromInvoice({ subscription: { id: "sub_456" } }), "sub_456");
});

test("finds the subscription id in the newer API shape (invoice.parent.subscription_details)", () => {
  const invoice = { parent: { subscription_details: { subscription: "sub_new" } } };
  assert.equal(subscriptionIdFromInvoice(invoice), "sub_new");
});

test("falls back to the line item in either API version", () => {
  assert.equal(subscriptionIdFromInvoice({ lines: { data: [{ subscription: "sub_line" }] } }), "sub_line");
  assert.equal(
    subscriptionIdFromInvoice({ lines: { data: [{ parent: { subscription_item_details: { subscription: "sub_item" } } }] } }),
    "sub_item",
  );
});

test("a one-off invoice, or ids that are not subscription ids, give null", () => {
  assert.equal(subscriptionIdFromInvoice({}), null);
  assert.equal(subscriptionIdFromInvoice({ subscription: null }), null);
  assert.equal(subscriptionIdFromInvoice({ subscription: "in_123" }), null);
  assert.equal(subscriptionIdFromInvoice({ subscription: { id: "cus_1" } }), null);
  assert.equal(subscriptionIdFromInvoice({ lines: { data: [] } }), null);
});

test("a subscription invoice whose id cannot be read is flagged, so it fails loudly instead of being ignored", () => {
  assert.equal(isUnreadableSubscriptionInvoice({ billing_reason: "subscription_cycle" }), true);
  assert.equal(isUnreadableSubscriptionInvoice({ billing_reason: "subscription_create" }), true);
  // readable subscription invoice: fine
  assert.equal(isUnreadableSubscriptionInvoice({ billing_reason: "subscription_cycle", subscription: "sub_1" }), false);
  assert.equal(
    isUnreadableSubscriptionInvoice({ billing_reason: "subscription_cycle", parent: { subscription_details: { subscription: "sub_1" } } }),
    false,
  );
  // genuine one-off invoices are not subscription invoices
  assert.equal(isUnreadableSubscriptionInvoice({ billing_reason: "manual" }), false);
  assert.equal(isUnreadableSubscriptionInvoice({}), false);
});

test("payment date is when the customer paid, not the end of the billing period", () => {
  const paidAt = Date.UTC(2026, 8, 21, 15, 30) / 1000; // Sep 21 2026
  const created = Date.UTC(2026, 8, 20, 9, 0) / 1000;
  assert.equal(paidDateFromInvoice({ status_transitions: { paid_at: paidAt }, created }), "2026-09-21");
  // no paid_at: use creation time
  assert.equal(paidDateFromInvoice({ status_transitions: { paid_at: null }, created }), "2026-09-20");
  assert.equal(paidDateFromInvoice({ created }), "2026-09-20");
  // nothing usable: today
  assert.equal(paidDateFromInvoice({}, new Date("2026-09-22T05:00:00Z")), "2026-09-22");
});

test("subscription status maps onto plan status; unknown or in-between statuses change nothing", () => {
  assert.equal(planStatusForSubscriptionStatus("active"), "active");
  assert.equal(planStatusForSubscriptionStatus("past_due"), "past_due");
  assert.equal(planStatusForSubscriptionStatus("unpaid"), "past_due");
  assert.equal(planStatusForSubscriptionStatus("canceled"), "canceled");
  for (const status of ["trialing", "incomplete", "incomplete_expired", "paused", "", null, undefined, "something_new"]) {
    assert.equal(planStatusForSubscriptionStatus(status), null, String(status));
  }
});

test("a scheduled cancellation is read from cancel_at, or from the period end when only cancel_at_period_end is set", () => {
  const end = Date.UTC(2026, 9, 21, 12, 0) / 1000; // Oct 21 2026
  assert.equal(scheduledCancelAt({ cancel_at: end, cancel_at_period_end: true }), "2026-10-21T12:00:00.000Z");
  assert.equal(scheduledCancelAt({ cancel_at: end }), "2026-10-21T12:00:00.000Z"); // scheduled from the Stripe dashboard
  assert.equal(scheduledCancelAt({ cancel_at_period_end: true, current_period_end: end }), "2026-10-21T12:00:00.000Z");
  // newer API versions keep the period end on the subscription item
  assert.equal(
    scheduledCancelAt({ cancel_at_period_end: true, items: { data: [{ current_period_end: end }] } }),
    "2026-10-21T12:00:00.000Z",
  );
});

test("nothing scheduled reads as null, including a canceled-then-undone subscription", () => {
  assert.equal(scheduledCancelAt({}), null);
  assert.equal(scheduledCancelAt({ cancel_at: null, cancel_at_period_end: false, current_period_end: 1_800_000_000 }), null);
  assert.equal(scheduledCancelAt({ cancel_at_period_end: true }), null); // flagged but no date to show
  assert.equal(scheduledCancelAt({ cancel_at: 0 }), null);
});
