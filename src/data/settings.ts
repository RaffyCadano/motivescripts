import { DEFAULT_PROPOSAL_LINE_PRICE_CENTS } from "@/data/documents";
import type { ProposalDraftFields } from "@/data/proposalPresets";

export const SETTINGS_CURRENCIES = ["USD", "CAD", "GBP", "EUR", "AUD"] as const;

export const SETTINGS_TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "Europe/London",
  "Europe/Paris",
  "Asia/Manila",
  "Asia/Singapore",
  "Australia/Sydney",
] as const;

export type SettingsSectionId =
  | "agency"
  | "branding"
  | "documents"
  | "portal"
  | "notifications"
  | "email"
  | "invoices"
  | "payments"
  | "profile"
  | "security"
  | "danger";

export type SettingsNavGroup = {
  label: string;
  hint: string;
  items: { id: SettingsSectionId; label: string }[];
};

export const settingsNavGroups: SettingsNavGroup[] = [
  {
    label: "Agency",
    hint: "Name, contact details, and branding",
    items: [
      { id: "agency", label: "Agency Profile" },
      { id: "branding", label: "Branding" },
    ],
  },
  {
    label: "Workspace",
    hint: "Documents, portal, and notifications",
    items: [
      { id: "documents", label: "Document Defaults" },
      { id: "portal", label: "Client Portal" },
      { id: "notifications", label: "Notifications" },
    ],
  },
  {
    label: "Communication",
    hint: "Outgoing agency email",
    items: [{ id: "email", label: "Email" }],
  },
  {
    label: "Billing",
    hint: "Invoice defaults and payments",
    items: [
      { id: "invoices", label: "Invoice Defaults" },
      { id: "payments", label: "Payment Settings" },
    ],
  },
  {
    label: "Account",
    hint: "Your personal account",
    items: [
      { id: "profile", label: "My Profile" },
      { id: "security", label: "Security" },
    ],
  },
  {
    label: "Danger Zone",
    hint: "Export or permanently delete records",
    items: [{ id: "danger", label: "Danger Zone" }],
  },
];

export const settingsSections = settingsNavGroups.flatMap((group) => group.items);

export type AgencySettings = {
  agencyName: string;
  businessEmail: string;
  phone: string;
  website: string;
  address: string;
  timezone: string;
  currency: string;
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  supportEmail: string;
  emailFromName: string;
  emailFromAddress: string;
  emailReplyTo: string;
  defaultProposalValidDays: number;
  defaultProposalIntroduction: string;
  defaultProposalOverview: string;
  defaultProposalScope: string;
  defaultProposalDeliverables: string;
  defaultProposalTimeline: string;
  defaultProposalPaymentTerms: string;
  defaultProposalTerms: string;
  defaultProposalNotes: string;
  defaultContractTerms: string;
  defaultInvoiceDueDays: number;
  defaultInvoicePaymentTerms: string;
  defaultInvoiceNotes: string;
  clientPortalWelcomeMessage: string;
  defaultProposalWebsiteCents: number;
  defaultAddonQuoteRequestFormCents: number;
  defaultAddonBookingFormCents: number;
  defaultAddonSocialMediaCents: number;
  defaultAddonBusinessEmailCents: number;
  defaultAddonDomainCents: number;
  defaultAddonHostingSetupCents: number;
  updatedAt: string;
  updatedBy: string | null;
};

export type AgencySettingsPatch = Omit<AgencySettings, "logoUrl" | "updatedAt" | "updatedBy">;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const COLOR_RE = /^#[0-9A-Fa-f]{6}$/;

export function isPlausibleWebsite(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return true;
  try {
    const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    return Boolean(url.hostname && url.hostname.includes("."));
  } catch {
    return false;
  }
}

export function isSettingsEmail(value: string) {
  return EMAIL_RE.test(value.trim());
}

export function isSettingsSectionId(value: string): value is SettingsSectionId {
  return settingsSections.some((item) => item.id === value);
}

export function clampSettingDays(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(365, Math.max(1, Math.floor(value)));
}

export function clampSettingCents(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  const cents = Math.floor(value);
  if (cents < 0 || cents > 99_999_999) return fallback;
  return cents;
}

export function proposalWebsitePriceCents(settings: AgencySettings | null | undefined): number {
  return clampSettingCents(settings?.defaultProposalWebsiteCents, DEFAULT_PROPOSAL_LINE_PRICE_CENTS);
}

export function proposalAddonPriceOverrides(
  settings: AgencySettings | null | undefined,
): Partial<Record<string, number>> {
  if (!settings) return {};
  return {
    "Quote Request Form": settings.defaultAddonQuoteRequestFormCents,
    Booking: settings.defaultAddonBookingFormCents,
    "Booking Form": settings.defaultAddonBookingFormCents,
    "Social Media Integration": settings.defaultAddonSocialMediaCents,
    "Business Email": settings.defaultAddonBusinessEmailCents,
    Domain: settings.defaultAddonDomainCents,
    "Hosting Setup": settings.defaultAddonHostingSetupCents,
  };
}

export function proposalDraftOverrides(settings: AgencySettings | null): Partial<ProposalDraftFields> | undefined {
  if (!settings) return undefined;
  return {
    introduction: settings.defaultProposalIntroduction,
    overview: settings.defaultProposalOverview,
    scope: settings.defaultProposalScope,
    deliverablesText: settings.defaultProposalDeliverables,
    timeline: settings.defaultProposalTimeline,
    paymentTerms: settings.defaultProposalPaymentTerms,
    terms: settings.defaultProposalTerms,
    notes: settings.defaultProposalNotes,
  };
}

