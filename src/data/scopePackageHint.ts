import type { ProjectPackage } from "@/data/projectPackages";

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
