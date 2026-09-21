// Tests for the "Refund via Stripe" rules (supabase/functions/_shared/stripeRefund.ts). Stripe and the
// ledger are faked; no network and no real money.
//
//   node --test scripts/test-stripe-refund.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import { StripeCallError, refundStripePayment } from "../supabase/functions/_shared/stripeRefund.ts";

const basePayment = {
  id: "pay-1",
  invoice_id: "inv-1",
  invoice_number: "MS-INV-2026-004",
  client_id: "client-1",
  amount_cents: 100,
  currency: "USD",
  provider: "stripe",
  reversed_at: null,
  stripe_payment_intent_id: "pi_123",
};

function harness(overrides = {}) {
  const calls = [];
  const activity = [];
  const deps = {
    loadPayment: async () => ({ ...basePayment, ...(overrides.payment ?? {}) }),
    listRefunds: async () => {
      calls.push("list");
      if (overrides.listThrows) throw new Error("boom");
      return overrides.existing ?? [];
    },
    createRefund: async (args) => {
      calls.push("create");
      calls.created = args;
      if (overrides.createThrows) throw overrides.createThrows;
      return { id: "re_new", status: overrides.refundStatus ?? "succeeded", amount: args.amountCents };
    },
    reversePayment: async (id) => {
      calls.push("reverse");
      calls.reversed = id;
      if (overrides.reverseThrows) throw new Error("reverse failed");
    },
    recordActivity: async (clientId, message) => {
      calls.push("activity");
      if (overrides.activityThrows) throw new Error("activity failed");
      activity.push({ clientId, message });
    },
  };
  return { deps, calls, activity };
}
const run = (deps) => refundStripePayment(deps, { paymentId: "pay-1", idempotencyKey: "key-1", actorEmail: "admin@x.com" });

test("happy path: refunds the recorded amount, then reverses the ledger, then logs", async () => {
  const { deps, calls, activity } = harness();
  const result = await run(deps);
  assert.deepEqual(result, { ok: true, refundId: "re_new", status: "succeeded", alreadyRefunded: false, refundedCents: 100 });
  assert.deepEqual(calls.slice(), ["list", "create", "reverse", "activity"], "refund happens BEFORE the ledger reversal");
  assert.equal(calls.created.paymentIntentId, "pi_123");
  assert.equal(calls.created.amountCents, 100);
  assert.equal(calls.created.idempotencyKey, "refund:pay-1:key-1");
  assert.equal(calls.created.metadata.payment_id, "pay-1");
  assert.equal(calls.reversed, "pay-1");
  assert.match(activity[0].message, /refund of \$1\.00 issued \(re_new\).*MS-INV-2026-004.*admin@x\.com/);
  assert.equal(activity[0].clientId, "client-1");
});

test("payments that cannot be refunded never touch Stripe", async () => {
  const cases = [
    [{ reversed_at: "2026-09-21T00:00:00Z" }, "already_reversed"],
    [{ provider: "manual", stripe_payment_intent_id: null }, "not_refundable"],
    [{ amount_cents: 0 }, "not_refundable"],
    [{ stripe_payment_intent_id: null }, "no_payment_intent"],
  ];
  for (const [payment, expected] of cases) {
    const { deps, calls } = harness({ payment });
    const result = await run(deps);
    assert.deepEqual(result, { ok: false, error: expected }, JSON.stringify(payment));
    assert.equal(calls.length, 0, "no Stripe or ledger call for " + expected);
  }
  const missing = await refundStripePayment({ ...harness().deps, loadPayment: async () => null }, { paymentId: "x", idempotencyKey: "k" });
  assert.deepEqual(missing, { ok: false, error: "not_found" });
});

test("already fully refunded in Stripe: no new refund, only the ledger is reversed", async () => {
  const { deps, calls } = harness({ existing: [{ id: "re_dash", status: "succeeded", amount: 100 }] });
  const result = await run(deps);
  assert.equal(result.ok, true);
  assert.equal(result.alreadyRefunded, true);
  assert.equal(result.refundId, "re_dash");
  assert.ok(!calls.includes("create"), "must not refund twice");
  assert.ok(calls.includes("reverse"));
});

