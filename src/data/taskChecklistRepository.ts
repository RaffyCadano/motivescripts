import type { TaskChecklistItem } from "@/data/taskChecklist";
import { AgencyDbError, friendlyDbError, logDbError } from "@/lib/dbErrors";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { TaskChecklistItemRow } from "@/types/database";
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

function mapItem(row: TaskChecklistItemRow): TaskChecklistItem {
  return {
    id: row.id,
    taskId: row.task_id,
    projectId: row.project_id,
    label: row.label,
    done: row.done,
    position: row.position,
    createdAt: row.created_at,
  };
}

export async function listTaskChecklistItems(taskId: string): Promise<TaskChecklistItem[]> {
  const client = db();
  const { data, error } = await client
    .from("task_checklist_items")
    .select("*")
    .eq("task_id", taskId)
    .order("position", { ascending: true });
  throwIf(error, "load checklist", "Unable to load the checklist.");
  return (data ?? []).map((row) => mapItem(row as TaskChecklistItemRow));
}

export async function addTaskChecklistItem(input: {
  taskId: string;
  projectId: string;
  label: string;
  position: number;
}): Promise<TaskChecklistItem> {
  const trimmed = input.label.trim();
  if (!trimmed) throw new AgencyDbError("Enter a checklist item.");
  const client = db();
  const { data, error } = await client
    .from("task_checklist_items")
    .insert({ task_id: input.taskId, project_id: input.projectId, label: trimmed, position: input.position })
    .select("*")
    .single();
  throwIf(error, "add checklist item", "Unable to add this item.");
  return mapItem(data as TaskChecklistItemRow);
}

export async function setTaskChecklistItemDone(id: string, done: boolean): Promise<void> {
  const client = db();
  const { error } = await client.from("task_checklist_items").update({ done }).eq("id", id);
  throwIf(error, "update checklist item", "Unable to update this item.");
}

export async function removeTaskChecklistItem(id: string): Promise<void> {
  const client = db();
  const { error } = await client.from("task_checklist_items").delete().eq("id", id);
  throwIf(error, "remove checklist item", "Unable to remove this item.");
}
