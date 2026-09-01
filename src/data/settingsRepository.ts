import type { AgencySettings, AgencySettingsPatch, WorkspacePurgeScope } from "@/data/settings";
import { clampSettingCents, clampSettingDays } from "@/data/settings";
import { DEFAULT_PROPOSAL_LINE_PRICE_CENTS } from "@/data/documents";
import { PROPOSAL_PAID_ADDONS_CENTS } from "@/data/proposalPresets";
import { AgencyDbError, friendlyDbError, logDbError } from "@/lib/dbErrors";
import { getSupabase } from "@/lib/supabase";
import type { AgencySettingsRow, Database, Json } from "@/types/database";

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
    message.includes("purge_workspace") ||
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
    defaultProposalWebsiteCents: clampSettingCents(row.default_proposal_website_cents, DEFAULT_PROPOSAL_LINE_PRICE_CENTS),
    defaultAddonQuoteRequestFormCents: clampSettingCents(
      row.default_addon_quote_request_form_cents,
      PROPOSAL_PAID_ADDONS_CENTS["Quote Request Form"],
    ),
    defaultAddonBookingFormCents: clampSettingCents(
      row.default_addon_booking_form_cents,
      PROPOSAL_PAID_ADDONS_CENTS["Booking Form"],
    ),
    defaultAddonSocialMediaCents: clampSettingCents(
      row.default_addon_social_media_cents,
      PROPOSAL_PAID_ADDONS_CENTS["Social Media Integration"],
    ),
    defaultAddonBusinessEmailCents: clampSettingCents(
      row.default_addon_business_email_cents,
      PROPOSAL_PAID_ADDONS_CENTS["Business Email"],
    ),
    defaultAddonDomainCents: clampSettingCents(row.default_addon_domain_cents, PROPOSAL_PAID_ADDONS_CENTS.Domain),
    defaultAddonHostingSetupCents: clampSettingCents(
      row.default_addon_hosting_setup_cents,
      PROPOSAL_PAID_ADDONS_CENTS["Hosting Setup"],
    ),
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
    default_proposal_website_cents: clampSettingCents(
      settings.defaultProposalWebsiteCents,
      DEFAULT_PROPOSAL_LINE_PRICE_CENTS,
    ),
    default_addon_quote_request_form_cents: clampSettingCents(
      settings.defaultAddonQuoteRequestFormCents,
      PROPOSAL_PAID_ADDONS_CENTS["Quote Request Form"],
    ),
    default_addon_booking_form_cents: clampSettingCents(
      settings.defaultAddonBookingFormCents,
      PROPOSAL_PAID_ADDONS_CENTS["Booking Form"],
    ),
    default_addon_social_media_cents: clampSettingCents(
      settings.defaultAddonSocialMediaCents,
      PROPOSAL_PAID_ADDONS_CENTS["Social Media Integration"],
    ),
    default_addon_business_email_cents: clampSettingCents(
      settings.defaultAddonBusinessEmailCents,
      PROPOSAL_PAID_ADDONS_CENTS["Business Email"],
    ),
    default_addon_domain_cents: clampSettingCents(settings.defaultAddonDomainCents, PROPOSAL_PAID_ADDONS_CENTS.Domain),
    default_addon_hosting_setup_cents: clampSettingCents(
      settings.defaultAddonHostingSetupCents,
      PROPOSAL_PAID_ADDONS_CENTS["Hosting Setup"],
    ),
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

const WORKSPACE_EXPORT_TABLES = [
  "leads",
  "clients",
  "client_staff_data",
  "projects",
  "milestones",
  "tasks",
  "deliverables",
  "file_versions",
  "feedback",
  "approvals",
  "activity",
  "proposals",
  "proposal_revisions",
  "proposal_items",
  "proposal_admin_notes",
  "contracts",
  "contract_revisions",
  "contract_admin_notes",
  "invoices",
  "invoice_items",
  "invoice_admin_notes",
  "payments",
  "conversations",
  "messages",
  "stripe_checkout_sessions",
] as const satisfies ReadonlyArray<keyof Database["public"]["Tables"]>;

async function selectAll(table: (typeof WORKSPACE_EXPORT_TABLES)[number]): Promise<unknown[]> {
  const client = requireClient();
  const pageSize = 1000;
  const rows: unknown[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await client.from(table).select("*").range(from, from + pageSize - 1);
    if (error) fail(`export ${table}`, error, "Unable to download workspace data.");
    const chunk = data ?? [];
    rows.push(...chunk);
    if (chunk.length < pageSize) break;
  }
  return rows;
}

function downloadJsonFile(filename: string, payload: unknown) {
  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: "application/json" });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

export async function downloadWorkspaceExport(): Promise<void> {
  const client = requireClient();
  const settings = await fetchAgencySettings();
  const tables = Object.fromEntries(
    await Promise.all(WORKSPACE_EXPORT_TABLES.map(async (table) => [table, await selectAll(table)])),
  );
  const { data: portalAccounts, error: portalError } = await client
    .from("profiles")
    .select("id, email, full_name, role, client_id")
    .eq("role", "client");
  if (portalError) fail("export portal accounts", portalError, "Unable to download workspace data.");

  const day = new Date().toISOString().slice(0, 10);
  downloadJsonFile(`motivescripts-workspace-${day}.json`, {
    exportedAt: new Date().toISOString(),
    note: "JSON record export. Project file binaries in Storage are not included. Invitation tokens are not included.",
    settings,
    portalAccounts: portalAccounts ?? [],
    ...tables,
  });
}

export async function purgeWorkspace(scope: WorkspacePurgeScope, confirmation: string): Promise<void> {
  const client = requireClient();
  const { error } = await client.rpc("purge_workspace", {
    p_scope: scope,
    p_confirmation: confirmation,
  });
  if (error) {
    const message =
      error && typeof error === "object" && "message" in error && typeof error.message === "string"
        ? error.message
        : "";
    if (message.includes("CONFIRMATION_REQUIRED")) {
      throw new AgencyDbError("Type the confirmation phrase exactly to continue.", error);
    }
    if (message.includes("PORTAL_PURGE_FAILED") || message.toLowerCase().includes("auth.users")) {
      throw new AgencyDbError(
        "Workspace records were not deleted because portal or team accounts could not be removed. Try again or delete those users in Supabase Auth, then retry.",
        error,
      );
    }
    fail("purge workspace", error, "Unable to complete this workspace action.");
  }
}

export async function updateOwnProfile(input: { fullName?: string; jobTitle?: string }): Promise<void> {
  const client = requireClient();
  const { error } = await client.rpc("update_own_profile", {
    p_full_name: input.fullName,
    p_job_title: input.jobTitle,
  });
  if (error) fail("update own profile", error, "Unable to update your profile.");
}
