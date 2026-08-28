import { Link } from "react-router-dom";
import { DeliverableStatusBadge } from "@/components/admin/projects/DeliverableStatusBadge";
import { useProjectReview } from "@/components/admin/leads/LeadsProvider";
import { currentVersion, versionLabel } from "@/data/files";
import { awaitingReview, formatReviewLong } from "@/data/review";
import type { AgencyProject } from "@/data/agencyProjects";

export function ProjectApprovalsPanel({ project }: { project: AgencyProject }) {
  const { approvals, deliverables } = useProjectReview(project.id);
  const waiting = awaitingReview(deliverables);
  const approved = deliverables.filter((item) => item.status === "Approved");

  return (
    <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
      <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Approvals</h2>
      <p className="mt-1 text-[12px] text-[var(--admin-muted)]">
        {approved.length} approved · {waiting.length} awaiting review
      </p>

      <h3 className="mt-5 font-heading text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--admin-muted)]">
        Awaiting review
      </h3>
      {waiting.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--admin-muted)]">Nothing waiting for client review.</p>
      ) : (
        <ul className="mt-2 divide-y divide-[var(--admin-line)]">
          {waiting.map((item) => {
            const current = currentVersion(item);
            return (
              <li key={item.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-medium text-[var(--admin-ink)]">{item.name}</p>
                  <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">
                    {current ? versionLabel(current.versionNumber) : "No version"} · In Review
                  </p>
                </div>
                <Link
                  to={`/admin/projects/${project.id}?tab=files&file=${item.id}`}
                  className="font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline"
                >
                  View
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <h3 className="mt-6 font-heading text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--admin-muted)]">
        Approved
      </h3>
      {approvals.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--admin-muted)]">No approvals yet.</p>
      ) : (
        <ul className="mt-2 divide-y divide-[var(--admin-line)]">
          {approvals.map((item) => {
            const deliverable = deliverables.find((entry) => entry.id === item.deliverableId);
            const version = deliverable?.versions.find((entry) => entry.id === item.versionId);
            return (
              <li key={item.id} className="py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-[var(--admin-ink)]">
                    {deliverable?.name ?? "Deliverable"} {version ? versionLabel(version.versionNumber) : ""}
                  </p>
                  {deliverable ? <DeliverableStatusBadge status={deliverable.status} /> : null}
                </div>
                <p className="mt-1 text-[12px] text-[var(--admin-muted)]">
                  {formatReviewLong(item.approvedAt)} · Approved by {item.approvedBy}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
