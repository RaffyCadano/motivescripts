import type {
  MaintenancePlanTemplate,
  MaintenancePlanTemplateDefaultPriority,
  MaintenancePlanTemplateInput,
} from "@/data/maintenancePlanTemplates";
import { maintenancePlanTemplateErrorCode, maintenancePlanTemplateErrorMessage } from "@/data/maintenancePlanTemplates";
import { AgencyDbError, logDbError } from "@/lib/dbErrors";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { MaintenancePlanTemplateRow } from "@/types/database";
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

function fail(context: string, error: unknown): never {
  logDbError(context, error);
  const message = error && typeof error === "object" && "message" in error ? String(error.message) : "";
  throw new AgencyDbError(maintenancePlanTemplateErrorMessage(maintenancePlanTemplateErrorCode(message)), error);
}

function toTemplate(row: MaintenancePlanTemplateRow): MaintenancePlanTemplate {
  const services = Array.isArray(row.included_services)
    ? (row.included_services as unknown[]).filter((v): v is string => typeof v === "string")
    : [];
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    monthlyPriceCents: Number(row.monthly_price_cents),
    includedHours: Number(row.included_hours),
    includedServices: services,
    overageRateCents: row.overage_rate_cents === null ? null : Number(row.overage_rate_cents),
    defaultPriority: (row.default_priority as MaintenancePlanTemplateDefaultPriority) ?? "Medium",
    fastMonitoring: row.fast_monitoring,
    reviewIncluded: row.review_included,
    isActive: row.is_active,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function draftFields(input: MaintenancePlanTemplateInput) {
  return {
    name: input.name.trim(),
    description: input.description.trim(),
    monthly_price_cents: input.monthlyPriceCents,
    included_hours: input.includedHours,
    included_services: input.includedServices.filter((s) => s.trim().length > 0),
    overage_rate_cents: input.overageRateCents,
    default_priority: input.defaultPriority,
    fast_monitoring: input.fastMonitoring,
    review_included: input.reviewIncluded,
    is_active: input.isActive,
    sort_order: input.sortOrder,
  };
}

/** All tiers a staff member with invoices.manage can see (active + retired). Client-facing screens should filter to isActive. */
export async function listMaintenancePlanTemplates(): Promise<MaintenancePlanTemplate[]> {
  const client = db();
  const { data, error } = await client
    .from("maintenance_plan_templates")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) fail("load plan tiers", error);
  return ((data ?? []) as MaintenancePlanTemplateRow[]).map(toTemplate);
}

/** Active tiers only -- what a client, or an admin assigning a plan, should be offered. */
export async function listActiveMaintenancePlanTemplates(): Promise<MaintenancePlanTemplate[]> {
  const templates = await listMaintenancePlanTemplates();
  return templates.filter((t) => t.isActive);
}

/**
 * Anon-safe: active Website Care tiers for the public pricing page and the client's self-serve
 * "choose a plan" flow. Never throws -- mirrors fetchPublishedTestimonials, since a failed fetch
 * here should just fall back to the page's static content, not break the page.
 */
export async function fetchPublishedMaintenancePlanTemplates(): Promise<MaintenancePlanTemplate[]> {
  if (!isSupabaseConfigured()) return [];
  const client = getSupabase();
  if (!client) return [];
  const { data, error } = await client
    .from("maintenance_plan_templates")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) return [];
  return ((data ?? []) as MaintenancePlanTemplateRow[]).map(toTemplate);
}

export async function createMaintenancePlanTemplate(input: MaintenancePlanTemplateInput): Promise<string> {
  const client = db();
  const { data, error } = await client
    .from("maintenance_plan_templates")
    .insert(draftFields(input))
    .select("id")
    .single();
  if (error) fail("create plan tier", error);
  if (!data) throw new AgencyDbError("Unable to create this plan tier.");
  return (data as { id: string }).id;
}

export async function updateMaintenancePlanTemplate(id: string, input: MaintenancePlanTemplateInput): Promise<void> {
  const client = db();
  const { error } = await client.from("maintenance_plan_templates").update(draftFields(input)).eq("id", id);
  if (error) fail("update plan tier", error);
}

/** Retires a tier (is_active = false) rather than deleting it -- past service_plans rows keep their plan_template_id link. */
export async function retireMaintenancePlanTemplate(id: string): Promise<void> {
  const client = db();
  const { error } = await client.from("maintenance_plan_templates").update({ is_active: false }).eq("id", id);
  if (error) fail("retire plan tier", error);
}

export async function reactivateMaintenancePlanTemplate(id: string): Promise<void> {
  const client = db();
  const { error } = await client.from("maintenance_plan_templates").update({ is_active: true }).eq("id", id);
  if (error) fail("reactivate plan tier", error);
}
