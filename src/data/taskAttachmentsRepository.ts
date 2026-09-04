import type { TaskAttachment } from "@/data/taskAttachments";
import { tryRemoveProjectFile, uploadTaskAttachmentFile } from "@/data/fileStorage";
import { AgencyDbError, friendlyDbError, logDbError } from "@/lib/dbErrors";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { TaskAttachmentRow } from "@/types/database";
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

function fail(context: string, error: unknown, fallback: string): never {
  logDbError(context, error);
  throw new AgencyDbError(friendlyDbError(error, fallback), error);
}

function throwIf(error: unknown, context: string, fallback: string) {
  if (error) fail(context, error, fallback);
}

function mapAttachment(row: TaskAttachmentRow): TaskAttachment {
  return {
    id: row.id,
    taskId: row.task_id,
    projectId: row.project_id,
    fileName: row.file_name,
    fileSize: row.file_size,
    storagePath: row.storage_path,
    uploadedBy: row.uploaded_by,
    uploadedByLabel: row.uploaded_by_label,
    createdAt: row.created_at,
  };
}

export async function listTaskAttachments(taskId: string): Promise<TaskAttachment[]> {
  const client = db();
  const { data, error } = await client
    .from("task_attachments")
    .select("*")
    .eq("task_id", taskId)
    .order("created_at", { ascending: false });
  throwIf(error, "load task attachments", "Unable to load attachments.");
  return (data ?? []).map((row) => mapAttachment(row as TaskAttachmentRow));
}

export async function uploadTaskAttachment(input: {
  projectId: string;
  taskId: string;
  uploadedByLabel: string;
  file: File;
}): Promise<TaskAttachment> {
  const fileId = crypto.randomUUID();
  const storagePath = await uploadTaskAttachmentFile({
    projectId: input.projectId,
    taskId: input.taskId,
    fileId,
    file: input.file,
  });

  const client = db();
  const {
    data: { user },
  } = await client.auth.getUser();
  const { data, error } = await client
    .from("task_attachments")
    .insert({
      task_id: input.taskId,
      project_id: input.projectId,
      file_name: input.file.name,
      file_size: input.file.size,
      storage_path: storagePath,
      uploaded_by: user?.id ?? null,
      uploaded_by_label: input.uploadedByLabel.trim() || "Team",
    })
    .select("*")
    .single();
  if (error) {
    await tryRemoveProjectFile(storagePath);
    fail("save task attachment", error, "The file uploaded, but saving it failed.");
  }
  return mapAttachment(data as TaskAttachmentRow);
}

export async function removeTaskAttachment(attachment: { id: string; storagePath: string }): Promise<void> {
  const client = db();
  const { error } = await client.from("task_attachments").delete().eq("id", attachment.id);
  throwIf(error, "remove task attachment", "Unable to remove this file.");
  await tryRemoveProjectFile(attachment.storagePath);
}
