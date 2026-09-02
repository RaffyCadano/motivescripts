import type { AgencyClient } from "@/data/agencyClients";
import type { ClientScopeBrief } from "@/data/scopeBriefs";
import { SCOPE_FEATURE_OPTIONS, SCOPE_PAGE_OPTIONS } from "@/data/scopeBriefs";

export const DISCOVERY_STATUSES = [
  "not_started",
  "awaiting_client",
  "submitted",
  "under_review",
  "more_information_needed",
  "complete",
] as const;

export type DiscoveryStatus = (typeof DISCOVERY_STATUSES)[number];

export const DISCOVERY_SECTIONS = [
  "business",
  "goals",
  "pages",
  "content",
  "branding",
  "features",
  "domain",
  "review",
] as const;

export type DiscoverySectionId = (typeof DISCOVERY_SECTIONS)[number];

export const DISCOVERY_MAIN_GOAL_OPTIONS = [
  "Generate leads",
  "Get quote requests",
  "Get phone calls",
  "Get bookings",
  "Showcase services",
  "Provide business information",
  "Sell products",
  "Other",
] as const;

export const DISCOVERY_VISITOR_ACTION_OPTIONS = [
  "Call the business",
  "Request a quote",
  "Book an appointment",
  "Browse services",
  "View portfolio or gallery",
  "Read about the business",
  "Contact via form",
  "Visit a physical location",
  "Purchase online",
  "Other",
] as const;

export const DISCOVERY_WEBSITE_FEEL_OPTIONS = [
  "Professional",
  "Modern",
  "Friendly",
  "Bold",
  "Elegant",
  "Minimal",
  "Luxury",
  "Industrial",
] as const;

export const DISCOVERY_FILE_CATEGORIES = [
  "logo",
  "brand_guidelines",
  "photo",
  "video",
  "document",
  "marketing",
  "other",
] as const;

export type DiscoveryFileCategory = (typeof DISCOVERY_FILE_CATEGORIES)[number];

export const DISCOVERY_FOLLOW_UP_ITEMS = [
  "Logo",
  "Project photos",
  "Service descriptions",
  "Brand guidelines",
  "Domain information",
  "Content copy",
  "Other",
] as const;

export type DiscoverySectionReviewState = "pending" | "ok" | "attention";

export type DiscoveryServiceEntry = {
  id: string;
  name: string;
  shortDescription: string;
  detailedDescription: string;
  pricing: string;
  provideLater: boolean;
};

export type DiscoveryScopeFlag = {
  id: string;
  kind: "page" | "feature";
  label: string;
  createdAt: string;
};

export type DiscoveryFollowUp = {
  missingItems: string[];
  message: string;
  requestedAt: string;
};

export type DiscoveryFormData = {
  business: {
    businessName: string;
    contactName: string;
    email: string;
    phone: string;
    address: string;
    businessHours: string;
  };
  goals: {
    mainGoals: string[];
    mainGoalOther: string;
    visitorActions: string[];
    visitorActionOther: string;
  };
  pages: {
    clarification: string;
    additionalPages: string[];
  };
  services: DiscoveryServiceEntry[];
  branding: {
    brandColors: string;
    brandFonts: string;
    brandGuidelinesNotes: string;
    designStyles: string[];
    likedWebsites: string;
    dislikedWebsites: string;
    websiteFeel: string;
  };
  features: {
    clarification: string;
    requestedFeatures: string[];
    requestedFeatureOther: string;
  };
  domain: {
    ownsDomain: boolean | null;
    domainName: string;
    existingWebsiteUrl: string;
    hostingProvider: string;
    platform: string;
  };
  finalNotes: string;
};

export type DiscoverySectionReview = Partial<Record<DiscoverySectionId, DiscoverySectionReviewState>>;

export type DiscoveryIntake = {
  id: string;
  projectId: string;
  clientId: string;
  status: DiscoveryStatus;
  formData: DiscoveryFormData;
  sectionReview: DiscoverySectionReview;
  scopeFlags: DiscoveryScopeFlag[];
  followUp: DiscoveryFollowUp | null;
  internalNotes: string;
  sentAt: string | null;
  submittedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
};

