import { agencyEmail } from "./documentStatus.ts";
import { asCents } from "./money.ts";
import type { InvoicePdfItem, InvoicePdfModel, InvoicePdfPayment } from "./invoicePdf.ts";

type InvoiceRow = {
  id: string;
  invoice_number: string;
  client_id: string;
  project_id: string | null;
  contract_id: string | null;
  status: string;
  issue_date: string;
  due_date: string;
  currency: string;
  subtotal_cents: unknown;
  tax_cents: unknown;
  discount_cents: unknown;
  total_cents: unknown;
  amount_paid_cents: unknown;
  amount_due_cents: unknown;
  notes: string | null;
  snapshot_items: unknown;
  bill_to: unknown;
};

export type InvoiceStatus = "draft" | "sent" | "viewed" | "partially_paid" | "paid" | "cancelled";
export type EffectiveStatus = InvoiceStatus | "overdue";

export function effectiveInvoiceStatus(
  status: string,
  dueDate: string | null | undefined,
  amountDueCents: number,
  now = new Date(),
): EffectiveStatus {
  if (status === "sent" || status === "viewed") {
    if (dueDate && amountDueCents > 0) {
      const day = dueDate.slice(0, 10);
      const today = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
      if (day < today) return "overdue";
    }
  }
  if (
    status === "draft" ||
    status === "sent" ||
    status === "viewed" ||
    status === "partially_paid" ||
    status === "paid" ||
    status === "cancelled"
  ) {
    return status;
  }
  return "sent";
}

export function invoiceStatusLabel(status: EffectiveStatus, audience: "admin" | "client"): string {
  if (audience === "client" && (status === "sent" || status === "viewed")) return "Awaiting Payment";
  switch (status) {
    case "draft":
      return "Draft";
    case "sent":
      return "Sent";
    case "viewed":
      return "Viewed";
    case "partially_paid":
      return "Partially Paid";
    case "paid":
      return "Paid";
    case "overdue":
      return "Overdue";
    case "cancelled":
      return "Cancelled";
  }
}

function paymentMethodLabel(method: string): string {
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
    default:
      return "Payment";
  }
}

function publicReference(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  if (lower.startsWith("pi_") || lower.startsWith("cs_") || lower.startsWith("evt_") || lower.startsWith("whsec_")) {
    return null;
  }
  if (trimmed.includes("@")) return null;
  return trimmed.slice(0, 80);
}

function itemsFromUnknown(value: unknown): InvoicePdfItem[] {
  if (!Array.isArray(value)) return [];
  return [...value]
    .map((entry, index) => {
      if (!entry || typeof entry !== "object") return null;
      const row = entry as Record<string, unknown>;
      const description =
        (typeof row.description === "string" && row.description.trim()) ||
        (typeof row.name === "string" && row.name.trim()) ||
        "Item";
      return {
        description,
        quantity: Math.max(1, asCents(row.quantity) || 1),
        unit_price_cents: asCents(row.unit_price_cents),
        total_cents: asCents(row.total_cents),
        sort_order: typeof row.sort_order === "number" ? row.sort_order : index,
      };
    })
    .filter((item): item is InvoicePdfItem & { sort_order: number } => item != null)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(({ sort_order: _sort, ...item }) => item);
}

function billToFromJson(value: unknown): { businessName: string; contactName: string; email: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { businessName: "", contactName: "", email: "" };
  }
  const row = value as Record<string, unknown>;
  return {
    businessName: typeof row.business_name === "string" ? row.business_name : "",
    contactName: typeof row.contact_name === "string" ? row.contact_name : "",
    email: typeof row.email === "string" ? row.email : "",
  };
}

