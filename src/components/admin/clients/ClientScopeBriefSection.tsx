import { useEffect, useState } from "react";
import type { AgencyClient } from "@/data/agencyClients";
import { formatClientDate } from "@/data/agencyClients";
import { SCOPE_PACKAGE_INCLUDED, scopeStatus, scopeStatusLabel, type ClientScopeBrief } from "@/data/scopeBriefs";
import { fetchClientScopeBrief } from "@/data/scopeBriefsRepository";
import { cn } from "@/lib/cn";

export function ClientScopeBriefSection({ client }: { client: AgencyClient }) {
  const [brief, setBrief] = useState<ClientScopeBrief | null>(null);
  const [loading, setLoading] = useState(true);

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

  return (
    <section
      className={cn(
        "rounded-[var(--admin-radius)] border bg-[var(--admin-card)] p-5",
        status === "submitted" ? "border-[rgb(16_185_129_/_0.35)]" : "border-[var(--admin-line)]",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Website Scope</h2>
        {!loading && status === "submitted" ? (
          <span className="inline-flex items-center rounded-full bg-[rgb(16_185_129_/_0.12)] px-2.5 py-0.5 font-heading text-[11px] font-semibold text-[#0f7a56]">
            Ready for review
          </span>
        ) : null}
      </div>
      {loading ? (
        <div className="mt-4 h-24 animate-pulse rounded-lg bg-[var(--admin-bg)]" />
      ) : status === "not_started" || !brief ? (
        <>
          <p className="mt-2 font-heading text-sm font-semibold text-[var(--admin-ink)]">Not Started</p>
          <p className="mt-2 text-sm text-[var(--admin-muted)]">
            Waiting for this client to start the scope form in the portal. You can still create a project if you already
            know the brief.
          </p>
        </>
      ) : (
        <>
          <p className="mt-2 font-heading text-sm font-semibold text-[var(--admin-ink)]">
            {status === "submitted" ? "Submitted ✓" : scopeStatusLabel(status)}
          </p>
          <p className="mt-1 text-sm text-[var(--admin-muted)]">
            {status === "submitted"
              ? "The client has submitted their website requirements."
              : "Client has started their scope but has not submitted it."}
          </p>
          <p className="mt-1 text-[12px] text-[var(--admin-muted)]">
            {status === "submitted" && brief.submittedAt
              ? `Submitted ${formatClientDate(brief.submittedAt)}`
              : `Last saved ${formatClientDate(brief.updatedAt)}`}
            {brief.submittedAt && brief.updatedAt !== brief.submittedAt
              ? ` · Updated ${formatClientDate(brief.updatedAt)}`
              : ""}
          </p>
          <dl className="mt-4 space-y-4">
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
