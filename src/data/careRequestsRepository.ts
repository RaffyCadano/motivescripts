import type {
  CareRequest,
  CareRequestBillingDecision,
  CareRequestCategory,
  CareRequestFile,
  CareRequestPriority,
  CareRequestStatus,
  CareRequestType,
} from "@/data/careRequests";
import { AgencyDbError, logDbError } from "@/lib/dbErrors";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { CareRequestFileRow, CareRequestRow, Database } from "@/types/database";
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
    category: row.category,
    hasActiveCarePlan: row.has_active_care_plan,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    resolvedAt: row.resolved_at,
    requestType: row.request_type,
    billingDecision: row.billing_decision,
    servicePlanId: row.service_plan_id,
    resultingTaskId: row.resulting_task_id,
    resultingInvoiceId: row.resulting_invoice_id,
    resultingProjectId: row.resulting_project_id,
  };
}

function mapCareRequestFile(row: CareRequestFileRow): CareRequestFile {
  return {
    id: row.id,
    requestId: row.request_id,
    projectId: row.project_id,
    clientId: row.client_id,
    fileName: row.file_name,
    fileType: row.file_type,
    fileSize: row.file_size,
    storagePath: row.storage_path,
    createdAt: row.created_at,
    uploadedBy: row.uploaded_by,
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

/** Client portal: ask for something on a launched project with an active Care plan (the server
 * rejects it otherwise -- see care_requests_before_insert). Priority and status start at the
 * server's defaults (Medium, New) -- a client doesn't set either. */
export async function submitCareRequest(input: {
  clientId: string;
  projectId: string;
  message: string;
  category: CareRequestCategory;
  requestType: CareRequestType;
}): Promise<string> {
  const client = db();
  const { data, error } = await client
    .from("care_requests")
    .insert({
      client_id: input.clientId,
      project_id: input.projectId,
      message: input.message.trim(),
      category: input.category,
      request_type: input.requestType,
    })
    .select("id")
    .single();
  if (error) {
    const message = (error.message ?? "").toUpperCase();
    if (message.includes("NO_ACTIVE_PLAN")) {
      fail("submit care request", error, "This needs an active Website Care plan. Choose a plan above, then try again.");
    }
    if (message.includes("NOT_LAUNCHED")) {
      fail("submit care request", error, "This is available once your website has launched.");
    }
    fail("submit care request", error, "Unable to submit this request.");
  }
  return (data as { id: string } | null)?.id ?? "";
}

export async function fetchCareRequestById(id: string): Promise<CareRequest | null> {
  const client = db();
  const { data, error } = await client.from("care_requests").select("*").eq("id", id).maybeSingle();
  if (error) fail("load care request", error, "Unable to load this request.");
  return data ? mapCareRequest(data as CareRequestRow) : null;
}

/** Attachments for a set of requests, keyed by request id -- pass the ids you're displaying (client: their own; admin: the visible page). */
export async function fetchCareRequestFiles(requestIds: string[]): Promise<Record<string, CareRequestFile[]>> {
  const result: Record<string, CareRequestFile[]> = {};
  if (requestIds.length === 0) return result;
  const client = db();
  const { data, error } = await client
    .from("care_request_files")
    .select("*")
    .in("request_id", requestIds)
    .order("created_at", { ascending: false });
  if (error) fail("load care request files", error, "Unable to load attachments.");
  for (const row of (data ?? []) as CareRequestFileRow[]) {
    const file = mapCareRequestFile(row);
    (result[file.requestId] ??= []).push(file);
  }
  return result;
}

export async function insertCareRequestFile(input: {
  requestId: string;
  projectId: string;
  clientId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  storagePath: string;
}): Promise<CareRequestFile> {
  const client = db();
  const { data, error } = await client
    .from("care_request_files")
    .insert({
      request_id: input.requestId,
      project_id: input.projectId,
      client_id: input.clientId,
      file_name: input.fileName,
      file_type: input.fileType,
      file_size: input.fileSize,
      storage_path: input.storagePath,
    })
    .select("*")
    .single();
  if (error) fail("upload care request file", error, "Unable to save this attachment.");
  return mapCareRequestFile(data as CareRequestFileRow);
}

/**
 * Staff: turn an included Website Care request into a project task (the existing task board, same
 * table every other task lives in), then link the request to it and mark it included. Done
 * atomically in one RPC, checked against the same single permission (projects.manage on the
 * request's project) care_requests_resolve uses -- a direct client-side insert into `tasks` here
 * used to hit a stricter table-level RLS policy (staff_may_coordinate_project, which also requires
 * clients.manage) than this action actually needs, breaking the button for any staff member with
 * projects.manage but not clients.manage (Developer, Designer, Content Writer, Team Member).
 */
export async function convertCareRequestToTask(request: CareRequest): Promise<string> {
  const client = db();
  const { data, error } = await client.rpc("care_requests_convert_to_task", { p_request_id: request.id });
  if (error) fail("create task from care request", error, "Unable to create a task for this request.");
  return data as string;
}

/** Staff: record the included/billable call and/or link a request to what it turned into (task, invoice, or project). */
export async function resolveCareRequest(input: {
  requestId: string;
  billingDecision?: CareRequestBillingDecision | null;
  resultingTaskId?: string | null;
  resultingInvoiceId?: string | null;
  resultingProjectId?: string | null;
}): Promise<void> {
  const client = db();
  const { error } = await client.rpc("care_requests_resolve", {
    p_request_id: input.requestId,
    p_billing_decision: input.billingDecision ?? null,
    p_resulting_task_id: input.resultingTaskId ?? null,
    p_resulting_invoice_id: input.resultingInvoiceId ?? null,
    p_resulting_project_id: input.resultingProjectId ?? null,
  });
  if (error) fail("resolve care request", error, "Unable to save this decision.");
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
