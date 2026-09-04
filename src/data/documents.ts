import { formatUsdFromCents } from "@/data/money";
import { proposalLineDescription } from "@/data/proposalPresets";
import { site } from "@/data/site";
import type { DocumentStatus, ProposalItemRow } from "@/types/database";

export const documentStatuses = [
  "draft",
  "sent",
  "viewed",
  "accepted",
  "declined",
  "expired",
  "cancelled",
] as const;

export type { DocumentStatus };

export type SnapshotItem = {
  id?: string;
  name: string;
  description: string;
  quantity: number;
  unit_price_cents: number;
  total_cents: number;
  sort_order: number;
};

export type LineItemDraft = {
  key: string;
  name: string;
  description: string;
  quantity: number;
  unitPriceCents: number;
};

export function emptyLineItem(): LineItemDraft {
  return { key: `item-${crypto.randomUUID()}`, name: "", description: "", quantity: 1, unitPriceCents: 0 };
}

/** Starter website price on new proposal drafts. Change the unit price on the draft if this job is different. */
export const DEFAULT_PROPOSAL_LINE_PRICE_CENTS = 250_000;

export function defaultProposalLineItem(priceCents = DEFAULT_PROPOSAL_LINE_PRICE_CENTS): LineItemDraft {
  const cents =
    typeof priceCents === "number" && Number.isFinite(priceCents) && priceCents >= 0
      ? Math.floor(priceCents)
      : DEFAULT_PROPOSAL_LINE_PRICE_CENTS;
  return {
    key: `item-${crypto.randomUUID()}`,
    name: "Website",
    description: proposalLineDescription("Website"),
    quantity: 1,
    unitPriceCents: cents,
  };
}

export function toggleNamedLineItem(
  items: LineItemDraft[],
  name: string,
  unitPriceCents: number,
  enabled: boolean,
): LineItemDraft[] {
  const label = name.trim();
  if (!label) return items;
  const match = (item: LineItemDraft) => item.name.trim().toLowerCase() === label.toLowerCase();
  if (enabled) {
    if (items.some(match)) {
      return items.map((item) =>
        match(item)
          ? {
              ...item,
              unitPriceCents,
              description: item.description.trim() || proposalLineDescription(label),
            }
          : item,
      );
    }
    const row: LineItemDraft = {
      key: `item-${crypto.randomUUID()}`,
      name: label,
      description: proposalLineDescription(label),
      quantity: 1,
      unitPriceCents,
    };
    const onlyBlank = items.length === 1 && !items[0].name.trim();
    return onlyBlank ? [row] : [...items, row];
  }
  const next = items.filter((item) => !match(item));
  return next.length === 0 ? [emptyLineItem()] : next;
}

function lineItemIdentity(item: LineItemDraft): string {
  return [
    item.name.trim().toLowerCase(),
    item.description.trim().toLowerCase(),
    item.quantity,
    item.unitPriceCents,
  ].join("|");
}

export function dedupeProposalLineItems(items: LineItemDraft[]): LineItemDraft[] {
  const seen = new Set<string>();
  const unique: LineItemDraft[] = [];
  for (const item of items) {
    const id = lineItemIdentity(item);
    if (seen.has(id)) continue;
    seen.add(id);
    unique.push(item);
  }
  return unique;
}

export function applyProposalLineDefaults(
  items: LineItemDraft[],
  websiteCents = DEFAULT_PROPOSAL_LINE_PRICE_CENTS,
): LineItemDraft[] {
  const named = items.filter((item) => item.name.trim());
  if (named.length === 0) return [defaultProposalLineItem(websiteCents)];

  const priced = named.map((item) => {
    const next = { ...item };
    if (next.name.trim().toLowerCase() === "website" && next.unitPriceCents === 0) {
      next.unitPriceCents =
        typeof websiteCents === "number" && Number.isFinite(websiteCents) && websiteCents >= 0
          ? Math.floor(websiteCents)
          : DEFAULT_PROPOSAL_LINE_PRICE_CENTS;
    }
    if (!next.description.trim()) {
      next.description = proposalLineDescription(next.name);
    }
    return next;
  });

  const unique = dedupeProposalLineItems(priced);
  return unique.length > 0 ? unique : [defaultProposalLineItem(websiteCents)];
}