test("a partial refund made earlier is never doubled: only the remainder is refunded", async () => {
  const { deps, calls } = harness({ payment: { amount_cents: 500 }, existing: [{ id: "re_1", status: "succeeded", amount: 200 }] });
  const result = await run(deps);
  assert.equal(calls.created.amountCents, 300);
  assert.equal(result.refundedCents, 500, "total refunded equals the recorded payment, never more");
});

test("pending refunds count; failed and canceled ones do not", async () => {
  const pending = harness({ existing: [{ id: "re_p", status: "pending", amount: 100 }] });
  assert.equal((await run(pending.deps)).alreadyRefunded, true);

  const failed = harness({ existing: [{ id: "re_f", status: "failed", amount: 100 }, { id: "re_c", status: "canceled", amount: 100 }] });
  const result = await run(failed.deps);
  assert.equal(result.alreadyRefunded, false);
  assert.equal(failed.calls.created.amountCents, 100);
});

test("never refunds more than the recorded amount even if Stripe collected more", async () => {
  // The ledger caps a payment below the Stripe charge in a race; the extra needs a Dashboard refund.
  const { deps, calls } = harness({ payment: { amount_cents: 4000 } });
  await run(deps);
  assert.equal(calls.created.amountCents, 4000);
});

test("Stripe failures stop everything before the ledger is touched, with a specific error", async () => {
  const cases = [
    [new StripeCallError("permission"), "stripe_permission"],
    [new StripeCallError("permission_error"), "stripe_permission"],
    [new StripeCallError("balance_insufficient"), "stripe_balance"],
    [new StripeCallError("something_else"), "stripe_error"],
    [new Error("network"), "stripe_error"],
  ];
  for (const [error, expected] of cases) {
    const { deps, calls } = harness({ createThrows: error });
    const result = await run(deps);
    assert.deepEqual(result, { ok: false, error: expected });
    assert.ok(!calls.includes("reverse"), "ledger must stay untouched when the refund failed");
    assert.ok(!calls.includes("activity"));
  }
});

test("a lookup failure is treated as a Stripe error and nothing is refunded", async () => {
  const { deps, calls } = harness({ listThrows: true });
  assert.deepEqual(await run(deps), { ok: false, error: "stripe_error" });
  assert.ok(!calls.includes("create") && !calls.includes("reverse"));
});

test("Stripe says the charge is already refunded (race): treat as refunded and finish the ledger", async () => {
  const { deps, calls } = harness({ createThrows: new StripeCallError("charge_already_refunded") });
  const result = await run(deps);
  assert.equal(result.ok, true);
  assert.equal(result.alreadyRefunded, true);
  assert.ok(calls.includes("reverse"));
});

test("if the ledger reversal fails after a successful refund, the caller is told exactly that", async () => {
  const { deps, calls, activity } = harness({ reverseThrows: true });
  const result = await run(deps);
  assert.deepEqual(result, { ok: false, error: "refunded_not_reversed", refundId: "re_new" });
  assert.deepEqual(calls.slice(), ["list", "create", "reverse"]);
  assert.equal(activity.length, 0);
});

test("retrying after that half-finished state does not refund again", async () => {
  // Second attempt: Stripe now lists the refund from the first attempt.
  const { deps, calls } = harness({ existing: [{ id: "re_new", status: "succeeded", amount: 100 }] });
  const result = await run(deps);
  assert.equal(result.ok, true);
  assert.ok(!calls.includes("create"));
  assert.ok(calls.includes("reverse"));
});

test("an audit-log failure never undoes or hides a completed refund", async () => {
  const { deps } = harness({ activityThrows: true });
  const result = await run(deps);
  assert.equal(result.ok, true);
});
