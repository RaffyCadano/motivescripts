/** What admin_client_deletion_preview() says would be deleted along with a client. */
export type ClientDeletionPreview = {
  businessName: string;
  projects: number;
  tasks: number;
  files: number;
  storedFiles: number;
  proposals: number;
  contracts: number;
  invoices: number;
  paidCents: number;
  conversations: number;
  timeEntries: number;
  careRequests: number;
  portalAccounts: number;
  hasActivePlan: boolean;
  liveWebsites: string[];
};

/** Why deleting a client was refused, in words for the admin. Unknown errors get the fallback. */
export function deleteClientErrorMessage(message: string | null | undefined): string {
  const text = message ?? "";
  if (text.includes("CONFIRMATION_REQUIRED")) return "Type the client's business name exactly to confirm.";
  if (text.includes("ACTIVE_PLAN")) return "This client still has an active Website Care plan. Cancel the plan first.";
  if (text.includes("WEBSITE_LIVE")) return "This client's website is still live. Take it down first, or choose to leave it running.";
  if (text.includes("NOT_FOUND")) return "That client no longer exists.";
  if (text.includes("Not allowed")) return "You don't have permission to delete clients.";
  return "Unable to delete this client.";
}

/** The lines of the confirmation screen: what goes, with counts, skipping anything the client doesn't have. */
export function deletionSummaryLines(preview: ClientDeletionPreview): string[] {
  const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
  const lines: string[] = [];
  if (preview.projects > 0) lines.push(`${plural(preview.projects, "project")}, with ${plural(preview.tasks, "task")}`);
  if (preview.files > 0 || preview.storedFiles > 0) lines.push(`${plural(preview.files, "file version")} and ${plural(preview.storedFiles, "stored file")}`);
  if (preview.proposals > 0) lines.push(plural(preview.proposals, "proposal"));
  if (preview.contracts > 0) lines.push(plural(preview.contracts, "contract"));
  if (preview.invoices > 0) {
    const paid = preview.paidCents > 0 ? `, ${(preview.paidCents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })} paid` : "";
    lines.push(`${plural(preview.invoices, "invoice")} and their payment records${paid}`);
  }
  if (preview.conversations > 0) lines.push(plural(preview.conversations, "conversation"));
  if (preview.timeEntries > 0) lines.push(plural(preview.timeEntries, "logged time entry", "logged time entries"));
  if (preview.careRequests > 0) lines.push(plural(preview.careRequests, "care request"));
  if (preview.portalAccounts > 0) lines.push(`${plural(preview.portalAccounts, "portal login")} (they will no longer be able to sign in)`);
  return lines;
}
