import type {
  TaskTemplateChecklistItem,
  TaskTemplateChecklistItemDraft,
  TaskTemplateDraft,
  TaskTemplateItem,
  TaskTemplateMilestoneKey,
} from "@/data/taskTemplates";
import { slugifyTaskTemplateTitle } from "@/data/taskTemplates";
import type { TaskRecommendedRoleId } from "@/data/taskRecommendedRoles";
import type { TaskType } from "@/data/taskTypes";
import { AgencyDbError, friendlyDbError, logDbError } from "@/lib/dbErrors";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type {
  TaskTemplateChecklistItemRow,
  TaskTemplateRow,
  TaskTemplateScopeItemRow,
} from "@/types/database";
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

function throwIf(error: unknown, context: string, fallback: string) {
  if (error) {
    logDbError(context, error);
    if (error && typeof error === "object" && "code" in error && error.code === "23505") {
      throw new AgencyDbError("A template with this title already exists.", error);
    }
    throw new AgencyDbError(friendlyDbError(error, fallback), error);
  }
}

function toItem(row: TaskTemplateRow, scopeKeys: string[]): TaskTemplateItem {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    instructions: row.instructions ?? "",
    milestoneKey: row.milestone_key as TaskTemplateMilestoneKey,
    taskType: row.task_type as TaskType,
    recommendedRole: row.recommended_role as TaskRecommendedRoleId | null,
    requiresContentScope: row.requires_content_scope,
    estimatedHours: row.estimated_hours,
    isRequired: row.is_required,
    isActive: row.is_active,
    sortOrder: row.sort_order,
    scopeKeys,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function draftFields(draft: TaskTemplateDraft, slug: string) {
  return {
    slug,
    title: draft.title.trim(),
    description: draft.description.trim(),
    instructions: draft.instructions.trim() || null,
    milestone_key: draft.milestoneKey,
    task_type: draft.taskType,
    recommended_role: draft.recommendedRole,
    requires_content_scope: draft.requiresContentScope,
    estimated_hours: draft.estimatedHours,
    is_required: draft.isRequired,
    is_active: draft.isActive,
    sort_order: draft.sortOrder,
  };
}

export async function fetchTaskTemplates(): Promise<TaskTemplateItem[]> {
  const client = db();
  const [templatesRes, scopeItemsRes] = await Promise.all([
    client
      .from("task_templates")
      .select("*")
      .order("milestone_key", { ascending: true })
      .order("sort_order", { ascending: true }),
    client.from("task_template_scope_items").select("*"),
  ]);
  throwIf(templatesRes.error, "load task templates", "Unable to load task templates.");
  throwIf(scopeItemsRes.error, "load task template scope items", "Unable to load task templates.");

  const scopeKeysByTemplate = new Map<string, string[]>();
  for (const row of (scopeItemsRes.data ?? []) as TaskTemplateScopeItemRow[]) {
    const list = scopeKeysByTemplate.get(row.task_template_id) ?? [];
    list.push(row.scope_item_key);
    scopeKeysByTemplate.set(row.task_template_id, list);
  }

  return ((templatesRes.data ?? []) as TaskTemplateRow[]).map((row) => toItem(row, scopeKeysByTemplate.get(row.id) ?? []));
}

async function replaceScopeItems(templateId: string, scopeKeys: string[]): Promise<void> {
  const client = db();
  const { error: deleteError } = await client.from("task_template_scope_items").delete().eq("task_template_id", templateId);
  throwIf(deleteError, "update task template scope mapping", "Unable to save the scope mapping.");
  const unique = Array.from(new Set(scopeKeys.map((key) => key.trim()).filter(Boolean)));
  if (unique.length === 0) return;
  const { error: insertError } = await client
    .from("task_template_scope_items")
    .insert(unique.map((scope_item_key) => ({ task_template_id: templateId, scope_item_key })));
  throwIf(insertError, "update task template scope mapping", "Unable to save the scope mapping.");
}

export async function insertTaskTemplate(draft: TaskTemplateDraft): Promise<string> {
  const client = db();
  const slug = slugifyTaskTemplateTitle(draft.title);
  const { data, error } = await client
    .from("task_templates")
    .insert(draftFields(draft, slug))
    .select("id")
    .single();
  throwIf(error, "create task template", "Unable to create this task template.");
  if (!data) throw new AgencyDbError("Unable to create this task template.");
  const id = (data as { id: string }).id;
  await replaceScopeItems(id, draft.scopeKeys);
  return id;
}

export async function updateTaskTemplate(
  id: string,
  draft: TaskTemplateDraft,
  currentSlug: string,
  titleChanged: boolean,
): Promise<void> {
  const client = db();
  const slug = titleChanged ? slugifyTaskTemplateTitle(draft.title) : currentSlug;
  const { error } = await client.from("task_templates").update(draftFields(draft, slug)).eq("id", id);
  throwIf(error, "update task template", "Unable to update this task template.");
  await replaceScopeItems(id, draft.scopeKeys);
}

export async function setTaskTemplateActive(id: string, isActive: boolean): Promise<void> {
  const client = db();
  const { error } = await client.from("task_templates").update({ is_active: isActive }).eq("id", id);
  throwIf(error, isActive ? "reactivate task template" : "deactivate task template", "Unable to update this task template.");
}

/**
 * Hard delete. Safe to expose: prepare_project_production_from_paid_invoice()
 * copies every field onto the task at generation time (title, description,
 * instructions, task_type, recommended_role, checklist snapshot) and
 * task_template_id is ON DELETE SET NULL, so deleting a template can never
 * corrupt an already-generated task. Prefer setTaskTemplateActive for a
 * template that has ever been used -- deactivating keeps it available for
 * reference and is reversible.
 */
export async function deleteTaskTemplate(id: string): Promise<void> {
  const client = db();
  const { error } = await client.from("task_templates").delete().eq("id", id);
  throwIf(error, "delete task template", "Unable to delete this task template.");
}

function toChecklistItem(row: TaskTemplateChecklistItemRow): TaskTemplateChecklistItem {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? "",
    sortOrder: row.sort_order,
  };
}

