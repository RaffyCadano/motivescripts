import type { RecurringRevenueSummary } from "@/data/recurringRevenue";
import { AgencyDbError, logDbError } from "@/lib/dbErrors";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { Database } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";

function db(): SupabaseClient<Database> {
  if (!isSupabaseConfigured()) throw new AgencyDbError("Supabase is not configured.");
  const client = getSupabase();
  if (!client) throw new AgencyDbError("Supabase is not configured.");
  return client;
}

export async function fetchRecurringRevenueSummary(): Promise<RecurringRevenueSummary> {
  const client = db();
  const { data, error } = await client.rpc("recurring_revenue_summary");
  if (error) {
    logDbError("load recurring revenue summary", error);
    throw new AgencyDbError("Unable to load recurring revenue.", error);
  }
  const row = (Array.isArray(data) ? data[0] : data) as
    | {
        mrr_cents?: number;
        active_count?: number;
        past_due_count?: number;
        paused_count?: number;
        clients_with_plan?: number;
        clients_without_plan?: number;
        canceled_this_month?: number;
        upcoming_renewals_30d?: number;
        included_hours_this_month?: number;
        billable_overages_this_month?: number;
        billable_overages_cents_this_month?: number;
      }
    | undefined;
  return {
    mrrCents: Number(row?.mrr_cents ?? 0),
    activeCount: Number(row?.active_count ?? 0),
    pastDueCount: Number(row?.past_due_count ?? 0),
    pausedCount: Number(row?.paused_count ?? 0),
    clientsWithPlan: Number(row?.clients_with_plan ?? 0),
    clientsWithoutPlan: Number(row?.clients_without_plan ?? 0),
    canceledThisMonth: Number(row?.canceled_this_month ?? 0),
    upcomingRenewals30d: Number(row?.upcoming_renewals_30d ?? 0),
    includedHoursThisMonth: Number(row?.included_hours_this_month ?? 0),
    billableOveragesThisMonth: Number(row?.billable_overages_this_month ?? 0),
    billableOveragesCentsThisMonth: Number(row?.billable_overages_cents_this_month ?? 0),
  };
}
