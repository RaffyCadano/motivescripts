/**
 * Admin-managed definitions for production tasks. Replaces the hardcoded
 * task-definition portion of prepare_project_production_from_paid_invoice()
 * (see supabase/migrations/20260930320000-340000) as the runtime source of
 * truth for what gets generated when an invoice is paid. Editing a
 * template only affects FUTURE production plans -- every field is copied
 * onto the generated task row at creation time, so existing tasks are never
 * touched by a later edit here.
 */

import type { TaskRecommendedRoleId } from "@/data/taskRecommendedRoles";
import type { TaskType } from "@/data/taskTypes";

export const TASK_TEMPLATE_MILESTONE_KEYS = ["discovery", "design", "development", "review", "launch"] as const;
export type TaskTemplateMilestoneKey = (typeof TASK_TEMPLATE_MILESTONE_KEYS)[number];

export function taskTemplateMilestoneLabel(key: TaskTemplateMilestoneKey): string {
  switch (key) {
    case "discovery":
      return "Discovery";
    case "design":
      return "Design";
    case "development":
      return "Development";
    case "review":
      return "QA & Client Review";
    case "launch":
      return "Launch";
  }
}

/**
 * The exact vocabulary production_scope_keys_from_text() already extracts
 * from accepted proposal/contract text today (see canonical_commercial_item()
 * in supabase/migrations/20260909000000_catalog_additions.sql). Distinct
 * from the Feature Catalog's client-facing page/feature names -- this is
 * the internal production-planning vocabulary a task template triggers on.
 */
export const PRODUCTION_SCOPE_KEYS = [
  "homepage", "about", "services", "contact", "gallery", "testimonials", "faq", "pricing", "team", "locations", "blog",
  "responsive", "mobile",
  "content", "content_migration",
  "contact_form", "quote_form", "booking_form", "payments", "ecommerce", "customer_login", "maps", "social",
  "newsletter", "live_chat", "seo", "analytics", "hosting", "email", "domain", "performance", "security",
] as const;
export type ProductionScopeKey = (typeof PRODUCTION_SCOPE_KEYS)[number];

const SCOPE_KEY_LABELS: Record<ProductionScopeKey, string> = {
  homepage: "Homepage",
  about: "About",
  services: "Services",
  contact: "Contact",
  gallery: "Gallery / Portfolio",
  testimonials: "Testimonials",
  faq: "FAQ",
  pricing: "Pricing",
  team: "Team",
  locations: "Locations",
  blog: "Blog / News",
  responsive: "Responsive design",
  mobile: "Mobile optimization",
  content: "Copywriting",
  content_migration: "Content migration",
  contact_form: "Contact form",
  quote_form: "Quote request form",
  booking_form: "Booking / appointment form",
  payments: "Online payments",
  ecommerce: "E-commerce",
  customer_login: "Customer login",
  maps: "Google Maps",
  social: "Social media integration",
  newsletter: "Newsletter signup",
  live_chat: "Live chat",
  seo: "SEO setup",
  analytics: "Analytics",
  hosting: "Hosting setup",
  email: "Business email",
  domain: "Domain",
  performance: "Performance optimization",
  security: "Security setup",
};

export function scopeKeyLabel(key: string): string {
  return SCOPE_KEY_LABELS[key as ProductionScopeKey] ?? key;
}

export type TaskTemplateChecklistItem = {
  id: string;
  title: string;
  description: string;
  sortOrder: number;
};

export type TaskTemplateChecklistItemDraft = {
  title: string;
  description: string;
};

export type TaskTemplateItem = {
  id: string;
  slug: string;
  title: string;
  description: string;
  instructions: string;
  milestoneKey: TaskTemplateMilestoneKey;
  taskType: TaskType;
  recommendedRole: TaskRecommendedRoleId | null;
  requiresContentScope: boolean;
  estimatedHours: number | null;
  isRequired: boolean;
  isActive: boolean;
  sortOrder: number;
  scopeKeys: string[];
  createdAt: string;
  updatedAt: string;
};

export type TaskTemplateDraft = {
  title: string;
  description: string;
  instructions: string;
  milestoneKey: TaskTemplateMilestoneKey;
  taskType: TaskType;
  recommendedRole: TaskRecommendedRoleId | null;
  requiresContentScope: boolean;
  estimatedHours: number | null;
  isRequired: boolean;
  isActive: boolean;
  sortOrder: number;
  scopeKeys: string[];
};

export const emptyTaskTemplateDraft: TaskTemplateDraft = {
  title: "",
  description: "",
  instructions: "",
  milestoneKey: "discovery",
  taskType: "internal",
  recommendedRole: null,
  requiresContentScope: false,
  estimatedHours: null,
  isRequired: true,
  isActive: true,
  sortOrder: 0,
  scopeKeys: [],
};

export function draftFromTaskTemplate(item: TaskTemplateItem): TaskTemplateDraft {
  return {
    title: item.title,
    description: item.description,
    instructions: item.instructions,
    milestoneKey: item.milestoneKey,
    taskType: item.taskType,
    recommendedRole: item.recommendedRole,
    requiresContentScope: item.requiresContentScope,
    estimatedHours: item.estimatedHours,
    isRequired: item.isRequired,
    isActive: item.isActive,
    sortOrder: item.sortOrder,
    scopeKeys: item.scopeKeys,
  };
}

/** Lowercase, hyphenated slug from a title -- e.g. "Design homepage" -> "design-homepage". */
export function slugifyTaskTemplateTitle(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function validateTaskTemplateDraft(draft: TaskTemplateDraft): string | null {
  if (!draft.title.trim()) return "Title is required.";
  if (draft.title.trim().length > 160) return "Keep the title under 160 characters.";
  if (!TASK_TEMPLATE_MILESTONE_KEYS.includes(draft.milestoneKey)) return "Choose a milestone.";
  if (draft.description.length > 500) return "Keep the short description under 500 characters.";
  if (draft.instructions.length > 10000) return "Keep the instructions under 10,000 characters.";
  if (draft.estimatedHours != null && (!Number.isFinite(draft.estimatedHours) || draft.estimatedHours < 0)) {
    return "Estimated hours can't be negative.";
  }
  if (!Number.isFinite(draft.sortOrder)) return "Sort order must be a number.";
  return null;
}

export function validateChecklistItemDraft(draft: TaskTemplateChecklistItemDraft): string | null {
  if (!draft.title.trim()) return "Checklist item text is required.";
  if (draft.title.trim().length > 300) return "Keep the checklist item under 300 characters.";
  return null;
}
