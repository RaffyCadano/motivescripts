import type { SupabaseClient } from "@supabase/supabase-js";
import {
  applyEmailAlertRows,
  type EmailAlertCategory,
  type EmailAlertPreferenceMap,
} from "@/data/emailAlertPreferences";
import { AgencyDbError, friendlyDbError, logDbError } from "@/lib/dbErrors";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

function db(): SupabaseClient {
  if (!isSupabaseConfigured()) throw new AgencyDbError("Supabase is not configured.");
  const client = getSupabase() as SupabaseClient | null;
  if (!client) throw new AgencyDbError("Supabase is not configured.");
  return client;
}

/** The signed-in person's own email switches (row-level security only ever returns their own rows). */
export async function fetchMyEmailAlertPreferences(): Promise<EmailAlertPreferenceMap> {
  const { data, error } = await db().from("staff_email_preferences").select("category, enabled");
  if (error) {
    logDbError("load email alert preferences", error);
    throw new AgencyDbError(friendlyDbError(error, "Unable to load your email settings."), error);
  }
  return applyEmailAlertRows((data ?? []) as { category: string; enabled: boolean }[]);
}

export async function setMyEmailAlertPreference(
  userId: string,
  category: EmailAlertCategory,
  enabled: boolean,
): Promise<void> {
  const { error } = await db()
    .from("staff_email_preferences")
    .upsert({ user_id: userId, category, enabled, updated_at: new Date().toISOString() }, { onConflict: "user_id,category" });
  if (error) {
    logDbError("save email alert preference", error);
    throw new AgencyDbError(friendlyDbError(error, "Unable to save that setting."), error);
  }
}
