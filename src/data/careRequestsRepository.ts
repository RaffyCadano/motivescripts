import type { CareRequest, CareRequestPriority, CareRequestStatus } from "@/data/careRequests";
import { AgencyDbError, logDbError } from "@/lib/dbErrors";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { CareRequestRow, Database } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";

function db(): SupabaseClient<Database> {
  if (!isSupabaseConfigured()) throw new AgencyDbError("Supabase is not configured.");
  const client = getSupabase();
  if (!client) throw new AgencyDbError("Supabase is not configured.");
  return client;
}

function fail(context: string, error: unknown, fallback: string): never {
  logDbError(context, error);
  throw new AgencyDbError(fallback, error);
}

function mapCareRequest(row: CareRequestRow): CareRequest {
  return {
    id: row.id,
    clientId: row.client_id,
    projectId: row.project_id,
    submittedBy: row.submitted_by,
    message: row.message,
    priority: row.priority,
    status: row.status,
    hasActiveCarePlan: row.has_active_care_plan,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    resolvedAt: row.resolved_at,
  };
}

/** Admin/staff: every request across every client. Client portal: pass no filter -- RLS narrows to their own. */
export async function listCareRequests(filter?: { clientId?: string; projectId?: string }): Promise<CareRequest[]> {
  const client = db();
  let query = client.from("care_requests").select("*").order("created_at", { ascending: false });
  if (filter?.clientId) query = query.eq("client_id", filter.clientId);
  if (filter?.projectId) query = query.eq("project_id", filter.projectId);
  const { data, error } = await query;
  if (error) fail("load care requests", error, "Unable to load care requests.");
  return (data ?? []).map((row) => mapCareRequest(row as CareRequestRow));
}

/** Client portal: ask for something on a launched project. Priority and status start at the server's
 * defaults (Medium, New) -- a client doesn't set either. */
export async function submitCareRequest(input: { clientId: string; projectId: string; message: string }): Promise<void> {
  const client = db();
  const { error } = await client.from("care_requests").insert({
    client_id: input.clientId,
    project_id: input.projectId,
    message: input.message.trim(),
  });
  if (error) {
    const message = (error.message ?? "").toUpperCase();
    if (message.includes("NOT_LAUNCHED")) {
      fail("submit care request", error, "This is available once your website has launched.");
    }
    fail("submit care request", error, "Unable to submit this request.");
  }
}

export async function setCareRequestPriority(id: string, priority: CareRequestPriority): Promise<void> {
  const client = db();
  const { error } = await client.from("care_requests").update({ priority }).eq("id", id);
  if (error) fail("update care request priority", error, "Unable to update the priority.");
}

export async function setCareRequestStatus(id: string, status: CareRequestStatus): Promise<void> {
  const client = db();
  const { error } = await client.from("care_requests").update({ status }).eq("id", id);
  if (error) fail("update care request status", error, "Unable to update the status.");
}
