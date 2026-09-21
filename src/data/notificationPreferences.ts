import type { NotificationEvent } from "@/types/database";

/**
 * The in-app events a person can switch off, in display order. Keep in step with
 * notification_event_for_type() in supabase/migrations/20261001000000_notification_preferences.sql, which
 * decides which notification types belong to which event. Notifications for anything not listed here
 * (tasks, deadlines, payroll, domains, project updates, and so on) are always delivered.
 */
export const notificationEvents: { key: NotificationEvent; label: string; description: string }[] = [
  { key: "proposal_accepted", label: "Proposal accepted", description: "A client accepts a proposal." },
  { key: "contract_accepted", label: "Contract accepted", description: "A client accepts a contract." },
  { key: "invoice_paid", label: "Invoice paid", description: "An invoice is paid in full." },
  {
    key: "payment_received",
    label: "Payment received",
    description: "A payment is received or recorded, including online card payments.",
  },
  {
    key: "file_feedback",
    label: "File feedback",
    description: "A client leaves feedback or asks for changes on a file.",
  },
  {
    key: "approval_activity",
    label: "Approval activity",
    description: "A client approves a file, or a new version is ready for review.",
  },
  { key: "new_message", label: "New messages", description: "A client sends a message." },
  {
    key: "lead_submitted",
    label: "Lead submissions",
    description: "Someone submits Start a Project on the website. Leads you add by hand never notify you.",
  },
];

/**
 * The events that can reach a production-team member (developer, designer, content writer, QA). They never
 * get proposal, contract, invoice, payment, or lead notifications, so those switches would do nothing.
 * File feedback and approval activity need file access; project messages only reach the roles allowed to
 * message assigned clients.
 */
export function teamNotificationEvents(access: { canFiles: boolean; canMessages: boolean }): NotificationEvent[] {
  const keys: NotificationEvent[] = [];
  if (access.canMessages) keys.push("new_message");
  if (access.canFiles) keys.push("file_feedback", "approval_activity");
  return notificationEvents.filter((event) => keys.includes(event.key)).map((event) => event.key);
}

/**
 * The events that can reach someone in the admin workspace (Admin, Project Manager, Sales, Accounting),
 * decided by what they are allowed to see: an event only appears if they hold the permission behind it.
 * New-lead notifications go to admins only, so that switch is admin-only too.
 */
export function officeNotificationEvents(access: {
  isAdmin: boolean;
  can: (code: string) => boolean;
}): NotificationEvent[] {
  if (access.isAdmin) return notificationEvents.map((event) => event.key);
  const keys: NotificationEvent[] = [];
  if (access.can("proposals.view")) keys.push("proposal_accepted");
  if (access.can("contracts.view")) keys.push("contract_accepted");
  if (access.can("invoices.view")) keys.push("invoice_paid", "payment_received");
  if (access.can("files.view")) keys.push("file_feedback", "approval_activity");
  if (access.can("messages.view")) keys.push("new_message");
  return notificationEvents.filter((event) => keys.includes(event.key)).map((event) => event.key);
}

export type NotificationPreferenceMap = Record<NotificationEvent, boolean>;

/** Every event defaults to on, so a person with no saved rows keeps receiving everything. */
export function defaultNotificationPreferences(): NotificationPreferenceMap {
  return Object.fromEntries(notificationEvents.map((event) => [event.key, true])) as NotificationPreferenceMap;
}

/** Merges saved rows over the defaults. Unknown events are ignored. */
export function applyNotificationPreferenceRows(
  rows: { event: string; in_app: boolean }[],
): NotificationPreferenceMap {
  const map = defaultNotificationPreferences();
  for (const row of rows) {
    if (row.event in map) map[row.event as NotificationEvent] = row.in_app;
  }
  return map;
}
