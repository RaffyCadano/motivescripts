import {
  draftsFromInvoiceItems,
  effectiveInvoiceStatus,
  invoiceErrorMessage,
  invoiceItemClientDescription,
  invoiceItemIsBillable,
  invoiceItemsFromSnapshot,
  invoiceRpcErrorCode,
  roundQuantity,
  type EffectiveInvoiceStatus,
  type InvoiceSnapshotItem,
  type LineItemDraft,
} from "@/data/invoices";
import { downloadAuthenticatedPdf } from "@/data/pdfDownload";
import { AgencyDbError, friendlyDbError, logDbError } from "@/lib/dbErrors";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type {
  InvoiceAdminNoteRow,
  InvoiceItemRow,
  InvoiceRow,
  InvoiceStatus,
  PaymentRow,
} from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";

export type InvoiceSummary = {
  id: string;
  clientId: string;
  projectId: string | null;
  contractId: string | null;
  proposalId: string | null;
  number: string;
  status: InvoiceStatus;
  effectiveStatus: EffectiveInvoiceStatus;
  issueDate: string;
  dueDate: string;
  currency: string;
  totalCents: number;
  amountPaidCents: number;
  amountDueCents: number;
  createdAt: string;
  updatedAt: string;
  firstLine: string | null;
};

export type InvoiceBillTo = {
  businessName: string;
  contactName: string;
  email: string;
};

export type InvoiceDetail = {
  invoice: InvoiceRow;
  items: InvoiceItemRow[];
  snapshotItems: InvoiceSnapshotItem[];
  payments: PaymentRow[];
  adminNotes: string;
  billTo: InvoiceBillTo | null;
  effectiveStatus: EffectiveInvoiceStatus;
};

function db(): SupabaseClient<Database> {
  if (!isSupabaseConfigured()) {
    throw new AgencyDbError("Supabase is not configured.");
  }
  const client = getSupabase();
  if (!client) throw new AgencyDbError("Supabase is not configured.");
  return client;
}

function fail(context: string, error: unknown, fallback: string): never {
  logDbError(context, error);
  const message =
    error && typeof error === "object" && "message" in error && typeof error.message === "string"
      ? error.message
      : "";
  const mapped = invoiceRpcErrorCode(message);
  if (mapped !== "error") {
    throw new AgencyDbError(invoiceErrorMessage(mapped), error);
  }
  throw new AgencyDbError(friendlyDbError(error, fallback), error);
}

function throwIf(error: unknown, context: string, fallback: string) {
  if (error) fail(context, error, fallback);
}

function firstId(data: string | string[] | null | undefined): string | null {
  if (!data) return null;
  return Array.isArray(data) ? (data[0] ?? null) : data;
}

function toSummary(row: InvoiceRow): InvoiceSummary {
  const items = invoiceItemsFromSnapshot(row.snapshot_items);
  const first = items[0]?.description.trim() ?? "";
  return {
    id: row.id,
    clientId: row.client_id,
    projectId: row.project_id,
    contractId: row.contract_id,
    proposalId: row.proposal_id,
    number: row.invoice_number,
    status: row.status,
    effectiveStatus: effectiveInvoiceStatus(row.status, row.due_date, row.amount_due_cents),
    issueDate: row.issue_date,
    dueDate: row.due_date,
    currency: row.currency,
    totalCents: row.total_cents,
    amountPaidCents: row.amount_paid_cents,
    amountDueCents: row.amount_due_cents,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    firstLine: first ? first.split("\n")[0].trim() : null,
  };
}

function billToFromJson(value: InvoiceRow["bill_to"]): InvoiceBillTo | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  return {
    businessName: typeof row.business_name === "string" ? row.business_name : "",
    contactName: typeof row.contact_name === "string" ? row.contact_name : "",
    email: typeof row.email === "string" ? row.email : "",
  };
}

export async function fetchInvoiceSummaries(clientId?: string): Promise<InvoiceSummary[]> {
  const client = db();
  let query = client.from("invoices").select("*").order("created_at", { ascending: false });
  if (clientId) query = query.eq("client_id", clientId);
  const { data, error } = await query;
  throwIf(error, "load invoices", "Unable to load invoices.");
  return ((data ?? []) as InvoiceRow[]).map(toSummary);
}

export type InvoicePaymentChannel = Pick<PaymentRow, "payment_method" | "provider">;

export async function fetchInvoicePaymentMethods(
  invoiceIds: string[],
): Promise<Map<string, InvoicePaymentChannel[]>> {
  const methods = new Map<string, InvoicePaymentChannel[]>();
  if (invoiceIds.length === 0) return methods;
  const client = db();
  const { data, error } = await client
    .from("payments")
    .select("invoice_id, payment_method, provider, reversed_at")
    .in("invoice_id", invoiceIds);
  throwIf(error, "load invoice payments", "Unable to load invoice payments.");
  for (const row of (data ?? []) as Pick<PaymentRow, "invoice_id" | "payment_method" | "provider" | "reversed_at">[]) {
    if (row.reversed_at) continue;
    const current = methods.get(row.invoice_id) ?? [];
    current.push({ payment_method: row.payment_method, provider: row.provider });
    methods.set(row.invoice_id, current);
  }
  return methods;
}

