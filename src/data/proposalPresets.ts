import {
  SCOPE_FEATURE_OPTIONS,
  SCOPE_PACKAGE_INCLUDED,
  SCOPE_PAGE_OPTIONS,
} from "@/data/scopeBriefs";

export const PROPOSAL_SCOPE_INCLUDED = [
  "Homepage",
  "Responsive Website Design",
  "Mobile Optimization",
] as const;

export const PROPOSAL_SCOPE_OPTIONAL = [
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
] as const;

export const PROPOSAL_SCOPE_PRESETS = [...PROPOSAL_SCOPE_INCLUDED, ...PROPOSAL_SCOPE_OPTIONAL] as const;

export const PROPOSAL_PAGE_PRESETS = [
  ...SCOPE_PACKAGE_INCLUDED,
  ...SCOPE_PAGE_OPTIONS.filter((item) => item !== "Other"),
] as const;

export const PROPOSAL_FUNCTIONALITY_PRESETS = SCOPE_FEATURE_OPTIONS.filter((item) => item !== "Other");

export const PROPOSAL_ADDITIONAL_UNPAID = [
  "SEO Setup",
  "Analytics",
  "Performance Optimization",
  "Security Setup",
] as const;

export const PROPOSAL_ADDITIONAL_PAID = ["Hosting Setup", "Booking Form", "Business Email", "Domain"] as const;

const LEGACY_SCOPE_PLACEHOLDER =
  "Use the Scope buttons above to list the pages and setup included in this build, or write the scope here.";

const LEGACY_DELIVERABLES_PLACEHOLDER =
  "Use the Features buttons above to list standard inclusions, or write the deliverables here.";

const LEGACY_PAYMENT_TERMS =
  "A 50% deposit is due to start. The remaining 50% is due before the website goes live.\n\nInvoices are issued from MotiveScripts and can be paid through the client portal. Work pauses if an invoice stays unpaid past the due date. This proposal does not charge a card by itself.";

const SCOPE_LABEL_ALIASES: Record<string, string[]> = {
  About: ["About Page", "About page"],
  Services: ["Services Page", "Services page"],
  Contact: ["Contact Page", "Contact page"],
  "Gallery / Portfolio": ["Gallery"],
  "Booking / Appointment Form": ["Booking Form", "Booking"],
  "Responsive Website Design": ["Responsive Design"],
  "SEO Setup": ["Basic SEO"],
};

const DELIVERABLE_LABELS: Record<string, string> = {
  homepage: "Homepage",
  "responsive website design": "Responsive website design",
  "responsive design": "Responsive website design",
  "mobile optimization": "Mobile-optimized website",
  about: "About page",
  "about page": "About page",
  services: "Services page",
  "services page": "Services page",
  contact: "Contact page",
  "contact page": "Contact page",
  "gallery / portfolio": "Gallery / Portfolio",
  gallery: "Gallery / Portfolio",
  testimonials: "Testimonials",
  faq: "FAQ page",
  pricing: "Pricing page",
  team: "Team page",
  locations: "Locations page",
  "blog / news": "Blog / News",
  "contact form": "Contact form",
  "quote request form": "Quote request form",
  "booking / appointment form": "Booking / appointment form",
  "booking form": "Booking / appointment form",
  booking: "Booking / appointment form",
  "online payments": "Online payments",
  "e-commerce / online store": "E-commerce / online store",
  "customer login": "Customer login",
  "google maps": "Google Maps integration",
  "social media integration": "Social media integration",
  "newsletter signup": "Newsletter signup",
  "live chat": "Live chat",
  "seo setup": "SEO setup",
  "basic seo": "SEO setup",
  analytics: "Analytics",
  "hosting setup": "Hosting setup",
  "business email": "Business email",
  domain: "Domain",
  "performance optimization": "Performance optimization",
  "security setup": "Security setup",
};

export function defaultIncludedScope(): string {
  return PROPOSAL_SCOPE_INCLUDED.join("\n");
}