export const DEFAULT_CONTRACT_VALID_DAYS = 30;

export function defaultProposalValidUntil(now = new Date(), days = 30): string {
  const date = new Date(now);
  const span = Number.isFinite(days) ? Math.min(365, Math.max(1, Math.floor(days))) : 30;
  date.setDate(date.getDate() + span);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** YYYY-MM-DD for date inputs. Postgres date columns and ISO timestamps both work. */
export function calendarDateValue(value: string | null | undefined): string {
  if (!value) return "";
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value.trim());
  return match?.[1] ?? "";
}

export function calendarDateOrNull(value: string | null | undefined): string | null {
  return calendarDateValue(value) || null;
}

export function formatCalendarDate(value: string | null | undefined): string {
  const day = calendarDateValue(value);
  if (!day) return "";
  return new Date(`${day}T00:00:00`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function itemsFromSnapshot(value: unknown): SnapshotItem[] {
  if (!Array.isArray(value)) return [];
  const items: SnapshotItem[] = [];
  value.forEach((entry, index) => {
    if (!entry || typeof entry !== "object") return;
    const row = entry as Record<string, unknown>;
    const quantity = typeof row.quantity === "number" && row.quantity > 0 ? Math.floor(row.quantity) : 1;
    const unit = typeof row.unit_price_cents === "number" ? Math.max(0, Math.floor(row.unit_price_cents)) : 0;
    items.push({
      id: typeof row.id === "string" ? row.id : undefined,
      name: typeof row.name === "string" ? row.name : "Item",
      description: typeof row.description === "string" ? row.description : "",
      quantity,
      unit_price_cents: unit,
      total_cents: typeof row.total_cents === "number" ? Math.floor(row.total_cents) : quantity * unit,
      sort_order: typeof row.sort_order === "number" ? row.sort_order : index,
    });
  });
  return items;
}

export function toSnapshotItems(items: ProposalItemRow[] | SnapshotItem[]): SnapshotItem[] {
  return [...items]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((item, index) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      quantity: item.quantity,
      unit_price_cents: item.unit_price_cents,
      total_cents: item.total_cents,
      sort_order: item.sort_order ?? index,
    }));
}

export function draftsFromItems(items: ProposalItemRow[] | SnapshotItem[]): LineItemDraft[] {
  if (items.length === 0) return [emptyLineItem()];
  return toSnapshotItems(items).map((item) => ({
    key: item.id || `item-${crypto.randomUUID()}`,
    name: item.name,
    description: item.description,
    quantity: item.quantity,
    unitPriceCents: item.unit_price_cents,
  }));
}

export function lineItemTotalCents(item: LineItemDraft): number {
  return Math.round(item.quantity * item.unitPriceCents);
}

export function lineItemsTotalCents(items: LineItemDraft[]): number {
  return items.reduce((sum, item) => sum + lineItemTotalCents(item), 0);
}

export function effectiveDocumentStatus(
  status: DocumentStatus,
  expiry: string | null | undefined,
  now = new Date(),
): DocumentStatus {
  if (status === "sent" || status === "viewed") {
    if (expiry) {
      const day = calendarDateValue(expiry);
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      if (day < today) return "expired";
    }
  }
  return status;
}

export type ContractSignedCopy = {
  storagePath: string;
  fileName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
};

export function contractSignedCopyFromRow(row: {
  client_signed_copy_path: string | null;
  client_signed_copy_file_name: string;
  client_signed_copy_mime_type: string;
  client_signed_copy_size: number;
  client_signed_copy_uploaded_at: string | null;
}): ContractSignedCopy | null {
  if (!row.client_signed_copy_path || !row.client_signed_copy_uploaded_at) return null;
  return {
    storagePath: row.client_signed_copy_path,
    fileName: row.client_signed_copy_file_name.trim() || "Signed contract",
    mimeType: row.client_signed_copy_mime_type,
    size: row.client_signed_copy_size,
    uploadedAt: row.client_signed_copy_uploaded_at,
  };
}

export function contractIsAgencySigned(revision: { agency_signed_at?: string | null } | null | undefined): boolean {
  return Boolean(revision?.agency_signed_at);
}

