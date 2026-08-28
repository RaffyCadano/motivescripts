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

export function draftsFromInvoiceItems(items: InvoiceItemRow[] | InvoiceSnapshotItem[]): LineItemDraft[] {
  if (items.length === 0) return [emptyLineItem()];
  return [...items]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((item) => ({
      key: item.id || `item-${crypto.randomUUID()}`,
      name: item.description,
      description: "",
      quantity: item.quantity,
      unitPriceCents: item.unit_price_cents,
    }));
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

export function invoiceDraftTotalCents(items: LineItemDraft[], taxCents: number, discountCents: number): {
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
} {
  const subtotal = lineItemsTotalCents(items.filter((item) => item.name.trim()));
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
  if (!items.some((item) => item.name.trim())) return "Add at least one line item before sending.";
  if (!issueDate || !dueDate) return "Issue date and due date are required.";
  if (dueDate < issueDate) return "Due date must be on or after the issue date.";
  if (invoiceDraftTotalCents(items, taxCents, discountCents).total <= 0) {
    return "Total must be greater than zero before sending.";
  }
  return null;
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
      return "This invoice has payments recorded, so it can’t be cancelled.";
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
