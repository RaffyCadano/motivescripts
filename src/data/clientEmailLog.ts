/** One automated email sent to a client, from client_email_log (written by the document-email function). */
export type ClientEmailLogEntry = {
  id: string;
  kind: string;
  stage: string | null;
  subject: string;
  recipients: string[];
  providerId: string | null;
  createdAt: string;
};

const LAUNCH_STAGE_LABELS: Record<string, string> = {
  "7d": "ends in about a week",
  "1d": "ends tomorrow",
  paused: "site paused",
  manual: "site paused by us",
};

/** What the email was, in words staff recognise. */
export function clientEmailLabel(kind: string, stage: string | null): string {
  switch (kind) {
    case "scope_reminder":
      return `Website Scope reminder${stage ? ` (${stage} of 3)` : ""}`;
    case "reminder_proposal":
      return "Proposal reminder";
    case "reminder_contract":
      return "Contract reminder";
    case "reminder_invoice":
      return "Invoice due-soon reminder";
    case "reminder_invite":
      return "Portal invitation reminder";
    case "reminder_discovery":
      return "Project details reminder";
    case "reminder_review":
      return "Files awaiting review reminder";
    case "reminder_info_request":
      return "Information request reminder";
    case "invoice_overdue":
      return "Overdue invoice reminder";
    case "plan_past_due":
      return "Payment failed notice";
    case "plan_canceled":
      return "Plan canceled notice";
    case "launch_trial":
      return `Free launch period${stage && LAUNCH_STAGE_LABELS[stage] ? `: ${LAUNCH_STAGE_LABELS[stage]}` : ""}`;
    default:
      return kind.replace(/_/g, " ");
  }
}
