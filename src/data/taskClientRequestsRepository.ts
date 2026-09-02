import {
  taskClientRequestStatusLabel,
  type TaskClientRequest,
  type TaskClientRequestFile,
  type TaskClientRequestStatus,
} from "@/data/taskClientRequests";
import { AgencyDbError, friendlyDbError, logDbError } from "@/lib/dbErrors";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { TaskClientRequestFileRow, TaskClientRequestRow } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

function db(): SupabaseClient<Database> {
  if (!isSupabaseConfigured()) {
    throw new AgencyDbError("Supabase is not configured.");
  }
  const client = getSupabase();
  if (!client) throw new AgencyDbError("Supabase is not configured.");
  return client;
}

function requestUnavailable(error: unknown): boolean {
  const message =
    error && typeof error === "object" && "message" in error && typeof error.message === "string"
      ? error.message
      : "";
  const code =
    error && typeof error === "object" && "code" in error && typeof error.code === "string" ? error.code : "";
  return (
    code === "42P01" ||
    code === "PGRST204" ||
    code === "PGRST205" ||
    (message.includes("task_client_request") &&
      (message.toLowerCase().includes("does not exist") ||
        message.toLowerCase().includes("schema cache") ||
        message.toLowerCase().includes("could not find")))
  );
}

function fail(context: string, error: unknown, fallback: string): never {
  logDbError(context, error);
  if (requestUnavailable(error)) {
    throw new AgencyDbError("Client requests aren't available until the latest database update is applied.", error);
  }
  throw new AgencyDbError(friendlyDbError(error, fallback), error);
}

function throwIf(error: unknown, context: string, fallback: string) {
  if (error) fail(context, error, fallback);
}

function mapRequest(row: TaskClientRequestRow): TaskClientRequest {
  return {
    id: row.id,
    taskId: row.task_id,
    projectId: row.project_id,
    clientId: row.client_id,
    status: row.status as TaskClientRequestStatus,
    message: row.message,
    clientResponse: row.client_response,
    requestedAt: row.requested_at,
    submittedAt: row.submitted_at,
    completedAt: row.completed_at,
    updatedAt: row.updated_at,
  };
}

function mapFile(row: TaskClientRequestFileRow): TaskClientRequestFile {
  return {
    id: row.id,
    requestId: row.request_id,
    taskId: row.task_id,
    projectId: row.project_id,
    clientId: row.client_id,
    fileName: row.file_name,
    fileType: row.file_type,
    fileSize: row.file_size,
    storagePath: row.storage_path,
    createdAt: row.created_at,
  };
}

export { taskClientRequestStatusLabel };

export async function fetchTaskClientRequestByTask(taskId: string): Promise<TaskClientRequest | null> {
  const client = db();
  const { data, error } = await client.from("task_client_requests").select("*").eq("task_id", taskId).maybeSingle();
  throwIf(error, "load task client request", "Unable to load this request.");
  return data ? mapRequest(data as TaskClientRequestRow) : null;
}

export async function fetchTaskClientRequests(): Promise<TaskClientRequest[]> {
  const client = db();
  const { data, error } = await client.from("task_client_requests").select("*");
  throwIf(error, "load task client requests", "Unable to load requests.");
  return (data ?? []).map((row) => mapRequest(row as TaskClientRequestRow));
}

export async function fetchTaskClientRequestsForProject(projectId: string): Promise<TaskClientRequest[]> {
  const client = db();
  const { data, error } = await client.from("task_client_requests").select("*").eq("project_id", projectId);
  throwIf(error, "load task client requests", "Unable to load requests.");
  return (data ?? []).map((row) => mapRequest(row as TaskClientRequestRow));
}

export async function fetchTaskClientRequestFiles(requestId: string): Promise<TaskClientRequestFile[]> {
  const client = db();
  const { data, error } = await client
    .from("task_client_request_files")
    .select("*")
    .eq("request_id", requestId)
    .order("created_at", { ascending: false });
  throwIf(error, "load task request files", "Unable to load files.");
  return (data ?? []).map((row) => mapFile(row as TaskClientRequestFileRow));
}

