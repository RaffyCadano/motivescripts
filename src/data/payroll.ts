export type StaffPayRate = {
  userId: string;
  payRateCents: number;
  updatedAt: string;
};

export function payrollErrorMessage(code: string): string {
  switch (code) {
    case "NOT_FOUND":
      return "That staff member could not be found.";
    case "INVALID_RATE":
      return "Enter a pay rate of $0 or more.";
    case "not_allowed":
      return "You don’t have permission to do that.";
    case "network":
      return "We couldn’t reach the server. Check your connection and try again.";
    default:
      return "Something went wrong. Please try again.";
  }
}

export function payrollErrorCode(message: string): string {
  const upper = message.toUpperCase();
  if (upper.includes("NOT_FOUND")) return "NOT_FOUND";
  if (upper.includes("INVALID_RATE")) return "INVALID_RATE";
  if (message.toLowerCase().includes("failed to fetch") || message.toLowerCase().includes("network")) {
    return "network";
  }
  if (message.toLowerCase().includes("row-level security") || message.includes("42501")) return "not_allowed";
  return "error";
}