export function invoiceNotesFromSettings(settings: AgencySettings): string {
  return [settings.defaultInvoicePaymentTerms.trim(), settings.defaultInvoiceNotes.trim()]
    .filter(Boolean)
    .join("\n\n");
}

export function validateAgencySettings(settings: AgencySettingsPatch): string | null {
  if (!settings.agencyName.trim() || settings.agencyName.trim().length > 120) {
    return "Enter an agency name (120 characters or fewer).";
  }
  if (!EMAIL_RE.test(settings.businessEmail.trim())) return "Enter a valid business email.";
  if (settings.phone.trim().length > 40) return "Phone is too long.";
  if (settings.website.trim().length > 200) return "Website is too long.";
  if (settings.website.trim() && !isPlausibleWebsite(settings.website)) {
    return "Enter a valid website such as https://example.com.";
  }
  if (settings.address.trim().length > 500) return "Address is too long.";
  if (!settings.timezone.trim()) return "Choose a timezone.";
  if (!/^[A-Z]{3}$/.test(settings.currency.trim().toUpperCase())) {
    return "Currency must be a 3-letter code such as USD.";
  }
  if (!COLOR_RE.test(settings.primaryColor.trim())) return "Primary color must be a hex value such as #0050f0.";
  if (!COLOR_RE.test(settings.secondaryColor.trim())) return "Secondary color must be a hex value such as #001030.";
  if (!EMAIL_RE.test(settings.supportEmail.trim())) return "Enter a valid support email.";
  if (!settings.emailFromName.trim()) return "Enter an email from name.";
  if (!EMAIL_RE.test(settings.emailFromAddress.trim())) return "Enter a valid from email.";
  if (!EMAIL_RE.test(settings.emailReplyTo.trim())) return "Enter a valid reply-to email.";
  if (clampSettingDays(settings.defaultProposalValidDays, 0) < 1) {
    return "Proposal validity must be between 1 and 365 days.";
  }
  if (clampSettingDays(settings.defaultInvoiceDueDays, 0) < 1) {
    return "Invoice due period must be between 1 and 365 days.";
  }
  const prices = [
    settings.defaultProposalWebsiteCents,
    settings.defaultAddonQuoteRequestFormCents,
    settings.defaultAddonBookingFormCents,
    settings.defaultAddonSocialMediaCents,
    settings.defaultAddonBusinessEmailCents,
    settings.defaultAddonDomainCents,
    settings.defaultAddonHostingSetupCents,
  ];
  if (prices.some((value) => typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 99_999_999)) {
    return "Enter a valid dollar amount between $0.00 and $999,999.99.";
  }
  return null;
}

export type WorkspacePurgeScope = "projects" | "clients" | "agency";

export const WORKSPACE_PURGE_CONFIRMATION: Record<WorkspacePurgeScope, string> = {
  projects: "DELETE PROJECTS",
  clients: "DELETE CLIENTS",
  agency: "DELETE AGENCY",
};

export const SETTINGS_TIMEZONE_CAPTIONS: Record<(typeof SETTINGS_TIMEZONES)[number], string> = {
  UTC: "Coordinated Universal Time",
  "America/New_York": "Eastern Time",
  "America/Chicago": "Central Time",
  "America/Denver": "Mountain Time",
  "America/Los_Angeles": "Pacific Time",
  "America/Toronto": "Eastern Time",
  "Europe/London": "United Kingdom",
  "Europe/Paris": "Central Europe",
  "Asia/Manila": "Philippines",
  "Asia/Singapore": "Singapore",
  "Australia/Sydney": "Sydney",
};

export const SETTINGS_CURRENCY_CAPTIONS: Record<(typeof SETTINGS_CURRENCIES)[number], string> = {
  USD: "US Dollar",
  CAD: "Canadian Dollar",
  GBP: "British Pound",
  EUR: "Euro",
  AUD: "Australian Dollar",
};

export function timezoneOptionLabel(zone: string) {
  const caption = SETTINGS_TIMEZONE_CAPTIONS[zone as (typeof SETTINGS_TIMEZONES)[number]];
  return caption ? `${zone} — ${caption}` : zone;
}

export function currencyOptionLabel(code: string) {
  const normalized = code.toUpperCase();
  const caption = SETTINGS_CURRENCY_CAPTIONS[normalized as (typeof SETTINGS_CURRENCIES)[number]];
  return caption ? `${normalized} — ${caption}` : normalized;
}

export function emailIdentityConfigured(
  settings: Pick<AgencySettings, "emailFromName" | "emailFromAddress" | "emailReplyTo" | "supportEmail">,
) {
  return (
    settings.emailFromName.trim().length > 0 &&
    EMAIL_RE.test(settings.emailFromAddress.trim()) &&
    EMAIL_RE.test(settings.emailReplyTo.trim()) &&
    EMAIL_RE.test(settings.supportEmail.trim())
  );
}

export function stripeProcessorLabel(): { processor: string; status: string; detail: string } {
  return {
    processor: "Stripe",
    status: "Not confirmed here",
    detail:
      "Checkout uses Stripe keys stored as Supabase Edge Function secrets. This page cannot confirm whether payments are connected, and it cannot show test or live mode. Secret keys are never displayed. Settings cannot switch Stripe modes.",
  };
}