export function isEmptyScopeDraft(text: string): boolean {
  const trimmed = text.trim();
  return !trimmed || trimmed === LEGACY_SCOPE_PLACEHOLDER;
}

export function isEmptyDeliverablesDraft(text: string): boolean {
  const trimmed = text.trim();
  return !trimmed || trimmed === LEGACY_DELIVERABLES_PLACEHOLDER;
}

export function isEmptyPaymentTermsDraft(text: string): boolean {
  const trimmed = text.trim();
  return !trimmed || trimmed === LEGACY_PAYMENT_TERMS;
}

export function canonicalScopeLabel(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) return "";
  const lower = trimmed.toLowerCase();
  for (const [canonical, aliases] of Object.entries(SCOPE_LABEL_ALIASES)) {
    if (canonical.toLowerCase() === lower) return canonical;
    if (aliases.some((alias) => alias.toLowerCase() === lower)) return canonical;
  }
  return trimmed;
}

export function scopeLineVariants(label: string): string[] {
  const canonical = canonicalScopeLabel(label);
  const aliases = SCOPE_LABEL_ALIASES[canonical] ?? [];
  const unique = new Set([canonical, ...aliases, label.trim()].filter(Boolean));
  return [...unique];
}

/** Paid add-ons. Selecting them under Additional Services writes this amount to Line items. */
export const PROPOSAL_PAID_ADDONS_CENTS: Record<string, number> = {
  "Quote Request Form": 15_000,
  Booking: 25_000,
  "Booking Form": 25_000,
  "Social Media Integration": 10_000,
  "Business Email": 10_000,
  Domain: 2_500,
  "Hosting Setup": 15_000,
};

export function paidAddonCents(label: string): number | undefined {
  const canonical = canonicalScopeLabel(label);
  return (
    PROPOSAL_PAID_ADDONS_CENTS[label] ??
    PROPOSAL_PAID_ADDONS_CENTS[canonical] ??
    scopeLineVariants(label).map((variant) => PROPOSAL_PAID_ADDONS_CENTS[variant]).find((cents) => cents != null)
  );
}

/** Client-facing line-item descriptions. Filled only when the description is still blank. */
export const PROPOSAL_LINE_DESCRIPTIONS: Record<string, string> = {
  Website: "Complete website design and development based on the approved scope.",
  "Website Design & Development": "Complete website design and development based on the approved scope.",
  "Quote Request Form": "A form on the site so visitors can request a quote from this business.",
  Booking: "A booking form so visitors can request an appointment.",
  "Booking Form": "A booking form so visitors can request an appointment.",
  "Social Media Integration": "Connect the website to the business social profiles and show those links on the site.",
  "Business Email": "Set up professional email on the business domain.",
  Domain: "Register or connect the domain name the website will use.",
  "Hosting Setup": "Set up hosting so the finished website can go live.",
  "SEO Setup": "Search engine setup so the new website can be found and tracked.",
  Analytics: "Install analytics so the business can see how visitors use the site.",
};

export function proposalLineDescription(name: string): string {
  const key = name.trim().toLowerCase();
  if (!key) return "";
  const match = Object.entries(PROPOSAL_LINE_DESCRIPTIONS).find(([label]) => label.toLowerCase() === key);
  return match?.[1] ?? "";
}

export function displayLineItemName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.toLowerCase() === "website") return "Website Design & Development";
  return trimmed;
}

export function isBaseWebsiteLine(name: string): boolean {
  const key = name.trim().toLowerCase();
  return key === "website" || key === "website design & development";
}

export const PROPOSAL_FEATURE_PRESETS = [
  "Responsive Design",
  "Contact Form",
  "Business Email",
  "Domain",
  "Quote Request Form",
  "Booking",
  "Gallery",
  "Testimonials",
  "Google Maps",
  "Social Media Integration",
  "Analytics",
  "Basic SEO",
  "Performance Optimization",
  "Security Setup",
  "Hosting Setup",
] as const;

