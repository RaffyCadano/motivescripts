import { emptyLineItem, lineItemTotalCents, lineItemsTotalCents, type LineItemDraft } from "@/data/documents";
import { formatMoneyFromCents, formatUsdFromCents } from "@/data/money";
import type { InvoiceItemRow, InvoiceStatus, PaymentMethod } from "@/types/database";

export type { InvoiceStatus, LineItemDraft, PaymentMethod };

export type EffectiveInvoiceStatus = InvoiceStatus | "overdue";

export type InvoiceSnapshotItem = {
  id?: string;
  description: string;
  quantity: number;
  unit_price_cents: number;
  total_cents: number;
  sort_order: number;
};

export function invoiceItemsFromSnapshot(value: unknown): InvoiceSnapshotItem[] {
  if (!Array.isArray(value)) return [];
  const items: InvoiceSnapshotItem[] = [];
  value.forEach((entry, index) => {
    if (!entry || typeof entry !== "object") return;
    const row = entry as Record<string, unknown>;
    const quantity = typeof row.quantity === "number" && row.quantity > 0 ? Math.floor(row.quantity) : 1;
    const unit = typeof row.unit_price_cents === "number" ? Math.max(0, Math.floor(row.unit_price_cents)) : 0;
    const description =
      typeof row.description === "string" && row.description.trim()
        ? row.description
        : typeof row.name === "string"
          ? row.name
          : "Item";
    items.push({
      id: typeof row.id === "string" ? row.id : undefined,
      description,
      quantity,
      unit_price_cents: unit,
      total_cents: typeof row.total_cents === "number" ? Math.floor(row.total_cents) : quantity * unit,
      sort_order: typeof row.sort_order === "number" ? row.sort_order : index,
    });
  });
  return items;
}

export function invoiceItemIsBillable(item: LineItemDraft): boolean {
  return Boolean(item.name.trim() || item.description.trim());
}

/** Invoice items store a single description. Keep name + optional detail in that field. */
export function invoiceItemClientDescription(item: LineItemDraft): string {
  return [item.name.trim(), item.description.trim()].filter(Boolean).join("\n");
}

export function previewInvoiceDraftItems(items: LineItemDraft[]): InvoiceSnapshotItem[] {
  return items.filter(invoiceItemIsBillable).map((item, index) => {
    const quantity = Math.max(1, Math.floor(item.quantity) || 1);
    const unit = Math.max(0, Math.floor(item.unitPriceCents) || 0);
    return {
      description: invoiceItemClientDescription(item),
      quantity,
      unit_price_cents: unit,
      total_cents: quantity * unit,
      sort_order: index,
    };
  });
}

export function draftsFromInvoiceItems(items: InvoiceItemRow[] | InvoiceSnapshotItem[]): LineItemDraft[] {
  if (items.length === 0) return [emptyLineItem()];
  return [...items]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((item) => {
      const raw = item.description.trim();
      const breakAt = raw.indexOf("\n");
      return {
        key: item.id || `item-${crypto.randomUUID()}`,
        name: breakAt >= 0 ? raw.slice(0, breakAt).trim() : raw,
        description: breakAt >= 0 ? raw.slice(breakAt + 1).trim() : "",
        quantity: item.quantity,
        unitPriceCents: item.unit_price_cents,
      };
    });
}

export function isoCalendarDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function isoCalendarDatePlusDays(days: number, date = new Date()): string {
  return isoCalendarDate(new Date(date.getFullYear(), date.getMonth(), date.getDate() + days));
}

