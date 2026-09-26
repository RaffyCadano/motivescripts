import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthSession } from "@/data/authSessions";
import { AgencyDbError } from "@/lib/dbErrors";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

type SessionRow = {
  id: string;
  user_agent: string | null;
  ip: string | null;
  created_at: string;
  last_active_at: string;
  is_current: boolean | null;
};

function db(): SupabaseClient {
  if (!isSupabaseConfigured()) throw new AgencyDbError("Supabase is not configured.");
  const client = getSupabase() as SupabaseClient | null;
  if (!client) throw new AgencyDbError("Supabase is not configured.");
  return client;
}

/** The signed-in person's own sessions, most recently active first. */
export async function listMySessions(): Promise<AuthSession[]> {
  const { data, error } = await db().rpc("my_auth_sessions");
  if (error) throw new AgencyDbError("Unable to load your active sessions.");
  return ((data ?? []) as SessionRow[]).map((row) => ({
    id: row.id,
    userAgent: row.user_agent ?? "",
    ip: row.ip ?? "",
    createdAt: row.created_at,
    lastActiveAt: row.last_active_at,
    isCurrent: Boolean(row.is_current),
  }));
}

/** Ends one of the person's other sessions. */
export async function revokeMySession(sessionId: string): Promise<void> {
  const { error } = await db().rpc("revoke_my_auth_session", { p_session_id: sessionId });
  if (error) throw new AgencyDbError("Unable to log out that device.");
}