/** Display-only workflow label. Does not change stored revision status. */
export function contractWorkflowLabel(input: {
  status: DocumentStatus;
  agencySigned: boolean;
  signedCopyUploaded: boolean;
}): string {
  if (input.status === "draft") {
    return input.agencySigned ? "Agency Signed" : "Agency Signature Required";
  }
  if (input.status === "sent" || input.status === "viewed") return "Sent to Client";
  if (input.status === "accepted") {
    return input.signedCopyUploaded ? "Signed Document Uploaded" : "Client Accepted";
  }
  return adminStatusLabel(input.status);
}

export function formatDocumentTimestamp(value: string | null | undefined): string {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function adminStatusLabel(status: DocumentStatus): string {
  switch (status) {
    case "draft":
      return "Draft";
    case "sent":
      return "Sent";
    case "viewed":
      return "Viewed";
    case "accepted":
      return "Accepted";
    case "declined":
      return "Declined";
    case "expired":
      return "Expired";
    case "cancelled":
      return "Cancelled";
  }
}

export function clientStatusLabel(status: DocumentStatus): string {
  if (status === "sent") return "Awaiting Review";
  if (status === "draft" || status === "cancelled") return adminStatusLabel(status);
  return adminStatusLabel(status);
}

export function awaitingResponse(status: DocumentStatus): boolean {
  return status === "sent" || status === "viewed";
}

/** Agency-facing proposal label. Database status stays sent/viewed. */
export function proposalWorkspaceLabel(status: DocumentStatus): string {
  if (awaitingResponse(status)) return "Awaiting Response";
  return adminStatusLabel(status);
}

export function proposalActivityAt(row: {
  acceptedAt: string | null;
  sentAt: string | null;
  createdAt: string;
}): string {
  return row.acceptedAt || row.sentAt || row.createdAt;
}

export function formatProposalValidUntil(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "—";
  return `Valid until ${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

export function contractWorkspaceLabel(status: DocumentStatus): string {
  return proposalWorkspaceLabel(status);
}

export function formatContractCalendarDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** Display-only signature caption from existing agency_signed_at. */
export function contractSignatureCaption(input: { status: DocumentStatus; agencySigned: boolean }): string {
  if (input.status === "draft") {
    return input.agencySigned ? "Agency Signed ✓ · Ready to send" : "Agency signature required";
  }
  if (awaitingResponse(input.status)) {
    return input.agencySigned ? "Agency Signed ✓" : "Sent";
  }
  return input.agencySigned ? "Agency Signed ✓" : "—";
}

export function documentErrorMessage(code: string): string {
  switch (code) {
    case "EXPIRED":
      return "This document has expired and can no longer be accepted.";
    case "INVALID_STATUS":
      return "This proposal can’t be sent in its current status. Save a draft, then send it again.";
    case "NOT_FOUND":
      return "This document could not be found.";
    case "CLIENT_NOT_FOUND":
      return "That client record could not be found.";
    case "DRAFT_EXISTS":
      return "A draft revision is already in progress.";
    case "HAS_INVOICES":
      return "This document has invoices, so it can’t be deleted. Cancel or remove those invoices first.";
    case "HAS_CONTRACTS":
      return "This proposal has a contract, so it can’t be deleted. Delete or cancel that contract first.";
    case "HAS_ACCEPTED":
      return "This document was accepted, so it can’t be deleted.";
    case "email_failed":
      return "The proposal email could not be sent. Check the client’s email address and try again.";
    case "no_recipient":
      return "This client has no email address. Add one on the client record, then resend.";
    case "email_unavailable":
      return "Proposal email isn’t available yet. Deploy the document-email function.";
    case "missing_site_url":
      return "Email isn’t configured yet. Set PUBLIC_SITE_URL on the Edge Function.";
    case "AGENCY_SIGNATURE_REQUIRED":
      return "Agency signature required before sending.";
    case "not_allowed":
      return "You don’t have permission to do that.";
    case "proposal_pdf_failed":
      return "Unable to generate the proposal PDF. Please try again.";
    case "contract_pdf_failed":
      return "Unable to generate the contract PDF. Please try again.";
    case "network":
      return "We couldn’t reach the server. Check your connection and try again.";
    default:
      return "Something went wrong. Please try again.";
  }
}

export function rpcErrorCode(message: string): string {
  const upper = message.toUpperCase();
  if (upper.includes("EXPIRED")) return "EXPIRED";
  if (upper.includes("INVALID_STATUS")) return "INVALID_STATUS";
  if (upper.includes("NOT_FOUND")) return "NOT_FOUND";
  if (upper.includes("CLIENT_NOT_FOUND")) return "CLIENT_NOT_FOUND";
  if (upper.includes("DRAFT_EXISTS")) return "DRAFT_EXISTS";
  if (upper.includes("HAS_INVOICES")) return "HAS_INVOICES";
  if (upper.includes("HAS_CONTRACTS")) return "HAS_CONTRACTS";
  if (upper.includes("HAS_ACCEPTED")) return "HAS_ACCEPTED";
  if (upper.includes("AGENCY_SIGNATURE_REQUIRED")) return "AGENCY_SIGNATURE_REQUIRED";
  if (message.toLowerCase().includes("failed to fetch") || message.toLowerCase().includes("network")) {
    return "network";
  }
  if (
    message.toLowerCase().includes("row-level security") ||
    message.includes("42501") ||
    message.toLowerCase().includes("not allowed")
  ) {
    return "not_allowed";
  }
  return "error";
}

export function investmentSummary(cents: number): string {
  return formatUsdFromCents(cents);
}

/** Matches document-email: portal profile emails plus the client record email. */
export function documentMailRecipients(clientEmail?: string | null, portalEmails: Array<string | null | undefined> = []): string[] {
  return [
    ...new Set(
      [...portalEmails, clientEmail]
        .map((value) => (value ?? "").trim().toLowerCase())
        .filter((value) => value.includes("@")),
    ),
  ];
}

export function documentMailRecipientCopy(
  recipients: string[],
  options?: { companyName?: string; action?: "send" | "resend" },
): string {
  const company = options?.companyName?.trim();
  const verb = options?.action === "resend" ? "This email will be sent again to" : "This email will go to";
  if (recipients.length === 0) {
    return company
      ? `No email is on file for ${company}. Add a client email or portal account before sending.`
      : "No email is on file for this client. Add a client email or portal account before sending.";
  }
  const list = recipients.join(", ");
  return company ? `${verb} ${list} (${company}).` : `${verb} ${list}.`;
}

/** Starting copy for a new contract. Matches `website_contract_template` in SQL. Not persisted until Save draft. */
export function websiteContractTemplate(companyName: string) {
  const company = companyName.trim() || "the Client";
  return {
    title: "Website Development Agreement",
    parties: `This agreement is between ${site.name} (“Agency”) and ${company} (“Client”). This document is a working agreement for the project described below. It is not legal advice and may need review for a specific jurisdiction.`,
    scope:
      "The Agency will design and develop the website described in the related proposal, including the pages and features listed in that proposal’s scope of work.",
    responsibilities:
      "Agency: plan, design, and implement the agreed website, and communicate progress through the MotiveScripts portal.\nClient: provide content, feedback, and timely approvals so work can move forward.",
    timeline:
      "The schedule in the related proposal applies unless both parties agree to an update in writing (including a message in the client portal).",
    compensation: "Compensation matches the investment in the related proposal. Invoices and payment collection are handled separately.",
    paymentTerms: "Payment terms match the related proposal unless this agreement states otherwise.",
    confidentiality:
      "Each party will treat non-public business information shared for this project as confidential and use it only to complete the work.",
    intellectualProperty:
      "Upon full payment for the agreed work, the Client receives ownership of the final approved website deliverables created uniquely for the Client, excluding Agency tools, frameworks, and prior materials.",
    revisionsPolicy: "Revision rounds follow the related proposal. Work outside the agreed scope may require an updated proposal.",
    termination:
      "Either party may end this agreement with written notice if the other party materially fails to meet its responsibilities after a reasonable chance to remedy.",
    generalTerms:
      "This agreement is a software workflow record of the business terms the Client reviewed in the MotiveScripts portal. It is not a substitute for counsel. Electronic acceptance here records the authenticated user’s agreement; it is not a qualified digital signature under every jurisdiction’s e-sign rules.",
  };
}