export async function loadInvoicePdfModel(
  // deno-lint-ignore no-explicit-any
  admin: { from: (table: string) => any },
  invoiceId: string,
  audience: "admin" | "client",
): Promise<InvoicePdfModel | null> {
  const { data } = await admin
    .from("invoices")
    .select(
      "id, invoice_number, client_id, project_id, contract_id, status, issue_date, due_date, currency, subtotal_cents, tax_cents, discount_cents, total_cents, amount_paid_cents, amount_due_cents, notes, snapshot_items, bill_to",
    )
    .eq("id", invoiceId)
    .maybeSingle();
  if (!data) return null;
  const invoice = data as unknown as InvoiceRow;

  const { data: itemRows } = await admin
    .from("invoice_items")
    .select("description, quantity, unit_price_cents, total_cents, sort_order")
    .eq("invoice_id", invoice.id)
    .order("sort_order", { ascending: true });

  const { data: paymentRows } = await admin
    .from("payments")
    .select("amount_cents, payment_date, payment_method, reference, reversed_at")
    .eq("invoice_id", invoice.id)
    .order("payment_date", { ascending: true });

  const { data: clientRow } = await admin
    .from("clients")
    .select("business_name, contact_name, email, phone")
    .eq("id", invoice.client_id)
    .maybeSingle();

  let projectName: string | null = null;
  if (invoice.project_id) {
    const { data: projectRow } = await admin.from("projects").select("name").eq("id", invoice.project_id).maybeSingle();
    if (typeof projectRow?.name === "string" && projectRow.name.trim()) projectName = projectRow.name.trim();
  }

  let contractNumber: string | null = null;
  if (invoice.contract_id) {
    const { data: contractRow } = await admin
      .from("contracts")
      .select("contract_number")
      .eq("id", invoice.contract_id)
      .maybeSingle();
    if (typeof contractRow?.contract_number === "string" && contractRow.contract_number.trim()) {
      contractNumber = contractRow.contract_number.trim();
    }
  }

  const snapshot = itemsFromUnknown(invoice.snapshot_items);
  const liveItems = itemsFromUnknown(itemRows ?? []);
  const items = snapshot.length > 0 ? snapshot : liveItems;
  const frozen = billToFromJson(invoice.bill_to);
  const amountDue = asCents(invoice.amount_due_cents);
  const effective = effectiveInvoiceStatus(invoice.status, invoice.due_date, amountDue);
  const payments: InvoicePdfPayment[] = (paymentRows ?? []).map((row) => ({
    date: typeof row.payment_date === "string" ? row.payment_date : "",
    methodLabel: paymentMethodLabel(typeof row.payment_method === "string" ? row.payment_method : ""),
    statusLabel: row.reversed_at ? "Reversed" : "Received",
    amount_cents: asCents(row.amount_cents),
    reference: publicReference(row.reference),
  }));

  const businessName =
    frozen.businessName || (typeof clientRow?.business_name === "string" ? clientRow.business_name : "") || "Client";
  const contactName = frozen.contactName || (typeof clientRow?.contact_name === "string" ? clientRow.contact_name : "");
  const email = frozen.email || (typeof clientRow?.email === "string" ? clientRow.email : "");
  const phone = typeof clientRow?.phone === "string" ? clientRow.phone : "";

  return {
    number: invoice.invoice_number,
    statusLabel: invoiceStatusLabel(effective, audience),
    issueDate: invoice.issue_date,
    dueDate: invoice.due_date,
    currency: invoice.currency || "USD",
    billToName: contactName,
    billToCompany: businessName,
    billToEmail: email,
    billToPhone: phone,
    projectName,
    contractNumber,
    notes: invoice.notes ?? "",
    items,
    subtotal_cents: asCents(invoice.subtotal_cents),
    tax_cents: asCents(invoice.tax_cents),
    discount_cents: asCents(invoice.discount_cents),
    total_cents: asCents(invoice.total_cents),
    amount_paid_cents: asCents(invoice.amount_paid_cents),
    amount_due_cents: amountDue,
    payments,
    agencyName: "MotiveScripts",
    agencyEmail: agencyEmail(),
  };
}

export function clientMayAccessInvoice(status: string): boolean {
  return status !== "draft" && status !== "cancelled";
}
