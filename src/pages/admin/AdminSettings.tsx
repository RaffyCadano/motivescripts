import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { isActiveAdmin } from "@/auth/permissions";
import { AdminInfoTip } from "@/components/admin/AdminInfoTip";
import { AdminDialog } from "@/components/admin/leads/AdminDialog";
import { adminDangerBtn, adminDangerSolidBtn, adminGhostBtn, adminPrimaryBtn } from "@/components/admin/adminActionStyles";
import { BrandMark } from "@/components/BrandMark";
import { ConfirmDocumentModal } from "@/components/documents/ConfirmDocumentModal";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import {
  SETTINGS_CURRENCIES,
  SETTINGS_TIMEZONES,
  WORKSPACE_PURGE_CONFIRMATION,
  isSettingsSectionId,
  settingsNavGroups,
  stripeProcessorLabel,
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
import { AgencyDbError } from "@/lib/dbErrors";
import { cn } from "@/lib/cn";
import { useMessaging } from "@/providers/MessagingProvider";

const fieldClass =
  "mt-1.5 w-full rounded-lg border border-[var(--admin-line)] bg-white px-3 py-2 text-sm text-[var(--admin-ink)] outline-none focus:border-[rgb(0_80_240_/_0.45)] disabled:bg-[var(--admin-bg)]";

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
    setSection(next);
    window.history.replaceState(null, "", `#${next}`);
    document.getElementById("admin-main")?.scrollTo({ top: 0 });
  }

  async function saveAgency() {
    if (!settings || !canEditAgency || busy) return;
    const invalid = validateAgencySettings(settings);
    if (invalid) {
      notify(invalid);
      return;
    }
    setBusy(true);
    try {
      const saved = await saveAgencySettings(settings);
      setSettings(saved);
      setSavedSnap(snapshotOf(saved));
      notify("Settings saved.");
    } catch (error) {
      notify(error instanceof AgencyDbError ? error.message : "Unable to save settings.");
    } finally {
      setBusy(false);
    }
  }

  async function saveProfile() {
    if (!profile || profileBusy) return;
    if (!fullName.trim()) {
      notify("Enter your name.");
      return;
    }
    setProfileBusy(true);
    try {
      await updateOwnProfile({ fullName: fullName.trim(), jobTitle: jobTitle.trim() });
      await refreshProfile();
      notify("Profile saved.");
    } catch (error) {
      notify(error instanceof AgencyDbError ? error.message : "Unable to update your profile.");
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
    setSettings((current) => (current ? { ...current, ...partial } : current));
  }

  const readOnly = !canEditAgency || busy || !settings;

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
            : "Workspace records were deleted.",
      );
      navigate("/admin");
      await Promise.all([reload(), messaging.reload()]);
    } catch (error) {
      notify(error instanceof AgencyDbError ? error.message : "Unable to complete this workspace action.");
    } finally {
      setPurgeBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-[1.65rem] font-semibold tracking-tight md:text-3xl">Settings</h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--admin-muted)]">
          Agency configuration for MotiveScripts. Staff can review these values. Only administrators can change
          workspace settings.
        </p>
      </div>

      {agencyDirty || profileDirty ? (
        <p className="rounded-[var(--admin-radius)] border border-[rgb(0_80_240_/_0.22)] bg-[rgb(0_80_240_/_0.06)] px-4 py-3 text-sm text-[var(--admin-ink)]">
          You have unsaved changes.
        </p>
      ) : null}

      {!canEditAgency ? (
        <p className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] px-4 py-3 text-sm text-[var(--admin-muted)]">
          Agency settings are read-only for staff. You can update My Profile and sign out from Security.
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
              <optgroup key={group.label} label={group.label}>
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

      <div className="grid gap-6 lg:grid-cols-[13.5rem_minmax(0,1fr)]">
        <nav
          className="hidden lg:block lg:self-start lg:sticky lg:top-0"
          aria-label="Settings sections"
        >
          <div className="space-y-5">
            {settingsNavGroups.map((group) => (
              <div key={group.label}>
                <p className="px-2.5 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--admin-muted)]">
                  {group.label}
                </p>
                <div className="flex flex-col gap-0.5">
                  {group.items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => requestSection(item.id)}
                      className={cn(
                        "rounded-lg px-2.5 py-2 text-left text-[13px] font-medium tracking-tight",
                        section === item.id
                          ? "bg-[var(--admin-hover)] text-[var(--admin-blue)]"
                          : "text-[var(--admin-ink)]/75 hover:bg-[var(--admin-bg)] hover:text-[var(--admin-ink)]",
                      )}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
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
              description="Identity used as the source of truth for configurable agency values."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Agency name" htmlFor="agency-name">
                  <input id="agency-name" disabled={readOnly} className={fieldClass} value={settings.agencyName} onChange={(e) => patch({ agencyName: e.target.value })} />
                </Field>
                <Field label="Business email" htmlFor="business-email">
                  <input id="business-email" type="email" disabled={readOnly} className={fieldClass} value={settings.businessEmail} onChange={(e) => patch({ businessEmail: e.target.value })} />
                </Field>
                <Field label="Phone" htmlFor="agency-phone">
                  <input id="agency-phone" disabled={readOnly} className={fieldClass} value={settings.phone} onChange={(e) => patch({ phone: e.target.value })} />
                </Field>
                <Field label="Website" htmlFor="agency-website">
                  <input id="agency-website" disabled={readOnly} className={fieldClass} value={settings.website} onChange={(e) => patch({ website: e.target.value })} />
                </Field>
                <Field label="Timezone" htmlFor="agency-timezone">
                  <select id="agency-timezone" disabled={readOnly} className={fieldClass} value={settings.timezone} onChange={(e) => patch({ timezone: e.target.value })}>
                    {timezoneOptions(settings.timezone).map((zone) => (
                      <option key={zone} value={zone}>{zone}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Currency" htmlFor="agency-currency">
                  <select id="agency-currency" disabled={readOnly} className={fieldClass} value={settings.currency} onChange={(e) => patch({ currency: e.target.value })}>
                    {currencyOptions(settings.currency).map((code) => (
                      <option key={code} value={code}>{code}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Support email" htmlFor="support-email">
                  <input id="support-email" type="email" disabled={readOnly} className={fieldClass} value={settings.supportEmail} onChange={(e) => patch({ supportEmail: e.target.value })} />
                </Field>
              </div>
              <Field label="Business address" htmlFor="agency-address">
                <textarea id="agency-address" rows={3} disabled={readOnly} className={fieldClass} value={settings.address} onChange={(e) => patch({ address: e.target.value })} />
              </Field>
              <SaveRow disabled={readOnly} busy={busy} dirty={agencyDirty} onSave={() => void saveAgency()} />
            </Card>
          ) : null}

          {!loading && settings && section === "branding" ? (
            <Card
              title="Branding"
              description="Colors are stored for future document use. The current MotiveScripts mark stays in PDFs, emails, and the Admin UI."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Primary brand color"
                  htmlFor="primary-color"
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
                    <input disabled={readOnly} className={fieldClass + " mt-0"} value={settings.primaryColor} onChange={(e) => patch({ primaryColor: e.target.value })} />
                  </div>
                </Field>
                <Field label="Secondary brand color" htmlFor="secondary-color">
                  <div className="mt-1.5 flex gap-2">
                    <input
                      id="secondary-color"
                      type="color"
                      disabled={readOnly}
                      value={safeColor(settings.secondaryColor, "#001030")}
                      onChange={(e) => patch({ secondaryColor: e.target.value })}
                      className="h-10 w-14 cursor-pointer rounded-lg border border-[var(--admin-line)] bg-white p-1"
                    />
                    <input disabled={readOnly} className={fieldClass + " mt-0"} value={settings.secondaryColor} onChange={(e) => patch({ secondaryColor: e.target.value })} />
                  </div>
                </Field>
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--admin-ink)]">Preview</p>
                <div className="mt-2 space-y-3 rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-bg)] p-4">
                  <div className="flex items-center gap-3 border-b-2 pb-3" style={{ borderColor: safeColor(settings.primaryColor) }}>
                    <BrandMark className="h-8 w-auto" decorative />
                    <div>
                      <p className="font-heading text-sm font-semibold" style={{ color: safeColor(settings.secondaryColor, "#001030") }}>
                        {settings.agencyName || "MotiveScripts"}
                      </p>
                      <p className="text-xs text-[var(--admin-muted)]">{settings.supportEmail}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <BrandMark className="h-7 w-auto" decorative />
                    <span className="text-sm text-[var(--admin-muted)]">Current logo (bundled mark)</span>
                  </div>
                  <button
                    type="button"
                    className="inline-flex h-9 items-center rounded-[var(--admin-radius)] px-3 text-sm font-semibold text-white"
                    style={{ background: safeColor(settings.primaryColor) }}
                  >
                    Sample button
                  </button>
                </div>
                <p className="mt-2 text-xs text-[var(--admin-muted)]">
                  Logo upload is not available in this phase. Storage and the bundled PDF/email logo are unchanged.
                </p>
              </div>
              <SaveRow disabled={readOnly} busy={busy} dirty={agencyDirty} onSave={() => void saveAgency()} />
            </Card>
          ) : null}

          {!loading && settings && section === "documents" ? (
            <Card
              title="Document defaults"
              description="These values fill empty fields on newly created documents only. Existing proposals, contracts, invoices, and published revisions stay as they are."
            >
              <p className="text-sm font-semibold text-[var(--admin-ink)]">Proposal</p>
              <Field label="Default validity (days)" htmlFor="proposal-days">
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
              </Field>
              <TextArea label="Default introduction" id="proposal-intro" disabled={readOnly} value={settings.defaultProposalIntroduction} onChange={(value) => patch({ defaultProposalIntroduction: value })} />
              <TextArea label="Default project overview" id="proposal-overview" disabled={readOnly} value={settings.defaultProposalOverview} onChange={(value) => patch({ defaultProposalOverview: value })} />
              <TextArea label="Default scope" id="proposal-scope" disabled={readOnly} value={settings.defaultProposalScope} onChange={(value) => patch({ defaultProposalScope: value })} />
              <TextArea label="Default deliverables" id="proposal-deliverables" disabled={readOnly} value={settings.defaultProposalDeliverables} onChange={(value) => patch({ defaultProposalDeliverables: value })} />
              <TextArea label="Default timeline" id="proposal-timeline" disabled={readOnly} value={settings.defaultProposalTimeline} onChange={(value) => patch({ defaultProposalTimeline: value })} />
              <TextArea label="Default payment terms" id="proposal-payment" disabled={readOnly} value={settings.defaultProposalPaymentTerms} onChange={(value) => patch({ defaultProposalPaymentTerms: value })} />
              <TextArea label="Default terms & conditions" id="proposal-terms" disabled={readOnly} value={settings.defaultProposalTerms} onChange={(value) => patch({ defaultProposalTerms: value })} />
              <TextArea label="Default notes" id="proposal-notes" disabled={readOnly} value={settings.defaultProposalNotes} onChange={(value) => patch({ defaultProposalNotes: value })} />
              <p className="pt-2 text-sm font-semibold text-[var(--admin-ink)]">Contract</p>
              <TextArea
                label="Default contract terms"
                id="contract-terms"
                disabled={readOnly}
                value={settings.defaultContractTerms}
                onChange={(value) => patch({ defaultContractTerms: value })}
                tip="Applied to general terms on newly created contracts. Contracts created from an accepted proposal still copy scope, timeline, and payment terms from that proposal."
              />
              <SaveRow disabled={readOnly} busy={busy} dirty={agencyDirty} onSave={() => void saveAgency()} />
            </Card>
          ) : null}

          {!loading && settings && section === "portal" ? (
            <Card
              title="Client Portal"
              description="The welcome message appears on the client Overview after this setting is saved."
            >
              <TextArea
                label="Portal welcome message"
                id="portal-welcome"
                disabled={readOnly}
                value={settings.clientPortalWelcomeMessage}
                onChange={(value) => patch({ clientPortalWelcomeMessage: value })}
              />
              <SaveRow disabled={readOnly} busy={busy} dirty={agencyDirty} onSave={() => void saveAgency()} />
            </Card>
          ) : null}

          {section === "notifications" ? (
            <Card
              title="Notification preferences"
              description="In-app notifications already deliver for document, payment, file, and message activity. Per-event opt-out is not wired yet."
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
                    className="flex items-center justify-between rounded-lg border border-[var(--admin-line)] bg-[var(--admin-bg)] px-3 py-2"
                  >
                    <span className="text-[var(--admin-ink)]">{label}</span>
                    <span className="text-xs font-semibold uppercase tracking-[0.12em]">Coming later</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {!loading && settings && section === "email" ? (
            <Card
              title="Email"
              description="These are display and configuration values only. Email provider API keys and other sending secrets stay in Supabase Edge Function secrets."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="From name" htmlFor="email-from-name">
                  <input id="email-from-name" disabled={readOnly} className={fieldClass} value={settings.emailFromName} onChange={(e) => patch({ emailFromName: e.target.value })} />
                </Field>
                <Field label="From email" htmlFor="email-from-address">
                  <input id="email-from-address" type="email" disabled={readOnly} className={fieldClass} value={settings.emailFromAddress} onChange={(e) => patch({ emailFromAddress: e.target.value })} />
                </Field>
                <Field label="Reply-To" htmlFor="email-reply">
                  <input id="email-reply" type="email" disabled={readOnly} className={fieldClass} value={settings.emailReplyTo} onChange={(e) => patch({ emailReplyTo: e.target.value })} />
                </Field>
                <Field label="Support email" htmlFor="email-support">
                  <input id="email-support" type="email" disabled={readOnly} className={fieldClass} value={settings.supportEmail} onChange={(e) => patch({ supportEmail: e.target.value })} />
                </Field>
              </div>
              <p className="text-xs text-[var(--admin-muted)]">
                document-email and invitation functions still send with RESEND_FROM and SUPPORT_EMAIL until those
                functions are updated to read these values. Changing a field here does not rotate API keys.
              </p>
              <SaveRow disabled={readOnly} busy={busy} dirty={agencyDirty} onSave={() => void saveAgency()} />
            </Card>
          ) : null}

          {!loading && settings && section === "invoices" ? (
            <Card
              title="Invoice defaults"
              description="Used when creating a new invoice. Existing invoices, totals, payments, and Stripe transactions are not changed."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Default currency" htmlFor="invoice-currency">
                  <select id="invoice-currency" disabled={readOnly} className={fieldClass} value={settings.currency} onChange={(e) => patch({ currency: e.target.value })}>
                    {currencyOptions(settings.currency).map((code) => (
                      <option key={code} value={code}>{code}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Default due period (days)" htmlFor="invoice-due">
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
                </Field>
              </div>
              <TextArea label="Default payment terms" id="invoice-terms" disabled={readOnly} value={settings.defaultInvoicePaymentTerms} onChange={(value) => patch({ defaultInvoicePaymentTerms: value })} />
              <TextArea label="Default invoice notes" id="invoice-notes" disabled={readOnly} value={settings.defaultInvoiceNotes} onChange={(value) => patch({ defaultInvoiceNotes: value })} />
              <SaveRow disabled={readOnly} busy={busy} dirty={agencyDirty} onSave={() => void saveAgency()} />
            </Card>
          ) : null}

          {section === "payments" ? (
            <Card
              title="Payment settings"
              description="Visibility only. Stripe Checkout architecture is unchanged."
            >
              <dl className="grid gap-3 text-sm">
                <div className="rounded-lg border border-[var(--admin-line)] bg-[var(--admin-bg)] px-3 py-2">
                  <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--admin-muted)]">Processor</dt>
                  <dd className="mt-1 font-heading font-semibold text-[var(--admin-ink)]">{stripe.processor}</dd>
                </div>
                <div className="rounded-lg border border-[var(--admin-line)] bg-[var(--admin-bg)] px-3 py-2">
                  <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--admin-muted)]">Status</dt>
                  <dd className="mt-1 font-heading font-semibold text-[var(--admin-ink)]">{stripe.status}</dd>
                </div>
              </dl>
              <p className="text-sm text-[var(--admin-muted)]">{stripe.detail}</p>
            </Card>
          ) : null}

          {section === "profile" ? (
            <Card title="My Profile" description="Your MotiveScripts account. Role and client assignment cannot be changed here.">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Name" htmlFor="profile-name">
                  <input id="profile-name" disabled={profileBusy} className={fieldClass} value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </Field>
                <Field label="Job title" htmlFor="profile-title">
                  <input id="profile-title" disabled={profileBusy} className={fieldClass} value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
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
              <div className="flex justify-end">
                <button type="button" disabled={profileBusy || !profileDirty} className={adminPrimaryBtn} onClick={() => void saveProfile()}>
                  {profileBusy ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </Card>
          ) : null}

          {section === "security" ? (
            <Card title="Security" description="MotiveScripts uses magic-link authentication. There is no password to change.">
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <InfoItem label="Authentication method" value="Magic link" />
                <InfoItem label="Account email" value={profile?.email || "—"} />
                <InfoItem label="Session expires" value={sessionExpires || "Not available"} />
              </dl>
              <div className="flex justify-end">
                <button
                  type="button"
                  className={adminGhostBtn}
                  onClick={() => {
                    void signOut().then(() => navigate("/login"));
                  }}
                >
                  Sign out
                </button>
              </div>
            </Card>
          ) : null}

          {section === "danger" ? (
            <Card
              title="Danger Zone"
              description="These actions permanently remove test workspace records, including paid invoices and accepted documents. Team accounts and Settings are not deleted. Stripe Dashboard history is not removed."
              danger
            >
              {!canEditAgency ? (
                <p className="text-sm text-[var(--admin-muted)]">Only administrators can run these actions.</p>
              ) : (
                <div className="divide-y divide-[var(--admin-line)]">
                  {dangerActions.map((action) => (
                    <div key={action.scope} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between">
                      <div className="max-w-xl">
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-heading text-sm font-semibold text-[var(--admin-ink)]">{action.title}</h3>
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
                  <div className="flex flex-col gap-3 py-4 last:pb-0 sm:flex-row sm:items-start sm:justify-between">
                    <div className="max-w-xl">
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-heading text-sm font-semibold text-[var(--admin-ink)]">Download workspace data</h3>
                        <AdminInfoTip
                          label="More about Download workspace data"
                          text="Downloads a JSON backup of leads, clients, projects, documents, invoices, payments, and messages. Project file binaries and invitation tokens are not included. Download this before deleting."
                          wide
                        />
                      </div>
                      <p className="mt-1 text-sm text-[var(--admin-muted)]">
                        Save a JSON copy of workspace records before you delete anything.
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
                </div>
              )}
            </Card>
          ) : null}
        </div>
      </div>

      <AdminDialog
        open={purgeScope !== null}
        busy={purgeBusy}
        title={purgeScope ? dangerActions.find((action) => action.scope === purgeScope)?.title ?? "Confirm" : "Confirm"}
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

      <ConfirmDocumentModal
        open={pendingSection !== null}
        title="Discard unsaved changes?"
        description="You have unsaved settings. Leave this section without saving?"
        actionLabel="Discard changes"
        danger
        onClose={() => setPendingSection(null)}
        onConfirm={() => {
          if (settings) {
            const parsed = savedSnap ? (JSON.parse(savedSnap) as Omit<AgencySettings, "logoUrl" | "updatedAt" | "updatedBy">) : null;
            if (parsed) setSettings({ ...settings, ...parsed });
          }
          setFullName(profile?.fullName ?? "");
          setJobTitle(profile?.jobTitle ?? "");
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
    description: "Permanently removes every project and its files, tasks, messages, and activity — including work that already has invoices or signed documents.",
    tip: "Deletes projects, files, tasks, milestones, project conversations, and activity. Clients, leads, proposals, contracts, and invoices stay. Paid or accepted documents keep their client and lose the project link so this cannot fail on a progressed project.",
    confirm:
      "This permanently deletes every project and its files, tasks, and activity. Proposals, contracts, and invoices are kept and unlinked from those projects, even if they are sent, accepted, or paid.",
  },
  {
    scope: "clients",
    title: "Delete all clients",
    button: "Delete all clients",
    description: "Permanently removes every client, the records they own, and their portal Auth accounts — including paid invoices and accepted documents.",
    tip: "Deletes every client plus their projects, scope briefs, files, messages, proposals, contracts, invoices, and payment records in this workspace. Client portal Auth accounts are deleted so you can invite the same email again. Leads, team members, and Settings stay. Stripe Dashboard charges are not refunded.",
    confirm:
      "This permanently deletes every client, their documents, invoices, payments, files, messages, and portal accounts. Paid and accepted records are included. Team accounts and Settings stay. Stripe test payments remain in Stripe.",
  },
  {
    scope: "agency",
    title: "Delete entire agency",
    button: "Delete entire agency",
    description: "The strongest test-workspace reset. Wipes client data so you can run the commercial workflow again from a clean state.",
    tip: "Deletes leads, clients, projects, scope briefs, files, messages, proposals, contracts, invoices, payment records, and client portal Auth accounts. Team accounts and Settings stay. Document numbers reset. Stripe Dashboard history is not refunded or removed.",
    confirm:
      "This permanently deletes all clients, projects, proposals, contracts, invoices, payments, files, messages, and portal accounts. Team accounts and Settings will remain.",
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

function Card({
  title,
  description,
  children,
  danger,
}: {
  title: string;
  description: string;
  children: ReactNode;
  danger?: boolean;
}) {
  return (
    <section
      className={cn(
        "space-y-4 rounded-[var(--admin-radius)] border bg-[var(--admin-card)] p-5 md:p-6",
        danger ? "border-[rgb(180_35_24_/_0.28)]" : "border-[var(--admin-line)]",
      )}
    >
      <div>
        <h2 className={cn("font-heading text-lg font-semibold tracking-tight", danger && "text-[#b42318]")}>{title}</h2>
        <p className="mt-1 text-sm text-[var(--admin-muted)]">{description}</p>
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  htmlFor,
  tip,
  children,
}: {
  label: string;
  htmlFor: string;
  tip?: string;
  children: ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-semibold text-[var(--admin-ink)]">
      <span className="inline-flex items-center gap-1.5">
        {label}
        {tip ? <AdminInfoTip text={tip} /> : null}
      </span>
      {children}
    </label>
  );
}

function TextArea({
  label,
  id,
  value,
  disabled,
  onChange,
  tip,
}: {
  label: string;
  id: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
  tip?: string;
}) {
  return (
    <Field label={label} htmlFor={id} tip={tip}>
      <textarea id={id} rows={5} disabled={disabled} className={fieldClass} value={value} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

function SaveRow({
  disabled,
  busy,
  dirty,
  onSave,
}: {
  disabled: boolean;
  busy: boolean;
  dirty: boolean;
  onSave: () => void;
}) {
  return (
    <div className="flex justify-end">
      <button type="button" disabled={disabled || !dirty} className={adminPrimaryBtn} onClick={onSave}>
        {busy ? "Saving…" : "Save Changes"}
      </button>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--admin-line)] bg-[var(--admin-bg)] px-3 py-2">
      <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--admin-muted)]">{label}</dt>
      <dd className="mt-1 text-[var(--admin-ink)]">{value}</dd>
    </div>
  );
}