export async function fetchTaskTemplateChecklistItems(templateId: string): Promise<TaskTemplateChecklistItem[]> {
  const client = db();
  const { data, error } = await client
    .from("task_template_checklist_items")
    .select("*")
    .eq("task_template_id", templateId)
    .order("sort_order", { ascending: true });
  throwIf(error, "load task template checklist", "Unable to load this template's checklist.");
  return ((data ?? []) as TaskTemplateChecklistItemRow[]).map(toChecklistItem);
}

export async function addTaskTemplateChecklistItem(
  templateId: string,
  draft: TaskTemplateChecklistItemDraft,
  sortOrder: number,
): Promise<void> {
  const client = db();
  const { error } = await client.from("task_template_checklist_items").insert({
    task_template_id: templateId,
    title: draft.title.trim(),
    description: draft.description.trim() || null,
    sort_order: sortOrder,
  });
  throwIf(error, "add checklist item", "Unable to add this checklist item.");
}

export async function updateTaskTemplateChecklistItem(id: string, draft: TaskTemplateChecklistItemDraft): Promise<void> {
  const client = db();
  const { error } = await client
    .from("task_template_checklist_items")
    .update({ title: draft.title.trim(), description: draft.description.trim() || null })
    .eq("id", id);
  throwIf(error, "update checklist item", "Unable to update this checklist item.");
}

export async function deleteTaskTemplateChecklistItem(id: string): Promise<void> {
  const client = db();
  const { error } = await client.from("task_template_checklist_items").delete().eq("id", id);
  throwIf(error, "delete checklist item", "Unable to delete this checklist item.");
}

export async function reorderTaskTemplateChecklistItems(orderedIds: string[]): Promise<void> {
  const client = db();
  for (let i = 0; i < orderedIds.length; i += 1) {
    const { error } = await client.from("task_template_checklist_items").update({ sort_order: i }).eq("id", orderedIds[i]);
    throwIf(error, "reorder checklist items", "Unable to reorder the checklist.");
  }
}
