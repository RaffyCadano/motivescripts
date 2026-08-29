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
  items: { id: SettingsSectionId; label: string }[];
};

export const settingsNavGroups: SettingsNavGroup[] = [
  {
    label: "Agency",
    items: [
      { id: "agency", label: "Agency Profile" },
      { id: "branding", label: "Branding" },
    ],
  },
  {
    label: "Workspace",
    items: [
      { id: "documents", label: "Document Defaults" },
      { id: "portal", label: "Client Portal" },
      { id: "notifications", label: "Notifications" },
    ],
  },
  {
    label: "Communication",
    items: [{ id: "email", label: "Email" }],
  },
  {
    label: "Billing",
    items: [
      { id: "invoices", label: "Invoice Defaults" },
      { id: "payments", label: "Payment Settings" },
    ],
  },
  {
    label: "Account",
    items: [
      { id: "profile", label: "My Profile" },
      { id: "security", label: "Security" },
    ],
  },
  {
    label: "Danger Zone",
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
  updatedAt: string;
  updatedBy: string | null;
};

export type AgencySettingsPatch = Omit<AgencySettings, "logoUrl" | "updatedAt" | "updatedBy">;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const COLOR_RE = /^#[0-9A-Fa-f]{6}$/;

export function isSettingsSectionId(value: string): value is SettingsSectionId {
  return settingsSections.some((item) => item.id === value);
}

export function clampSettingDays(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(365, Math.max(1, Math.floor(value)));
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
  return null;
}

export function stripeProcessorLabel(): { processor: string; status: string; detail: string } {
  return {
    processor: "Stripe",
    status: "Configured in Edge Function secrets",
    detail:
      "Test or live mode is not shown here. Stripe secret keys and the webhook signing secret stay in Supabase Edge Function secrets. Settings cannot switch Stripe modes.",
  };
}
