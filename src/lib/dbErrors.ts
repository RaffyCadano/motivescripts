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
  if (message.toLowerCase().includes("row-level security")) {
    return "You don’t have permission to perform this action.";
  }
  if (code === "42501") {
    // Every access-control check in the schema raises the literal string
    // 'Not allowed' with this code; every workflow-gate rejection (launch,
    // task, project-completion gates) raises a real, already-safe-for-staff
    // sentence with the same code, e.g. "Cannot complete this project: it
    // has not launched to production yet." Collapsing both into the generic
    // permission message hid the actual reason from the PM/staff member
    // who hit the gate.
    //
    // Passing through EVERY non-"Not allowed" 42501 message would also let
    // a raw Postgres grant-level "permission denied for table X" (a
    // different failure mode than RLS, which is already caught above) leak
    // a table/column name -- so only recognized workflow-gate sentences are
    // shown verbatim; anything else still falls back to the generic
    // message. New gate messages need their prefix added here to surface
    // (see supabase/migrations/20260930090000_production_workflow_gates.sql
    // and 20260930280000_handoff_and_project_completion_gate.sql).
    if (message.trim() === "Not allowed") {
      return "You don’t have permission to perform this action.";
    }
    const isKnownWorkflowGateMessage =
      /^(cannot (launch|complete)|development is locked|qa is locked|client review is locked|a reason is required|set a qa result)/i.test(
        message.trim(),
      );
    return isKnownWorkflowGateMessage ? message : "You don’t have permission to perform this action.";
  }
  if (message.toLowerCase().includes("not allowed")) {
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

export function isSchemaColumnMissing(error: unknown, _table: string, column: string): boolean {
  const message =
    error && typeof error === "object" && "message" in error && typeof error.message === "string"
      ? error.message
      : "";
  const code =
    error && typeof error === "object" && "code" in error && typeof error.code === "string" ? error.code : "";
  const lower = message.toLowerCase();
  if (code === "PGRST204") {
    return lower.includes(column.toLowerCase());
  }
  if (code === "42703") {
    return lower.includes(column.toLowerCase()) || lower.includes("does not exist");
  }
  return (
    lower.includes(column.toLowerCase()) &&
    (lower.includes("schema cache") || lower.includes("does not exist") || lower.includes("could not find"))
  );
}

export function logDbError(context: string, error: unknown) {
  const code =
    error && typeof error === "object" && "code" in error && typeof error.code === "string" ? error.code : undefined;
  const message =
    error && typeof error === "object" && "message" in error && typeof error.message === "string"
      ? error.message
      : String(error);
  const details =
    error && typeof error === "object" && "details" in error && typeof error.details === "string"
      ? error.details
      : undefined;
  const hint =
    error && typeof error === "object" && "hint" in error && typeof error.hint === "string" ? error.hint : undefined;
  console.error(`[agency-db] ${context}`, { code, message, details, hint });
}
