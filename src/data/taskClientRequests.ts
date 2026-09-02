export const TASK_CLIENT_REQUEST_STATUSES = [
  "not_requested",
  "awaiting_client",
  "submitted",
  "under_review",
  "complete",
] as const;

export type TaskClientRequestStatus = (typeof TASK_CLIENT_REQUEST_STATUSES)[number];

export type TaskClientRequest = {
  id: string;
  taskId: string;
  projectId: string;
  clientId: string;
  status: TaskClientRequestStatus;
  message: string;
  clientResponse: string;
  requestedAt: string | null;
  submittedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
};

export type TaskClientRequestFile = {
  id: string;
  requestId: string;
  taskId: string;
  projectId: string;
  clientId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  storagePath: string;
  createdAt: string;
};

export function taskClientRequestStatusLabel(status: TaskClientRequestStatus): string {
  switch (status) {
    case "not_requested":
      return "Not Requested";
    case "awaiting_client":
      return "Awaiting Client";
    case "submitted":
      return "Ready for Review";
    case "under_review":
      return "Under Review";
    case "complete":
      return "Complete";
  }
}