export function formatInvoiceDate(value: string | null | undefined): string {
  if (!value) return "—";
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export function invoiceHasActivePayments(payments: { reversed_at: string | null }[]): boolean {
  return payments.some((item) => item.reversed_at == null);
}

export function canRecordInvoicePayment(status: EffectiveInvoiceStatus): boolean {
  return status === "sent" || status === "viewed" || status === "overdue" || status === "partially_paid";
}

export function canCancelInvoice(status: EffectiveInvoiceStatus, hasPayments: boolean): boolean {
  if (hasPayments) return false;
  return status === "draft" || status === "sent" || status === "viewed" || status === "overdue";
}

export function canRestoreInvoice(status: EffectiveInvoiceStatus, hasPayments: boolean): boolean {
  return status === "cancelled" && !hasPayments;
}

export function canEditSentInvoice(status: EffectiveInvoiceStatus, hasPayments: boolean): boolean {
  if (hasPayments) return false;
  return status === "cancelled" || status === "sent" || status === "viewed" || status === "overdue";
}

export function canDeleteInvoice(
  status: EffectiveInvoiceStatus,
  paymentCount: number,
  amountPaidCents: number,
): boolean {
  if (paymentCount > 0 || amountPaidCents > 0) return false;
  return status !== "paid" && status !== "partially_paid";
}

export function invoiceDraftTotalCents(items: LineItemDraft[], taxCents: number, discountCents: number): {
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
} {
  const subtotal = lineItemsTotalCents(items.filter(invoiceItemIsBillable));
  const tax = Math.max(0, Math.floor(taxCents) || 0);
  const discount = Math.max(0, Math.floor(discountCents) || 0);
  const total = Math.max(0, subtotal + tax - discount);
  return { subtotal, tax, discount, total };
}

export function invoiceSendBlockedReason(
  items: LineItemDraft[],
  taxCents: number,
  discountCents: number,
  issueDate: string,
  dueDate: string,
): string | null {
  const billed = items.filter(invoiceItemIsBillable);
  if (billed.length === 0) return "Add at least one line item before sending.";
  if (billed.some((item) => item.quantity <= 0)) return "Each line item needs a quantity greater than zero.";
  if (billed.some((item) => item.unitPriceCents < 0)) return "Unit price cannot be negative.";
  if (!issueDate || !dueDate) return "Issue date and due date are required.";
  if (dueDate < issueDate) return "Due date must be on or after the issue date.";
  if (invoiceDraftTotalCents(items, taxCents, discountCents).total <= 0) {
    return "Total must be greater than zero before sending.";
  }
  return null;
}

export function invoiceLinkingBlockedReason(input: {
  clientId: string;
  projectId: string;
  contractId: string;
  projects: { id: string; clientId: string }[];
  contracts: { id: string; clientId: string; projectId: string | null }[];
}): string | null {
  if (!input.clientId) return "Select a client first.";
  if (input.projectId) {
    const project = input.projects.find((row) => row.id === input.projectId);
    if (!project) return "The selected project could not be found.";
    if (project.clientId !== input.clientId) return "The selected project does not belong to this client.";
  }
  if (input.contractId) {
    const contract = input.contracts.find((row) => row.id === input.contractId);
    if (!contract) return "The selected contract could not be found.";
    if (contract.clientId !== input.clientId) return "The selected contract does not belong to this client.";
    if (input.projectId && contract.projectId && contract.projectId !== input.projectId) {
      return "The selected contract does not belong to this project.";
    }
  }
  return null;
}

export function invoiceSendConfirmCopy(input: {
  companyName: string;
  totalLabel: string;
  dueLabel: string;
}): { title: string; totalLabel: string; dueLabel: string; description: string } {
  const company = input.companyName.trim() || "the client";
  return {
    title: `Send invoice to ${company}?`,
    totalLabel: input.totalLabel,
    dueLabel: input.dueLabel,
    description: [
      `Total: ${input.totalLabel}`,
      `Due: ${input.dueLabel}`,
      "",
      "This emails the client and makes the invoice available in their portal.",
    ].join("\n"),
  };
}

export function invoiceSentMessage(emailed: boolean): string {
  return emailed
    ? "Invoice sent to the client. They’ll see it in their portal and receive an email."
    : "Invoice is now in the client portal, but the email could not be delivered. Open the invoice and use Resend email.";
}

export function effectiveInvoiceStatus(
  status: InvoiceStatus,
  dueDate: string | null | undefined,
  amountDueCents: number,
  now = new Date(),
): EffectiveInvoiceStatus {
  if (status === "sent" || status === "viewed") {
    if (dueDate && amountDueCents > 0) {
      const day = dueDate.slice(0, 10);
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      if (day < today) return "overdue";
    }
  }
  return status;
}

export function adminInvoiceStatusLabel(status: EffectiveInvoiceStatus): string {
  switch (status) {
    case "draft":
      return "Draft";
    case "sent":
      return "Sent";
    case "viewed":
      return "Viewed";
    case "partially_paid":
      return "Partially paid";
    case "paid":
      return "Paid";
    case "overdue":
      return "Overdue";
    case "cancelled":
      return "Cancelled";
  }
}

export function clientInvoiceStatusLabel(status: EffectiveInvoiceStatus): string {
  if (status === "sent" || status === "viewed") return "Awaiting payment";
  return adminInvoiceStatusLabel(status);
}

export function awaitingInvoicePayment(status: EffectiveInvoiceStatus): boolean {
  return status === "sent" || status === "viewed" || status === "overdue" || status === "partially_paid";
}

export const STRIPE_MIN_CHARGE_CENTS = 50;

export function canPayInvoiceOnline(status: EffectiveInvoiceStatus, amountDueCents: number): boolean {
  return awaitingInvoicePayment(status) && amountDueCents >= STRIPE_MIN_CHARGE_CENTS;
}

export function paymentStatusLabel(reversedAt: string | null): string {
  return reversedAt ? "Reversed" : "Received";
}

export function paymentMethodLabel(method: PaymentMethod): string {
  switch (method) {
    case "bank_transfer":
      return "Bank Transfer";
    case "cash":
      return "Cash";
    case "check":
      return "Check";
    case "other":
      return "Other";
    case "stripe":
      return "Stripe";
  }
}

export function invoiceErrorMessage(code: string): string {
  switch (code) {
    case "PAYMENT_EXCEEDS_TOTAL":
      return "That payment is more than the amount due.";
    case "PAYMENT_INVALID":
      return "Enter a valid payment amount and method.";
    case "HAS_PAYMENTS":
      return "This invoice has payments recorded, so that action isn’t available.";
    case "not_payable":
      return "This invoice isn’t available for online payment.";
    case "invalid_amount":
      return "Enter an amount greater than zero and not more than the amount due.";
    case "amount_too_small":
      return "Online payment is available for $0.50 or more.";
    case "INVALID_STATUS":
      return "That action isn’t available for the current invoice status.";
    case "NOT_FOUND":
      return "This invoice could not be found.";
    case "CLIENT_NOT_FOUND":
      return "That client record could not be found.";
    case "email_failed":
      return "The invoice was saved, but the email could not be sent.";
    case "no_recipient":
      return "This client has no email address. Add one on the client record, then resend.";
    case "email_unavailable":
      return "Invoice email isn’t available yet. Deploy the document-email function.";
    case "missing_site_url":
      return "Email isn’t configured yet. Set PUBLIC_SITE_URL on the Edge Function.";
    case "not_allowed":
      return "You don’t have permission to do that.";
    case "pdf_failed":
      return "Unable to generate invoice PDF. Please try again.";
    case "network":
      return "We couldn’t reach the server. Check your connection and try again.";
    default:
      return "Something went wrong. Please try again.";
  }
}

export function invoiceRpcErrorCode(message: string): string {
  const upper = message.toUpperCase();
  if (upper.includes("PAYMENT_EXCEEDS_TOTAL")) return "PAYMENT_EXCEEDS_TOTAL";
  if (upper.includes("PAYMENT_INVALID")) return "PAYMENT_INVALID";
  if (upper.includes("HAS_PAYMENTS")) return "HAS_PAYMENTS";
  if (upper.includes("INVALID_STATUS")) return "INVALID_STATUS";
  if (upper.includes("NOT_FOUND")) return "NOT_FOUND";
  if (upper.includes("CLIENT_NOT_FOUND")) return "CLIENT_NOT_FOUND";
  if (message.toLowerCase().includes("failed to fetch") || message.toLowerCase().includes("network")) {
    return "network";
  }
  if (message.toLowerCase().includes("row-level security") || message.includes("42501")) return "not_allowed";
  return "error";
}

export { emptyLineItem, lineItemTotalCents, lineItemsTotalCents, formatMoneyFromCents, formatUsdFromCents };
