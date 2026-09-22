export type CareRequestPriority = "Low" | "Medium" | "High" | "Urgent";
export type CareRequestStatus = "New" | "In Progress" | "Done";
export type CareRequestCategory = "quick_update" | "new_addition";
export type CareRequestType =
  | "content_update"
  | "bug_fix"
  | "design_change"
  | "new_page"
  | "new_feature"
  | "seo"
  | "technical"
  | "other";
export type CareRequestBillingDecision = "included" | "billable";

export const careRequestPriorities: CareRequestPriority[] = ["Low", "Medium", "High", "Urgent"];
export const careRequestStatuses: CareRequestStatus[] = ["New", "In Progress", "Done"];
export const careRequestCategories: CareRequestCategory[] = ["quick_update", "new_addition"];
export const careRequestTypes: CareRequestType[] = [
  "content_update",
  "bug_fix",
  "design_change",
  "new_page",
  "new_feature",
  "seo",
  "technical",
  "other",
];

export type CareRequest = {
  id: string;
  clientId: string;
  projectId: string;
  submittedBy: string | null;
  message: string;
  priority: CareRequestPriority;
  status: CareRequestStatus;
  category: CareRequestCategory;
  /** Whether the client had an active (or past-due) Website Care plan at the moment they asked.
   * Submitting one requires an active plan now, so this is true for every new row -- kept for the
   * requests that predate that rule, and because a row still shouldn't change if the plan is
   * canceled afterwards. */
  hasActiveCarePlan: boolean;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  requestType: CareRequestType;
  billingDecision: CareRequestBillingDecision | null;
  servicePlanId: string | null;
  resultingTaskId: string | null;
  resultingInvoiceId: string | null;
  resultingProjectId: string | null;
};

export const CARE_REQUEST_STATUS_LABELS: Record<CareRequestStatus, string> = {
  New: "New",
  "In Progress": "In Progress",
  Done: "Done",
};

export const CARE_REQUEST_CATEGORY_LABELS: Record<CareRequestCategory, string> = {
  quick_update: "Quick update or fix",
  new_addition: "New addition",
};

export const CARE_REQUEST_TYPE_LABELS: Record<CareRequestType, string> = {
  content_update: "Content Update",
  bug_fix: "Bug Fix",
  design_change: "Design Change",
  new_page: "New Page",
  new_feature: "New Feature",
  seo: "SEO",
  technical: "Technical",
  other: "Other",
};

export const CARE_REQUEST_BILLING_DECISION_LABELS: Record<CareRequestBillingDecision, string> = {
  included: "Included in plan",
  billable: "Billable",
};

/**
 * A first guess at whether a request type is usually covered by a Care plan or usually needs a
 * quote -- shown to the client as a hint, and pre-selects (but never locks) the category radio.
 * Staff make the real call later via billing_decision; this is not authoritative.
 */
export type CareRequestFile = {
  id: string;
  requestId: string;
  projectId: string;
  clientId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  storagePath: string;
  createdAt: string;
  uploadedBy: string | null;
};

export function suggestedCategoryForType(type: CareRequestType): CareRequestCategory {
  switch (type) {
    case "new_page":
    case "new_feature":
    case "design_change":
      return "new_addition";
    default:
      return "quick_update";
  }
}

const PRIORITY_WEIGHT: Record<CareRequestPriority, number> = { Urgent: 0, High: 1, Medium: 2, Low: 3 };

/** Admin queue order: open work first (oldest status last -- Done sinks to the bottom), then by
 * priority (Urgent first), then longest-waiting first within the same priority. */
export function sortCareRequests(requests: CareRequest[]): CareRequest[] {
  return [...requests].sort((a, b) => {
    const doneDiff = Number(a.status === "Done") - Number(b.status === "Done");
    if (doneDiff !== 0) return doneDiff;
    const priorityDiff = PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return a.createdAt.localeCompare(b.createdAt);
  });
}

export function filterCareRequests(
  requests: CareRequest[],
  options: {
    status: CareRequestStatus | "All";
    priority: CareRequestPriority | "All";
    clientId: string | "All";
    category?: CareRequestCategory | "All";
    billingDecision?: CareRequestBillingDecision | "All" | "Undecided";
  },
): CareRequest[] {
  return requests.filter((request) => {
    if (options.status !== "All" && request.status !== options.status) return false;
    if (options.priority !== "All" && request.priority !== options.priority) return false;
    if (options.clientId !== "All" && request.clientId !== options.clientId) return false;
    if (options.category && options.category !== "All" && request.category !== options.category) return false;
    if (options.billingDecision === "Undecided" && request.billingDecision !== null) return false;
    if (
      options.billingDecision &&
      options.billingDecision !== "All" &&
      options.billingDecision !== "Undecided" &&
      request.billingDecision !== options.billingDecision
    ) {
      return false;
    }
    return true;
  });
}
