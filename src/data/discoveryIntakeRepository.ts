import type { ClientScopeBrief } from "@/data/scopeBriefs";
import {
  computeScopeFlags,
  mergeDiscoveryFormData,
  type DiscoveryFileCategory,
  type DiscoveryFollowUp,
  type DiscoveryFormData,
  type DiscoveryIntake,
  type DiscoveryIntakeFile,
  type DiscoveryScopeFlag,
  type DiscoverySectionId,
  type DiscoverySectionReview,
  type DiscoveryStatus,
  validateDiscoveryDraftSave,
  validateDiscoverySubmit,
} from "@/data/discoveryIntake";
import { AgencyDbError, friendlyDbError, isSchemaColumnMissing, logDbError } from "@/lib/dbErrors";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { DiscoveryIntakeFileRow, DiscoveryIntakeRow } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";

function db(): SupabaseClient<Database> {
  if (!isSupabaseConfigured()) {
    throw new AgencyDbError("Supabase is not configured.");
  }
  const client = getSupabase();
  if (!client) throw new AgencyDbError("Supabase is not configured.");
  return client;
}

function intakeUnavailable(error: unknown): boolean {
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
    (message.includes("discovery_intakes") &&
      (message.toLowerCase().includes("does not exist") ||
        message.toLowerCase().includes("schema cache") ||
        message.toLowerCase().includes("could not find")))
  );
}

function fail(context: string, error: unknown, fallback: string): never {
  logDbError(context, error);
  if (intakeUnavailable(error)) {
    throw new AgencyDbError("Discovery intake isn’t available until the latest database update is applied.", error);
  }
  throw new AgencyDbError(friendlyDbError(error, fallback), error);
}

function throwIf(error: unknown, context: string, fallback: string) {
  if (error) fail(context, error, fallback);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function parseFollowUp(value: unknown): DiscoveryFollowUp | null {
  const record = asRecord(value);
  if (!record.requestedAt || typeof record.requestedAt !== "string") return null;
  const missingItems = Array.isArray(record.missingItems)
    ? record.missingItems.filter((item): item is string => typeof item === "string")
    : [];
  const message = typeof record.message === "string" ? record.message : "";
  return { missingItems, message, requestedAt: record.requestedAt };
}

function parseScopeFlags(value: unknown): DiscoveryScopeFlag[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const record = asRecord(item);
      if (typeof record.id !== "string" || typeof record.label !== "string") return null;
      const kind = record.kind === "page" || record.kind === "feature" ? record.kind : "feature";
      return {
        id: record.id,
        kind,
        label: record.label,
        createdAt: typeof record.createdAt === "string" ? record.createdAt : new Date().toISOString(),
      };
    })
    .filter((item): item is DiscoveryScopeFlag => item !== null);
}

function parseSectionReview(value: unknown): DiscoverySectionReview {
  const record = asRecord(value);
  const out: DiscoverySectionReview = {};
  for (const [key, state] of Object.entries(record)) {
    if (state === "pending" || state === "ok" || state === "attention") {
      out[key as DiscoverySectionId] = state;
    }
  }
  return out;
}

function mapIntake(row: DiscoveryIntakeRow, options?: { includeInternal?: boolean }): DiscoveryIntake {
  const includeInternal = options?.includeInternal ?? true;
  return {
    id: row.id,
    projectId: row.project_id,
    clientId: row.client_id,
    status: row.status as DiscoveryStatus,
    formData: mergeDiscoveryFormData(row.form_data as Partial<DiscoveryFormData>),
    sectionReview: parseSectionReview(row.section_review),
    scopeFlags: parseScopeFlags(row.scope_flags),
    followUp: parseFollowUp(row.follow_up),
    internalNotes: includeInternal ? row.internal_notes : "",
    sentAt: row.sent_at,
    submittedAt: row.submitted_at,
    completedAt: row.completed_at,
    updatedAt: row.updated_at,
  };
}

function mapFile(row: DiscoveryIntakeFileRow): DiscoveryIntakeFile {
  return {
    id: row.id,
    intakeId: row.intake_id,
    projectId: row.project_id,
    clientId: row.client_id,
    category: row.category as DiscoveryFileCategory,
    fileName: row.file_name,
    fileType: row.file_type,
    fileSize: row.file_size,
    storagePath: row.storage_path,
    createdAt: row.created_at,
  };
}

export async function fetchDiscoveryIntakeByProject(projectId: string, options?: { includeInternal?: boolean }): Promise<DiscoveryIntake | null> {
  const client = db();
  const { data, error } = await client.from("discovery_intakes").select("*").eq("project_id", projectId).maybeSingle();
  throwIf(error, "load discovery intake", "Unable to load discovery intake.");
  return data ? mapIntake(data as DiscoveryIntakeRow, options) : null;
}

