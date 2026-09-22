export type CareRequestPriority = "Low" | "Medium" | "High" | "Urgent";
export type CareRequestStatus = "New" | "In Progress" | "Done";

export const careRequestPriorities: CareRequestPriority[] = ["Low", "Medium", "High", "Urgent"];
export const careRequestStatuses: CareRequestStatus[] = ["New", "In Progress", "Done"];

export type CareRequest = {
  id: string;
  clientId: string;
  projectId: string;
  submittedBy: string | null;
  message: string;
  priority: CareRequestPriority;
  status: CareRequestStatus;
  /** Whether the client had an active (or past-due) Website Care plan at the moment they asked. Not
   * re-checked afterwards -- a later cancellation doesn't change what this row says. */
  hasActiveCarePlan: boolean;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
};

export const CARE_REQUEST_STATUS_LABELS: Record<CareRequestStatus, string> = {
  New: "New",
  "In Progress": "In Progress",
  Done: "Done",
};

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
  options: { status: CareRequestStatus | "All"; priority: CareRequestPriority | "All"; clientId: string | "All" },
): CareRequest[] {
  return requests.filter((request) => {
    if (options.status !== "All" && request.status !== options.status) return false;
    if (options.priority !== "All" && request.priority !== options.priority) return false;
    if (options.clientId !== "All" && request.clientId !== options.clientId) return false;
    return true;
  });
}
