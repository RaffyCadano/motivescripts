import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { isActiveAdmin } from "@/auth/permissions";
import { AdminInfoTip } from "@/components/admin/AdminInfoTip";
import { ConfirmSignOutModal } from "@/components/admin/ConfirmSignOutModal";
import { AdminDialog } from "@/components/admin/leads/AdminDialog";
import { adminDangerBtn, adminDangerSolidBtn, adminGhostBtn, adminPrimaryBtn } from "@/components/admin/adminActionStyles";
import { AdminPageHeader } from "@/components/admin/list/AdminPageHeader";
import { BrandMark } from "@/components/BrandMark";
import { ConfirmDocumentModal } from "@/components/documents/ConfirmDocumentModal";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import {
  SETTINGS_CURRENCIES,
  SETTINGS_TIMEZONES,
  WORKSPACE_PURGE_CONFIRMATION,
  currencyOptionLabel,
  emailIdentityConfigured,
  isPlausibleWebsite,
  isSettingsEmail,
  isSettingsSectionId,
  settingsNavGroups,
  stripeProcessorLabel,
  timezoneOptionLabel,
  validateAgencySettings,
  type AgencySettings,
  type SettingsSectionId,
  type WorkspacePurgeScope,
} from "@/data/settings";
import {
  downloadWorkspaceExport,
  fetchAgencySettings,
  purgeWorkspace,
  saveAgencySettings,
  updateOwnProfile,
} from "@/data/settingsRepository";
import { centsInputValue, formatUsdFromCents, parseDollarsToCents } from "@/data/money";
import { AgencyDbError } from "@/lib/dbErrors";
import { cn } from "@/lib/cn";
import { useMessaging } from "@/providers/MessagingProvider";

const fieldClass =
  "mt-1.5 w-full rounded-lg border border-[var(--admin-line)] bg-white px-3 py-2 text-sm text-[var(--admin-ink)] outline-none focus:border-[rgb(0_80_240_/_0.45)] disabled:bg-[var(--admin-bg)]";

type SaveNotice = { tone: "ok" | "error"; message: string };

function snapshotOf(settings: AgencySettings) {
  const { logoUrl: _logoUrl, updatedAt: _updatedAt, updatedBy: _updatedBy, ...rest } = settings;
  return JSON.stringify(rest);
}

