export type MaintenancePlanTemplateDefaultPriority = "Low" | "Medium" | "High" | "Urgent";

export const maintenancePlanTemplateDefaultPriorities: MaintenancePlanTemplateDefaultPriority[] = [
  "Low",
  "Medium",
  "High",
  "Urgent",
];

export type MaintenancePlanTemplate = {
  id: string;
  name: string;
  description: string;
  monthlyPriceCents: number;
  includedHours: number;
  /** Free-form list of what the tier includes, e.g. "Hosting", "SSL certificate", "Priority support". */
  includedServices: string[];
  /** Suggested per-hour rate for billable overage work quoted off this tier. Informational -- never auto-charged. */
  overageRateCents: number | null;
  /** A new care request from a client on this tier starts at this priority. Staff can still change it by hand. */
  defaultPriority: MaintenancePlanTemplateDefaultPriority;
  /** "Advanced monitoring": checked every 5 minutes and alerts after 2 slow checks instead of ~15 minutes / 4 checks. */
  fastMonitoring: boolean;
  /** "Monthly maintenance review": a recurring task is auto-created on the 1st of each month for a plan on this tier. */
  reviewIncluded: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type MaintenancePlanTemplateInput = {
  name: string;
  description: string;
  monthlyPriceCents: number;
  includedHours: number;
  includedServices: string[];
  overageRateCents: number | null;
  defaultPriority: MaintenancePlanTemplateDefaultPriority;
  fastMonitoring: boolean;
  reviewIncluded: boolean;
  isActive: boolean;
  sortOrder: number;
};

export function maintenancePlanTemplateErrorMessage(code: string): string {
  switch (code) {
    case "NOT_FOUND":
      return "That plan tier could not be found.";
    case "INVALID_NAME":
      return "Enter a name for this tier.";
    case "INVALID_PRICE":
      return "Enter a monthly price of at least $0.50.";
    case "not_allowed":
      return "You don’t have permission to manage Website Care plan tiers.";
    case "network":
      return "We couldn’t reach the server. Check your connection and try again.";
    default:
      return "Something went wrong. Please try again.";
  }
}

export function maintenancePlanTemplateErrorCode(message: string): string {
  const upper = message.toUpperCase();
  if (upper.includes("NOT_FOUND")) return "NOT_FOUND";
  if (upper.includes("INVALID_NAME")) return "INVALID_NAME";
  if (upper.includes("INVALID_PRICE")) return "INVALID_PRICE";
  if (message.toLowerCase().includes("failed to fetch") || message.toLowerCase().includes("network")) {
    return "network";
  }
  if (message.toLowerCase().includes("row-level security") || message.includes("42501")) return "not_allowed";
  return "error";
}
