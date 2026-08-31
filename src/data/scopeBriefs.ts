export const SCOPE_PACKAGE_INCLUDED = [
  "Homepage",
  "Responsive Website Design",
  "Mobile Optimization",
] as const;

export const SCOPE_PAGE_OPTIONS = [
  "Services",
  "About",
  "Contact",
  "Gallery / Portfolio",
  "Testimonials",
  "FAQ",
  "Pricing",
  "Team",
  "Locations",
  "Blog / News",
  "Other",
] as const;

export const SCOPE_FEATURE_OPTIONS = [
  "Contact Form",
  "Quote Request Form",
  "Booking / Appointment Form",
  "Online Payments",
  "E-commerce / Online Store",
  "Customer Login",
  "Gallery",
  "Google Maps",
  "Social Media Integration",
  "Newsletter Signup",
  "Live Chat",
  "Other",
] as const;

export const SCOPE_STYLE_OPTIONS = [
  "Modern",
  "Minimal",
  "Professional",
  "Bold",
  "Elegant",
  "Friendly",
  "Luxury",
  "Industrial",
  "Other",
] as const;

export const SCOPE_COMPLEX_FEATURES = new Set([
  "Booking / Appointment Form",
  "Online Payments",
  "E-commerce / Online Store",
  "Customer Login",
]);

const PAGE_SET = new Set<string>(SCOPE_PAGE_OPTIONS);
const FEATURE_SET = new Set<string>(SCOPE_FEATURE_OPTIONS);
const STYLE_SET = new Set<string>(SCOPE_STYLE_OPTIONS);

const LEGACY_PAGE_TO_PAGE: Record<string, string> = {
  "Services Page": "Services",
  "About Page": "About",
  "Contact Page": "Contact",
  Gallery: "Gallery / Portfolio",
};

const LEGACY_PAGE_TO_FEATURE: Record<string, string> = {
  "Quote Request Form": "Quote Request Form",
  "Booking Form": "Booking / Appointment Form",
  "Google Maps": "Google Maps",
  "Social Media Integration": "Social Media Integration",
};

export type ClientScopeBrief = {
  id: string;
  clientId: string;
  selectedPages: string[];
  otherPages: string;
  features: string[];
  otherFeatures: string;
  goal: string;
  hasExistingWebsite: boolean;
  currentWebsiteUrl: string;
  currentWebsiteNotes: string;
  designStyles: string[];
  otherStyle: string;
  likedWebsites: string;
  additionalNotes: string;
  submittedAt: string;
  updatedAt: string;
};

export type ScopeBriefDraft = {
  pages: string[];
  otherPages: string;
  features: string[];
  otherFeatures: string;
  goal: string;
  hasExistingWebsite: boolean | null;
  currentWebsiteUrl: string;
  currentWebsiteNotes: string;
  styles: string[];
  otherStyle: string;
  likedWebsites: string;
  additionalNotes: string;
};

export function emptyScopeDraft(): ScopeBriefDraft {
  return {
    pages: [],
    otherPages: "",
    features: [],
    otherFeatures: "",
    goal: "",
    hasExistingWebsite: null,
    currentWebsiteUrl: "",
    currentWebsiteNotes: "",
    styles: [],
    otherStyle: "",
    likedWebsites: "",
    additionalNotes: "",
  };
}

export function draftFromBrief(brief: ClientScopeBrief): ScopeBriefDraft {
  return {
    pages: brief.selectedPages,
    otherPages: brief.otherPages,
    features: brief.features,
    otherFeatures: brief.otherFeatures,
    goal: brief.goal,
    hasExistingWebsite: brief.hasExistingWebsite,
    currentWebsiteUrl: brief.currentWebsiteUrl,
    currentWebsiteNotes: brief.currentWebsiteNotes,
    styles: brief.designStyles,
    otherStyle: brief.otherStyle,
    likedWebsites: brief.likedWebsites,
    additionalNotes: brief.additionalNotes,
  };
}

function uniqueAllowed(values: readonly string[], allowed: Set<string>): string[] {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const value of values) {
    const label = value.trim();
    if (!allowed.has(label) || seen.has(label)) continue;
    seen.add(label);
    next.push(label);
  }
  return next;
}

export function normalizeScopePages(pages: readonly string[]): string[] {
  return uniqueAllowed(pages, PAGE_SET);
}

export function normalizeScopeFeatures(features: readonly string[]): string[] {
  return uniqueAllowed(features, FEATURE_SET);
}

export function normalizeScopeStyles(styles: readonly string[]): string[] {
  return uniqueAllowed(styles, STYLE_SET);
}

