import { payrollErrorCode, payrollErrorMessage, type StaffPayRate } from "@/data/payroll";
import { AgencyDbError, logDbError } from "@/lib/dbErrors";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { StaffPayRateRow } from "@/types/database";
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