export function AdminSettings() {
  const { profile, session, signOut, refreshProfile } = useAuth();
  const { notify, reload } = useLeads();
  const messaging = useMessaging();
  const navigate = useNavigate();
  const canEditAgency = isActiveAdmin(profile);
  const stripe = stripeProcessorLabel();
  const reviewOnly = !canEditAgency;

  const [section, setSection] = useState<SettingsSectionId>("agency");
  const [pendingSection, setPendingSection] = useState<SettingsSectionId | null>(null);
  const [settings, setSettings] = useState<AgencySettings | null>(null);
  const [savedSnap, setSavedSnap] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [fullName, setFullName] = useState(profile?.fullName ?? "");
  const [jobTitle, setJobTitle] = useState(profile?.jobTitle ?? "");
  const [profileBusy, setProfileBusy] = useState(false);
  const [purgeScope, setPurgeScope] = useState<WorkspacePurgeScope | null>(null);
  const [purgeTyped, setPurgeTyped] = useState("");
  const [purgeBusy, setPurgeBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [saveNotice, setSaveNotice] = useState<SaveNotice | null>(null);
  const [agencyFieldErrors, setAgencyFieldErrors] = useState<Partial<Record<"agencyName" | "businessEmail" | "supportEmail" | "website", string>>>({});
  const [clock, setClock] = useState(() => Date.now());

  useEffect(() => {
    setFullName(profile?.fullName ?? "");
    setJobTitle(profile?.jobTitle ?? "");
  }, [profile?.fullName, profile?.jobTitle]);

  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (isSettingsSectionId(hash)) setSection(hash);
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void fetchAgencySettings()
      .then((row) => {
        if (!active) return;
        setSettings(row);
        setSavedSnap(snapshotOf(row));
        setLoadError(null);
      })
      .catch((error) => {
        if (!active) return;
        setLoadError(error instanceof AgencyDbError ? error.message : "Unable to load settings.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const agencyDirty = Boolean(settings && snapshotOf(settings) !== savedSnap);
  const profileDirty = fullName.trim() !== (profile?.fullName ?? "") || jobTitle.trim() !== (profile?.jobTitle ?? "");
  const dirty = agencyDirty || profileDirty;

  useEffect(() => {
    if (section !== "agency") return;
    const timer = window.setInterval(() => setClock(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, [section]);

  useEffect(() => {
    if (!dirty) return;
    const onLeave = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [dirty]);

  function requestSection(next: SettingsSectionId) {
    if (next === section) return;
    if (dirty) {
      setPendingSection(next);
      return;
    }
    goToSection(next);
  }

  function goToSection(next: SettingsSectionId) {
    setSaveNotice(null);
    setSection(next);
    window.history.replaceState(null, "", `#${next}`);
    document.getElementById("admin-main")?.scrollTo({ top: 0 });
  }

  async function saveAgency() {
    if (!settings || !canEditAgency || busy) return;
    if (section === "agency") {
      const nextErrors = collectAgencyProfileErrors(settings);
      setAgencyFieldErrors(nextErrors);
      if (Object.keys(nextErrors).length > 0) {
        const first = Object.values(nextErrors)[0];
        setSaveNotice({ tone: "error", message: first ?? "Complete the required fields marked below." });
        notify(first ?? "Complete the required fields marked below.");
        return;
      }
    }
    const invalid = validateAgencySettings(settings);
    if (invalid) {
      setSaveNotice({ tone: "error", message: invalid });
      notify(invalid);
      return;
    }
    setBusy(true);
    try {
      const saved = await saveAgencySettings(settings);
      setSettings(saved);
      setSavedSnap(snapshotOf(saved));
      const savedMessage = section === "agency" ? "Agency profile saved" : "Changes saved";
      setSaveNotice({ tone: "ok", message: savedMessage });
      notify(savedMessage === "Agency profile saved" ? savedMessage : "Settings saved.");
    } catch (error) {
      const message = error instanceof AgencyDbError ? error.message : "Unable to save settings.";
      setSaveNotice({ tone: "error", message });
      notify(message);
    } finally {
      setBusy(false);
    }
  }

  async function saveProfile() {
    if (!profile || profileBusy) return;
    if (!fullName.trim()) {
      setSaveNotice({ tone: "error", message: "Enter your name." });
      notify("Enter your name.");
      return;
    }
    setProfileBusy(true);
    try {
      await updateOwnProfile({ fullName: fullName.trim(), jobTitle: jobTitle.trim() });
      await refreshProfile();
      setSaveNotice({ tone: "ok", message: "Changes saved" });
      notify("Profile saved.");
    } catch (error) {
      const message = error instanceof AgencyDbError ? error.message : "Unable to update your profile.";
      setSaveNotice({ tone: "error", message });
      notify(message);
    } finally {
      setProfileBusy(false);
    }
  }

  const sessionExpires = useMemo(() => {
    const expiresAt = session?.expires_at;
    if (!expiresAt) return null;
    return new Date(expiresAt * 1000).toLocaleString();
  }, [session?.expires_at]);

  function patch(partial: Partial<AgencySettings>) {
    setSaveNotice(null);
    if ("agencyName" in partial || "businessEmail" in partial || "supportEmail" in partial || "website" in partial) {
      setAgencyFieldErrors((current) => {
        const next = { ...current };
        if ("agencyName" in partial) delete next.agencyName;
        if ("businessEmail" in partial) delete next.businessEmail;
        if ("supportEmail" in partial) delete next.supportEmail;
        if ("website" in partial) delete next.website;
        return next;
      });
    }
    setSettings((current) => (current ? { ...current, ...partial } : current));
  }

  const readOnly = !canEditAgency || busy || !settings;
  const timezonePreview = settings ? formatNowInTimezone(settings.timezone, clock) : null;
  const savedCurrency = useMemo(() => {
    if (!savedSnap) return "";
    try {
      const parsed = JSON.parse(savedSnap) as { currency?: string };
      return parsed.currency ?? "";
    } catch {
      return "";
    }
  }, [savedSnap]);
  const currencyChanged = Boolean(settings && savedCurrency && settings.currency !== savedCurrency);
  const emailReady = settings ? emailIdentityConfigured(settings) : false;

  async function runExport() {
    if (!canEditAgency || exportBusy || purgeBusy) return;
    setExportBusy(true);
    try {
      await downloadWorkspaceExport();
      notify("Workspace data downloaded.");
    } catch (error) {
      notify(error instanceof AgencyDbError ? error.message : "Unable to download workspace data.");
    } finally {
      setExportBusy(false);
    }
  }

  async function runPurge(scope: WorkspacePurgeScope) {
    if (!canEditAgency || purgeBusy) return;
    if (purgeTyped.trim() !== WORKSPACE_PURGE_CONFIRMATION[scope]) {
      notify("Type the confirmation phrase exactly to continue.");
      return;
    }
    setPurgeBusy(true);
    try {
      await purgeWorkspace(scope, WORKSPACE_PURGE_CONFIRMATION[scope]);
      setPurgeScope(null);
      setPurgeTyped("");
      notify(
        scope === "projects"
          ? "All projects were deleted."
          : scope === "clients"
            ? "All clients were deleted."
            : "Workspace records and team accounts were deleted.",
      );
      navigate("/admin");
      await Promise.all([reload(), messaging.reload()]);
    } catch (error) {
      notify(error instanceof AgencyDbError ? error.message : "Unable to complete this workspace action.");
    } finally {
      setPurgeBusy(false);
    }
  }

  const showAgencySave = !reviewOnly && Boolean(settings) && sectionNeedsSettings(section);

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Settings"
        description="Agency configuration for MotiveScripts. Staff can review these values. Only administrators can change workspace settings."
      />

      {agencyDirty || profileDirty ? (
        <p
          role="status"
          className="rounded-[var(--admin-radius)] border border-[rgb(0_80_240_/_0.22)] bg-[rgb(0_80_240_/_0.06)] px-4 py-3 text-sm font-semibold text-[var(--admin-ink)]"
        >
          Unsaved changes
        </p>
      ) : saveNotice?.tone === "ok" && (sectionNeedsSettings(section) || section === "profile") ? (
        <p
          role="status"
          className="rounded-[var(--admin-radius)] border border-[rgb(16_185_129_/_0.22)] bg-[rgb(16_185_129_/_0.08)] px-4 py-3 text-sm font-semibold text-[#0f7a56]"
        >
          {saveNotice.message}
        </p>
      ) : saveNotice?.tone === "error" ? (
        <p
          role="status"
          className="rounded-[var(--admin-radius)] border border-[rgb(180_35_24_/_0.22)] bg-[rgb(220_38_38_/_0.06)] px-4 py-3 text-sm font-semibold text-[#b42318]"
        >
          {saveNotice.message}
        </p>
      ) : null}

      {reviewOnly ? (
        <p className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] px-4 py-3 text-sm text-[var(--admin-muted)]">
          Agency settings are read-only for staff. You can review workspace values below, then update My Profile or
          sign out from Security.
        </p>
      ) : null}

      <div className="lg:hidden">
        <label className="block text-sm font-semibold text-[var(--admin-ink)]">
          Section
          <select
            value={section}
            onChange={(event) => {
              if (isSettingsSectionId(event.target.value)) requestSection(event.target.value);
            }}
            className={fieldClass}
          >
            {settingsNavGroups.map((group) => (
              <optgroup key={group.label} label={`${group.label} — ${group.hint}`}>
                {group.items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-6 lg:grid-cols-[15.5rem_minmax(0,1fr)]">
        <nav className="hidden lg:block lg:sticky lg:top-0 lg:self-start" aria-label="Settings sections">
          <div className="space-y-5 rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-3">
            {settingsNavGroups.map((group) => {
              const dangerGroup = group.label === "Danger Zone";
              return (
                <div key={group.label}>
                  <p
                    className={cn(
                      "px-2.5 text-[10px] font-semibold uppercase tracking-[0.16em]",
                      dangerGroup ? "text-[#b42318]" : "text-[var(--admin-muted)]",
                    )}
                  >
                    {group.label}
                  </p>
                  <p className="px-2.5 pb-2 text-[11px] leading-snug text-[var(--admin-muted)]">{group.hint}</p>
                  <div className="flex flex-col gap-0.5">
                    {group.items.map((item) => {
                      const active = section === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => requestSection(item.id)}
                          className={cn(
                            "rounded-lg px-2.5 py-2 text-left text-[13px] font-medium tracking-tight",
                            active && dangerGroup && "bg-[rgb(220_38_38_/_0.08)] text-[#b42318]",
                            active && !dangerGroup && "bg-[var(--admin-hover)] text-[var(--admin-blue)]",
                            !active && dangerGroup && "text-[#b42318]/80 hover:bg-[rgb(220_38_38_/_0.06)]",
                            !active && !dangerGroup && "text-[var(--admin-ink)]/75 hover:bg-[var(--admin-bg)] hover:text-[var(--admin-ink)]",
                          )}
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </nav>

        <div className="min-w-0 space-y-6">
          {loading && sectionNeedsSettings(section) ? (
            <div className="h-64 animate-pulse rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)]" />
          ) : null}

          {!loading && loadError && sectionNeedsSettings(section) ? (
            <Card title="Settings unavailable" description={loadError}>
              <p className="text-sm text-[var(--admin-muted)]">
                Apply <code className="text-[13px]">supabase/migrations/20260829310000_agency_settings.sql</code> to
                the linked Supabase project, then refresh. Do not run a full database push.
              </p>
            </Card>
          ) : null}

          {!loading && settings && section === "agency" ? (
            <Card
              title="Agency Profile"
              description="These details are used across client-facing documents, invoices, contracts, proposals, and portal communication."
            >
              <p className="text-sm leading-6 text-[var(--admin-muted)]">
                This information appears on documents and client communications. Keep it accurate before sending
                client-facing documents.
              </p>
              <FieldGroup title="Business identity">
                <ValueField
                  label="Agency name"
                  htmlFor="agency-name"
                  review={reviewOnly}
                  display={settings.agencyName}
                  error={agencyFieldErrors.agencyName}
                  hint="Used as the business name on proposals, contracts, invoices, and the client portal."
                >
                  <input
                    id="agency-name"
                    disabled={readOnly}
                    className={fieldClass}
                    value={settings.agencyName}
                    onChange={(e) => patch({ agencyName: e.target.value })}
                    aria-invalid={Boolean(agencyFieldErrors.agencyName)}
                  />
                </ValueField>
                <div className="grid gap-4 sm:grid-cols-2">
                  <ValueField
                    label="Business email"
                    htmlFor="business-email"
                    review={reviewOnly}
                    display={settings.businessEmail}
                    error={agencyFieldErrors.businessEmail}
                    hint="Primary agency email shown on client-facing documents."
                  >
                    <input
                      id="business-email"
                      type="email"
                      disabled={readOnly}
                      className={fieldClass}
                      value={settings.businessEmail}
                      onChange={(e) => patch({ businessEmail: e.target.value })}
                      aria-invalid={Boolean(agencyFieldErrors.businessEmail)}
                    />
                  </ValueField>
                  <ValueField
                    label="Support email"
                    htmlFor="support-email"
                    review={reviewOnly}
                    display={settings.supportEmail}
                    error={agencyFieldErrors.supportEmail}
                    hint="Email clients can use for support and questions."
                  >
                    <input
                      id="support-email"
                      type="email"
                      disabled={readOnly}
                      className={fieldClass}
                      value={settings.supportEmail}
                      onChange={(e) => patch({ supportEmail: e.target.value })}
                      aria-invalid={Boolean(agencyFieldErrors.supportEmail)}
                    />
                  </ValueField>
                  <ValueField
                    label="Phone"
                    htmlFor="agency-phone"
                    optional
                    review={reviewOnly}
                    display={settings.phone}
                    hint="Optional contact number shown on applicable documents."
                  >
                    <input
                      id="agency-phone"
                      type="tel"
                      disabled={readOnly}
                      className={fieldClass}
                      value={settings.phone}
                      onChange={(e) => patch({ phone: e.target.value })}
                    />
                  </ValueField>
                  <ValueField
                    label="Website"
                    htmlFor="agency-website"
                    optional
                    review={reviewOnly}
                    display={settings.website}
                    error={agencyFieldErrors.website}
                    hint="Agency website shown on applicable documents."
                  >
                    <input
                      id="agency-website"
                      inputMode="url"
                      disabled={readOnly}
                      className={fieldClass}
                      value={settings.website}
                      onChange={(e) => patch({ website: e.target.value })}
                      aria-invalid={Boolean(agencyFieldErrors.website)}
                    />
                  </ValueField>
                </div>
              </FieldGroup>
              <FieldGroup title="Location & billing">
                <ValueField
                  label="Business address"
                  htmlFor="agency-address"
                  optional
                  review={reviewOnly}
                  display={settings.address}
                  hint="Used on proposals, contracts, invoices, and other applicable documents."
                >
                  <textarea
                    id="agency-address"
                    rows={3}
                    disabled={readOnly}
                    className={fieldClass}
                    value={settings.address}
                    onChange={(e) => patch({ address: e.target.value })}
                  />
                </ValueField>
                <div className="grid gap-4 sm:grid-cols-2">
                  <ValueField
                    label="Timezone"
                    htmlFor="agency-timezone"
                    review={reviewOnly}
                    display={timezoneOptionLabel(settings.timezone)}
                    hint="Controls how dates and times are displayed throughout the workspace."
                  >
                    <select
                      id="agency-timezone"
                      disabled={readOnly}
                      className={fieldClass}
                      value={settings.timezone}
                      onChange={(e) => patch({ timezone: e.target.value })}
                    >
                      {timezoneOptions(settings.timezone).map((zone) => (
                        <option key={zone} value={zone}>
                          {timezoneOptionLabel(zone)}
                        </option>
                      ))}
                    </select>
                  </ValueField>
                  <ValueField
                    label="Currency"
                    htmlFor="agency-currency"
                    review={reviewOnly}
                    display={currencyOptionLabel(settings.currency)}
                    hint="Default currency for newly created invoices and documents. Existing documents keep their original currency."
                  >
                    <select
                      id="agency-currency"
                      disabled={readOnly}
                      className={fieldClass}
                      value={settings.currency}
                      onChange={(e) => patch({ currency: e.target.value })}
                    >
                      {currencyOptions(settings.currency).map((code) => (
                        <option key={code} value={code}>
                          {currencyOptionLabel(code)}
                        </option>
                      ))}
                    </select>
                  </ValueField>
                </div>
                {timezonePreview ? (
                  <p className="text-xs text-[var(--admin-muted)]">
                    <span className="font-semibold text-[var(--admin-ink)]/70">Current time:</span> {timezonePreview}
                  </p>
                ) : null}
                {currencyChanged ? (
                  <p className="rounded-lg border border-[rgb(0_80_240_/_0.18)] bg-white px-3 py-2 text-xs leading-5 text-[var(--admin-muted)]">
                    New documents will use this currency. Existing invoices, proposals, and contracts will not be changed.
                  </p>
                ) : null}
              </FieldGroup>
              <div className="rounded-lg border border-[var(--admin-line)] bg-white px-3 py-3">
                <p className="text-sm font-semibold text-[var(--admin-ink)]">Before sending client documents</p>
                <p className="mt-1 text-xs leading-5 text-[var(--admin-muted)]">
                  Make sure your agency name, email, address, phone, website, timezone, and currency are correct. These
                  settings can appear on proposals, contracts, invoices, and client communications.
                </p>
              </div>
              {showAgencySave ? (
                <SaveRow disabled={readOnly} busy={busy} dirty={agencyDirty} notice={saveNotice} onSave={() => void saveAgency()} />
              ) : null}
            </Card>
          ) : null}

          {!loading && settings && section === "branding" ? (
            <Card
              title="Branding"
              description="These colors and the current mark affect how MotiveScripts presents the agency on client-facing documents and in the portal preview. Existing PDFs still use the bundled mark until a later branding phase."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <ValueField
                  label="Primary brand color"
                  htmlFor="primary-color"
                  review={reviewOnly}
                  display={settings.primaryColor}
                  tip="Used in this preview. Existing PDFs and emails still use the bundled MotiveScripts mark."
                >
                  <div className="mt-1.5 flex gap-2">
                    <input
                      id="primary-color"
                      type="color"
                      disabled={readOnly}
                      value={safeColor(settings.primaryColor)}
                      onChange={(e) => patch({ primaryColor: e.target.value })}
                      className="h-10 w-14 cursor-pointer rounded-lg border border-[var(--admin-line)] bg-white p-1"
                    />
                    <input
                      disabled={readOnly}
                      className={fieldClass + " mt-0"}
                      value={settings.primaryColor}
                      onChange={(e) => patch({ primaryColor: e.target.value })}
                    />
                  </div>
                </ValueField>
                <ValueField
                  label="Secondary brand color"
                  htmlFor="secondary-color"
                  review={reviewOnly}
                  display={settings.secondaryColor}
                >
                  <div className="mt-1.5 flex gap-2">
                    <input
                      id="secondary-color"
                      type="color"
                      disabled={readOnly}
                      value={safeColor(settings.secondaryColor, "#001030")}
                      onChange={(e) => patch({ secondaryColor: e.target.value })}
                      className="h-10 w-14 cursor-pointer rounded-lg border border-[var(--admin-line)] bg-white p-1"
                    />
                    <input
                      disabled={readOnly}
                      className={fieldClass + " mt-0"}
                      value={settings.secondaryColor}
                      onChange={(e) => patch({ secondaryColor: e.target.value })}
                    />
                  </div>
                </ValueField>
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--admin-ink)]">Current logo</p>
                <div className="mt-2 flex items-center gap-3 rounded-[var(--admin-radius)] border border-dashed border-[var(--admin-line)] px-4 py-3">
                  {settings.logoUrl ? (
                    <img src={settings.logoUrl} alt="" className="h-8 w-auto" />
                  ) : (
                    <BrandMark className="h-8 w-auto" decorative />
                  )}
                  <div>
                    <p className="text-sm text-[var(--admin-ink)]">
                      {settings.logoUrl ? "Logo on file" : "Bundled MotiveScripts mark"}
                    </p>
                    <p className="text-xs text-[var(--admin-muted)]">
                      Logo upload is not available in this phase. Storage and the bundled PDF/email logo are unchanged.
                    </p>
                  </div>
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--admin-ink)]">Preview</p>
                <div className="mt-2 space-y-3 rounded-[var(--admin-radius)] border border-[var(--admin-line)] p-4">
                  <div
                    className="flex items-center gap-3 border-b-2 pb-3"
                    style={{ borderColor: safeColor(settings.primaryColor) }}
                  >
                    {settings.logoUrl ? (
                      <img src={settings.logoUrl} alt="" className="h-8 w-auto" />
                    ) : (
                      <BrandMark className="h-8 w-auto" decorative />
                    )}
                    <div>
                      <p
                        className="font-heading text-sm font-semibold"
                        style={{ color: safeColor(settings.secondaryColor, "#001030") }}
                      >
                        {settings.agencyName || "Agency name"}
                      </p>
                      <p className="text-xs text-[var(--admin-muted)]">{settings.supportEmail || "Support email"}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="inline-flex h-9 items-center rounded-[var(--admin-radius)] px-3 text-sm font-semibold text-white"
                    style={{ background: safeColor(settings.primaryColor) }}
                  >
                    Sample button
                  </button>
                </div>
              </div>
              {showAgencySave ? (
                <SaveRow disabled={readOnly} busy={busy} dirty={agencyDirty} notice={saveNotice} onSave={() => void saveAgency()} />
              ) : null}
            </Card>
          ) : null}

          {!loading && settings && section === "documents" ? (
            <Card
              title="Document Defaults"
              description="These values are used when creating new proposals, contracts, and invoices. You can edit the document before sending. Changing a default does not modify existing documents."
            >
              <FieldGroup title="Proposal">
                <ValueField
                  label="Default validity (days)"
                  htmlFor="proposal-days"
                  review={reviewOnly}
                  display={String(settings.defaultProposalValidDays)}
                >
                  <input
                    id="proposal-days"
                    type="number"
                    min={1}
                    max={365}
                    disabled={readOnly}
                    className={fieldClass}
                    value={settings.defaultProposalValidDays}
                    onChange={(e) => patch({ defaultProposalValidDays: Number(e.target.value) })}
                  />
                </ValueField>
                <TextArea
                  label="Default introduction"
                  id="proposal-intro"
                  review={reviewOnly}
                  disabled={readOnly}
                  value={settings.defaultProposalIntroduction}
                  onChange={(value) => patch({ defaultProposalIntroduction: value })}
                />
                <TextArea
                  label="Default project overview"
                  id="proposal-overview"
                  review={reviewOnly}
                  disabled={readOnly}
                  value={settings.defaultProposalOverview}
                  onChange={(value) => patch({ defaultProposalOverview: value })}
                />
                <TextArea
                  label="Default scope"
                  id="proposal-scope"
                  review={reviewOnly}
                  disabled={readOnly}
                  value={settings.defaultProposalScope}
                  onChange={(value) => patch({ defaultProposalScope: value })}
                />
                <TextArea
                  label="Default deliverables"
                  id="proposal-deliverables"
                  review={reviewOnly}
                  disabled={readOnly}
                  value={settings.defaultProposalDeliverables}
                  onChange={(value) => patch({ defaultProposalDeliverables: value })}
                />
                <TextArea
                  label="Default timeline"
                  id="proposal-timeline"
                  review={reviewOnly}
                  disabled={readOnly}
                  value={settings.defaultProposalTimeline}
                  onChange={(value) => patch({ defaultProposalTimeline: value })}
                />
                <TextArea
                  label="Default payment terms"
                  id="proposal-payment"
                  review={reviewOnly}
                  disabled={readOnly}
                  value={settings.defaultProposalPaymentTerms}
                  onChange={(value) => patch({ defaultProposalPaymentTerms: value })}
                />
                <TextArea
                  label="Default terms & conditions"
                  id="proposal-terms"
                  review={reviewOnly}
                  disabled={readOnly}
                  value={settings.defaultProposalTerms}
                  onChange={(value) => patch({ defaultProposalTerms: value })}
                />
                <TextArea
                  label="Default notes"
                  id="proposal-notes"
                  review={reviewOnly}
                  disabled={readOnly}
                  value={settings.defaultProposalNotes}
                  onChange={(value) => patch({ defaultProposalNotes: value })}
                />
              </FieldGroup>
              <FieldGroup title="Pricing">
                <p className="text-sm text-[var(--admin-muted)]">
                  Defaults for new proposals and newly added line items. Existing proposals, contracts, and invoices keep
                  the prices they were saved with.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <MoneySettingField
                    id="price-website"
                    label="Website"
                    hint="Default website line on a new proposal."
                    review={reviewOnly}
                    cents={settings.defaultProposalWebsiteCents}
                    onChange={(cents) => patch({ defaultProposalWebsiteCents: cents })}
                    disabled={readOnly}
                  />
                  <MoneySettingField
                    id="price-quote-form"
                    label="Quote Request Form"
                    review={reviewOnly}
                    cents={settings.defaultAddonQuoteRequestFormCents}
                    onChange={(cents) => patch({ defaultAddonQuoteRequestFormCents: cents })}
                    disabled={readOnly}
                  />
                  <MoneySettingField
                    id="price-booking"
                    label="Booking Form"
                    review={reviewOnly}
                    cents={settings.defaultAddonBookingFormCents}
                    onChange={(cents) => patch({ defaultAddonBookingFormCents: cents })}
                    disabled={readOnly}
                  />
                  <MoneySettingField
                    id="price-social"
                    label="Social Media Integration"
                    review={reviewOnly}
                    cents={settings.defaultAddonSocialMediaCents}
                    onChange={(cents) => patch({ defaultAddonSocialMediaCents: cents })}
                    disabled={readOnly}
                  />
                  <MoneySettingField
                    id="price-email"
                    label="Business Email"
                    review={reviewOnly}
                    cents={settings.defaultAddonBusinessEmailCents}
                    onChange={(cents) => patch({ defaultAddonBusinessEmailCents: cents })}
                    disabled={readOnly}
                  />
                  <MoneySettingField
                    id="price-domain"
                    label="Domain"
                    review={reviewOnly}
                    cents={settings.defaultAddonDomainCents}
                    onChange={(cents) => patch({ defaultAddonDomainCents: cents })}
                    disabled={readOnly}
                  />
                  <MoneySettingField
                    id="price-hosting"
                    label="Hosting Setup"
                    review={reviewOnly}
                    cents={settings.defaultAddonHostingSetupCents}
                    onChange={(cents) => patch({ defaultAddonHostingSetupCents: cents })}
                    disabled={readOnly}
                  />
                </div>
              </FieldGroup>
              <FieldGroup title="Contract">
                <TextArea
                  label="Default contract terms"
                  id="contract-terms"
                  review={reviewOnly}
                  disabled={readOnly}
                  value={settings.defaultContractTerms}
                  onChange={(value) => patch({ defaultContractTerms: value })}
                  tip="Applied to general terms on newly created contracts. Contracts created from an accepted proposal still copy scope, timeline, and payment terms from that proposal."
                />
              </FieldGroup>
              {showAgencySave ? (
                <SaveRow disabled={readOnly} busy={busy} dirty={agencyDirty} notice={saveNotice} onSave={() => void saveAgency()} />
              ) : null}
            </Card>
          ) : null}

          {!loading && settings && section === "portal" ? (
            <Card
              title="Client Portal"
              description="These settings affect what clients see after they sign in to the portal."
            >
              <TextArea
                label="Portal welcome message"
                id="portal-welcome"
                review={reviewOnly}
                disabled={readOnly}
                value={settings.clientPortalWelcomeMessage}
                onChange={(value) => patch({ clientPortalWelcomeMessage: value })}
                hint="Shown on the client Overview after you save."
              />
              {showAgencySave ? (
                <SaveRow disabled={readOnly} busy={busy} dirty={agencyDirty} notice={saveNotice} onSave={() => void saveAgency()} />
              ) : null}
            </Card>
          ) : null}

          {section === "notifications" ? (
            <Card
              title="Notifications"
              description="These are the in-app notifications already delivered for document, payment, file, and message activity. Individual event toggles are not available yet."
            >
              <ul className="space-y-2 text-sm text-[var(--admin-muted)]">
                {[
                  "Proposal accepted",
                  "Contract accepted",
                  "Invoice paid",
                  "Payment received",
                  "File feedback",
                  "Approval activity",
                  "New messages",
                  "Lead submissions",
                ].map((label) => (
                  <li
                    key={label}
                    className="flex items-center justify-between gap-3 rounded-lg border border-[var(--admin-line)] px-3 py-2"
                  >
                    <span className="text-[var(--admin-ink)]">{label}</span>
                    <StatusPill label="Coming later" tone="neutral" />
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {!loading && settings && section === "email" ? (
            <Card
              title="Email"
              description="These values control the name and addresses used on agency and document emails. Sending credentials stay on the server and are never shown here."
              badge={<StatusPill label={emailReady ? "Configured" : "Not configured"} tone={emailReady ? "ok" : "warn"} />}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <ValueField
                  label="From name"
                  htmlFor="email-from-name"
                  review={reviewOnly}
                  display={settings.emailFromName}
                  hint="Used on proposals, contracts, and invoices sent by email."
                >
                  <input
                    id="email-from-name"
                    disabled={readOnly}
                    className={fieldClass}
                    value={settings.emailFromName}
                    onChange={(e) => patch({ emailFromName: e.target.value })}
                  />
                </ValueField>
                <ValueField
                  label="From email"
                  htmlFor="email-from-address"
                  review={reviewOnly}
                  display={settings.emailFromAddress}
                  hint="Used on proposals, contracts, and invoices sent by email."
                >
                  <input
                    id="email-from-address"
                    type="email"
                    disabled={readOnly}
                    className={fieldClass}
                    value={settings.emailFromAddress}
                    onChange={(e) => patch({ emailFromAddress: e.target.value })}
                  />
                </ValueField>
                <ValueField
                  label="Reply-To"
                  htmlFor="email-reply"
                  review={reviewOnly}
                  display={settings.emailReplyTo}
                >
                  <input
                    id="email-reply"
                    type="email"
                    disabled={readOnly}
                    className={fieldClass}
                    value={settings.emailReplyTo}
                    onChange={(e) => patch({ emailReplyTo: e.target.value })}
                  />
                </ValueField>
                <ValueField
                  label="Support email"
                  htmlFor="email-support"
                  review={reviewOnly}
                  display={settings.supportEmail}
                  hint="Shown to clients in portal communication."
                >
                  <input
                    id="email-support"
                    type="email"
                    disabled={readOnly}
                    className={fieldClass}
                    value={settings.supportEmail}
                    onChange={(e) => patch({ supportEmail: e.target.value })}
                  />
                </ValueField>
              </div>
              <p className="text-xs text-[var(--admin-muted)]">
                Configured or not configured reflects the From and Reply-To values on this page. The sending provider
                is managed as a server secret, so this status does not confirm that email delivery is connected.
              </p>
              {showAgencySave ? (
                <SaveRow disabled={readOnly} busy={busy} dirty={agencyDirty} notice={saveNotice} onSave={() => void saveAgency()} />
              ) : null}
            </Card>
          ) : null}

          {!loading && settings && section === "invoices" ? (
            <Card
              title="Invoice Defaults"
              description="Used when creating a new invoice. You can edit the invoice before sending. Existing invoices, totals, payments, and Stripe transactions are not changed."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <ValueField
                  label="Default currency"
                  htmlFor="invoice-currency"
                  review={reviewOnly}
                  display={currencyOptionLabel(settings.currency)}
                  hint="This is the agency currency used for new invoices. Historical invoices keep the currency they were created with."
                >
                  <select
                    id="invoice-currency"
                    disabled={readOnly}
                    className={fieldClass}
                    value={settings.currency}
                    onChange={(e) => patch({ currency: e.target.value })}
                  >
                    {currencyOptions(settings.currency).map((code) => (
                      <option key={code} value={code}>
                        {currencyOptionLabel(code)}
                      </option>
                    ))}
                  </select>
                </ValueField>
                <ValueField
                  label="Default due period (days)"
                  htmlFor="invoice-due"
                  review={reviewOnly}
                  display={String(settings.defaultInvoiceDueDays)}
                >
                  <input
                    id="invoice-due"
                    type="number"
                    min={1}
                    max={365}
                    disabled={readOnly}
                    className={fieldClass}
                    value={settings.defaultInvoiceDueDays}
                    onChange={(e) => patch({ defaultInvoiceDueDays: Number(e.target.value) })}
                  />
                </ValueField>
              </div>
              <TextArea
                label="Default payment terms"
                id="invoice-terms"
                review={reviewOnly}
                disabled={readOnly}
                value={settings.defaultInvoicePaymentTerms}
                onChange={(value) => patch({ defaultInvoicePaymentTerms: value })}
              />
              <TextArea
                label="Default invoice notes"
                id="invoice-notes"
                review={reviewOnly}
                disabled={readOnly}
                value={settings.defaultInvoiceNotes}
                onChange={(value) => patch({ defaultInvoiceNotes: value })}
              />
              {showAgencySave ? (
                <SaveRow disabled={readOnly} busy={busy} dirty={agencyDirty} notice={saveNotice} onSave={() => void saveAgency()} />
              ) : null}
            </Card>
          ) : null}

          {section === "payments" ? (
            <Card
              title="Payment Settings"
              description="How client invoice payments are collected. This page does not change Checkout behavior or expose secret keys."
              badge={<StatusPill label={stripe.status} tone="neutral" />}
            >
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <InfoItem label="Processor" value={stripe.processor} />
                <InfoItem label="Status" value={stripe.status} />
              </dl>
              <p className="text-sm text-[var(--admin-muted)]">{stripe.detail}</p>
            </Card>
          ) : null}

          {section === "profile" ? (
            <Card
              title="My Profile"
              description="Your personal MotiveScripts account. These details are not agency-wide settings. Role and client assignment cannot be changed here."
              personal
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Name" htmlFor="profile-name">
                  <input
                    id="profile-name"
                    disabled={profileBusy}
                    className={fieldClass}
                    value={fullName}
                    onChange={(e) => {
                      setSaveNotice(null);
                      setFullName(e.target.value);
                    }}
                  />
                </Field>
                <Field label="Job title" htmlFor="profile-title">
                  <input
                    id="profile-title"
                    disabled={profileBusy}
                    className={fieldClass}
                    value={jobTitle}
                    onChange={(e) => {
                      setSaveNotice(null);
                      setJobTitle(e.target.value);
                    }}
                  />
                </Field>
                <Field label="Email" htmlFor="profile-email">
                  <input id="profile-email" readOnly className={fieldClass} value={profile?.email ?? ""} />
                </Field>
                <Field label="Role" htmlFor="profile-role">
                  <input id="profile-role" readOnly className={fieldClass} value={profile?.role ?? ""} />
                </Field>
              </div>
              <p className="text-xs text-[var(--admin-muted)]">
                Email changes are not supported from Settings. Magic-link sign-in uses the address on this account.
              </p>
              <SaveRow
                disabled={profileBusy}
                busy={profileBusy}
                dirty={profileDirty}
                notice={saveNotice}
                onSave={() => void saveProfile()}
              />
            </Card>
          ) : null}

          {section === "security" ? (
            <Card
              title="Security"
              description="Authentication for your personal account. MotiveScripts uses magic-link sign-in, so there is no password to change here."
              personal
            >
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <InfoItem label="Authentication method" value="Magic link" />
                <InfoItem label="Account email" value={profile?.email || "—"} />
                <InfoItem label="Session expires" value={sessionExpires || "Not available"} />
              </dl>
              <div className="flex justify-end">
                <button
                  type="button"
                  className={adminGhostBtn}
                  onClick={() => setConfirmSignOut(true)}
                >
                  Sign out
                </button>
              </div>
            </Card>
          ) : null}

          {section === "danger" ? (
            <Card
              title="Danger Zone"
              description="Permanent workspace actions. Download a copy first. These deletions remove test workspace records, including paid invoices and accepted documents. Delete entire agency also removes team accounts except the administrator who runs it. Settings stay. Stripe Dashboard history is not removed."
              danger
            >
              {!canEditAgency ? (
                <p className="text-sm text-[var(--admin-muted)]">Only administrators can run these actions.</p>
              ) : (
                <div className="space-y-5">
                  <div className="flex flex-col gap-3 rounded-lg border border-[var(--admin-line)] p-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="max-w-xl">
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-heading text-sm font-semibold text-[var(--admin-ink)]">
                          Download workspace data
                        </h3>
                        <AdminInfoTip
                          label="More about Download workspace data"
                          text="Downloads a JSON backup of leads, clients, projects, documents, invoices, payments, and messages. Project file binaries and invitation tokens are not included. Download this before deleting."
                          wide
                        />
                      </div>
                      <p className="mt-1 text-sm text-[var(--admin-muted)]">
                        Save a JSON copy of workspace records before you delete anything. This is the safe action.
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={busy || purgeBusy || exportBusy}
                      className={`${adminGhostBtn} shrink-0 justify-center`}
                      onClick={() => void runExport()}
                    >
                      {exportBusy ? "Preparing…" : "Download all data"}
                    </button>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#b42318]">
                      Permanent deletion
                    </p>
                    <p className="mt-1 text-sm text-[var(--admin-muted)]">
                      Each action asks you to type a confirmation phrase. This cannot be undone from MotiveScripts.
                    </p>
                    <div className="mt-3 divide-y divide-[rgb(180_35_24_/_0.16)] rounded-lg border border-[rgb(180_35_24_/_0.22)] px-4">
                      {dangerActions.map((action) => (
                        <div
                          key={action.scope}
                          className="flex flex-col gap-3 py-4 first:pt-4 last:pb-4 sm:flex-row sm:items-start sm:justify-between"
                        >
                          <div className="max-w-xl">
                            <div className="flex items-center gap-1.5">
                              <h3 className="font-heading text-sm font-semibold text-[#b42318]">{action.title}</h3>
                              <AdminInfoTip label={`More about ${action.title}`} text={action.tip} wide />
                            </div>
                            <p className="mt-1 text-sm text-[var(--admin-muted)]">{action.description}</p>
                          </div>
                          <button
                            type="button"
                            disabled={busy || purgeBusy || exportBusy}
                            className={`${adminDangerBtn} shrink-0 justify-center`}
                            onClick={() => {
                              setPurgeTyped("");
                              setPurgeScope(action.scope);
                            }}
                          >
                            {action.button}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </Card>
          ) : null}
        </div>
      </div>

      <AdminDialog
        open={purgeScope !== null}
        busy={purgeBusy}
        title={
          purgeScope
            ? `${dangerActions.find((action) => action.scope === purgeScope)?.title ?? "Confirm"} — this cannot be undone`
            : "Confirm"
        }
        description={purgeScope ? dangerActions.find((action) => action.scope === purgeScope)?.confirm : undefined}
        onClose={() => {
          if (!purgeBusy) {
            setPurgeScope(null);
            setPurgeTyped("");
          }
        }}
      >
        {purgeScope ? (
          <div className="space-y-4">
            <button
              type="button"
              disabled={purgeBusy || exportBusy}
              className={`${adminGhostBtn} w-full justify-center`}
              onClick={() => void runExport()}
            >
              {exportBusy ? "Preparing…" : "Download all data first"}
            </button>
            <label className="block text-sm font-semibold text-[var(--admin-ink)]">
              Type {WORKSPACE_PURGE_CONFIRMATION[purgeScope]} to confirm
              <input
                autoComplete="off"
                disabled={purgeBusy}
                className={fieldClass}
                value={purgeTyped}
                onChange={(event) => setPurgeTyped(event.target.value)}
              />
            </label>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={purgeBusy}
                className={`${adminGhostBtn} justify-center`}
                onClick={() => {
                  setPurgeScope(null);
                  setPurgeTyped("");
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={purgeBusy || purgeTyped.trim() !== WORKSPACE_PURGE_CONFIRMATION[purgeScope]}
                className={`${adminDangerSolidBtn} justify-center`}
                onClick={() => void runPurge(purgeScope)}
              >
                {purgeBusy ? "Deleting…" : "Delete permanently"}
              </button>
            </div>
          </div>
        ) : null}
      </AdminDialog>

      <ConfirmSignOutModal
        open={confirmSignOut}
        busy={signingOut}
        onClose={() => {
          if (signingOut) return;
          setConfirmSignOut(false);
        }}
        onConfirm={() => {
          if (signingOut) return;
          setSigningOut(true);
          void signOut().then(() => navigate("/login"));
        }}
      />

      <ConfirmDocumentModal
        open={pendingSection !== null}
        title="Unsaved changes"
        description="You have unsaved settings. Leave this section without saving?"
        actionLabel="Discard changes"
        danger
        onClose={() => setPendingSection(null)}
        onConfirm={() => {
          if (settings) {
            const parsed = savedSnap
              ? (JSON.parse(savedSnap) as Omit<AgencySettings, "logoUrl" | "updatedAt" | "updatedBy">)
              : null;
            if (parsed) setSettings({ ...settings, ...parsed });
          }
          setFullName(profile?.fullName ?? "");
          setJobTitle(profile?.jobTitle ?? "");
          setAgencyFieldErrors({});
          setSaveNotice(null);
          if (pendingSection) goToSection(pendingSection);
          setPendingSection(null);
        }}
      />
    </div>
  );
}

const dangerActions: {
  scope: WorkspacePurgeScope;
  title: string;
  button: string;
  description: string;
  tip: string;
  confirm: string;
}[] = [
  {
    scope: "projects",
    title: "Delete all projects",
    button: "Delete all projects",
    description:
      "Permanently removes every project and its files, tasks, messages, and activity — including work that already has invoices or signed documents.",
    tip: "Deletes projects, files, tasks, milestones, project conversations, and activity. Clients, leads, proposals, contracts, and invoices stay. Paid or accepted documents keep their client and lose the project link so this cannot fail on a progressed project.",
    confirm:
      "This permanently deletes every project and its files, tasks, and activity. Proposals, contracts, and invoices are kept and unlinked from those projects, even if they are sent, accepted, or paid.",
  },
  {
    scope: "clients",
    title: "Delete all clients",
    button: "Delete all clients",
    description:
      "Permanently removes every client, the records they own, and their portal Auth accounts — including paid invoices and accepted documents.",
    tip: "Deletes every client plus their projects, scope briefs, files, messages, proposals, contracts, invoices, and payment records in this workspace. Client portal Auth accounts are deleted so you can invite the same email again. Leads, team members, and Settings stay. Stripe Dashboard charges are not refunded.",
    confirm:
      "This permanently deletes every client, their documents, invoices, payments, files, messages, and portal accounts. Paid and accepted records are included. Team accounts and Settings stay. Stripe test payments remain in Stripe.",
  },
  {
    scope: "agency",
    title: "Delete entire agency",
    button: "Delete entire agency",
    description: "The strongest test-workspace reset. Wipes client data and team accounts so you can run the commercial workflow again from a clean state.",
    tip: "Deletes leads, clients, projects, scope briefs, files, messages, proposals, contracts, invoices, payment records, client portal accounts, team members, and pending staff invitations. Your signed-in admin account and Settings stay. Document numbers reset. Stripe Dashboard history is not refunded or removed.",
    confirm:
      "This permanently deletes all clients, projects, proposals, contracts, invoices, payments, files, messages, portal accounts, and team accounts. Your admin account and Settings will remain.",
  },
];

function sectionNeedsSettings(section: SettingsSectionId) {
  return ["agency", "branding", "documents", "portal", "email", "invoices"].includes(section);
}

function timezoneOptions(current: string) {
  return SETTINGS_TIMEZONES.includes(current as (typeof SETTINGS_TIMEZONES)[number])
    ? [...SETTINGS_TIMEZONES]
    : [current, ...SETTINGS_TIMEZONES];
}

function currencyOptions(current: string) {
  const code = current.toUpperCase();
  return SETTINGS_CURRENCIES.includes(code as (typeof SETTINGS_CURRENCIES)[number])
    ? [...SETTINGS_CURRENCIES]
    : [code, ...SETTINGS_CURRENCIES];
}

function safeColor(value: string, fallback = "#0050f0") {
  return /^#[0-9A-Fa-f]{6}$/.test(value) ? value : fallback;
}

function formatNowInTimezone(zone: string, now = Date.now()) {
  try {
    const date = new Date(now);
    const day = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(date);
    const time = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
    return `${day} · ${time}`;
  } catch {
    return null;
  }
}

function collectAgencyProfileErrors(settings: AgencySettings) {
  const errors: Partial<Record<"agencyName" | "businessEmail" | "supportEmail" | "website", string>> = {};
  if (!settings.agencyName.trim()) errors.agencyName = "Enter the agency name.";
  if (!settings.businessEmail.trim() || !isSettingsEmail(settings.businessEmail)) {
    errors.businessEmail = "Enter a valid business email.";
  }
  if (!settings.supportEmail.trim() || !isSettingsEmail(settings.supportEmail)) {
    errors.supportEmail = "Enter a valid support email.";
  }
  if (settings.website.trim() && !isPlausibleWebsite(settings.website)) {
    errors.website = "Enter a valid website such as https://example.com.";
  }
  return errors;
}

function Card({
  title,
  description,
  children,
  danger,
  personal,
  badge,
}: {
  title: string;
  description: string;
  children: ReactNode;
  danger?: boolean;
  personal?: boolean;
  badge?: ReactNode;
}) {
  return (
    <section
      className={cn(
        "space-y-4 rounded-[var(--admin-radius)] border bg-[var(--admin-card)] p-5 md:p-6",
        danger ? "border-[rgb(180_35_24_/_0.28)]" : "border-[var(--admin-line)]",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {personal ? (
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--admin-blue)]">
              Your account
            </p>
          ) : null}
          <h2 className={cn("font-heading text-lg font-semibold tracking-tight", danger && "text-[#b42318]")}>
            {title}
          </h2>
          <p className="mt-1 text-sm text-[var(--admin-muted)]">{description}</p>
        </div>
        {badge}
      </div>
      {children}
    </section>
  );
}

function FieldGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-4 rounded-lg border border-[var(--admin-line)] p-4">
      <h3 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">{title}</h3>
      {children}
    </div>
  );
}

function Field({
  label,
  htmlFor,
  tip,
  hint,
  error,
  optional,
  children,
}: {
  label: string;
  htmlFor: string;
  tip?: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  children: ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-semibold text-[var(--admin-ink)]">
      <span className="inline-flex items-center gap-1.5">
        {label}
        {optional ? <span className="text-xs font-normal text-[var(--admin-muted)]">Optional</span> : null}
        {tip ? <AdminInfoTip text={tip} /> : null}
      </span>
      {children}
      {error ? (
        <span className="mt-1 block text-xs font-medium text-[#b42318]">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-xs font-normal text-[var(--admin-muted)]">{hint}</span>
      ) : null}
    </label>
  );
}

function ReviewField({
  label,
  value,
  hint,
  optional,
}: {
  label: string;
  value: string;
  hint?: string;
  optional?: boolean;
}) {
  return (
    <div>
      <p className="text-sm font-semibold text-[var(--admin-ink)]">
        {label}
        {optional ? <span className="ml-1.5 text-xs font-normal text-[var(--admin-muted)]">Optional</span> : null}
      </p>
      <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--admin-ink)]">{value.trim() || "—"}</p>
      {hint ? <p className="mt-1 text-xs text-[var(--admin-muted)]">{hint}</p> : null}
    </div>
  );
}

function ValueField({
  label,
  htmlFor,
  tip,
  hint,
  error,
  optional,
  review,
  display,
  children,
}: {
  label: string;
  htmlFor: string;
  tip?: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  review: boolean;
  display: string;
  children: ReactNode;
}) {
  if (review) return <ReviewField label={label} value={display} hint={hint} optional={optional} />;
  return (
    <Field label={label} htmlFor={htmlFor} tip={tip} hint={hint} error={error} optional={optional}>
      {children}
    </Field>
  );
}

function MoneySettingField({
  id,
  label,
  hint,
  review,
  cents,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  review: boolean;
  cents: number;
  disabled: boolean;
  onChange: (cents: number) => void;
}) {
  return (
    <ValueField label={label} htmlFor={id} review={review} display={formatUsdFromCents(cents)} hint={hint}>
      <input
        id={id}
        inputMode="decimal"
        disabled={disabled}
        value={centsInputValue(cents)}
        onChange={(event) => {
          const next = parseDollarsToCents(event.target.value);
          if (next == null) return;
          onChange(next);
        }}
        className={fieldClass}
        aria-describedby={hint ? `${id}-hint` : undefined}
      />
    </ValueField>
  );
}

function TextArea({
  label,
  id,
  value,
  disabled,
  onChange,
  tip,
  hint,
  review = false,
}: {
  label: string;
  id: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
  tip?: string;
  hint?: string;
  review?: boolean;
}) {
  if (review) return <ReviewField label={label} value={value} hint={hint} />;
  return (
    <Field label={label} htmlFor={id} tip={tip} hint={hint}>
      <textarea id={id} rows={5} disabled={disabled} className={fieldClass} value={value} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

function SaveRow({
  disabled,
  busy,
  dirty,
  notice,
  onSave,
}: {
  disabled: boolean;
  busy: boolean;
  dirty: boolean;
  notice: SaveNotice | null;
  onSave: () => void;
}) {
  const status =
    busy ? "Saving…" : dirty ? "Unsaved changes" : notice?.tone === "ok" || notice?.tone === "error" ? notice.message : null;
  return (
    <div className="flex flex-col gap-3 border-t border-[var(--admin-line)] pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p
        role="status"
        className={cn(
          "text-sm",
          notice?.tone === "error" && !dirty
            ? "font-semibold text-[#b42318]"
            : notice?.tone === "ok" && !dirty
              ? "font-semibold text-[#0f7a56]"
              : dirty
                ? "font-semibold text-[var(--admin-ink)]"
                : "text-[var(--admin-muted)]",
        )}
      >
        {status}
      </p>
      <button type="button" disabled={disabled || !dirty} className={`${adminPrimaryBtn} justify-center`} onClick={onSave}>
        {busy ? "Saving…" : "Save Changes"}
      </button>
    </div>
  );
}

function StatusPill({ label, tone }: { label: string; tone: "ok" | "warn" | "neutral" | "danger" }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 font-heading text-[11px] font-semibold tracking-tight",
        tone === "ok" && "bg-[rgb(16_185_129_/_0.1)] text-[#0f7a56]",
        tone === "warn" && "bg-[rgb(245_158_11_/_0.12)] text-[#b45309]",
        tone === "neutral" && "bg-[rgb(7_17_31_/_0.06)] text-[#667085]",
        tone === "danger" && "bg-[rgb(220_38_38_/_0.08)] text-[#b42318]",
      )}
    >
      {label}
    </span>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--admin-line)] px-3 py-2">
      <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--admin-muted)]">{label}</dt>
      <dd className="mt-1 text-[var(--admin-ink)]">{value}</dd>
    </div>
  );
}