export type DiscoveryIntakeFile = {
  id: string;
  intakeId: string;
  projectId: string;
  clientId: string;
  category: DiscoveryFileCategory;
  fileName: string;
  fileType: string;
  fileSize: number;
  storagePath: string;
  createdAt: string;
};

export function emptyDiscoveryFormData(): DiscoveryFormData {
  return {
    business: {
      businessName: "",
      contactName: "",
      email: "",
      phone: "",
      address: "",
      businessHours: "",
    },
    goals: {
      mainGoals: [],
      mainGoalOther: "",
      visitorActions: [],
      visitorActionOther: "",
    },
    pages: {
      clarification: "",
      additionalPages: [],
    },
    services: [],
    branding: {
      brandColors: "",
      brandFonts: "",
      brandGuidelinesNotes: "",
      designStyles: [],
      likedWebsites: "",
      dislikedWebsites: "",
      websiteFeel: "",
    },
    features: {
      clarification: "",
      requestedFeatures: [],
      requestedFeatureOther: "",
    },
    domain: {
      ownsDomain: null,
      domainName: "",
      existingWebsiteUrl: "",
      hostingProvider: "",
      platform: "",
    },
    finalNotes: "",
  };
}

export function discoveryFormFromClient(client: AgencyClient): DiscoveryFormData {
  const base = emptyDiscoveryFormData();
  base.business.businessName = client.businessName;
  base.business.contactName = client.contactName;
  base.business.email = client.email;
  base.business.phone = client.phone;
  base.business.address = client.location;
  return base;
}

export function mergeDiscoveryFormData(stored: Partial<DiscoveryFormData> | null | undefined): DiscoveryFormData {
  const empty = emptyDiscoveryFormData();
  if (!stored || typeof stored !== "object") return empty;
  return {
    business: { ...empty.business, ...(stored.business ?? {}) },
    goals: { ...empty.goals, ...(stored.goals ?? {}) },
    pages: { ...empty.pages, ...(stored.pages ?? {}) },
    services: Array.isArray(stored.services) ? stored.services : [],
    branding: { ...empty.branding, ...(stored.branding ?? {}) },
    features: { ...empty.features, ...(stored.features ?? {}) },
    domain: { ...empty.domain, ...(stored.domain ?? {}) },
    finalNotes: typeof stored.finalNotes === "string" ? stored.finalNotes : "",
  };
}

export function discoveryStatusLabel(status: DiscoveryStatus): string {
  switch (status) {
    case "not_started":
      return "Not Started";
    case "awaiting_client":
      return "Awaiting Client";
    case "submitted":
      return "Ready for Review";
    case "under_review":
      return "Under Review";
    case "more_information_needed":
      return "Follow-Up Required";
    case "complete":
      return "Complete";
    default:
      return status;
  }
}

/** Sections included in the client discovery questionnaire (PM preview / send flow). */
export const DISCOVERY_QUESTIONNAIRE_SECTIONS = [
  { id: "business", label: "Business & contact", detail: "Business name, contact details, hours, service area" },
  { id: "goals", label: "Website goals", detail: "Goals, visitor actions, reference websites" },
  { id: "pages", label: "Pages & sitemap", detail: "Approved scope pages, clarifications, additional page requests" },
  { id: "content", label: "Services & content", detail: "Service descriptions and uploaded assets" },
  { id: "branding", label: "Branding & design", detail: "Colors, fonts, design preferences, logos" },
  { id: "features", label: "Features & requirements", detail: "Scope features, forms, integrations, extras" },
  { id: "domain", label: "Domain & hosting", detail: "Domain ownership, existing website, hosting" },
  { id: "review", label: "Review & submit", detail: "Final notes before submission" },
] as const;

const DISCOVERY_COORDINATION_TASK_TITLES = new Set([
  "review approved scope",
  "confirm sitemap and requirements",
  "collect/confirm client content and assets",
]);