export async function fetchDiscoveryIntakes(): Promise<DiscoveryIntake[]> {
  const client = db();
  const { data, error } = await client.from("discovery_intakes").select("*");
  throwIf(error, "load discovery intakes", "Unable to load discovery intakes.");
  return (data ?? []).map((row) => mapIntake(row as DiscoveryIntakeRow));
}

export async function fetchDiscoveryIntakeFiles(intakeId: string): Promise<DiscoveryIntakeFile[]> {
  const client = db();
  const { data, error } = await client
    .from("discovery_intake_files")
    .select("*")
    .eq("intake_id", intakeId)
    .order("created_at", { ascending: false });
  throwIf(error, "load discovery files", "Unable to load discovery files.");
  return (data ?? []).map((row) => mapFile(row as DiscoveryIntakeFileRow));
}

export async function ensureDiscoveryIntake(projectId: string, clientId: string): Promise<DiscoveryIntake> {
  const existing = await fetchDiscoveryIntakeByProject(projectId);
  if (existing) return existing;

  const client = db();
  const { data, error } = await client
    .from("discovery_intakes")
    .insert({ project_id: projectId, client_id: clientId, status: "not_started" })
    .select("*")
    .single();
  throwIf(error, "create discovery intake", "Unable to prepare discovery intake.");
  return mapIntake(data as DiscoveryIntakeRow);
}

export async function sendDiscoveryIntake(projectId: string, clientId: string): Promise<DiscoveryIntake> {
  const intake = await ensureDiscoveryIntake(projectId, clientId);
  if (intake.status === "complete") throw new AgencyDbError("Discovery is already complete.");
  if (intake.status !== "not_started" && intake.status !== "awaiting_client") {
    throw new AgencyDbError("Discovery has already been sent to the client.");
  }
  const client = db();
  const now = new Date().toISOString();
  const { data, error } = await client
    .from("discovery_intakes")
    .update({ status: "awaiting_client", sent_at: intake.sentAt ?? now })
    .eq("id", intake.id)
    .select("*")
    .single();
  throwIf(error, "send discovery intake", "Unable to send discovery intake.");
  return mapIntake(data as DiscoveryIntakeRow);
}

export async function saveDiscoveryIntakeDraft(
  projectId: string,
  formData: DiscoveryFormData,
  brief: ClientScopeBrief | null,
): Promise<DiscoveryIntake> {
  const invalid = validateDiscoveryDraftSave();
  if (invalid) throw new AgencyDbError(invalid);

  const intake = await fetchDiscoveryIntakeByProject(projectId);
  if (!intake) throw new AgencyDbError("Discovery intake is not available for this project.");
  if (intake.status === "complete") throw new AgencyDbError("Discovery is already complete.");
  if (intake.status === "not_started") throw new AgencyDbError("Discovery intake has not been sent yet.");
  if (intake.status !== "awaiting_client" && intake.status !== "more_information_needed") {
    throw new AgencyDbError("Discovery cannot be edited while it is under review.");
  }

  const client = db();
  const { data, error } = await client
    .from("discovery_intakes")
    .update({
      form_data: formData as unknown as Json,
      scope_flags: computeScopeFlags(formData, brief, intake.scopeFlags) as unknown as Json,
    })
    .eq("id", intake.id)
    .select("*")
    .single();
  throwIf(error, "save discovery draft", "Unable to save discovery form.");
  return mapIntake(data as DiscoveryIntakeRow, { includeInternal: false });
}

export async function submitDiscoveryIntake(
  projectId: string,
  formData: DiscoveryFormData,
  brief: ClientScopeBrief | null,
): Promise<DiscoveryIntake> {
  const invalid = validateDiscoverySubmit(formData);
  if (invalid) throw new AgencyDbError(invalid);

  const intake = await fetchDiscoveryIntakeByProject(projectId);
  if (!intake) throw new AgencyDbError("Discovery intake is not available for this project.");
  if (intake.status === "complete") throw new AgencyDbError("Discovery is already complete.");
  if (intake.status === "not_started") throw new AgencyDbError("Discovery intake has not been sent yet.");
  if (intake.status !== "awaiting_client" && intake.status !== "more_information_needed") {
    throw new AgencyDbError("Discovery cannot be edited while it is under review.");
  }

  const now = new Date().toISOString();
  const client = db();
  const { data, error } = await client
    .from("discovery_intakes")
    .update({
      form_data: formData as unknown as Json,
      scope_flags: computeScopeFlags(formData, brief, intake.scopeFlags) as unknown as Json,
      status: "submitted",
      submitted_at: intake.submittedAt ?? now,
      follow_up: {} as Json,
    })
    .eq("id", intake.id)
    .select("*")
    .single();
  throwIf(error, "submit discovery", "Unable to submit discovery form.");
  return mapIntake(data as DiscoveryIntakeRow, { includeInternal: false });
}