export async function fetchInvoiceFirstLines(invoiceIds: string[]): Promise<Map<string, string>> {
  const lines = new Map<string, string>();
  if (invoiceIds.length === 0) return lines;
  const client = db();
  const { data, error } = await client
    .from("invoice_items")
    .select("invoice_id, description, sort_order")
    .in("invoice_id", invoiceIds)
    .order("sort_order", { ascending: true });
  throwIf(error, "load invoice items", "Unable to load invoice line items.");
  for (const row of (data ?? []) as Pick<InvoiceItemRow, "invoice_id" | "description" | "sort_order">[]) {
    if (lines.has(row.invoice_id)) continue;
    const line = row.description.split("\n")[0]?.trim() ?? "";
    if (line) lines.set(row.invoice_id, line);
  }
  return lines;
}

export async function fetchClientInvoiceSummaries(): Promise<InvoiceSummary[]> {
  return fetchInvoiceSummaries();
}

export async function fetchInvoiceDetail(id: string): Promise<InvoiceDetail | null> {
  const client = db();
  const { data, error } = await client.from("invoices").select("*").eq("id", id).maybeSingle();
  throwIf(error, "load invoice", "Unable to load this invoice.");
  if (!data) return null;
  const invoice = data as InvoiceRow;
  const { data: items, error: itemError } = await client
    .from("invoice_items")
    .select("*")
    .eq("invoice_id", invoice.id)
    .order("sort_order", { ascending: true });
  throwIf(itemError, "load invoice", "Unable to load this invoice.");
  const { data: payments, error: payError } = await client
    .from("payments")
    .select("*")
    .eq("invoice_id", invoice.id)
    .order("created_at", { ascending: true });
  throwIf(payError, "load invoice", "Unable to load this invoice.");
  const { data: notes } = await client.from("invoice_admin_notes").select("*").eq("invoice_id", invoice.id).maybeSingle();
  const snapshot = invoiceItemsFromSnapshot(invoice.snapshot_items);
  return {
    invoice,
    items: (items ?? []) as InvoiceItemRow[],
    snapshotItems: snapshot.length > 0 ? snapshot : invoiceItemsFromSnapshot(items ?? []),
    payments: (payments ?? []) as PaymentRow[],
    adminNotes: (notes as InvoiceAdminNoteRow | null)?.notes ?? "",
    billTo: billToFromJson(invoice.bill_to),
    effectiveStatus: effectiveInvoiceStatus(invoice.status, invoice.due_date, invoice.amount_due_cents),
  };
}

export async function createInvoice(input: {
  clientId: string;
  projectId?: string | null;
  contractId?: string | null;
  proposalId?: string | null;
}): Promise<string> {
  const client = db();
  const { data, error } = await client.rpc("create_invoice", {
    p_client_id: input.clientId,
    p_project_id: input.projectId ?? null,
    p_contract_id: input.contractId ?? null,
    p_proposal_id: input.proposalId ?? null,
  });
  throwIf(error, "create invoice", "Unable to create this invoice.");
  const id = firstId(data);
  if (!id) throw new AgencyDbError("Unable to create this invoice.");
  return id;
}

export async function saveInvoiceDraft(input: {
  invoiceId: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  taxCents: number;
  discountCents: number;
  notes: string;
  projectId: string | null;
  contractId: string | null;
  proposalId: string | null;
  adminNotes: string;
  items: LineItemDraft[];
}): Promise<void> {
  const client = db();
  const items: Json = input.items
    .filter((item) => invoiceItemIsBillable(item))
    .map((item, index) => ({
      name: invoiceItemClientDescription(item),
      description: item.description.trim(),
      quantity: roundQuantity(item.quantity),
      unit_price_cents: Math.max(0, Math.floor(item.unitPriceCents) || 0),
      sort_order: index,
    }));
  const { error } = await client.rpc("update_invoice_draft", {
    p_invoice_id: input.invoiceId,
    p_issue_date: input.issueDate.slice(0, 10),
    p_due_date: input.dueDate.slice(0, 10),
    p_currency: input.currency || "USD",
    p_tax_cents: Math.max(0, Math.floor(input.taxCents) || 0),
    p_discount_cents: Math.max(0, Math.floor(input.discountCents) || 0),
    p_notes: input.notes,
    p_project_id: input.projectId,
    p_contract_id: input.contractId,
    p_proposal_id: input.proposalId,
    p_admin_notes: input.adminNotes,
    p_items: items,
  });
  throwIf(error, "save invoice", "Unable to save this invoice.");
}

async function functionErrorCode(error: unknown): Promise<string | null> {
  if (!error || typeof error !== "object" || !("context" in error)) return null;
  const context = (error as { context?: unknown }).context;
  if (!context || typeof context !== "object" || !("json" in context)) return null;
  const json = (context as { json?: unknown }).json;
  if (typeof json !== "function") return null;
  try {
    const body = (await json.call(context)) as { error?: string };
    return typeof body?.error === "string" && body.error ? body.error : null;
  } catch {
    return null;
  }
}