export function splitLegacySelections(pages: readonly string[]): { pages: string[]; features: string[] } {
  const nextPages: string[] = [];
  const nextFeatures: string[] = [];
  const seenPages = new Set<string>();
  const seenFeatures = new Set<string>();

  for (const raw of pages) {
    const label = raw.trim();
    if (!label || (SCOPE_PACKAGE_INCLUDED as readonly string[]).includes(label)) continue;
    const asPage = LEGACY_PAGE_TO_PAGE[label] ?? (PAGE_SET.has(label) ? label : "");
    const asFeature = LEGACY_PAGE_TO_FEATURE[label] ?? (FEATURE_SET.has(label) ? label : "");
    if (asPage && !seenPages.has(asPage)) {
      seenPages.add(asPage);
      nextPages.push(asPage);
    }
    if (asFeature && !seenFeatures.has(asFeature)) {
      seenFeatures.add(asFeature);
      nextFeatures.push(asFeature);
    }
  }

  return { pages: nextPages, features: nextFeatures };
}

function looksLikeUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 300) return false;
  return /^(https?:\/\/)?[^\s]+\.[^\s]+$/i.test(trimmed);
}

export function validateScopeBrief(draft: ScopeBriefDraft): string | null {
  const pages = normalizeScopePages(draft.pages);
  const features = normalizeScopeFeatures(draft.features);
  const styles = normalizeScopeStyles(draft.styles);
  const goal = draft.goal.trim();
  if (goal.length < 1) return "Tell us what your website is for.";
  if (goal.length > 2000) return "Keep the website purpose under 2,000 characters.";
  if (pages.includes("Other") && !draft.otherPages.trim()) return "Describe the other page you need.";
  if (draft.otherPages.trim().length > 400) return "Keep the other page description shorter.";
  if (features.includes("Other") && !draft.otherFeatures.trim()) return "Describe the other functionality you need.";
  if (draft.otherFeatures.trim().length > 400) return "Keep the other functionality description shorter.";
  if (draft.hasExistingWebsite == null) return "Tell us whether you already have a website.";
  if (draft.hasExistingWebsite && !looksLikeUrl(draft.currentWebsiteUrl)) {
    return "Enter the current website address.";
  }
  if (draft.currentWebsiteNotes.trim().length > 2000) return "Keep the current-website notes shorter.";
  if (styles.includes("Other") && !draft.otherStyle.trim()) return "Describe the style you’re looking for.";
  if (draft.otherStyle.trim().length > 200) return "Keep the style description shorter.";
  if (draft.likedWebsites.trim().length > 1000) return "Keep the website links shorter.";
  if (draft.additionalNotes.trim().length > 2000) return "Keep the extra notes shorter.";
  return null;
}

export function needsComplexityNote(draft: ScopeBriefDraft): boolean {
  return (
    draft.features.some((item) => SCOPE_COMPLEX_FEATURES.has(item)) ||
    Boolean(draft.otherFeatures.trim()) ||
    draft.features.includes("Other")
  );
}

export function projectDescriptionFromBrief(brief: ClientScopeBrief): string {
  const pages = [...SCOPE_PACKAGE_INCLUDED, ...brief.selectedPages];
  if (brief.otherPages) pages.push(brief.otherPages);
  const features = [...brief.features];
  if (brief.otherFeatures) features.push(brief.otherFeatures);
  const lines = [
    `Design and develop a professional website including ${pages.join(", ")}.`,
    "",
    "What they want:",
    brief.goal,
  ];
  if (features.length) {
    lines.push("", "Requested functionality:", features.join(", "));
  }
  if (brief.hasExistingWebsite && brief.currentWebsiteUrl) {
    lines.push("", `Current website: ${brief.currentWebsiteUrl}`);
    if (brief.currentWebsiteNotes) lines.push(brief.currentWebsiteNotes);
  }
  if (brief.designStyles.length || brief.otherStyle) {
    lines.push("", `Style: ${[...brief.designStyles, brief.otherStyle].filter(Boolean).join(", ")}`);
  }
  if (brief.likedWebsites) lines.push(`Sites they like: ${brief.likedWebsites}`);
  if (brief.additionalNotes) {
    lines.push("", "Other notes:", brief.additionalNotes);
  }
  return lines.join("\n");
}

export function proposalScopeFromBrief(brief: ClientScopeBrief): string {
  const pages = [...SCOPE_PACKAGE_INCLUDED, ...brief.selectedPages.filter((item) => item !== "Other")];
  if (brief.otherPages) pages.push(brief.otherPages);
  const features = brief.features.filter((item) => item !== "Other");
  if (brief.otherFeatures) features.push(brief.otherFeatures);
  return [...pages, ...features].join("\n");
}

export function proposalOverviewFromBrief(brief: ClientScopeBrief): string {
  return [
    "We will design and develop a professional website for this business: clear pages, a straightforward path for visitors to get in touch, and a site that works well on phones and desktops.",
    "",
    "What they asked for:",
    brief.goal,
  ].join("\n");
}

export function suggestedProjectName(businessName: string): string {
  const name = businessName.trim();
  return name ? `${name} website` : "";
}
