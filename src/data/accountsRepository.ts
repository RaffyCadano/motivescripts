import type { SupabaseClient } from "@supabase/supabase-js";
import { deleteAccountErrorMessage, type AccountDeletion, type AccountRow } from "@/data/accounts";
import { AgencyDbError, logDbError } from "@/lib/dbErrors";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

type AccountRowDb = {
  user_id: string;
  email: string | null;
  full_name: string | null;
  role: string;
  template_key: string | null;
  is_active: boolean | null;
  client_id: string | null;
  business_name: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  has_active_plan: boolean | null;
  is_self: boolean | null;
};

type DeletionRowDb = {
  id: string;
  email: string;
  full_name: string | null;
  role: string | null;
  business_name: string | null;
  deleted_by_email: string | null;
  created_at: string;
};

function db(): SupabaseClient {
  if (!isSupabaseConfigured()) throw new AgencyDbError("Supabase is not configured.");
  const client = getSupabase() as SupabaseClient | null;
  if (!client) throw new AgencyDbError("Supabase is not configured.");
  return client;
}

/** Every login, newest first. Admins only. */
export async function listAccounts(): Promise<AccountRow[]> {
  const { data, error } = await db().rpc("admin_list_accounts");
  if (error) {
    logDbError("list accounts", error);
    throw new AgencyDbError("Unable to load accounts.", error);
  }
  return ((data ?? []) as AccountRowDb[]).map((row) => ({
    userId: row.user_id,
    email: row.email ?? "",
    fullName: row.full_name ?? "",
    role: row.role === "admin" || row.role === "staff" ? row.role : "client",
    templateKey: row.template_key,
    isActive: row.is_active !== false,
    clientId: row.client_id,
    businessName: row.business_name,
    createdAt: row.created_at,
    lastSignInAt: row.last_sign_in_at,
    hasActivePlan: Boolean(row.has_active_plan),
    isSelf: Boolean(row.is_self),
  }));
}

/** The most recent deletions, newest first. */
export async function listAccountDeletions(): Promise<AccountDeletion[]> {
  const { data, error } = await db()
    .from("account_deletions")
    .select("id, email, full_name, role, business_name, deleted_by_email, created_at")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw new AgencyDbError("Unable to load deleted accounts.", error);
  return ((data ?? []) as DeletionRowDb[]).map((row) => ({
    id: row.id,
    email: row.email,
    fullName: row.full_name ?? "",
    role: row.role ?? "",
    businessName: row.business_name,
    deletedByEmail: row.deleted_by_email,
    createdAt: row.created_at,
  }));
}

/** Deletes one login. The email must be typed to confirm. Refusals come back as readable errors. */
export async function deleteAccount(userId: string, confirmation: string): Promise<void> {
  const { error } = await db().rpc("admin_delete_account", { p_user_id: userId, p_confirmation: confirmation });
  if (!error) return;
  logDbError("delete account", error);
  throw new AgencyDbError(deleteAccountErrorMessage(error.message), error);
}
