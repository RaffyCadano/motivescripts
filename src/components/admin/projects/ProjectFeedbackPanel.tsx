import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { DeliverableStatusBadge } from "@/components/admin/projects/DeliverableStatusBadge";
import { useLeads, useProjectReview } from "@/components/admin/leads/LeadsProvider";
import { versionLabel } from "@/data/files";
import {
  filterFeedback,
  formatReviewLong,
  type FeedbackStatus,
} from "@/data/review";
import type { AgencyProject } from "@/data/agencyProjects";
import { cn } from "@/lib/cn";

const filters = ["Open", "Resolved", "All"] as const;

export function ProjectFeedbackPanel({ project }: { project: AgencyProject }) {
  const { resolveFeedback } = useLeads();
  const { feedback, deliverables } = useProjectReview(project.id);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<FeedbackStatus | "All">("Open");
  const visible = useMemo(() => filterFeedback(feedback, query, status), [feedback, query, status]);

  return (
    <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
      <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Feedback</h2>
      <p className="mt-1 text-[12px] text-[var(--admin-muted)]">Comments are tied to the exact version the client reviewed.</p>

      <label className="mt-4 block">
        <span className="sr-only">Search feedback</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search feedback..."
          className="h-10 w-full rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-white px-3 text-sm text-[var(--admin-ink)] outline-none placeholder:text-[var(--admin-muted)] focus:border-[rgb(0_80_240_/_0.45)]"
        />
      </label>
      <div className="mt-3 flex gap-1.5" role="group" aria-label="Feedback status">
        {filters.map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={status === item}
            className={cn(
              "rounded-full px-3 py-1.5 font-heading text-[12px] font-semibold",
              status === item
                ? "bg-[var(--admin-navy)] text-white"
                : "bg-white text-[var(--admin-ink)] ring-1 ring-[var(--admin-line)] hover:bg-[var(--admin-hover)]",
            )}
            onClick={() => setStatus(item)}
          >
            {item}
          </button>
        ))}
      </div>

      {feedback.length === 0 ? (
        <div className="mt-6">
          <p className="font-heading text-sm font-semibold text-[var(--admin-ink)]">No feedback yet.</p>
          <p className="mt-1 text-sm text-[var(--admin-muted)]">Client feedback will appear here when submitted.</p>
        </div>
      ) : visible.length === 0 ? (
        <p className="mt-6 text-sm text-[var(--admin-muted)]">No feedback matches this filter.</p>
      ) : (
        <ul className="mt-5 divide-y divide-[var(--admin-line)]">
          {visible.map((item) => {
            const deliverable = deliverables.find((entry) => entry.id === item.deliverableId);
            const version = deliverable?.versions.find((entry) => entry.id === item.versionId);
            return (
              <li key={item.id} className="py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-heading text-sm font-semibold text-[var(--admin-ink)]">
                    {deliverable?.name ?? "Deliverable"}
                    {version ? ` ${versionLabel(version.versionNumber)}` : ""}
                  </p>
                  {deliverable ? <DeliverableStatusBadge status={deliverable.status} /> : null}
                </div>
                <p className="mt-2 text-sm text-[var(--admin-ink)]">“{item.message}”</p>
                <p className="mt-2 text-[12px] text-[var(--admin-muted)]">
                  Submitted {formatReviewLong(item.createdAt)} · {item.status}
                  {item.resolvedAt ? ` · Resolved ${formatReviewLong(item.resolvedAt)}` : ""}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {deliverable ? (
                    <Link
                      to={`/admin/projects/${project.id}?tab=files&file=${deliverable.id}`}
                      className="inline-flex h-8 items-center rounded-lg border border-[var(--admin-line)] px-2.5 font-heading text-[12px] font-semibold text-[var(--admin-ink)] hover:bg-[var(--admin-bg)]"
                    >
                      View
                    </Link>
                  ) : null}
                  {item.status === "Open" ? (
                    <button
                      type="button"
                      className="inline-flex h-8 items-center rounded-lg border border-[var(--admin-line)] px-2.5 font-heading text-[12px] font-semibold text-[var(--admin-ink)] hover:bg-[var(--admin-bg)]"
                      onClick={() => resolveFeedback(item.id)}
                    >
                      Mark Resolved
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
