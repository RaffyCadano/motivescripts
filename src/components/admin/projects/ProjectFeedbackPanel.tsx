import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { hasPermission } from "@/auth/permissions";
import { adminFilterControlState } from "@/components/admin/list/adminListStyles";
import { DeliverableStatusBadge } from "@/components/admin/projects/DeliverableStatusBadge";
import { useLeads, useProjectReview } from "@/components/admin/leads/LeadsProvider";
import { versionLabel } from "@/data/files";
import {
  feedbackStatuses,
  filterFeedback,
  formatReviewLong,
  type FeedbackStatus,
} from "@/data/review";
import type { AgencyProject } from "@/data/agencyProjects";

export function ProjectFeedbackPanel({
  project,
  fileHref,
}: {
  project: AgencyProject;
  fileHref?: (fileId: string) => string;
}) {
  const { profile } = useAuth();
  const canResolve = hasPermission(profile, "feedback.manage");
  const { resolveFeedback } = useLeads();
  const { feedback, deliverables } = useProjectReview(project.id);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<FeedbackStatus | "All">("Open");
  const visible = useMemo(() => filterFeedback(feedback, query, status), [feedback, query, status]);

  return (
    <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
      <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Feedback</h2>
      <p className="mt-1 text-[12px] text-[var(--admin-muted)]">Comments are tied to the exact version the client reviewed.</p>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Search feedback</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search feedback..."
            className={adminFilterControlState(Boolean(query.trim()))}
          />
        </label>
        <label className="sm:w-44">
          <span className="sr-only">Status</span>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as FeedbackStatus | "All")}
            className={adminFilterControlState(status !== "All")}
          >
            <option value="All">All</option>
            {feedbackStatuses.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
      </div>

      {feedback.length === 0 ? (
        <div className="mt-6">
          <p className="font-heading text-sm font-semibold text-[var(--admin-ink)]">No feedback yet.</p>
          <p className="mt-1 text-sm text-[var(--admin-muted)]">Client feedback will appear here when submitted.</p>
        </div>
      ) : visible.length === 0 ? (
        <p className="mt-6 text-sm text-[var(--admin-muted)]">No feedback matches this filter.</p>
      ) : (
        <div className="mt-5 overflow-x-auto rounded-[var(--admin-radius)] border border-[var(--admin-line)]">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-[var(--admin-line)] bg-[var(--admin-bg)] text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--admin-muted)]">
              <tr>
                <th className="px-4 py-3 font-heading">Deliverable</th>
                <th className="px-4 py-3 font-heading">Feedback</th>
                <th className="px-4 py-3 font-heading">Submitted</th>
                <th className="px-4 py-3 font-heading">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--admin-line)]">
              {visible.map((item) => {
                const deliverable = deliverables.find((entry) => entry.id === item.deliverableId);
                const version = deliverable?.versions.find((entry) => entry.id === item.versionId);
                return (
                  <tr key={item.id} className="hover:bg-[var(--admin-bg)]">
                    <td className="px-4 py-3 align-top">
                      <p className="font-medium text-[var(--admin-ink)]">
                        {deliverable?.name ?? "Deliverable"}
                        {version ? ` ${versionLabel(version.versionNumber)}` : ""}
                      </p>
                      {deliverable ? (
                        <div className="mt-1">
                          <DeliverableStatusBadge status={deliverable.status} />
                        </div>
                      ) : null}
                    </td>
                    <td className="max-w-sm px-4 py-3 align-top text-[var(--admin-ink)]">“{item.message}”</td>
                    <td className="px-4 py-3 align-top text-[var(--admin-muted)]">
                      {formatReviewLong(item.createdAt)} · {item.status}
                      {item.resolvedAt ? (
                        <>
                          <br />
                          Resolved {formatReviewLong(item.resolvedAt)}
                        </>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex flex-wrap gap-2">
                        {deliverable ? (
                          <Link
                            to={fileHref ? fileHref(deliverable.id) : `/admin/projects/${project.id}?tab=files&file=${deliverable.id}`}
                            className="inline-flex h-8 items-center rounded-lg border border-[var(--admin-line)] px-2.5 font-heading text-[12px] font-semibold text-[var(--admin-ink)] hover:bg-[var(--admin-bg)]"
                          >
                            View
                          </Link>
                        ) : null}
                        {item.status === "Open" && canResolve ? (
                          <button
                            type="button"
                            className="inline-flex h-8 items-center rounded-lg border border-[var(--admin-line)] px-2.5 font-heading text-[12px] font-semibold text-[var(--admin-ink)] hover:bg-[var(--admin-bg)]"
                            onClick={() => resolveFeedback(item.id)}
                          >
                            Mark Resolved
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
