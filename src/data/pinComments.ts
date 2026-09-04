export type PinComment = {
  id: string;
  versionId: string;
  deliverableId: string;
  projectId: string;
  xPct: number;
  yPct: number;
  body: string;
  status: "Open" | "Resolved";
  createdBy: string;
  createdAt: string;
  resolvedAt: string | null;
};

export function pinCommentErrorMessage(code: string): string {
  switch (code) {
    case "NOT_FOUND":
      return "This file version could not be found.";
    case "INVALID_STATUS":
      return "This deliverable isn't open for review right now.";
    case "EMPTY_BODY":
      return "Enter a comment before placing a pin.";
    case "not_allowed":
      return "You don’t have permission to do that.";
    case "network":
      return "We couldn’t reach the server. Check your connection and try again.";
    default:
      return "Something went wrong. Please try again.";
  }
}

export function pinCommentErrorCode(message: string): string {
  const upper = message.toUpperCase();
  if (upper.includes("NOT_FOUND")) return "NOT_FOUND";
  if (upper.includes("INVALID_STATUS")) return "INVALID_STATUS";
  if (upper.includes("EMPTY_BODY")) return "EMPTY_BODY";
  if (message.toLowerCase().includes("failed to fetch") || message.toLowerCase().includes("network")) {
    return "network";
  }
  if (message.toLowerCase().includes("row-level security") || message.includes("42501")) return "not_allowed";
  return "error";
}