export function hasPresetLine(text: string, line: string): boolean {
  const variants = new Set(scopeLineVariants(line).map((entry) => entry.toLowerCase()));
  if (variants.size === 0) return false;
  return text.split(/\r?\n/).some((entry) => variants.has(entry.trim().toLowerCase()));
}

export function newlineList(text: string): string[] {
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push(line);
  }
  return lines;
}

export function deliverableLabelForScopeItem(item: string): string {
  const canonical = canonicalScopeLabel(item);
  return (
    DELIVERABLE_LABELS[canonical.toLowerCase()] ??
    DELIVERABLE_LABELS[item.trim().toLowerCase()] ??
    item.trim()
  );
}

export function deliverablesFromScope(scope: string): string {
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const item of newlineList(scope)) {
    if (item.toLowerCase() === "other") continue;
    const label = deliverableLabelForScopeItem(item);
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push(label);
  }
  return lines.join("\n");
}

const PAGE_KEYS = new Set(
  [...PROPOSAL_PAGE_PRESETS, "About Page", "Services Page", "Contact Page", "Gallery", "Responsive Design"].map(
    (item) => canonicalScopeLabel(item).toLowerCase(),
  ),
);

const FEATURE_KEYS = new Set(
  [
    ...PROPOSAL_FUNCTIONALITY_PRESETS,
    ...PROPOSAL_ADDITIONAL_UNPAID,
    "Booking Form",
    "Booking",
    "Basic SEO",
  ].map((item) => canonicalScopeLabel(item).toLowerCase()),
);

export function partitionScopeLines(scope: string): { pages: string[]; features: string[]; other: string[] } {
  const pages: string[] = [];
  const features: string[] = [];
  const other: string[] = [];
  const seen = new Set<string>();
  for (const raw of newlineList(scope)) {
    const canonical = canonicalScopeLabel(raw);
    const key = canonical.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    if (PAGE_KEYS.has(key)) pages.push(canonical);
    else if (FEATURE_KEYS.has(key)) features.push(canonical);
    else other.push(raw.trim());
  }
  return { pages, features, other };
}

export function extraScopeLines(scope: string): string[] {
  return partitionScopeLines(scope).other;
}

export const PROPOSAL_DRAFT_DEFAULTS = {
  introduction:
    "Thank you for considering MotiveScripts. This proposal describes the website we recommend, what is included, and how we work together through launch.",
  overview:
    "We will design and develop a professional website for this business: clear pages, a straightforward path for visitors to get in touch, and a site that works well on phones and desktops.",
  scope: defaultIncludedScope(),
  deliverablesText: deliverablesFromScope(defaultIncludedScope()),
  timeline:
    "Typical timeline after we receive content and a kickoff confirmation:\n\nWeek 1 — Discovery and sitemap\nWeeks 2–3 — Design direction\nWeeks 4–5 — Build and review\nWeek 6 — Revisions, launch checklist, and go-live\n\nDates shift if content or feedback is delayed.",
  paymentTerms:
    "A 50% deposit is due to start. The remaining 50% is due before the website goes live.\n\nAfter the deposit is paid and work has started, the client has 5 business days to change their mind and receive a refund of that deposit. After those 5 business days, the deposit cannot be refunded.\n\nInvoices are issued from MotiveScripts and can be paid through the client portal. Work pauses if an invoice stays unpaid past the due date. This proposal does not charge a card by itself.",
  terms:
    "This proposal is an offer from MotiveScripts for the scope and investment shown. It is valid until the date on this document.\n\nAccepting this proposal in the client portal confirms agreement to this scope, investment, and these terms. It is not a qualified digital signature and is not a substitute for legal advice.\n\nThe price covers the listed scope. New pages, features, or rounds of revision beyond what is written here may need an updated proposal.\n\nThe client provides logos, photos, and written content needed to complete the work. MotiveScripts provides the design and development described here.\n\nAfter full payment, the client owns the final approved website work created uniquely for them. MotiveScripts tools, frameworks, and prior materials stay with MotiveScripts.\n\nEither party may pause or end the work with written notice if the other party does not meet its responsibilities after a reasonable chance to fix the issue.",
  notes: "Questions before you accept? Reply in the client portal or email us and we will adjust this draft.",
} as const;

