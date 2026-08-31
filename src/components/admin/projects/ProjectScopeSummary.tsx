import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { AgencyClient } from "@/data/agencyClients";
import type { ClientScopeBrief } from "@/data/scopeBriefs";
import { scopeStatus } from "@/data/scopeBriefs";

function Block({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--admin-muted)]">{label}</p>
      <div className="mt-1.5 text-sm leading-6 text-[var(--admin-ink)]">{children}</div>
    </div>
  );
}

function joinValues(values: string[]) {
  return values.filter((value) => value.trim()).join(" · ");
}

export function ProjectScopeSummary({
  client,
  brief,
  loading,
}: {
  client: AgencyClient | undefined;
  brief: ClientScopeBrief | null;
  loading: boolean;
}) {
  const status = scopeStatus(brief);
  const submitted = status === "submitted";
  const pages = brief ? ["Homepage", ...brief.selectedPages.filter((item) => item !== "Other")] : [];
  const features = brief ? brief.features.filter((item) => item !== "Other") : [];
  const styles = brief ? brief.designStyles.filter((item) => item !== "Other") : [];
  const otherPages = brief?.otherPages.trim() ?? "";
  const otherFeatures = brief?.otherFeatures.trim() ?? "";
  const otherStyle = brief?.otherStyle.trim() ?? "";
  const currentUrl = brief?.currentWebsiteUrl.trim() ?? "";
  const currentNotes = brief?.currentWebsiteNotes.trim() ?? "";
  const likedWebsites = brief?.likedWebsites.trim() ?? "";
  const additionalNotes = brief?.additionalNotes.trim() ?? "";
  const goal = brief?.goal.trim() ?? "";
  const hasScopeData = Boolean(
    brief &&
      (goal ||
        pages.length > 1 ||
        brief.selectedPages.length > 0 ||
        features.length ||
        styles.length ||
        otherPages ||
        otherFeatures ||
        otherStyle ||
        currentUrl ||
        currentNotes ||
        likedWebsites ||
        additionalNotes ||
        brief.hasExistingWebsite !== null),
  );

  return (
    <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-heading text-sm font-semibold text-[var(--admin-ink)]">Scope Summary</p>
          <p className="mt-1 text-sm text-[var(--admin-muted)]">Client requirements gathered from the Website Scope.</p>
        </div>
        {client ? (
          <Link
            to={`/admin/clients/${client.id}`}
            className="text-xs font-semibold text-[var(--admin-navy)] hover:underline"
          >
            Open client
          </Link>
        ) : null}
      </div>

      <p
        className={`mt-4 text-sm font-semibold ${
          submitted ? "text-emerald-800" : status === "in_progress" ? "text-amber-800" : "text-[var(--admin-muted)]"
        }`}
      >
        {status === "submitted" ? "Scope Submitted ✓" : status === "in_progress" ? "Scope In Progress" : "Scope Not Started"}
      </p>

      {!submitted ? (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-950">
          This client has not submitted a Website Scope yet. You can still create the project if you already have the
          project brief.
        </p>
      ) : null}

      {loading ? <p className="mt-4 text-sm text-[var(--admin-muted)]">Loading scope…</p> : null}

      {!loading && hasScopeData && brief ? (
        <div className="mt-5 space-y-4">
          <p className="font-heading text-sm font-semibold text-[var(--admin-ink)]">Website Scope</p>
          {goal ? (
            <Block label="Business Goal">
              <p className="whitespace-pre-wrap">{goal}</p>
            </Block>
          ) : null}
          {pages.length > 0 ? (
            <Block label="Pages">
              <p>{joinValues(pages)}</p>
            </Block>
          ) : null}
          {otherPages ? <Block label="Other pages">{otherPages}</Block> : null}
          {features.length > 0 ? (
            <Block label="Features">
              <p>{joinValues(features)}</p>
            </Block>
          ) : null}
          {otherFeatures ? <Block label="Other features">{otherFeatures}</Block> : null}
          {brief.hasExistingWebsite !== null ? (
            <Block label="Existing Website">
              {brief.hasExistingWebsite ? "Yes" : "No current website"}
            </Block>
          ) : null}
          {currentUrl ? <Block label="Current website URL">{currentUrl}</Block> : null}
          {currentNotes ? (
            <Block label="Current website notes">
              <p className="whitespace-pre-wrap">{currentNotes}</p>
            </Block>
          ) : null}
          {styles.length > 0 ? (
            <Block label="Design Direction">
              <p>{joinValues(styles)}</p>
            </Block>
          ) : null}
          {otherStyle ? <Block label="Other style">{otherStyle}</Block> : null}
          {likedWebsites ? (
            <Block label="Liked websites">
              <p className="whitespace-pre-wrap">{likedWebsites}</p>
            </Block>
          ) : null}
          {additionalNotes ? (
            <Block label="Additional notes">
              <p className="whitespace-pre-wrap">{additionalNotes}</p>
            </Block>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
