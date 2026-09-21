/**
 * "Refund via Stripe" for a recorded Stripe payment. This moves real money, so the rules live here,
 * free of Deno and Stripe APIs (everything external is injected) and unit-tested in Node.
 *
 * Rules:
 *  - Only a Stripe payment that has a PaymentIntent and has not already been reversed is refundable.
 *  - The refund is for the amount RECORDED on the ledger payment (never more), minus anything already
 *    refunded on that PaymentIntent, so a partial refund made earlier in the Dashboard is never doubled.
 *  - If the PaymentIntent is already fully refunded in Stripe, no new refund is created; only the
 *    ledger is reversed. This makes a retry after a half-finished attempt safe.
 *  - The ledger is reversed AFTER the refund succeeds. If that step fails, the caller is told the money
 *    was refunded but the payment still needs Reverse, instead of pretending nothing happened.
 */
export type PaymentForRefund = {
  id: string;
  invoice_id: string;
  invoice_number: string;
  client_id: string;
  amount_cents: number;
  currency: string;
  provider: string;
  reversed_at: string | null;
  stripe_payment_intent_id: string | null;
};

export type StripeRefundInfo = { id: string; status: string; amount: number };

/** Thrown by the injected Stripe calls so the logic can classify failures without importing Stripe. */
export class StripeCallError extends Error {
  code: string;
  constructor(code: string, message = "stripe call failed") {
    super(message);
    this.name = "StripeCallError";
    this.code = code;
  }
}

export type RefundDeps = {
  loadPayment: (paymentId: string) => Promise<PaymentForRefund | null>;
  listRefunds: (paymentIntentId: string) => Promise<StripeRefundInfo[]>;
  createRefund: (args: {
    paymentIntentId: string;
    amountCents: number;
    idempotencyKey: string;
    metadata: Record<string, string>;
  }) => Promise<StripeRefundInfo>;
  /** Reverses the ledger payment as the signed-in admin. Throws on failure. */
  reversePayment: (paymentId: string) => Promise<void>;
  /** Best-effort audit line (staff-only client activity). Must not throw into the flow. */
  recordActivity: (clientId: string, message: string) => Promise<void>;
};

export type RefundError =
  | "not_found"
  | "not_refundable"
  | "already_reversed"
  | "no_payment_intent"
  | "stripe_permission"
  | "stripe_balance"
  | "stripe_error"
  | "refunded_not_reversed";

export type RefundOutcome =
  | { ok: true; refundId: string; status: string; alreadyRefunded: boolean; refundedCents: number }
  | { ok: false; error: RefundError; refundId?: string };

const COUNTED_STATUSES = new Set(["succeeded", "pending", "requires_action"]);

function formatUsd(cents: number, currency: string): string {
  const value = (cents / 100).toFixed(2);
  return currency.toUpperCase() === "USD" ? `$${value}` : `${value} ${currency.toUpperCase()}`;
}

function classify(code: string): RefundError {
  if (code === "permission" || code === "permission_error") return "stripe_permission";
  if (code === "balance_insufficient") return "stripe_balance";
  return "stripe_error";
}

export async function refundStripePayment(
  deps: RefundDeps,
  input: { paymentId: string; idempotencyKey: string; actorEmail?: string },
): Promise<RefundOutcome> {
  const payment = await deps.loadPayment(input.paymentId);
  if (!payment) return { ok: false, error: "not_found" };
  if (payment.reversed_at) return { ok: false, error: "already_reversed" };
  if (payment.provider !== "stripe" || !(payment.amount_cents > 0)) return { ok: false, error: "not_refundable" };
  if (!payment.stripe_payment_intent_id) return { ok: false, error: "no_payment_intent" };

  const intentId = payment.stripe_payment_intent_id;

  let existing: StripeRefundInfo[];
  try {
    existing = await deps.listRefunds(intentId);
  } catch {
    return { ok: false, error: "stripe_error" };
  }
  const alreadyRefundedCents = existing
    .filter((refund) => COUNTED_STATUSES.has(refund.status))
    .reduce((sum, refund) => sum + refund.amount, 0);
  const remaining = payment.amount_cents - alreadyRefundedCents;

  let refundId: string;
  let status: string;
  let refundedCents: number;
  let alreadyRefunded = false;

  if (remaining <= 0) {
    // Money is already back with the client (e.g. refunded in the Stripe Dashboard): only fix the ledger.
    alreadyRefunded = true;
    const latest = [...existing].reverse().find((refund) => COUNTED_STATUSES.has(refund.status));
    refundId = latest?.id ?? "";
    status = latest?.status ?? "succeeded";
    refundedCents = alreadyRefundedCents;
  } else {
    try {
      const refund = await deps.createRefund({
        paymentIntentId: intentId,
        amountCents: remaining,
        idempotencyKey: `refund:${payment.id}:${input.idempotencyKey}`,
        metadata: { payment_id: payment.id, invoice_id: payment.invoice_id, source: "motivescripts-admin" },
      });
      refundId = refund.id;
      status = refund.status;
      refundedCents = alreadyRefundedCents + refund.amount;
    } catch (error) {
      const code = error instanceof StripeCallError ? error.code : "unknown";
      if (code === "charge_already_refunded") {
        alreadyRefunded = true;
        refundId = "";
        status = "succeeded";
        refundedCents = payment.amount_cents;
      } else {
        return { ok: false, error: classify(code) };
      }
    }
  }

  try {
    await deps.reversePayment(payment.id);
  } catch {
    return { ok: false, error: "refunded_not_reversed", refundId: refundId || undefined };
  }

  try {
    await deps.recordActivity(
      payment.client_id,
      `Stripe refund of ${formatUsd(refundedCents, payment.currency)} ${alreadyRefunded ? "found" : "issued"}${
        refundId ? ` (${refundId})` : ""
      } and payment reversed on ${payment.invoice_number}${input.actorEmail ? ` by ${input.actorEmail}` : ""}.`,
    );
  } catch {
    // Audit line is best effort; the refund and reversal already happened.
  }

  return { ok: true, refundId, status, alreadyRefunded, refundedCents };
}
