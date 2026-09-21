/**
 * Pure helper for the client portal's "Choose a plan" section: where a client stands on one plan for one
 * project. Kept free of runtime imports so it can be unit tested in plain Node (scripts/test-client-plan-offer.mjs).
 * The server enforces the same rule (create_client_service_plan): one open plan of a kind per project.
 */
import type { ServicePlan } from "@/data/servicePlans";

export type PlanOfferState =
  /** Nothing open for this plan on this project: the client can choose it. */
  | { kind: "available" }
  /** They started it but have not finished Stripe checkout. They can pick up where they left off. */
  | { kind: "pending"; planId: string }
  /** Already theirs (active, or active but behind on payment). */
  | { kind: "subscribed"; status: "active" | "past_due" };

export function planOfferState(
  planType: ServicePlan["planType"],
  projectId: string,
  plans: Pick<ServicePlan, "id" | "planType" | "projectId" | "status">[],
): PlanOfferState {
  const mine = plans.filter((plan) => plan.planType === planType && plan.projectId === projectId);
  const subscribed = mine.find((plan) => plan.status === "active" || plan.status === "past_due");
  if (subscribed) return { kind: "subscribed", status: subscribed.status as "active" | "past_due" };
  const pending = mine.find((plan) => plan.status === "pending");
  if (pending) return { kind: "pending", planId: pending.id };
  return { kind: "available" };
}

export type ClientCancelMode =
  /** Ends when the period already paid for runs out; the client is not charged again. */
  | "period_end"
  /** Already behind on payment, so there is nothing paid to run out: ends right away. */
  | "now";

/**
 * What canceling would do for this plan, or null when the client can't cancel it (already canceled, still
 * pending checkout, or a cancellation is already scheduled). The server makes the same decision.
 */
export function clientCancelMode(plan: Pick<ServicePlan, "status" | "cancelAt">): ClientCancelMode | null {
  if (plan.status === "past_due") return "now";
  if (plan.status === "active" && !plan.cancelAt) return "period_end";
  return null;
}

/** The date a scheduled cancellation takes effect, only while the plan is still running. */
export function scheduledEnd(plan: Pick<ServicePlan, "status" | "cancelAt">): string | null {
  return (plan.status === "active" || plan.status === "past_due") && plan.cancelAt ? plan.cancelAt : null;
}

/** True when the client has no plan at all (canceled ones do not count), so the portal can nudge them once launched. */
export function hasNoOpenPlans(plans: Pick<ServicePlan, "status">[]): boolean {
  return !plans.some((plan) => plan.status !== "canceled");
}
