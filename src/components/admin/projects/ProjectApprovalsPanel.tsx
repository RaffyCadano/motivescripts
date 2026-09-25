import { Link } from "react-router-dom";
import { CheckCircle2, ChevronRight, Clock3, FileCheck2 } from "lucide-react";
import { DeliverableStatusBadge } from "@/components/admin/projects/DeliverableStatusBadge";
import { useProjectReview } from "@/components/admin/leads/LeadsProvider";
import { currentVersion, versionLabel } from "@/data/files";
import { awaitingReview, formatReviewLong } from "@/data/review";
import type { AgencyProject } from "@/data/agencyProjects";
import { cn } from "@/lib/cn";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "")).toUpperCase() || "?";
}

function StatTile({ icon: Icon, label, value, tone }: { icon: typeof Clock3; label: string; value: number; tone: "good" | "warn" | "idle" }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-[var(--admin-line)] bg-[var(--admin-bg)] px-4 py-3">
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg",
          tone === "good" && "bg-[rgb(16_185_129_/_0.1)] text-[#0f7a56]",
          tone === "warn" && "bg-[rgb(245_158_11_/_0.12)] text-[#b45309]",
          tone === "idle" && "bg-[var(--admin-line)] text-[var(--admin-muted)]",
        )}
      >
        <Icon size={18} strokeWidth={2} aria-hidden="true" />
      </span>
      <div>
        <p className="font-heading text-2xl font-semibold leading-tight text-[var(--admin-ink)]">{value}</p>
        <p className="text-[12px] text-[var(--admin-muted)]">{label}</p>
      </div>
    </div>
  );
}

export function ProjectApprovalsPanel({
  project,
  fileHref,
}: {
  project: AgencyProject;
  fileHref?: (fileId: string) => string;
}) {
  const { approvals, deliverables } = useProjectReview(project.id);
  const waiting = awaitingReview(deliverables);
  const approved = deliverables.filter((item) => item.status === "Approved");

  return (
    <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[rgb(0_80_240_/_0.08)] text-[var(--admin-blue)]">
          <FileCheck2 size={15} strokeWidth={2} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Approvals</h2>
          <p className="text-[12px] text-[var(--admin-muted)]">Client sign-off on each deliverable.</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <StatTile icon={CheckCircle2} label="Approved" value={approved.length} tone="good" />
        <StatTile icon={Clock3} label="Awaiting review" value={waiting.length} tone={waiting.length > 0 ? "warn" : "idle"} />
      </div>

      <h3 className="mt-6 flex items-center gap-2 font-heading text-xs font-semibold uppercase tracking-[0.14em] text-[var(--admin-muted)]">
        Awaiting review
      </h3>
      {waiting.length === 0 ? (
        <div className="mt-2 rounded-lg border border-dashed border-[var(--admin-line)] bg-[var(--admin-bg)] px-4 py-5 text-center text-sm text-[var(--admin-muted)]">
          Nothing waiting for client review.
        </div>
      ) : (
        <ul className="mt-2 space-y-2">
          {waiting.map((item) => {
            const current = currentVersion(item);
            return (
              <li key={item.id}>
                <Link
                  to={fileHref ? fileHref(item.id) : `/admin/projects/${project.id}?tab=files&file=${item.id}`}
                  className="group flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50/60 px-4 py-3 transition-colors hover:border-amber-300 hover:bg-amber-50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--admin-ink)]">{item.name}</p>
                    <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">
                      {current ? versionLabel(current.versionNumber) : "No version"} · In Review
                    </p>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-0.5 font-heading text-[12px] font-semibold text-[var(--admin-blue)]">
                    View
                    <ChevronRight size={14} strokeWidth={2.4} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <h3 className="mt-6 font-heading text-xs font-semibold uppercase tracking-[0.14em] text-[var(--admin-muted)]">Approved</h3>
      {approvals.length === 0 ? (
        <div className="mt-2 rounded-lg border border-dashed border-[var(--admin-line)] bg-[var(--admin-bg)] px-4 py-5 text-center text-sm text-[var(--admin-muted)]">
          No approvals yet.
        </div>
      ) : (
        <ul className="mt-2 space-y-2">
          {approvals.map((item) => {
            const deliverable = deliverables.find((entry) => entry.id === item.deliverableId);
            const version = deliverable?.versions.find((entry) => entry.id === item.versionId);
            return (
              <li key={item.id} className="flex items-start gap-3 rounded-lg border border-[var(--admin-line)] px-4 py-3">
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-[rgb(16_185_129_/_0.1)] text-[#0f7a56]">
                  <CheckCircle2 size={15} strokeWidth={2.2} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-[var(--admin-ink)]">
                      {deliverable?.name ?? "Deliverable"} {version ? versionLabel(version.versionNumber) : ""}
                    </p>
                    {deliverable ? <DeliverableStatusBadge status={deliverable.status} /> : null}
                  </div>
                  <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12px] text-[var(--admin-muted)]">
                    <span>{formatReviewLong(item.approvedAt)}</span>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        aria-hidden="true"
                        className="flex size-4 items-center justify-center rounded-full bg-[rgb(0_80_240_/_0.1)] font-heading text-[8px] font-semibold text-[var(--admin-blue)]"
                      >
                        {initials(item.approvedBy)}
                      </span>
                      Approved by {item.approvedBy}
                    </span>
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
