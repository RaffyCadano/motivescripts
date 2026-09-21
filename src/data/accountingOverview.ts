/**
 * Pure selectors for the Accounting Dashboard. Same style as salesOverview.ts / pmOverview.ts: plain
 * functions over invoice summaries and recorded payments the overview already loads, no hooks or fetching.
 * Every figure is summed from real records; nothing is estimated. Totals add cents across invoices the same
 * way the admin overview's invoice totals do (no currency conversion).
 *
 * Imports are relative (and type-only where possible) so these functions can be unit tested in plain Node
 * (scripts/test-accounting-overview.mjs).
 */
import type { InvoiceSummary } from "@/data/invoicesRepository";

const DAY_MS = 24 * 60 * 60 * 1000;

/** A payment as recorded against an invoice. Reversed payments are kept in the list but never counted. */
export type PaymentRecord = {
  id: string;
  invoiceId: string;
  amountCents: number;
  /** Date-only (YYYY-MM-DD) or full ISO timestamp. */
  paymentDate: string;
  method: string;
  reversedAt: string | null;
};

type OpenInvoice = Pick<InvoiceSummary, "effectiveStatus" | "amountDueCents" | "dueDate">;

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function parseDay(value: string): Date {
  return new Date(value.includes("T") ? value : `${value}T12:00:00`);
}

function isoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Whole local calendar days from `value` to `now` (0 = today, positive = in the past). */
function daysSince(value: string, now: Date): number {
  const date = parseDay(value);
  if (Number.isNaN(date.getTime())) return 0;
  return Math.round((startOfDay(now) - startOfDay(date)) / DAY_MS);
}

/** Sent, viewed, part-paid, or overdue: money the client still owes and has been asked for. */
function awaitingPayment(status: string): boolean {
  return status === "sent" || status === "viewed" || status === "partially_paid" || status === "overdue";
}

export const invoiceStatusOrder = ["draft", "sent", "viewed", "partially_paid", "overdue", "paid"] as const;
export type CountedInvoiceStatus = (typeof invoiceStatusOrder)[number];
export type InvoiceStatusCount = { status: CountedInvoiceStatus; label: string; count: number };

const statusLabels: Record<CountedInvoiceStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  viewed: "Viewed",
  partially_paid: "Part paid",
  overdue: "Overdue",
  paid: "Paid",
};

/** Invoices per status in workflow order, including zeros so the chart's categories stay stable. Cancelled invoices are not counted. */
export function invoiceStatusCounts(invoices: Pick<InvoiceSummary, "effectiveStatus">[]): InvoiceStatusCount[] {
  return invoiceStatusOrder.map((status) => ({
    status,
    label: statusLabels[status],
    count: invoices.filter((invoice) => invoice.effectiveStatus === status).length,
  }));
}

export type DailyAmount = { date: string; label: string; value: number };

/** Cents actually received per local calendar day for the last `days` days, oldest first, ending today. Reversed payments are excluded. */
export function collectedPerDay(payments: PaymentRecord[], days = 30, now = new Date()): DailyAmount[] {
  const byDate = new Map<string, number>();
  for (const payment of payments) {
    if (payment.reversedAt) continue;
    const paid = parseDay(payment.paymentDate);
    if (Number.isNaN(paid.getTime())) continue;
    const key = isoDate(paid);
    byDate.set(key, (byDate.get(key) ?? 0) + payment.amountCents);
  }
  return Array.from({ length: days }, (_, index) => {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1 - index));
    const date = isoDate(day);
    return {
      date,
      label: day.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      value: byDate.get(date) ?? 0,
    };
  });
}

/** Cents received in the calendar month containing `now`. Reversed payments are excluded. */
export function collectedThisMonth(payments: PaymentRecord[], now = new Date()): number {
  return payments
    .filter((payment) => {
      if (payment.reversedAt) return false;
      const paid = parseDay(payment.paymentDate);
      return paid.getFullYear() === now.getFullYear() && paid.getMonth() === now.getMonth();
    })
    .reduce((sum, payment) => sum + payment.amountCents, 0);
}

export type OverdueInvoice<T> = { invoice: T; daysOverdue: number };

/** Overdue invoices, most overdue first. `daysOverdue` counts from the due date, never below 1. */
export function overdueInvoices<T extends OpenInvoice>(invoices: T[], now = new Date()): OverdueInvoice<T>[] {
  return invoices
    .filter((invoice) => invoice.effectiveStatus === "overdue")
    .map((invoice) => ({ invoice, daysOverdue: Math.max(1, daysSince(invoice.dueDate, now)) }))
    .sort((a, b) => b.daysOverdue - a.daysOverdue);
}

export type DueSoonInvoice<T> = { invoice: T; daysUntilDue: number };

/** Invoices awaiting payment that fall due today or within the next `days` days, soonest first. Overdue ones are not included. */
export function invoicesDueSoon<T extends OpenInvoice>(invoices: T[], days = 7, now = new Date()): DueSoonInvoice<T>[] {
  return invoices
    .filter((invoice) => invoice.effectiveStatus !== "overdue" && awaitingPayment(invoice.effectiveStatus) && invoice.dueDate)
    .map((invoice) => ({ invoice, daysUntilDue: 0 - daysSince(invoice.dueDate, now) }))
    .filter((row) => row.daysUntilDue >= 0 && row.daysUntilDue < days)
    .sort((a, b) => a.daysUntilDue - b.daysUntilDue);
}

/** Draft invoices that have not been sent yet, oldest first (the ones most likely forgotten). */
export function draftInvoices<T extends Pick<InvoiceSummary, "effectiveStatus" | "createdAt">>(invoices: T[]): T[] {
  return invoices
    .filter((invoice) => invoice.effectiveStatus === "draft")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export type ClientBalance = { clientId: string; amountDueCents: number; invoiceCount: number };

/** What each client currently owes across invoices awaiting payment, largest balance first. */
export function outstandingByClient(
  invoices: Pick<InvoiceSummary, "clientId" | "effectiveStatus" | "amountDueCents">[],
  limit = 5,
): ClientBalance[] {
  const totals = new Map<string, ClientBalance>();
  for (const invoice of invoices) {
    if (!awaitingPayment(invoice.effectiveStatus) || invoice.amountDueCents <= 0) continue;
    const current = totals.get(invoice.clientId) ?? { clientId: invoice.clientId, amountDueCents: 0, invoiceCount: 0 };
    current.amountDueCents += invoice.amountDueCents;
    current.invoiceCount += 1;
    totals.set(invoice.clientId, current);
  }
  return [...totals.values()].sort((a, b) => b.amountDueCents - a.amountDueCents).slice(0, limit);
}

/** The most recent received (non-reversed) payments, newest first. */
export function recentPayments(payments: PaymentRecord[], limit = 5): PaymentRecord[] {
  return payments
    .filter((payment) => !payment.reversedAt)
    .sort((a, b) => b.paymentDate.localeCompare(a.paymentDate))
    .slice(0, limit);
}
