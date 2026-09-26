import type { SupabaseClient } from "@supabase/supabase-js";
import { deleteClientErrorMessage, type ClientDeletionPreview } from "@/data/clientDeletion";
import { AgencyDbError, logDbError } from "@/lib/dbErrors";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

function db(): SupabaseClient {
  if (!isSupabaseConfigured()) throw new AgencyDbError("Supabase is not configured.");
  const client = getSupabase() as SupabaseClient | null;
  if (!client) throw new AgencyDbError("Supabase is not configured.");
  return client;
}

type PreviewJson = {
  business_name: string;
  projects: number;
  tasks: number;
  files: number;
  stored_files: number;
  proposals: number;
  contracts: number;
  invoices: number;
  paid_cents: number;
  conversations: number;
  time_entries: number;
  care_requests: number;
  portal_accounts: number;
  has_active_plan: boolean;
  live_websites: string[];
};

/** What deleting this client would remove, in counts. Admins only. */
export async function fetchClientDeletionPreview(clientId: string): Promise<ClientDeletionPreview> {
  const { data, error } = await db().rpc("admin_client_deletion_preview", { p_client_id: clientId });
  if (error) {
    logDbError("client deletion preview", error);
    throw new AgencyDbError(deleteClientErrorMessage(error.message), error);
  }
  const row = data as PreviewJson;
  return {
    businessName: row.business_name,
    projects: Number(row.projects),
    tasks: Number(row.tasks),
    files: Number(row.files),
    storedFiles: Number(row.stored_files),
    proposals: Number(row.proposals),
    contracts: Number(row.contracts),
    invoices: Number(row.invoices),
    paidCents: Number(row.paid_cents),
    conversations: Number(row.conversations),
    timeEntries: Number(row.time_entries),
    careRequests: Number(row.care_requests),
    portalAccounts: Number(row.portal_accounts),
    hasActivePlan: Boolean(row.has_active_plan),
    liveWebsites: Array.isArray(row.live_websites) ? row.live_websites : [],
  };
}

/**
 * Deletes a client and everything that belongs to them: first their stored files (through the
 * admin-client-files function), then the records (admin_client_deletion RPC). Nothing is deleted from the
 * database if the files can't all be removed.
 */
export async function deleteClientEverything(clientId: string, businessName: string, leaveWebsiteLive: boolean): Promise<void> {
  const client = db();
  const { data: filesResult, error: filesError } = await client.functions.invoke("admin-client-files", {
    body: { clientId, businessName, leaveWebsiteLive },
  });
  if (filesError) {
    logDbError("remove client files", filesError);
    throw new AgencyDbError("Couldn't remove the client's stored files, so nothing was deleted. Try again in a moment.", filesError);
  }
  const files = filesResult as { ok?: boolean; failed?: number; error?: string; message?: string } | null;
  if (files?.error === "refused") throw new AgencyDbError(deleteClientErrorMessage(files.message));
  if (!files?.ok) {
    throw new AgencyDbError(
      `${files?.failed ?? "Some"} stored file(s) couldn't be removed, so the records were not deleted. Try again; files already removed stay removed.`,
    );
  }
  const { error } = await client.rpc("admin_delete_client", {
    p_client_id: clientId,
    p_confirmation: businessName,
    p_leave_website_live: leaveWebsiteLive,
  });
  if (error) {
    logDbError("delete client", error);
    throw new AgencyDbError(deleteClientErrorMessage(error.message), error);
  }
}
