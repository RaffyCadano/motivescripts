import {
  applyNotificationPreferenceRows,
  type NotificationPreferenceMap,
} from "@/data/notificationPreferences";
import { AgencyDbError, friendlyDbError, logDbError } from "@/lib/dbErrors";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { Database, NotificationEvent } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";

function db(): SupabaseClient<Database> {
  if (!isSupabaseConfigured()) throw new AgencyDbError("Supabase is not configured.");
  const client = getSupabase();
  if (!client) throw new AgencyDbError("Supabase is not configured.");
  return client;
}

/** The signed-in person's own switches (row-level security only ever returns their own rows). */
export async function fetchMyNotificationPreferences(): Promise<NotificationPreferenceMap> {
  const { data, error } = await db().from("notification_preferences").select("event, in_app");
  if (error) {
    logDbError("load notification preferences", error);
    throw new AgencyDbError(friendlyDbError(error, "Unable to load your notification settings."), error);
  }
  return applyNotificationPreferenceRows((data ?? []) as { event: string; in_app: boolean }[]);
}

export async function setMyNotificationPreference(
  userId: string,
  event: NotificationEvent,
  inApp: boolean,
): Promise<void> {
  const { error } = await db()
    .from("notification_preferences")
    .upsert({ user_id: userId, event, in_app: inApp, updated_at: new Date().toISOString() }, { onConflict: "user_id,event" });
  if (error) {
    logDbError("save notification preference", error);
    throw new AgencyDbError(friendlyDbError(error, "Unable to save that setting."), error);
  }
}
