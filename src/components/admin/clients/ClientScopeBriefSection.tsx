import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { hasPermission } from "@/auth/permissions";
import { projectPackageLabels } from "@/data/projectPackages";
import { describePackageSuggestion, suggestProjectPackage } from "@/data/scopePackageHint";
import { adminBlueBtn, adminGhostBtn } from "@/components/admin/adminActionStyles";
import type { AgencyClient } from "@/data/agencyClients";
import { formatClientDate } from "@/data/agencyClients";
import { SCOPE_PACKAGE_INCLUDED, scopeStatus, scopeStatusLabel, type ClientScopeBrief } from "@/data/scopeBriefs";
import { fetchClientScopeBrief } from "@/data/scopeBriefsRepository";
import { cn } from "@/lib/cn";

export function ClientScopeBriefSection({ client }: { client: AgencyClient }) {
  const [brief, setBrief] = useState<ClientScopeBrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const { profile } = useAuth();
  const canFill = hasPermission(profile, "clients.manage");

  useEffect(() => {
    let active = true;
    setLoading(true);
    void fetchClientScopeBrief(client.id)
      .then((row) => {
        if (active) setBrief(row);
      })
      .catch(() => {
        if (active) setBrief(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [client.id]);

  const status = scopeStatus(brief);
  const pages = brief
    ? [...SCOPE_PACKAGE_INCLUDED, ...brief.selectedPages.filter((item) => item !== "Other"), brief.otherPages].filter(
        Boolean,
      )
    : [];
  const features = brief
    ? [...brief.features.filter((item) => item !== "Other"), brief.otherFeatures].filter(Boolean)
    : [];
  const styles = brief ? [...brief.designStyles.filter((item) => item !== "Other"), brief.otherStyle].filter(Boolean) : [];
  const submitted = status === "submitted";

  return (
    <section
      id="website-scope"
      className={cn(
        "scroll-mt-4 rounded-[var(--admin-radius)] border bg-[var(--admin-card)] p-5",
        submitted ? "border-[rgb(16_185_129_/_0.35)]" : "border-[var(--admin-line)]",
      )}
    >
      <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Website Scope</h2>
      {loading ? (
        <div className="mt-4 h-20 animate-pulse rounded-lg bg-[var(--admin-bg)]" />
      ) : status === "not_started" || !brief ? (
        <>
          <p className="mt-2 font-heading text-sm font-semibold text-[var(--admin-ink)]">Not Started</p>
          <p className="mt-1 text-sm text-[var(--admin-muted)]">
            Waiting for the client to complete the Website Scope{canFill ? ", or you can fill it in for them" : ""}.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {canFill ? (
              <Link to={`/admin/clients/${client.id}/scope`} className={`${adminBlueBtn} justify-center`}>
                Fill in scope for client
              </Link>
            ) : null}
            <button type="button" disabled className={`${adminGhostBtn} justify-center opacity-60`}>
              View Scope
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="mt-2 font-heading text-sm font-semibold text-[var(--admin-ink)]">
            {submitted ? "✓ Completed" : scopeStatusLabel(status)}
          </p>
          <p className="mt-1 text-sm text-[var(--admin-muted)]">
            {submitted
              ? "The client has submitted their website requirements."
              : "The client has started the scope but has not submitted it."}
          </p>
          {submitted ? (
            <p className="mt-3 text-sm text-[var(--admin-ink)]">
              Pages: {pages.length}
              <span className="text-[var(--admin-muted)]"> · </span>
              Features: {features.length}
            </p>
          ) : null}
          <p className="mt-1 text-[12px] text-[var(--admin-muted)]">
            {submitted && brief.submittedAt
              ? `Submitted ${formatClientDate(brief.submittedAt)}`
              : `Last saved ${formatClientDate(brief.updatedAt)}`}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className={`${adminGhostBtn} justify-center`}
              onClick={() => setDetailsOpen((open) => !open)}
            >
              {detailsOpen ? "Hide Scope" : "View Scope"}
            </button>
            {canFill ? (
              <Link to={`/admin/clients/${client.id}/scope`} className={`${adminGhostBtn} justify-center`}>
                {submitted ? "Edit scope for client" : "Continue scope for client"}
              </Link>
            ) : null}
          </div>
          {detailsOpen ? (
            <dl className="mt-4 space-y-4 border-t border-[var(--admin-line)] pt-4">
              <Block
                label="Requested package"
                value={
                  brief.requestedPackage
                    ? projectPackageLabels[brief.requestedPackage]
                    : `Not sure, needs a recommendation. Suggested: ${describePackageSuggestion(suggestProjectPackage(brief.selectedPages, brief.features))}`
                }
              />
              <Block label="Business goal" value={brief.goal || "Not entered yet"} />
              <ChipBlock label="Pages" values={pages} />
              <ChipBlock label="Features" values={features.length ? features : ["None selected"]} muted={!features.length} />
              <Block
                label="Existing website"
                value={
                  brief.hasExistingWebsite === true
                    ? [brief.currentWebsiteUrl || "Yes", brief.currentWebsiteNotes].filter(Boolean).join("\n")
                    : brief.hasExistingWebsite === false
                      ? "No current website"
                      : "Not answered yet"
                }
              />
              <ChipBlock label="Design direction" values={styles.length ? styles : ["Not specified"]} muted={!styles.length} />
              {brief.likedWebsites ? <Block label="Websites they like" value={brief.likedWebsites} /> : null}
              {brief.additionalNotes ? <Block label="Additional requirements" value={brief.additionalNotes} /> : null}
            </dl>
          ) : null}
        </>
      )}
    </section>
  );
}

function Block({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[12px] text-[var(--admin-muted)]">{label}</dt>
      <dd className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-[var(--admin-ink)]">{value}</dd>
    </div>
  );
}

function ChipBlock({ label, values, muted = false }: { label: string; values: string[]; muted?: boolean }) {
  return (
    <div>
      <dt className="text-[12px] text-[var(--admin-muted)]">{label}</dt>
      <dd className="mt-2 flex flex-wrap gap-2">
        {values.map((value) => (
          <span
            key={value}
            className={`inline-flex min-h-8 items-center rounded-full border border-[var(--admin-line)] px-3 font-heading text-[12px] font-semibold ${
              muted ? "bg-white text-[var(--admin-muted)]" : "bg-[var(--admin-bg)] text-[var(--admin-ink)]"
            }`}
          >
            {value}
          </span>
        ))}
      </dd>
    </div>
  );
}
