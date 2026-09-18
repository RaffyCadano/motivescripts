/**
 * Admin-managed catalog of website scope "page" and "feature" options.
 * Replaces SCOPE_PAGE_OPTIONS/SCOPE_FEATURE_OPTIONS (src/data/scopeBriefs.ts)
 * as the runtime source of truth for what a client can select. Those TS
 * constants are kept only as historical/seed reference and as the fallback
 * allow-list for call sites not yet converted (see scopeBriefs.ts).
 */

export const FEATURE_CATALOG_CATEGORIES = ["page", "feature"] as const;
export type FeatureCatalogCategory = (typeof FEATURE_CATALOG_CATEGORIES)[number];

export function featureCatalogCategoryLabel(category: FeatureCatalogCategory): string {
  return category === "page" ? "Page" : "Feature";
}

export type FeatureCatalogItem = {
  id: string;
  category: FeatureCatalogCategory;
  name: string;
  slug: string;
  description: string;
  defaultPriceCents: number | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type FeatureCatalogDraft = {
  category: FeatureCatalogCategory;
  name: string;
  description: string;
  defaultPriceCents: number | null;
  isActive: boolean;
  sortOrder: number;
};

export const emptyFeatureCatalogDraft: FeatureCatalogDraft = {
  category: "page",
  name: "",
  description: "",
  defaultPriceCents: null,
  isActive: true,
  sortOrder: 0,
};

export function draftFromCatalogItem(item: FeatureCatalogItem): FeatureCatalogDraft {
  return {
    category: item.category,
    name: item.name,
    description: item.description,
    defaultPriceCents: item.defaultPriceCents,
    isActive: item.isActive,
    sortOrder: item.sortOrder,
  };
}

/** Lowercase, hyphenated slug from a display name -- e.g. "Gallery / Portfolio" -> "gallery-portfolio". */
export function slugifyFeatureCatalogName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function validateFeatureCatalogDraft(draft: FeatureCatalogDraft): string | null {
  if (!draft.name.trim()) return "Name is required.";
  if (draft.name.trim().length > 120) return "Keep the name under 120 characters.";
  if (!FEATURE_CATALOG_CATEGORIES.includes(draft.category)) return "Choose a category.";
  if (draft.description.length > 500) return "Keep the description under 500 characters.";
  if (draft.defaultPriceCents != null && (!Number.isFinite(draft.defaultPriceCents) || draft.defaultPriceCents < 0)) {
    return "Default price can't be negative.";
  }
  if (!Number.isFinite(draft.sortOrder)) return "Sort order must be a number.";
  return null;
}

export function formatFeatureCatalogPrice(cents: number | null): string {
  if (cents == null) return "—";
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}
