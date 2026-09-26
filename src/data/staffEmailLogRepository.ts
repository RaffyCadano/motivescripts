import type { SupabaseClient } from "@supabase/supabase-js";
import type { StaffEmailLogEntry } from "@/data/staffEmailLog";
import { AgencyDbError } from "@/lib/dbErrors";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

type LogRow = {
  id: string;
  type: string;
  category: string;
  subject: string;
  to_email: string;
  provider_id: string | null;
  created_at: string;
};

/** The alert emails sent to one team member, newest first. Admins only (row-level security). */
export async function listStaffEmailLog(userId: string): Promise<StaffEmailLogEntry[]> {
  if (!isSupabaseConfigured()) throw new AgencyDbError("Supabase is not configured.");
  const client = getSupabase() as SupabaseClient | null;
  if (!client) throw new AgencyDbError("Supabase is not configured.");
  const { data, error } = await client
    .from("staff_email_log")
    .select("id, type, category, subject, to_email, provider_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new AgencyDbError("Unable to load the alert emails.");
  return ((data ?? []) as LogRow[]).map((row) => ({
    id: row.id,
    type: row.type,
    category: row.category,
    subject: row.subject,
    toEmail: row.to_email,
    providerId: row.provider_id,
    createdAt: row.created_at,
  }));
}
