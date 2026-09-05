import {
  payrollErrorCode,
  payrollErrorMessage,
  type MarkPaidResult,
  type PayrollPayment,
  type PayrollPaymentMethod,
  type StaffPayRate,
} from "@/data/payroll";
import { AgencyDbError, logDbError } from "@/lib/dbErrors";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { PayrollPaymentRow, StaffPayRateRow } from "@/types/database";
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

function fail(context: string, error: unknown): never {
  logDbError(context, error);
  const message = error && typeof error === "object" && "message" in error ? String(error.message) : "";
  throw new AgencyDbError(payrollErrorMessage(payrollErrorCode(message)), error);
}

function mapPayRate(row: StaffPayRateRow): StaffPayRate {
  return {
    userId: row.user_id,
    payRateCents: Number(row.pay_rate_cents),
    updatedAt: row.updated_at,
  };
}

/** Admin: every staff pay rate that's been set. Staff: RLS narrows this to just their own row. */
export async function listStaffPayRates(): Promise<StaffPayRate[]> {
  const client = db();
  const { data, error } = await client.from("staff_pay_rates").select("*");
  if (error) fail("load pay rates", error);
  return (data ?? []).map((row) => mapPayRate(row as StaffPayRateRow));
}

export async function setStaffPayRate(userId: string, payRateCents: number): Promise<void> {
  const client = db();
  const { error } = await client.rpc("set_staff_pay_rate", {
    p_user_id: userId,
    p_pay_rate_cents: payRateCents,
  });
  if (error) fail("set pay rate", error);
}

function mapPayrollPayment(row: PayrollPaymentRow): PayrollPayment {
  return {
    id: row.id,
    staffId: row.staff_id,
    amountCents: Number(row.amount_cents),
    hours: Number(row.hours),
    payRateCents: Number(row.pay_rate_cents),
    throughDate: row.through_date,
    paymentDate: row.payment_date,
    method: row.method as PayrollPaymentMethod,
    reference: row.reference,
    notes: row.notes,
    recordedBy: row.recorded_by,
    recordedByLabel: row.recorded_by_label,
    createdAt: row.created_at,
  };
}

/** Admin: any staff member's payments (pass staffId). Staff: RLS narrows to their own regardless of staffId. */
export async function listPayrollPayments(staffId?: string): Promise<PayrollPayment[]> {
  const client = db();
  let query = client.from("payroll_payments").select("*").order("created_at", { ascending: false });
  if (staffId) query = query.eq("staff_id", staffId);
  const { data, error } = await query;
  if (error) fail("load payroll payments", error);
  return (data ?? []).map((row) => mapPayrollPayment(row as PayrollPaymentRow));
}

export async function markTimeEntriesPaid(
  staffId: string,
  input: { throughDate?: string; method: PayrollPaymentMethod; reference?: string; notes?: string },
): Promise<MarkPaidResult> {
  const client = db();
  const { data, error } = await client.rpc("mark_time_entries_paid", {
    p_staff_id: staffId,
    p_through_date: input.throughDate ?? new Date().toISOString().slice(0, 10),
    p_method: input.method,
    p_reference: input.reference ?? "",
    p_notes: input.notes ?? "",
  });
  if (error) fail("mark time entries paid", error);
  const result = data as { payment_id: string; amount_cents: number; hours: number; entries: number };
  return {
    paymentId: result.payment_id,
    amountCents: Number(result.amount_cents),
    hours: Number(result.hours),
    entries: Number(result.entries),
  };
}