export function isDiscoveryCoordinationTask(title: string): boolean {
  return DISCOVERY_COORDINATION_TASK_TITLES.has(title.trim().toLowerCase());
}

export type DiscoveryAttentionItem = {
  id: string;
  projectId: string;
  projectName: string;
  clientName: string;
  status: DiscoveryStatus;
  label: string;
  href: string;
  sort: number;
  waitingSince: string | null;
  actionLabel: string;
};

export function buildDiscoveryAttentionItems(input: {
  intakes: DiscoveryIntake[];
  projects: Array<{ id: string; name: string; clientId: string; archived?: boolean }>;
  clientsById: Map<string, { businessName: string }>;
}): DiscoveryAttentionItem[] {
  const items: DiscoveryAttentionItem[] = [];
  for (const intake of input.intakes) {
    if (intake.status === "not_started" || intake.status === "complete") continue;
    const project = input.projects.find((row) => row.id === intake.projectId);
    if (!project || project.archived) continue;
    const clientName = input.clientsById.get(project.clientId)?.businessName ?? "Client";
    const sort =
      intake.status === "submitted"
        ? 0
        : intake.status === "more_information_needed"
          ? 1
          : intake.status === "under_review"
            ? 2
            : intake.status === "awaiting_client"
              ? 3
              : 4;
    const waitingSince =
      intake.status === "awaiting_client"
        ? intake.sentAt
        : intake.status === "submitted" || intake.status === "under_review"
          ? intake.submittedAt
          : intake.updatedAt;
    items.push({
      id: intake.id,
      projectId: intake.projectId,
      projectName: project.name,
      clientName,
      status: intake.status,
      label: discoveryStatusLabel(intake.status),
      href: `/admin/projects/${intake.projectId}?tab=overview#project-discovery`,
      sort,
      waitingSince,
      actionLabel: intake.status === "submitted" ? "Review Discovery" : "Open Discovery",
    });
  }
  return items.sort((a, b) => a.sort - b.sort || a.projectName.localeCompare(b.projectName));
}

/**
 * Full 6-status Discovery board for a scoped project set (e.g. a PM's assigned projects).
 * Unlike `buildDiscoveryAttentionItems`, this includes `not_started` and `complete` so a
 * PM can see and act on every stage, not just the ones needing attention.
 */
export function buildDiscoveryStatusBoard(input: {
  intakes: DiscoveryIntake[];
  projects: Array<{ id: string; name: string; clientId: string; archived?: boolean }>;
  clientsById: Map<string, { businessName: string }>;
  projectIds: Set<string>;
}): DiscoveryAttentionItem[] {
  const items: DiscoveryAttentionItem[] = [];
  const statusOrder: Record<DiscoveryStatus, number> = {
    submitted: 0,
    more_information_needed: 1,
    under_review: 2,
    awaiting_client: 3,
    not_started: 4,
    complete: 5,
  };
  const actionLabels: Record<DiscoveryStatus, string> = {
    not_started: "Send Discovery",
    awaiting_client: "Open Discovery",
    submitted: "Review Discovery",
    under_review: "Continue Review",
    more_information_needed: "Open Discovery",
    complete: "View Discovery",
  };

  for (const intake of input.intakes) {
    if (!input.projectIds.has(intake.projectId)) continue;
    const project = input.projects.find((row) => row.id === intake.projectId);
    if (!project || project.archived) continue;
    const clientName = input.clientsById.get(project.clientId)?.businessName ?? "Client";
    const waitingSince =
      intake.status === "awaiting_client"
        ? intake.sentAt
        : intake.status === "submitted" || intake.status === "under_review"
          ? intake.submittedAt
          : intake.status === "complete"
            ? intake.completedAt
            : intake.updatedAt;
    items.push({
      id: intake.id,
      projectId: intake.projectId,
      projectName: project.name,
      clientName,
      status: intake.status,
      label: discoveryStatusLabel(intake.status),
      href: `/admin/projects/${intake.projectId}?tab=overview#project-discovery`,
      sort: statusOrder[intake.status],
      waitingSince,
      actionLabel: actionLabels[intake.status],
    });
  }
  return items.sort((a, b) => a.sort - b.sort || a.projectName.localeCompare(b.projectName));
}

