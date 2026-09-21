// Pure helpers for reading Stripe subscription invoices in the webhook. Kept free of the Stripe SDK and the
// Deno runtime so they can be unit tested in plain Node (scripts/test-stripe-subscription.mjs).
//
// Why this exists: Stripe moved a subscription invoice's subscription id between API versions. Older
// versions expose it as `invoice.subscription`; newer ones (2025-03-31 and later) put it under
// `invoice.parent.subscription_details.subscription`, and on the line item under
// `parent.subscription_item_details.subscription`. Which shape a webhook receives depends on the API version
// configured on the webhook endpoint in the Stripe dashboard, not on the SDK version the function imports, so
// the webhook must understand both.

type MaybeId = unknown;

/** A subscription invoice as either API version delivers it. Every field is optional on purpose. */
export type InvoiceLike = {
  subscription?: MaybeId;
  parent?: {
    subscription_details?: { subscription?: MaybeId } | null;
  } | null;
  billing_reason?: string | null;
  created?: number | null;
  status_transitions?: { paid_at?: number | null } | null;
  lines?: {
    data?: Array<{
      subscription?: MaybeId;
      parent?: { subscription_item_details?: { subscription?: MaybeId } | null } | null;
    }> | null;
  } | null;
};

function subscriptionIdFrom(value: MaybeId): string | null {
  if (typeof value === "string" && value.startsWith("sub_")) return value;
  if (value && typeof value === "object" && "id" in value) {
    const id = (value as { id?: unknown }).id;
    if (typeof id === "string" && id.startsWith("sub_")) return id;
  }
  return null;
}

/** The subscription an invoice belongs to, or null for a one-off invoice (or an unrecognised shape). */
export function subscriptionIdFromInvoice(invoice: InvoiceLike): string | null {
  const firstLine = invoice.lines?.data?.[0];
  return (
    subscriptionIdFrom(invoice.subscription) ??
    subscriptionIdFrom(invoice.parent?.subscription_details?.subscription) ??
    subscriptionIdFrom(firstLine?.subscription) ??
    subscriptionIdFrom(firstLine?.parent?.subscription_item_details?.subscription)
  );
}

/**
 * True when Stripe says this invoice is a subscription invoice (billing_reason "subscription_create",
 * "subscription_cycle", "subscription_update", ...) but no subscription id could be found on it. That means
 * the payload shape is one this code does not understand, and the event must fail loudly (so Stripe retries
 * and the failure shows up in the dashboard) instead of being ignored and the payment never recorded.
 */
export function isUnreadableSubscriptionInvoice(invoice: InvoiceLike): boolean {
  const reason = invoice.billing_reason ?? "";
  return reason.startsWith("subscription") && subscriptionIdFromInvoice(invoice) === null;
}

function utcDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toISOString().slice(0, 10);
}

/**
 * The UTC calendar date the customer actually paid: Stripe's paid_at, else the invoice's creation time, else
 * `now`. This is the payment date on the ledger. It is not the end of the billing period, which is a month
 * away for a charge taken at the start of a monthly cycle.
 */
export function paidDateFromInvoice(invoice: InvoiceLike, now: Date = new Date()): string {
  const paidAt = invoice.status_transitions?.paid_at;
  if (typeof paidAt === "number" && Number.isFinite(paidAt) && paidAt > 0) return utcDate(paidAt);
  if (typeof invoice.created === "number" && Number.isFinite(invoice.created) && invoice.created > 0) {
    return utcDate(invoice.created);
  }
  return now.toISOString().slice(0, 10);
}

export type ServicePlanStatus = "pending" | "active" | "past_due" | "canceled";

/**
 * How a Stripe subscription status maps onto a plan's status, or null when the plan's status should not
 * change (trialing, incomplete, paused, and anything unknown).
 */
export function planStatusForSubscriptionStatus(stripeStatus: string | null | undefined): ServicePlanStatus | null {
  switch (stripeStatus) {
    case "active":
      return "active";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "canceled":
      return "canceled";
    default:
      return null;
  }
}
