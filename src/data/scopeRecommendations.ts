import {
  normalizeScopeFeatures,
  normalizeScopePages,
  type ScopeBriefDraft,
} from "@/data/scopeBriefs";

const SERVICE_PAGES = ["About", "Services", "Gallery / Portfolio", "Testimonials", "Contact"];
const PROFESSIONAL_PAGES = ["About", "Services", "Testimonials", "FAQ", "Contact"];
const RESTAURANT_PAGES = ["About", "Pricing", "Gallery / Portfolio", "Contact", "Locations"];
const GENERIC_PAGES = ["About", "Services", "Contact"];

const SERVICE_FEATURES = ["Contact Form", "Quote Request Form", "Google Maps", "Social Media Integration"];
const APPOINTMENT_FEATURES = ["Contact Form", "Booking / Appointment Form", "Google Maps", "Social Media Integration"];
const RESTAURANT_FEATURES = ["Contact Form", "Google Maps", "Social Media Integration", "Gallery"];
const GENERIC_FEATURES = ["Contact Form", "Google Maps", "Social Media Integration"];

function industryKey(industry: string | null | undefined): string {
  return (industry ?? "").trim();
}

export function recommendedScopePages(industry: string | null | undefined): string[] {
  switch (industryKey(industry)) {
    case "Landscaping":
    case "Contractor":
    case "Tree service":
    case "Home services":
    case "Cleaning":
    case "Auto":
      return normalizeScopePages(SERVICE_PAGES);
    case "Restaurant":
      return normalizeScopePages(RESTAURANT_PAGES);
    case "Professional services":
      return normalizeScopePages(PROFESSIONAL_PAGES);
    case "Salon / barber":
      return normalizeScopePages(SERVICE_PAGES);
    default:
      return normalizeScopePages(GENERIC_PAGES);
  }
}

export function recommendedScopeFeatures(industry: string | null | undefined): string[] {
  switch (industryKey(industry)) {
    case "Salon / barber":
      return normalizeScopeFeatures(APPOINTMENT_FEATURES);
    case "Restaurant":
      return normalizeScopeFeatures(RESTAURANT_FEATURES);
    case "Landscaping":
    case "Contractor":
    case "Tree service":
    case "Home services":
    case "Cleaning":
    case "Auto":
    case "Professional services":
      return normalizeScopeFeatures(SERVICE_FEATURES);
    default:
      return normalizeScopeFeatures(GENERIC_FEATURES);
  }
}

export function mergeScopeChoices(current: readonly string[], added: readonly string[], kind: "pages" | "features"): string[] {
  const extra = kind === "pages" ? normalizeScopePages(added) : normalizeScopeFeatures(added);
  const seen = new Set(current);
  const next = [...current];
  for (const item of extra) {
    if (seen.has(item)) continue;
    seen.add(item);
    next.push(item);
  }
  return next;
}

export function applyPageRecommendations(draft: ScopeBriefDraft, picks: readonly string[]): ScopeBriefDraft {
  return { ...draft, pages: mergeScopeChoices(draft.pages, picks, "pages") };
}

export function applyFeatureRecommendations(draft: ScopeBriefDraft, picks: readonly string[]): ScopeBriefDraft {
  return { ...draft, features: mergeScopeChoices(draft.features, picks, "features") };
}
