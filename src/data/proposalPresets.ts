export const PROPOSAL_SCOPE_INCLUDED = [
  "Homepage",
  "Responsive Website Design",
  "Mobile Optimization",
] as const;

export const PROPOSAL_SCOPE_OPTIONAL = [
  "Services Page",
  "About Page",
  "Contact Page",
  "Gallery",
  "Testimonials",
  "Quote Request Form",
  "Booking Form",
  "SEO Setup",
  "Analytics",
  "Google Maps",
  "Social Media Integration",
  "Hosting Setup",
] as const;

export const PROPOSAL_SCOPE_PRESETS = [...PROPOSAL_SCOPE_INCLUDED, ...PROPOSAL_SCOPE_OPTIONAL] as const;

const LEGACY_SCOPE_PLACEHOLDER =
  "Use the Scope buttons above to list the pages and setup included in this build, or write the scope here.";

const LEGACY_PAYMENT_TERMS =
  "A 50% deposit is due to start. The remaining 50% is due before the website goes live.\n\nInvoices are issued from MotiveScripts and can be paid through the client portal. Work pauses if an invoice stays unpaid past the due date. This proposal does not charge a card by itself.";

export function defaultIncludedScope(): string {
  return PROPOSAL_SCOPE_INCLUDED.join("\n");
}

export function isEmptyScopeDraft(text: string): boolean {
  const trimmed = text.trim();
  return !trimmed || trimmed === LEGACY_SCOPE_PLACEHOLDER;
}

export function isEmptyPaymentTermsDraft(text: string): boolean {
  const trimmed = text.trim();
  return !trimmed || trimmed === LEGACY_PAYMENT_TERMS;
}

/** Paid add-ons. Clicking the chip writes this amount to Line items. */
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
  return PROPOSAL_PAID_ADDONS_CENTS[label];
}

/** Client-facing line-item descriptions. Filled only when the description is still blank. */
export const PROPOSAL_LINE_DESCRIPTIONS: Record<string, string> = {
  Website: "Design and development of a professional website, including the included pages, responsive layout, and launch.",
  "Quote Request Form": "A form on the site so visitors can request a quote from this business.",
  Booking: "A booking form so visitors can request an appointment.",
  "Booking Form": "A booking form so visitors can request an appointment.",
  "Social Media Integration": "Connect the website to the business social profiles and show those links on the site.",
  "Business Email": "Set up professional email on the business domain.",
  Domain: "Register or connect the domain name the website will use.",
  "Hosting Setup": "Set up hosting so the finished website can go live.",
};

export function proposalLineDescription(name: string): string {
  const key = name.trim().toLowerCase();
  if (!key) return "";
  const match = Object.entries(PROPOSAL_LINE_DESCRIPTIONS).find(([label]) => label.toLowerCase() === key);
  return match?.[1] ?? "";
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
  const needle = line.trim().toLowerCase();
  if (!needle) return false;
  return text.split(/\r?\n/).some((entry) => entry.trim().toLowerCase() === needle);
}

export const PROPOSAL_DRAFT_DEFAULTS = {
  introduction:
    "Thank you for considering MotiveScripts. This proposal describes the website we recommend, what is included, and how we work together through launch.",
  overview:
    "We will design and develop a professional website for this business: clear pages, a straightforward path for visitors to get in touch, and a site that works well on phones and desktops.",
  scope: defaultIncludedScope(),
  deliverablesText:
    "Use the Features buttons above to list standard inclusions, or write the deliverables here.",
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

export function applyProposalDraftDefaults(
  fields: ProposalDraftFields,
  overrides?: Partial<ProposalDraftFields>,
): ProposalDraftFields {
  const defaults = {
    ...PROPOSAL_DRAFT_DEFAULTS,
    introduction: overrides?.introduction?.trim() || PROPOSAL_DRAFT_DEFAULTS.introduction,
    overview: overrides?.overview?.trim() || PROPOSAL_DRAFT_DEFAULTS.overview,
    scope: overrides?.scope?.trim() || PROPOSAL_DRAFT_DEFAULTS.scope,
    deliverablesText: overrides?.deliverablesText?.trim() || PROPOSAL_DRAFT_DEFAULTS.deliverablesText,
    timeline: overrides?.timeline?.trim() || PROPOSAL_DRAFT_DEFAULTS.timeline,
    paymentTerms: overrides?.paymentTerms?.trim() || PROPOSAL_DRAFT_DEFAULTS.paymentTerms,
    terms: overrides?.terms?.trim() || PROPOSAL_DRAFT_DEFAULTS.terms,
    notes: overrides?.notes?.trim() || PROPOSAL_DRAFT_DEFAULTS.notes,
  };
  return {
    introduction: fields.introduction.trim() || defaults.introduction,
    overview: fields.overview.trim() || defaults.overview,
    scope: isEmptyScopeDraft(fields.scope) ? defaults.scope : fields.scope,
    deliverablesText: fields.deliverablesText.trim() || defaults.deliverablesText,
    timeline: fields.timeline.trim() || defaults.timeline,
    paymentTerms: isEmptyPaymentTermsDraft(fields.paymentTerms) ? defaults.paymentTerms : fields.paymentTerms,
    terms: fields.terms.trim() || defaults.terms,
    notes: fields.notes.trim() || defaults.notes,
  };
}

export function togglePresetLine(text: string, line: string): string {
  const label = line.trim();
  if (!label) return text;
  if (hasPresetLine(text, label)) {
    return text
      .split(/\r?\n/)
      .filter((entry) => entry.trim().toLowerCase() !== label.toLowerCase())
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }
  const trimmed = text.replace(/\s+$/, "");
  return trimmed ? `${trimmed}\n${label}` : label;
}