export function discoveryClientStatusLabel(status: DiscoveryStatus): string {
  switch (status) {
    case "not_started":
      return "Not available yet";
    case "awaiting_client":
      return "Action Required";
    case "submitted":
      return "Under Review";
    case "under_review":
      return "Under Review";
    case "more_information_needed":
      return "More Information Needed";
    case "complete":
      return "Complete";
    default:
      return status;
  }
}

export function scopePagesForDiscovery(brief: ClientScopeBrief | null): string[] {
  if (!brief) return ["Home"];
  const pages = brief.selectedPages.filter((item) => item !== "Other");
  if (brief.otherPages.trim()) pages.push(brief.otherPages.trim());
  return ["Home", ...pages];
}

export function scopeFeaturesForDiscovery(brief: ClientScopeBrief | null): string[] {
  if (!brief) return [];
  const features = brief.features.filter((item) => item !== "Other");
  if (brief.otherFeatures.trim()) features.push(brief.otherFeatures.trim());
  return features;
}

export function isScopeFeature(feature: string, brief: ClientScopeBrief | null): boolean {
  const approved = new Set(scopeFeaturesForDiscovery(brief).map((item) => item.toLowerCase()));
  return approved.has(feature.trim().toLowerCase());
}

export function computeScopeFlags(
  form: DiscoveryFormData,
  brief: ClientScopeBrief | null,
  existing: DiscoveryScopeFlag[] = [],
): DiscoveryScopeFlag[] {
  const approvedPages = new Set(scopePagesForDiscovery(brief).map((item) => item.toLowerCase()));
  const flags: DiscoveryScopeFlag[] = [...existing];
  const seen = new Set(flags.map((item) => `${item.kind}:${item.label.toLowerCase()}`));

  for (const page of form.pages.additionalPages) {
    const label = page.trim();
    if (!label) continue;
    if (approvedPages.has(label.toLowerCase())) continue;
    const key = `page:${label.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    flags.push({
      id: crypto.randomUUID(),
      kind: "page",
      label,
      createdAt: new Date().toISOString(),
    });
  }

  for (const feature of form.features.requestedFeatures) {
    const label = feature.trim();
    if (!label) continue;
    if (isScopeFeature(label, brief)) continue;
    const key = `feature:${label.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    flags.push({
      id: crypto.randomUUID(),
      kind: "feature",
      label,
      createdAt: new Date().toISOString(),
    });
  }

  if (form.features.requestedFeatureOther.trim() && !isScopeFeature(form.features.requestedFeatureOther, brief)) {
    const label = form.features.requestedFeatureOther.trim();
    const key = `feature:${label.toLowerCase()}`;
    if (!seen.has(key)) {
      flags.push({
        id: crypto.randomUUID(),
        kind: "feature",
        label,
        createdAt: new Date().toISOString(),
      });
    }
  }

  return flags;
}

export function discoverySectionProgress(form: DiscoveryFormData): number {
  let done = 0;
  const businessDone =
    form.business.businessName.trim() ||
    form.business.contactName.trim() ||
    form.business.email.trim() ||
    form.business.phone.trim();
  if (businessDone) done += 1;
  if (form.goals.mainGoals.length > 0 || form.goals.visitorActions.length > 0) done += 1;
  if (form.pages.clarification.trim() || form.pages.additionalPages.length > 0) done += 1;
  if (form.services.length > 0 || form.branding.brandGuidelinesNotes.trim()) done += 1;
  if (
    form.branding.designStyles.length > 0 ||
    form.branding.likedWebsites.trim() ||
    form.branding.websiteFeel.trim()
  )
    done += 1;
  if (form.features.clarification.trim() || form.features.requestedFeatures.length > 0) done += 1;
  if (form.domain.ownsDomain !== null || form.domain.existingWebsiteUrl.trim()) done += 1;
  done += 1;
  return Math.round((done / DISCOVERY_SECTIONS.length) * 100);
}

export function validateDiscoverySubmit(form: DiscoveryFormData): string | null {
  if (!form.business.businessName.trim()) return "Business name is required.";
  if (!form.business.contactName.trim()) return "Primary contact is required.";
  if (!form.business.email.trim()) return "Business email is required.";
  if (form.goals.mainGoals.length === 0) return "Select at least one website goal.";
  if (form.goals.visitorActions.length === 0) return "Select what visitors should do on the website.";
  return null;
}

export function validateDiscoveryDraftSave(): string | null {
  return null;
}

export function discoveryChecklistItems(
  intake: DiscoveryIntake,
  brief: ClientScopeBrief | null,
  files: DiscoveryIntakeFile[],
): Array<{ id: string; label: string; state: "ok" | "attention" | "pending" }> {
  const form = intake.formData;
  const hasAssets = files.length > 0;

  return [
    {
      id: "scope",
      label: "Approved scope reviewed",
      state: brief ? "ok" : "pending",
    },
    {
      id: "sitemap",
      label: "Sitemap confirmed",
      state:
        form.pages.clarification.trim() || scopePagesForDiscovery(brief).length > 1
          ? intake.sectionReview.pages === "attention"
            ? "attention"
            : "ok"
          : "attention",
    },
    {
      id: "assets",
      label: "Client content & assets",
      state: hasAssets ? (intake.sectionReview.content === "attention" ? "attention" : "ok") : "attention",
    },
    {
      id: "design",
      label: "Design direction confirmed",
      state:
        form.branding.designStyles.length > 0 || form.branding.likedWebsites.trim()
          ? intake.sectionReview.branding === "attention"
            ? "attention"
            : "ok"
          : "pending",
    },
    {
      id: "domain",
      label: "Domain information",
      state:
        form.domain.ownsDomain !== null || form.domain.existingWebsiteUrl.trim()
          ? intake.sectionReview.domain === "attention"
            ? "attention"
            : "ok"
          : "pending",
    },
  ];
}

export function discoverySectionSummary(
  section: DiscoverySectionId,
  intake: DiscoveryIntake,
  files: DiscoveryIntakeFile[],
): DiscoverySectionReviewState {
  const review = intake.sectionReview[section];
  if (review) return review;

  const form = intake.formData;
  switch (section) {
    case "business":
      return form.business.businessName.trim() && form.business.email.trim() ? "ok" : "attention";
    case "goals":
      return form.goals.mainGoals.length > 0 ? "ok" : "attention";
    case "pages":
      return form.pages.clarification.trim() ? "ok" : "pending";
    case "content":
      return files.length > 0 || form.services.some((item) => item.name.trim()) ? "ok" : "attention";
    case "branding":
      return form.branding.designStyles.length > 0 || form.branding.likedWebsites.trim() ? "ok" : "pending";
    case "features":
      return form.features.clarification.trim() ? "ok" : "pending";
    case "domain":
      return form.domain.ownsDomain !== null ? "ok" : "pending";
    case "review":
      return intake.submittedAt ? "ok" : "pending";
    default:
      return "pending";
  }
}

export const DISCOVERY_SCOPE_FEATURE_OPTIONS = SCOPE_FEATURE_OPTIONS.filter((item) => item !== "Other");

export const DISCOVERY_EXTRA_FEATURE_OPTIONS = [
  "Online booking",
  "Blog",
  "Client portal",
  "Membership area",
  "Multilingual",
] as const;

export function allDiscoveryFeatureOptions(brief: ClientScopeBrief | null): string[] {
  const scope = scopeFeaturesForDiscovery(brief);
  const extras = DISCOVERY_EXTRA_FEATURE_OPTIONS.filter(
    (item) => !scope.some((f) => f.toLowerCase() === item.toLowerCase()),
  );
  return [...scope, ...extras];
}

export const DISCOVERY_PAGE_OPTIONS = SCOPE_PAGE_OPTIONS.filter((item) => item !== "Other");
