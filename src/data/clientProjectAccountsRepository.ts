import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ClientAccountService,
  ClientAccountStatus,
  ClientProjectAccount,
  ClientProjectAccountDraft,
} from "@/data/clientProjectAccounts";
import { AgencyDbError, logDbError } from "@/lib/dbErrors";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

type Row = {
  id: string;
  project_id: string;
  service: string;
  label: string;
  login_url: string;
  username: string;
  status: string;
  notes: string;
  created_at: string;
  updated_at: string;
};

const COLUMNS = "id, project_id, service, label, login_url, username, status, notes, created_at, updated_at";

function db(): SupabaseClient {
  if (!isSupabaseConfigured()) throw new AgencyDbError("Supabase is not configured.");
  const client = getSupabase() as SupabaseClient | null;
  if (!client) throw new AgencyDbError("Supabase is not configured.");
  return client;
}

function fail(context: string, error: unknown, fallback: string): never {
  logDbError(context, error);
  throw new AgencyDbError(fallback, error);
}

function mapRow(row: Row): ClientProjectAccount {
  return {
    id: row.id,
    projectId: row.project_id,
    service: row.service as ClientAccountService,
    label: row.label,
    loginUrl: row.login_url,
    username: row.username,
    status: row.status as ClientAccountStatus,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listClientProjectAccounts(projectId: string): Promise<ClientProjectAccount[]> {
  const { data, error } = await db().from("client_project_accounts").select(COLUMNS).eq("project_id", projectId);
  if (error) fail("load client project accounts", error, "Unable to load this project's accounts.");
  return (data ?? []).map((row) => mapRow(row as Row));
}

export async function createClientProjectAccount(projectId: string, draft: ClientProjectAccountDraft): Promise<void> {
  const { error } = await db()
    .from("client_project_accounts")
    .insert({
      project_id: projectId,
      service: draft.service,
      label: draft.label.trim(),
      login_url: draft.loginUrl.trim(),
      username: draft.username.trim(),
      status: draft.status,
      notes: draft.notes.trim(),
    });
  if (error) fail("create client project account", error, "Unable to add this account.");
}

export async function updateClientProjectAccount(id: string, draft: ClientProjectAccountDraft): Promise<void> {
  const { error } = await db()
    .from("client_project_accounts")
    .update({
      service: draft.service,
      label: draft.label.trim(),
      login_url: draft.loginUrl.trim(),
      username: draft.username.trim(),
      status: draft.status,
      notes: draft.notes.trim(),
    })
    .eq("id", id);
  if (error) fail("update client project account", error, "Unable to save this account.");
}

export async function setClientProjectAccountStatus(id: string, status: ClientAccountStatus): Promise<void> {
  const { error } = await db().from("client_project_accounts").update({ status }).eq("id", id);
  if (error) fail("update client project account status", error, "Unable to update this account.");
}

export async function deleteClientProjectAccount(id: string): Promise<void> {
  const { error } = await db().from("client_project_accounts").delete().eq("id", id);
  if (error) fail("delete client project account", error, "Unable to remove this account.");
}