export async function markDiscoveryUnderReview(projectId: string): Promise<DiscoveryIntake> {
  const client = db();
  const { data, error } = await client
    .from("discovery_intakes")
    .update({ status: "under_review" })
    .eq("project_id", projectId)
    .in("status", ["submitted", "more_information_needed"])
    .select("*")
    .maybeSingle();
  throwIf(error, "review discovery", "Unable to update discovery status.");
  if (!data) {
    const current = await fetchDiscoveryIntakeByProject(projectId);
    if (!current) throw new AgencyDbError("Discovery intake not found.");
    return current;
  }
  return mapIntake(data as DiscoveryIntakeRow);
}

export async function requestDiscoveryFollowUp(
  projectId: string,
  input: { missingItems: string[]; message: string },
): Promise<DiscoveryIntake> {
  const trimmed = input.message.trim();
  if (!trimmed) throw new AgencyDbError("Add a message for the client.");
  const followUp: DiscoveryFollowUp = {
    missingItems: input.missingItems,
    message: trimmed,
    requestedAt: new Date().toISOString(),
  };
  const client = db();
  const { data, error } = await client
    .from("discovery_intakes")
    .update({
      status: "more_information_needed",
      follow_up: followUp as unknown as Json,
    })
    .eq("project_id", projectId)
    .select("*")
    .single();
  throwIf(error, "request discovery follow-up", "Unable to send follow-up request.");
  return mapIntake(data as DiscoveryIntakeRow);
}

export async function markDiscoveryComplete(projectId: string): Promise<DiscoveryIntake> {
  const now = new Date().toISOString();
  const client = db();
  const { data, error } = await client
    .from("discovery_intakes")
    .update({ status: "complete", completed_at: now })
    .eq("project_id", projectId)
    .select("*")
    .single();
  throwIf(error, "complete discovery", "Unable to mark discovery complete.");
  return mapIntake(data as DiscoveryIntakeRow);
}

export async function updateDiscoverySectionReview(
  projectId: string,
  sectionReview: DiscoverySectionReview,
): Promise<DiscoveryIntake> {
  const client = db();
  const { data, error } = await client
    .from("discovery_intakes")
    .update({ section_review: sectionReview as unknown as Json })
    .eq("project_id", projectId)
    .select("*")
    .single();
  throwIf(error, "update discovery review", "Unable to update discovery review.");
  return mapIntake(data as DiscoveryIntakeRow);
}

export async function updateDiscoveryInternalNotes(projectId: string, notes: string): Promise<DiscoveryIntake> {
  const client = db();
  const { data, error } = await client
    .from("discovery_intakes")
    .update({ internal_notes: notes.trim() })
    .eq("project_id", projectId)
    .select("*")
    .single();
  throwIf(error, "update discovery notes", "Unable to save internal notes.");
  return mapIntake(data as DiscoveryIntakeRow);
}

export async function insertDiscoveryIntakeFile(input: {
  intakeId: string;
  projectId: string;
  clientId: string;
  category: DiscoveryFileCategory;
  fileName: string;
  fileType: string;
  fileSize: number;
  storagePath: string;
}): Promise<DiscoveryIntakeFile> {
  const client = db();
  const { data, error } = await client
    .from("discovery_intake_files")
    .insert({
      intake_id: input.intakeId,
      project_id: input.projectId,
      client_id: input.clientId,
      category: input.category,
      file_name: input.fileName,
      file_type: input.fileType,
      file_size: input.fileSize,
      storage_path: input.storagePath,
    })
    .select("*")
    .single();
  throwIf(error, "save discovery file", "Unable to save uploaded file.");
  return mapFile(data as DiscoveryIntakeFileRow);
}

export async function removeDiscoveryIntakeFile(fileId: string): Promise<void> {
  const client = db();
  const { error } = await client.from("discovery_intake_files").delete().eq("id", fileId);
  throwIf(error, "remove discovery file", "Unable to remove file.");
}

export async function startDiscoveryFollowUpConversation(input: {
  projectId: string;
  clientId: string;
  projectName: string;
  message: string;
}): Promise<void> {
  const client = db();
  const subject = `Discovery follow-up · ${input.projectName}`;
  const body = input.message.trim();
  const { error } = await client.rpc("start_conversation", {
    p_subject: subject,
    p_body: body,
    p_project_id: input.projectId,
    p_client_id: input.clientId,
  });
  if (error && !isSchemaColumnMissing(error, "conversations", "id")) {
    logDbError("discovery follow-up message", error);
  }
}
