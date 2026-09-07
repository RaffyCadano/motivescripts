import { Link } from "react-router-dom";
import type { AgencyDeliverable } from "@/data/files";
import { awaitingReview, needsAttention } from "@/data/review";
import { adminProjectHref } from "@/data/teamWorkspace";

function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--admin-bg)] px-1.5 font-heading text-[11px] font-semibold text-[var(--admin-muted)]">
      {count}
    </span>
  );
}

type PmReviewsSectionProps = {
  deliverables: AgencyDeliverable[];
  projectIds: Set<string>;
  projectsById: Map<string, { name: string }>;
  previewLimit?: number;
};

/** Reviews & Deliverables -- Needs Changes and In Review, straight off the canonical review.ts definitions. Nothing here is a new status. */
export function PmReviewsSection({ deliverables, projectIds, projectsById, previewLimit = 6 }: PmReviewsSectionProps) {
  const scoped = deliverables.filter((item) => projectIds.has(item.projectId));
  const changes = needsAttention(scoped);
  const review = awaitingReview(scoped);

  return (
    <section id="reviews" className="scroll-mt-20 space-y-5 rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
      <div>
        <div className="flex items-center gap-2">
          <h2 className="font-heading text-sm font-semibold tracking-tight">Needs Changes</h2>
          <CountBadge count={changes.length} />
        </div>
        <div className="mt-3">
          {changes.length === 0 ? (
            <p className="text-sm text-[var(--admin-muted)]">No changes requested.</p>
          ) : (
            <ul className="divide-y divide-[var(--admin-line)] rounded-[var(--admin-radius)] border border-[var(--admin-line)]">
              {changes.slice(0, previewLimit).map((item) => (
                <ReviewRow key={item.id} name={item.name} projectName={projectsById.get(item.projectId)?.name ?? "Project"} href={adminProjectHref(item.projectId, { tab: "feedback" })} actionLabel="Open Feedback" />
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="border-t border-[var(--admin-line)] pt-5">
        <div className="flex items-center gap-2">
          <h2 className="font-heading text-sm font-semibold tracking-tight">In Review</h2>
          <CountBadge count={review.length} />
        </div>
        <div className="mt-3">
          {review.length === 0 ? (
            <p className="text-sm text-[var(--admin-muted)]">Nothing is waiting for review.</p>
          ) : (
            <ul className="divide-y divide-[var(--admin-line)] rounded-[var(--admin-radius)] border border-[var(--admin-line)]">
              {review.slice(0, previewLimit).map((item) => (
                <ReviewRow key={item.id} name={item.name} projectName={projectsById.get(item.projectId)?.name ?? "Project"} href={adminProjectHref(item.projectId, { tab: "files" })} actionLabel="Open Files" />
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

function ReviewRow({
  name,
  projectName,
  href,
  actionLabel,
}: {
  name: string;
  projectName: string;
  href: string;
  actionLabel: string;
}) {
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="font-heading text-sm font-semibold text-[var(--admin-ink)]">{name}</p>
        <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">{projectName}</p>
      </div>
      <Link to={href} className="shrink-0 font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline">
        {actionLabel}
      </Link>
    </li>
  );
}
