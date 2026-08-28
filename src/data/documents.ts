import { formatUsdFromCents } from "@/data/money";
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
      const day = expiry.slice(0, 10);
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
      return "That action isn’t available for the current status.";
    case "NOT_FOUND":
      return "This document could not be found.";
    case "CLIENT_NOT_FOUND":
      return "That client record could not be found.";
    case "DRAFT_EXISTS":
      return "A draft revision is already in progress.";
    case "email_failed":
      return "The document was saved, but the email could not be sent.";
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
  if (message.toLowerCase().includes("failed to fetch") || message.toLowerCase().includes("network")) {
    return "network";
  }
  if (message.toLowerCase().includes("row-level security") || message.includes("42501")) return "not_allowed";
  return "error";
}

export function investmentSummary(cents: number): string {
  return formatUsdFromCents(cents);
}