async function ensureTaskClientRequest(taskId: string, projectId: string, clientId: string): Promise<TaskClientRequest> {
  const existing = await fetchTaskClientRequestByTask(taskId);
  if (existing) return existing;

  const client = db();
  const { data, error } = await client
    .from("task_client_requests")
    .insert({ task_id: taskId, project_id: projectId, client_id: clientId, status: "not_requested" })
    .select("*")
    .single();
  throwIf(error, "create task client request", "Unable to prepare this request.");
  return mapRequest(data as TaskClientRequestRow);
}

/** PM sends (or re-sends, e.g. after reviewing a response) a request to the client. */
export async function sendTaskClientRequest(input: {
  taskId: string;
  projectId: string;
  clientId: string;
  message: string;
}): Promise<TaskClientRequest> {
  const trimmed = input.message.trim();
  if (!trimmed) throw new AgencyDbError("Add a message describing what you need from the client.");
  const request = await ensureTaskClientRequest(input.taskId, input.projectId, input.clientId);
  if (request.status === "complete") throw new AgencyDbError("This request is already complete.");

  const client = db();
  const now = new Date().toISOString();
  const { data, error } = await client
    .from("task_client_requests")
    .update({ status: "awaiting_client", message: trimmed, requested_at: now })
    .eq("id", request.id)
    .select("*")
    .single();
  throwIf(error, "send task client request", "Unable to send this request.");
  return mapRequest(data as TaskClientRequestRow);
}

/** Client submits their response. */
export async function submitTaskClientResponse(taskId: string, response: string): Promise<TaskClientRequest> {
  const trimmed = response.trim();
  const existing = await fetchTaskClientRequestByTask(taskId);
  if (!existing) throw new AgencyDbError("This request is not available.");
  if (existing.status !== "awaiting_client") {
    throw new AgencyDbError("This request is not awaiting a response.");
  }

  const client = db();
  const now = new Date().toISOString();
  const { data, error } = await client
    .from("task_client_requests")
    .update({ status: "submitted", client_response: trimmed, submitted_at: now })
    .eq("id", existing.id)
    .select("*")
    .single();
  throwIf(error, "submit task client response", "Unable to submit your response.");
  return mapRequest(data as TaskClientRequestRow);
}

export async function markTaskClientRequestUnderReview(requestId: string): Promise<TaskClientRequest> {
  const client = db();
  const { data, error } = await client
    .from("task_client_requests")
    .update({ status: "under_review" })
    .eq("id", requestId)
    .select("*")
    .single();
  throwIf(error, "review task client request", "Unable to update this request.");
  return mapRequest(data as TaskClientRequestRow);
}

export async function completeTaskClientRequest(requestId: string): Promise<TaskClientRequest> {
  const client = db();
  const now = new Date().toISOString();
  const { data, error } = await client
    .from("task_client_requests")
    .update({ status: "complete", completed_at: now })
    .eq("id", requestId)
    .select("*")
    .single();
  throwIf(error, "complete task client request", "Unable to complete this request.");
  return mapRequest(data as TaskClientRequestRow);
}

export async function insertTaskClientRequestFile(input: {
  requestId: string;
  taskId: string;
  projectId: string;
  clientId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  storagePath: string;
}): Promise<TaskClientRequestFile> {
  const client = db();
  const { data, error } = await client
    .from("task_client_request_files")
    .insert({
      request_id: input.requestId,
      task_id: input.taskId,
      project_id: input.projectId,
      client_id: input.clientId,
      file_name: input.fileName,
      file_type: input.fileType,
      file_size: input.fileSize,
      storage_path: input.storagePath,
    })
    .select("*")
    .single();
  throwIf(error, "save task request file", "Unable to save uploaded file.");
  return mapFile(data as TaskClientRequestFileRow);
}

export async function removeTaskClientRequestFile(fileId: string): Promise<void> {
  const client = db();
  const { error } = await client.from("task_client_request_files").delete().eq("id", fileId);
  throwIf(error, "remove task request file", "Unable to remove file.");
}
