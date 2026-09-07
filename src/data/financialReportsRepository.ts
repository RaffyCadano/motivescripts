import type { PaymentReportRow } from "@/data/financialReports";
import { AgencyDbError, friendlyDbError, logDbError } from "@/lib/dbErrors";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { InvoiceRow, PaymentRow } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

function db(): SupabaseClient<Database> {
  if (!isSupabaseConfigured()) {
    throw new AgencyDbError("Supabase is not configured.");
  }
  const client = getSupabase();
  if (!client) throw new AgencyDbError("Supabase is not configured.");
  return client;
}

function throwIf(error: unknown, context: string, fallback: string) {
  if (error) {
    logDbError(context, error);
    throw new AgencyDbError(friendlyDbError(error, fallback), error);
  }
}

/** Non-reversed payments, joined client-side to their invoice's service_plan_id to tell recurring from one-time. */
export async function fetchAllPayments(): Promise<PaymentReportRow[]> {
  const client = db();
  const { data: payments, error } = await client
    .from("payments")
    .select("invoice_id, amount_cents, payment_date, reversed_at")
    .is("reversed_at", null)
    .order("payment_date", { ascending: true });
  throwIf(error, "load payments", "Unable to load payments.");
  const rows = (payments ?? []) as Pick<PaymentRow, "invoice_id" | "amount_cents" | "payment_date" | "reversed_at">[];
  if (rows.length === 0) return [];

  const invoiceIds = [...new Set(rows.map((row) => row.invoice_id))];
  const { data: invoices, error: invoiceError } = await client
    .from("invoices")
    .select("id, service_plan_id")
    .in("id", invoiceIds);
  throwIf(invoiceError, "load payments", "Unable to load payments.");
  const recurringInvoiceIds = new Set(
    ((invoices ?? []) as Pick<InvoiceRow, "id" | "service_plan_id">[])
      .filter((invoice) => invoice.service_plan_id)
      .map((invoice) => invoice.id),
  );

  return rows.map((row) => ({
    amountCents: row.amount_cents,
    paymentDate: row.payment_date,
    recurring: recurringInvoiceIds.has(row.invoice_id),
  }));
}
