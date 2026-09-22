export type ServicePlanType = "care" | "seo_retainer" | "hosting" | "custom";
export type ServicePlanStatus = "pending" | "active" | "past_due" | "canceled" | "paused";

export type ServicePlan = {
  id: string;
  clientId: string;
  projectId: string | null;
  planType: ServicePlanType;
  label: string;
  amountCents: number;
  status: ServicePlanStatus;
  domain: string | null;
  domainExpiresAt: string | null;
  sslExpiresAt: string | null;
  createdAt: string;
  canceledAt: string | null;
  /** When a scheduled cancellation takes effect (the plan is still active until then), or null. */
  cancelAt: string | null;
  /** Hours of included work per billing cycle (Website Care plans). */
  includedHoursMonthly: number;
  /** Which maintenance_plan_templates row this was assigned from, if any. */
  planTemplateId: string | null;
  pausedAt: string | null;
};

export type DomainAvailability = "available" | "taken" | "unknown";

export type AdminCancelOptions = {
  /** End at the close of the period already paid for (only for a plan that is active and not already ending). */
  atPeriodEnd: boolean;
  /** Stop billing right now (any running plan). */
  now: boolean;
  /** Undo a cancellation that is scheduled but has not happened yet. */
  undo: boolean;
  /** Clear a plan still waiting on checkout -- nothing was ever charged, so this isn't a real cancellation. */
  abandon: boolean;
};

/**
 * The cancel choices an admin has for one plan. A past-due plan can only be canceled now (nothing is paid for the
 * current period). The server enforces the same rules.
 */
export function adminCancelOptions(plan: Pick<ServicePlan, "status" | "cancelAt">): AdminCancelOptions {
  const running = plan.status === "active" || plan.status === "past_due" || plan.status === "paused";
  return {
    abandon: plan.status === "pending",
    atPeriodEnd: plan.status === "active" && !plan.cancelAt,
    now: running,
    undo: plan.status === "active" && Boolean(plan.cancelAt),
  };
}

/** Only an active plan can be paused; only a paused one can be resumed. */
export function canPausePlan(plan: Pick<ServicePlan, "status">): boolean {
  return plan.status === "active";
}
export function canResumePausedPlan(plan: Pick<ServicePlan, "status">): boolean {
  return plan.status === "paused";
}

export const SERVICE_PLAN_TYPE_LABELS: Record<ServicePlanType, string> = {
  care: "Website Care",
  seo_retainer: "SEO Retainer",
  hosting: "Hosting",
  custom: "Custom",
};

export const SERVICE_PLAN_STATUS_LABELS: Record<ServicePlanStatus, string> = {
  pending: "Pending",
  active: "Active",
  past_due: "Past due",
  canceled: "Canceled",
  paused: "Paused",
};

export function servicePlanErrorMessage(code: string): string {
  switch (code) {
    case "NOT_FOUND":
      return "That plan could not be found.";
    case "INVALID_AMOUNT":
      return "Enter a monthly amount of at least $0.50.";
    case "INVALID_PLAN_TYPE":
      return "Choose a valid plan type.";
    case "INVALID_LABEL":
      return "Enter a name for this plan.";
    case "not_payable":
      return "This plan is not ready for checkout.";
    case "not_cancelable":
      return "This plan can't be canceled right now.";
    case "not_pausable":
      return "This plan can't be paused right now.";
    case "not_unpausable":
      return "This plan isn't paused, so there's nothing to resume.";
    case "not_resumable":
      return "This plan isn't scheduled to end, so there's nothing to undo.";
    case "not_allowed":
      return "You don’t have permission to do that.";
    case "not_launched":
      return "Plans become available once your website has launched.";
    case "already_subscribed":
      return "You already have this plan.";
    case "missing_site_url":
      return "The site is not configured for checkout yet.";
    case "invalid_domain":
      return "Enter a valid domain name (e.g. example.com).";
    case "network":
      return "We couldn’t reach the server. Check your connection and try again.";
    default:
      return "Something went wrong. Please try again.";
  }
}

export function servicePlanErrorCode(message: string): string {
  const upper = message.toUpperCase();
  if (upper.includes("NOT_FOUND")) return "NOT_FOUND";
  if (upper.includes("INVALID_AMOUNT")) return "INVALID_AMOUNT";
  if (upper.includes("INVALID_PLAN_TYPE")) return "INVALID_PLAN_TYPE";
  if (upper.includes("INVALID_LABEL")) return "INVALID_LABEL";
  if (message.toLowerCase().includes("failed to fetch") || message.toLowerCase().includes("network")) {
    return "network";
  }
  if (message.toLowerCase().includes("row-level security") || message.includes("42501")) return "not_allowed";
  return "error";
}
