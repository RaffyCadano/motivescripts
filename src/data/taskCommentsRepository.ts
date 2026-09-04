import type { TaskComment } from "@/data/taskComments";
import { AgencyDbError, friendlyDbError, logDbError } from "@/lib/dbErrors";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { TaskCommentRow } from "@/types/database";
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

function mapComment(row: TaskCommentRow): TaskComment {
  return {
    id: row.id,
    taskId: row.task_id,
    projectId: row.project_id,
    authorId: row.author_id,
    authorLabel: row.author_label,
    body: row.body,
    createdAt: row.created_at,
  };
}

export async function listTaskComments(taskId: string): Promise<TaskComment[]> {
  const client = db();
  const { data, error } = await client
    .from("task_comments")
    .select("*")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });
  throwIf(error, "load task comments", "Unable to load comments.");
  return (data ?? []).map((row) => mapComment(row as TaskCommentRow));
}

export async function addTaskComment(input: {
  taskId: string;
  projectId: string;
  authorLabel: string;
  body: string;
}): Promise<TaskComment> {
  const trimmed = input.body.trim();
  if (!trimmed) throw new AgencyDbError("Write a comment before posting.");
  const client = db();
  const {
    data: { user },
  } = await client.auth.getUser();
  const { data, error } = await client
    .from("task_comments")
    .insert({
      task_id: input.taskId,
      project_id: input.projectId,
      author_id: user?.id ?? null,
      author_label: input.authorLabel.trim() || "Team",
      body: trimmed,
    })
    .select("*")
    .single();
  throwIf(error, "add task comment", "Unable to post this comment.");
  return mapComment(data as TaskCommentRow);
}
