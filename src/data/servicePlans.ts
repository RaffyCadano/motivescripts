export type ServicePlanType = "care" | "seo_retainer" | "hosting" | "custom";
export type ServicePlanStatus = "pending" | "active" | "past_due" | "canceled";

export type ServicePlan = {
  id: string;
  clientId: string;
  projectId: string | null;
  planType: ServicePlanType;
  label: string;
  amountCents: number;
  status: ServicePlanStatus;
  createdAt: string;
  canceledAt: string | null;
};

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
    case "not_allowed":
      return "You don’t have permission to do that.";
    case "missing_site_url":
      return "The site is not configured for checkout yet.";
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
