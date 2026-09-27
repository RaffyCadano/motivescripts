import { CircleCheck, Eye, PencilLine } from "lucide-react";
import { Link } from "react-router-dom";
import { OverviewCard, OverviewEmpty } from "@/components/admin/overview/kit";
import type { AgencyDeliverable } from "@/data/files";
import { awaitingReview, needsAttention } from "@/data/review";
import { adminProjectHref } from "@/data/teamWorkspace";

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
    <div id="reviews" className="grid scroll-mt-20 gap-4 md:grid-cols-2">
      <OverviewCard icon={PencilLine} title="Needs changes" count={changes.length} description="Deliverables the client asked to revise">
        {changes.length === 0 ? (
          <OverviewEmpty compact icon={CircleCheck} title="No changes requested" body="Nothing is waiting on a revision." />
        ) : (
          <ul className="divide-y divide-[var(--admin-line)]">
            {changes.slice(0, previewLimit).map((item) => (
              <ReviewRow key={item.id} name={item.name} projectName={projectsById.get(item.projectId)?.name ?? "Project"} href={adminProjectHref(item.projectId, { tab: "feedback" })} actionLabel="Open Feedback" />
            ))}
          </ul>
        )}
      </OverviewCard>

      <OverviewCard icon={Eye} title="In review" count={review.length} description="Deliverables waiting for a decision">
        {review.length === 0 ? (
          <OverviewEmpty compact icon={CircleCheck} title="Nothing to review" body="No deliverable is waiting on a review." />
        ) : (
          <ul className="divide-y divide-[var(--admin-line)]">
            {review.slice(0, previewLimit).map((item) => (
              <ReviewRow key={item.id} name={item.name} projectName={projectsById.get(item.projectId)?.name ?? "Project"} href={adminProjectHref(item.projectId, { tab: "files" })} actionLabel="Open Files" />
            ))}
          </ul>
        )}
      </OverviewCard>
    </div>
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
    <li className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
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