async function invokeInvoiceEmail(id: string): Promise<void> {
  const client = db();
  const { data, error } = await client.functions.invoke("document-email", { body: { kind: "invoice", id } });
  if (error) {
    const code = await functionErrorCode(error);
    if (code) throw new AgencyDbError(invoiceErrorMessage(code), error);
    const message = (error.message ?? "").toLowerCase();
    if (message.includes("failed to fetch") || message.includes("network")) {
      throw new AgencyDbError(invoiceErrorMessage("network"), error);
    }
    throw new AgencyDbError(invoiceErrorMessage("email_failed"), error);
  }
  const payload = data as { ok?: boolean; error?: string } | null;
  if (!payload?.ok) {
    throw new AgencyDbError(invoiceErrorMessage(payload?.error ?? "email_failed"));
  }
}

export async function sendInvoice(invoiceId: string): Promise<{ emailed: boolean }> {
  const client = db();
  const { error } = await client.rpc("send_invoice", { p_invoice_id: invoiceId });
  throwIf(error, "send invoice", "Unable to send this invoice.");
  try {
    await invokeInvoiceEmail(invoiceId);
    return { emailed: true };
  } catch (caught) {
    logDbError("invoice email", caught);
    return { emailed: false };
  }
}

export async function resendInvoiceEmail(invoiceId: string): Promise<void> {
  await invokeInvoiceEmail(invoiceId);
}

export async function downloadInvoicePdf(invoiceId: string): Promise<void> {
  await downloadAuthenticatedPdf({
    functionName: "invoice-pdf",
    body: { invoiceId },
    fallbackFilename: "MotiveScripts-Invoice.pdf",
    notAllowedMessage: invoiceErrorMessage("not_allowed"),
    networkMessage: invoiceErrorMessage("network"),
    failedMessage: invoiceErrorMessage("pdf_failed"),
  });
}

export async function markInvoiceViewed(invoiceId: string): Promise<void> {
  const client = db();
  const { error } = await client.rpc("mark_invoice_viewed", { p_invoice_id: invoiceId });
  throwIf(error, "view invoice", "Unable to open this invoice.");
}

export async function cancelInvoice(invoiceId: string): Promise<void> {
  const client = db();
  const { error } = await client.rpc("cancel_invoice", { p_invoice_id: invoiceId });
  throwIf(error, "cancel invoice", "Unable to cancel this invoice.");
}

export async function restoreInvoice(invoiceId: string): Promise<void> {
  const client = db();
  const { error } = await client.rpc("restore_invoice", { p_invoice_id: invoiceId });
  throwIf(error, "restore invoice", "Unable to restore this invoice.");
}

export async function reopenInvoiceDraft(invoiceId: string): Promise<void> {
  const client = db();
  const { error } = await client.rpc("reopen_invoice_draft", { p_invoice_id: invoiceId });
  throwIf(error, "reopen invoice", "Unable to edit this invoice.");
}

export async function deleteInvoice(invoiceId: string): Promise<void> {
  const client = db();
  const { error } = await client.rpc("delete_invoice", { p_invoice_id: invoiceId });
  throwIf(error, "delete invoice", "Unable to delete this invoice.");
}

export async function recordInvoicePayment(input: {
  invoiceId: string;
  amountCents: number;
  paymentDate: string;
  method: string;
  reference: string;
  notes: string;
}): Promise<void> {
  const client = db();
  const { error } = await client.rpc("record_invoice_payment", {
    p_invoice_id: input.invoiceId,
    p_amount_cents: Math.floor(input.amountCents),
    p_payment_date: input.paymentDate,
    p_method: input.method,
    p_reference: input.reference,
    p_notes: input.notes,
  });
  throwIf(error, "record payment", "Unable to record this payment.");
}

export async function reverseInvoicePayment(paymentId: string): Promise<void> {
  const client = db();
  const { error } = await client.rpc("reverse_invoice_payment", { p_payment_id: paymentId });
  throwIf(error, "reverse payment", "Unable to reverse this payment.");
}

export async function generateInvoiceItemsFromTimeEntries(input: {
  invoiceId: string;
  throughDate?: string;
}): Promise<number> {
  const client = db();
  const { data, error } = await client.rpc("generate_invoice_items_from_time_entries", {
    p_invoice_id: input.invoiceId,
    p_through_date: input.throughDate ?? new Date().toISOString().slice(0, 10),
  });
  throwIf(error, "generate invoice items", "Unable to generate invoice items from time entries.");
  return (data as number) ?? 0;
}

export function invoiceLineDrafts(detail: InvoiceDetail): LineItemDraft[] {
  if (detail.invoice.status === "draft") return draftsFromInvoiceItems(detail.items);
  return draftsFromInvoiceItems(detail.snapshotItems.length > 0 ? detail.snapshotItems : detail.items);
}
