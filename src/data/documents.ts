import { formatUsdFromCents } from "@/data/money";
import { proposalLineDescription } from "@/data/proposalPresets";
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

export function defaultProposalLineItem(): LineItemDraft {
  return {
    key: `item-${crypto.randomUUID()}`,
    name: "Website",
    description: proposalLineDescription("Website"),
    quantity: 1,
    unitPriceCents: DEFAULT_PROPOSAL_LINE_PRICE_CENTS,
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

export function applyProposalLineDefaults(items: LineItemDraft[]): LineItemDraft[] {
  const named = items.filter((item) => item.name.trim());
  if (named.length === 0) return [defaultProposalLineItem()];

  const priced = named.map((item) => {
    const next = { ...item };
    if (next.name.trim().toLowerCase() === "website" && next.unitPriceCents === 0) {
      next.unitPriceCents = DEFAULT_PROPOSAL_LINE_PRICE_CENTS;
    }
    if (!next.description.trim()) {
      next.description = proposalLineDescription(next.name);
    }
    return next;
  });

  const unique = dedupeProposalLineItems(priced);
  return unique.length > 0 ? unique : [defaultProposalLineItem()];
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
  return item.quantity * item.unitPriceCents;
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
