import { projectPackageLabels, type ProjectPackage } from "./projectPackages.ts";

// What the Pricing page comparison table puts in each package. Names are the scope form's page and
// feature labels (SCOPE_PAGE_OPTIONS / SCOPE_FEATURE_OPTIONS).
const GROWTH_PAGES = new Set(["Gallery / Portfolio", "FAQ", "Locations"]);
const GROWTH_FEATURES = new Set(["Booking / Appointment Form", "Quote Request Form"]);
const CUSTOM_FEATURES = new Set(["E-commerce / Online Store", "Customer Login"]);

/**
 * A gentle, non-blocking note for the scope form when what the client picked doesn't fit the package they
 * chose: extra pages and booking or quote forms are Growth, e-commerce and customer login are Custom. It
 * never stops them submitting (the package is only a request; the proposal sets the real scope and price).
 * Returns null when nothing conflicts, or when no package is chosen.
 */
export function scopePackageHint(
  pkg: ProjectPackage | null,
  pages: readonly string[],
  features: readonly string[],
): string | null {
  if (!pkg) return null;
  if (pkg !== "custom" && features.some((item) => CUSTOM_FEATURES.has(item))) {
    return "E-commerce and customer login are part of a Custom project. Choose Custom, or we'll go over it with you in your proposal.";
  }
  if (pkg === "website" && (pages.some((item) => GROWTH_PAGES.has(item)) || features.some((item) => GROWTH_FEATURES.has(item)))) {
    return "Extra pages such as a gallery, FAQ or locations, and booking or quote-request forms, are part of Growth.";
  }
  return null;
}

export type PackageSuggestion = {
  package: ProjectPackage;
  /** The pages and features that put the scope in that package; empty for a plain Website. */
  reasons: string[];
};

/**
 * The package a scope points to, for staff when the client chose "Not sure yet": e-commerce or customer login
 * is Custom; extra pages (gallery, FAQ, locations) or booking and quote forms are Growth; anything else is
 * Website. Same rules as scopePackageHint(). A suggestion only: staff still pick the project's package.
 */
export function suggestProjectPackage(pages: readonly string[], features: readonly string[]): PackageSuggestion {
  const custom = features.filter((item) => CUSTOM_FEATURES.has(item));
  if (custom.length > 0) return { package: "custom", reasons: custom };
  const growth = [...pages.filter((item) => GROWTH_PAGES.has(item)), ...features.filter((item) => GROWTH_FEATURES.has(item))];
  if (growth.length > 0) return { package: "growth", reasons: growth };
  return { package: "website", reasons: [] };
}

/** "Growth (Gallery / Portfolio, Booking / Appointment Form)" or "Website (no extra pages or forms)". */
export function describePackageSuggestion(suggestion: PackageSuggestion): string {
  const label = projectPackageLabels[suggestion.package];
  return suggestion.reasons.length > 0 ? `${label} (${suggestion.reasons.join(", ")})` : `${label} (no extra pages or forms)`;
}