export type ProposalDraftFields = {
  introduction: string;
  overview: string;
  scope: string;
  deliverablesText: string;
  timeline: string;
  paymentTerms: string;
  terms: string;
  notes: string;
};

function resolveDeliverables(current: string, scope: string, fallback: string): string {
  if (!isEmptyDeliverablesDraft(current)) return current;
  const fromScope = deliverablesFromScope(scope);
  if (fromScope) return fromScope;
  if (!isEmptyDeliverablesDraft(fallback)) return fallback;
  return deliverablesFromScope(defaultIncludedScope());
}

export function applyProposalDraftDefaults(
  fields: ProposalDraftFields,
  overrides?: Partial<ProposalDraftFields>,
): ProposalDraftFields {
  const defaults = {
    ...PROPOSAL_DRAFT_DEFAULTS,
    introduction: overrides?.introduction?.trim() || PROPOSAL_DRAFT_DEFAULTS.introduction,
    overview: overrides?.overview?.trim() || PROPOSAL_DRAFT_DEFAULTS.overview,
    scope: isEmptyScopeDraft(overrides?.scope ?? "")
      ? PROPOSAL_DRAFT_DEFAULTS.scope
      : (overrides?.scope?.trim() || PROPOSAL_DRAFT_DEFAULTS.scope),
    deliverablesText: isEmptyDeliverablesDraft(overrides?.deliverablesText ?? "")
      ? PROPOSAL_DRAFT_DEFAULTS.deliverablesText
      : (overrides?.deliverablesText?.trim() || PROPOSAL_DRAFT_DEFAULTS.deliverablesText),
    timeline: overrides?.timeline?.trim() || PROPOSAL_DRAFT_DEFAULTS.timeline,
    paymentTerms: isEmptyPaymentTermsDraft(overrides?.paymentTerms ?? "")
      ? PROPOSAL_DRAFT_DEFAULTS.paymentTerms
      : (overrides?.paymentTerms?.trim() || PROPOSAL_DRAFT_DEFAULTS.paymentTerms),
    terms: overrides?.terms?.trim() || PROPOSAL_DRAFT_DEFAULTS.terms,
    notes: overrides?.notes?.trim() || PROPOSAL_DRAFT_DEFAULTS.notes,
  };
  const scope = isEmptyScopeDraft(fields.scope) ? defaults.scope : fields.scope;
  return {
    introduction: fields.introduction.trim() || defaults.introduction,
    overview: fields.overview.trim() || defaults.overview,
    scope,
    deliverablesText: resolveDeliverables(fields.deliverablesText, scope, defaults.deliverablesText),
    timeline: fields.timeline.trim() || defaults.timeline,
    paymentTerms: isEmptyPaymentTermsDraft(fields.paymentTerms) ? defaults.paymentTerms : fields.paymentTerms,
    terms: fields.terms.trim() || defaults.terms,
    notes: fields.notes.trim() || defaults.notes,
  };
}

export function togglePresetLine(text: string, line: string): string {
  const label = canonicalScopeLabel(line);
  if (!label) return text;
  const variants = new Set(scopeLineVariants(line).map((entry) => entry.toLowerCase()));
  if (hasPresetLine(text, line)) {
    return text
      .split(/\r?\n/)
      .filter((entry) => !variants.has(entry.trim().toLowerCase()))
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }
  const trimmed = text.replace(/\s+$/, "");
  return trimmed ? `${trimmed}\n${label}` : label;
}

export function suggestedProposalTitle(projectName?: string, businessName?: string): string {
  const fromProject = (projectName ?? "").trim().replace(/\bwebsite\b/i, "Website");
  if (fromProject) return fromProject;
  const business = (businessName ?? "").trim();
  return business ? `${business} Website` : "Website proposal";
}
