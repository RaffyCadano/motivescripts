import type { AgencySettings, AgencySettingsPatch } from "@/data/settings";
import { clampSettingDays } from "@/data/settings";
import { AgencyDbError, friendlyDbError, logDbError } from "@/lib/dbErrors";
import { getSupabase } from "@/lib/supabase";
import type { AgencySettingsRow, Json } from "@/types/database";

function requireClient() {
  const client = getSupabase();
  if (!client) throw new AgencyDbError("Supabase isn’t connected yet.");
  return client;
}

function settingsUnavailable(error: unknown): boolean {
  const message =
    error && typeof error === "object" && "message" in error && typeof error.message === "string"
      ? error.message
      : "";
  const code =
    error && typeof error === "object" && "code" in error && typeof error.code === "string" ? error.code : "";
  return (
    code === "PGRST202" ||
    code === "42883" ||
    message.includes("get_agency_settings") ||
    message.includes("update_agency_settings") ||
    message.includes("update_own_profile") ||
    message.includes("get_client_portal_welcome") ||
    message.includes("agency_settings") ||
    message.toLowerCase().includes("could not find the function")
  );
}

function fail(context: string, error: unknown, fallback: string): never {
  logDbError(context, error);
  if (settingsUnavailable(error)) {
    throw new AgencyDbError(
      "Settings aren’t available until the agency_settings migration is applied.",
      error,
    );
  }
  const message =
    error && typeof error === "object" && "message" in error && typeof error.message === "string"
      ? error.message
      : "";
  if (message && message.length < 180 && !message.toLowerCase().includes("failed to fetch")) {
    throw new AgencyDbError(message, error);
  }
  throw new AgencyDbError(friendlyDbError(error, fallback), error);
}

function mapSettings(row: AgencySettingsRow): AgencySettings {
  return {
    agencyName: row.agency_name,
    businessEmail: row.business_email,
    phone: row.phone,
    website: row.website,
    address: row.address,
    timezone: row.timezone,
    currency: row.currency,
    logoUrl: row.logo_url,
    primaryColor: row.primary_color,
    secondaryColor: row.secondary_color,
    supportEmail: row.support_email,
    emailFromName: row.email_from_name,
    emailFromAddress: row.email_from_address,
    emailReplyTo: row.email_reply_to,
    defaultProposalValidDays: clampSettingDays(row.default_proposal_valid_days, 30),
    defaultProposalIntroduction: row.default_proposal_introduction,
    defaultProposalOverview: row.default_proposal_overview,
    defaultProposalScope: row.default_proposal_scope,
    defaultProposalDeliverables: row.default_proposal_deliverables,
    defaultProposalTimeline: row.default_proposal_timeline,
    defaultProposalPaymentTerms: row.default_proposal_payment_terms,
    defaultProposalTerms: row.default_proposal_terms,
    defaultProposalNotes: row.default_proposal_notes,
    defaultContractTerms: row.default_contract_terms,
    defaultInvoiceDueDays: clampSettingDays(row.default_invoice_due_days, 14),
    defaultInvoicePaymentTerms: row.default_invoice_payment_terms,
    defaultInvoiceNotes: row.default_invoice_notes,
    clientPortalWelcomeMessage: row.client_portal_welcome_message,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  };
}

function toPatch(settings: AgencySettingsPatch): Json {
  return {
    agency_name: settings.agencyName.trim(),
    business_email: settings.businessEmail.trim(),
    phone: settings.phone.trim(),
    website: settings.website.trim(),
    address: settings.address.trim(),
    timezone: settings.timezone.trim(),
    currency: settings.currency.trim().toUpperCase(),
    primary_color: settings.primaryColor.trim(),
    secondary_color: settings.secondaryColor.trim(),
    support_email: settings.supportEmail.trim(),
    email_from_name: settings.emailFromName.trim(),
    email_from_address: settings.emailFromAddress.trim(),
    email_reply_to: settings.emailReplyTo.trim(),
    default_proposal_valid_days: clampSettingDays(settings.defaultProposalValidDays, 30),
    default_proposal_introduction: settings.defaultProposalIntroduction,
    default_proposal_overview: settings.defaultProposalOverview,
    default_proposal_scope: settings.defaultProposalScope,
    default_proposal_deliverables: settings.defaultProposalDeliverables,
    default_proposal_timeline: settings.defaultProposalTimeline,
    default_proposal_payment_terms: settings.defaultProposalPaymentTerms,
    default_proposal_terms: settings.defaultProposalTerms,
    default_proposal_notes: settings.defaultProposalNotes,
    default_contract_terms: settings.defaultContractTerms,
    default_invoice_due_days: clampSettingDays(settings.defaultInvoiceDueDays, 14),
    default_invoice_payment_terms: settings.defaultInvoicePaymentTerms,
    default_invoice_notes: settings.defaultInvoiceNotes,
    client_portal_welcome_message: settings.clientPortalWelcomeMessage,
  };
}

function asSettingsRow(data: unknown): AgencySettingsRow | null {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") return null;
  return row as AgencySettingsRow;
}

export async function fetchAgencySettings(): Promise<AgencySettings> {
  const client = requireClient();
  const { data, error } = await client.rpc("get_agency_settings");
  const row = asSettingsRow(data);
  if (error || !row) fail("load agency settings", error ?? new Error("empty"), "Unable to load settings.");
  return mapSettings(row);
}

export async function saveAgencySettings(settings: AgencySettingsPatch): Promise<AgencySettings> {
  const client = requireClient();
  const { data, error } = await client.rpc("update_agency_settings", { p_patch: toPatch(settings) });
  const row = asSettingsRow(data);
  if (error || !row) fail("save agency settings", error ?? new Error("empty"), "Unable to save settings.");
  return mapSettings(row);
}

export async function fetchClientPortalWelcome(): Promise<string> {
  const client = requireClient();
  const { data, error } = await client.rpc("get_client_portal_welcome");
  if (error) fail("load portal welcome", error, "Unable to load the portal welcome message.");
  return typeof data === "string" ? data : "";
}

export async function updateOwnProfile(input: { fullName?: string; jobTitle?: string }): Promise<void> {
  const client = requireClient();
  const { error } = await client.rpc("update_own_profile", {
    p_full_name: input.fullName,
    p_job_title: input.jobTitle,
  });
  if (error) fail("update own profile", error, "Unable to update your profile.");
}
