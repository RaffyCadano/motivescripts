export class AgencyDbError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, { cause });
    this.name = "AgencyDbError";
  }
}

export function friendlyDbError(error: unknown, fallback: string): string {
  const message =
    error && typeof error === "object" && "message" in error && typeof error.message === "string"
      ? error.message
      : "";
  const code =
    error && typeof error === "object" && "code" in error && typeof error.code === "string" ? error.code : "";

  if (message.toLowerCase().includes("failed to fetch") || message.toLowerCase().includes("network")) {
    return fallback;
  }
  if (message.toLowerCase().includes("row-level security") || code === "42501" || message.toLowerCase().includes("not allowed")) {
    return "You don’t have permission to perform this action.";
  }
  if (message.includes("LAST_ADMIN")) {
    return "An active administrator must remain on the account.";
  }
  if (message.toLowerCase().includes("unable to assign")) {
    return "Unable to assign this team member.";
  }
  if (code === "23505") {
    return "That record already exists.";
  }
  if (code === "23503") {
    return "Related records are missing. Refresh and try again.";
  }
  if (message.toLowerCase().includes("jwt expired") || code === "PGRST301") {
    return "Your session expired. Sign in again.";
  }
  if (message.toLowerCase().includes("jwt") || message.toLowerCase().includes("invalid api key")) {
    return "Database connection is misconfigured. Check the Supabase environment variables.";
  }
  if (
    message.toLowerCase().includes("bucket not found") ||
    message.toLowerCase().includes("object not found") ||
    message.toLowerCase().includes("not found") && message.toLowerCase().includes("storage")
  ) {
    return fallback;
  }
  if (message.toLowerCase().includes("payload too large") || message.toLowerCase().includes("maximum allowed size") || code === "413") {
    return "This file is too large. Maximum size is 50 MB.";
  }
  if (message.toLowerCase().includes("mime type") || message.toLowerCase().includes("invalid file")) {
    return "This file type isn’t supported.";
  }
  return fallback;
}

export function logDbError(context: string, error: unknown) {
  const code =
    error && typeof error === "object" && "code" in error && typeof error.code === "string" ? error.code : undefined;
  const message =
    error && typeof error === "object" && "message" in error && typeof error.message === "string"
      ? error.message
      : String(error);
  console.error(`[agency-db] ${context}`, code ? { code, message } : message);
}
