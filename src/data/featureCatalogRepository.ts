import type { FeatureCatalogCategory, FeatureCatalogDraft, FeatureCatalogItem } from "@/data/featureCatalog";
import { slugifyFeatureCatalogName } from "@/data/featureCatalog";
import { AgencyDbError, friendlyDbError, logDbError } from "@/lib/dbErrors";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { FeatureCatalogRow } from "@/types/database";
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
      throw new AgencyDbError("An item with this name already exists in this category.", error);
    }
    throw new AgencyDbError(friendlyDbError(error, fallback), error);
  }
}

function toCatalogItem(row: FeatureCatalogRow): FeatureCatalogItem {
  return {
    id: row.id,
    category: row.category as FeatureCatalogCategory,
    name: row.name,
    slug: row.slug,
    description: row.description ?? "",
    defaultPriceCents: row.default_price_cents,
    isActive: row.is_active,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function draftFields(draft: FeatureCatalogDraft, slug: string) {
  return {
    category: draft.category,
    name: draft.name.trim(),
    slug,
    description: draft.description.trim() || null,
    default_price_cents: draft.defaultPriceCents,
    is_active: draft.isActive,
    sort_order: draft.sortOrder,
  };
}

/**
 * Every catalog item, including inactive ones -- for the Admin → Settings →
 * Feature Catalog management screen. RLS restricts inactive-row visibility
 * to admins, so a non-admin caller transparently only ever gets active rows
 * back (no separate check needed here).
 */
export async function fetchFeatureCatalog(): Promise<FeatureCatalogItem[]> {
  const client = db();
  const { data, error } = await client
    .from("feature_catalog")
    .select("*")
    .order("category", { ascending: true })
    .order("sort_order", { ascending: true });
  throwIf(error, "load feature catalog", "Unable to load the feature catalog.");
  return ((data ?? []) as FeatureCatalogRow[]).map(toCatalogItem);
}

/** Active items only, grouped by category, ordered for display -- what the client scope form and any staff scope UI should render. */
export async function fetchActiveFeatureCatalog(): Promise<FeatureCatalogItem[]> {
  const client = db();
  const { data, error } = await client
    .from("feature_catalog")
    .select("*")
    .eq("is_active", true)
    .order("category", { ascending: true })
    .order("sort_order", { ascending: true });
  throwIf(error, "load feature catalog", "Unable to load the website scope options.");
  return ((data ?? []) as FeatureCatalogRow[]).map(toCatalogItem);
}

export async function insertFeatureCatalogItem(draft: FeatureCatalogDraft): Promise<string> {
  const client = db();
  const slug = slugifyFeatureCatalogName(draft.name);
  const { data, error } = await client
    .from("feature_catalog")
    .insert(draftFields(draft, slug))
    .select("id")
    .single();
  throwIf(error, "create feature catalog item", "Unable to create this item.");
  if (!data) throw new AgencyDbError("Unable to create this item.");
  return (data as { id: string }).id;
}

/** Slug is only re-derived from the name if the item's name actually changed elsewhere -- pass the current slug to keep it stable across unrelated edits. */
export async function updateFeatureCatalogItem(
  id: string,
  draft: FeatureCatalogDraft,
  currentSlug: string,
  nameChanged: boolean,
): Promise<void> {
  const client = db();
  const slug = nameChanged ? slugifyFeatureCatalogName(draft.name) : currentSlug;
  const { error } = await client.from("feature_catalog").update(draftFields(draft, slug)).eq("id", id);
  throwIf(error, "update feature catalog item", "Unable to update this item.");
}

export async function setFeatureCatalogItemActive(id: string, isActive: boolean): Promise<void> {
  const client = db();
  const { error } = await client.from("feature_catalog").update({ is_active: isActive }).eq("id", id);
  throwIf(error, isActive ? "reactivate feature catalog item" : "deactivate feature catalog item", "Unable to update this item.");
}

/**
 * Hard delete. Safe to expose: historical proposals/contracts/invoices store
 * copied text (see scopeBriefs.ts / proposal_items), never a reference to
 * this row, so removing a catalog item cannot corrupt past records. Prefer
 * setFeatureCatalogItemActive for anything that has ever been offered to a
 * client -- deactivating keeps the item's history intact and reversible.
 */
export async function deleteFeatureCatalogItem(id: string): Promise<void> {
  const client = db();
  const { error } = await client.from("feature_catalog").delete().eq("id", id);
  throwIf(error, "delete feature catalog item", "Unable to delete this item.");
}
