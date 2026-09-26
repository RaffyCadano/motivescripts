import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClientEmailLogEntry } from "@/data/clientEmailLog";
import { AgencyDbError } from "@/lib/dbErrors";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

type LogRow = {
  id: string;
  kind: string;
  stage: string | null;
  subject: string;
  recipients: string[] | null;
  provider_id: string | null;
  created_at: string;
};

/** The automated emails sent to one client, newest first. Staff only (row-level security). */
export async function listClientEmailLog(clientId: string): Promise<ClientEmailLogEntry[]> {
  if (!isSupabaseConfigured()) throw new AgencyDbError("Supabase is not configured.");
  const client = getSupabase() as SupabaseClient | null;
  if (!client) throw new AgencyDbError("Supabase is not configured.");
  const { data, error } = await client
    .from("client_email_log")
    .select("id, kind, stage, subject, recipients, provider_id, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new AgencyDbError("Unable to load the reminder emails.");
  return ((data ?? []) as LogRow[]).map((row) => ({
    id: row.id,
    kind: row.kind,
    stage: row.stage,
    subject: row.subject,
    recipients: row.recipients ?? [],
    providerId: row.provider_id,
    createdAt: row.created_at,
  }));
}
