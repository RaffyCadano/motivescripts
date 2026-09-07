import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import { TeamEmptyState } from "@/components/team/TeamEmptyState";
import { useTeamWork } from "@/components/team/useTeamWork";
import type { AgencyProject } from "@/data/agencyProjects";
import { needsChangesDeliverables } from "@/data/developerOverview";
import type { AgencyDeliverable } from "@/data/files";
import { formatReviewRelative, latestFeedback, type ReviewFeedback } from "@/data/review";
import { teamProjectHref } from "@/data/teamWorkspace";

export function TeamNeedsChanges() {
  const { myProjects, deliverables } = useTeamWork();
  const { feedback } = useLeads();
  const projectIds = useMemo(() => new Set(myProjects.map((project) => project.id)), [myProjects]);
  const projectsById = useMemo(() => new Map(myProjects.map((project) => [project.id, project])), [myProjects]);
  const needsChanges = useMemo(() => needsChangesDeliverables(deliverables, projectIds), [deliverables, projectIds]);

  const latestOpenFeedbackByDeliverable = useMemo(() => {
    const byDeliverable = new Map<string, ReviewFeedback[]>();
    for (const item of feedback) {
      if (item.status !== "Open") continue;
      const list = byDeliverable.get(item.deliverableId) ?? [];
      list.push(item);
      byDeliverable.set(item.deliverableId, list);
    }
    const latest = new Map<string, ReviewFeedback | null>();
    for (const [deliverableId, items] of byDeliverable) {
      latest.set(deliverableId, latestFeedback(items));
    }
    return latest;
  }, [feedback]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-[1.65rem] font-semibold tracking-tight md:text-3xl">Needs Changes</h1>
        <p className="mt-1 text-sm text-[var(--admin-muted)]">Client feedback/revisions require your attention.</p>
      </div>

      {needsChanges.length === 0 ? (
        <TeamEmptyState title="No changes requested." body="Deliverables the client asks to revise will show up here." />
      ) : (
        <div className="overflow-x-auto rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)]">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-[var(--admin-line)] bg-[var(--admin-bg)] text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--admin-muted)]">
              <tr>
                <th className="px-4 py-3 font-heading">Deliverable</th>
                <th className="px-4 py-3 font-heading">What needs to change</th>
                <th className="px-4 py-3 font-heading">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--admin-line)]">
              {needsChanges.map((item) => (
                <NeedsChangesRow
                  key={item.id}
                  deliverable={item}
                  project={projectsById.get(item.projectId)}
                  feedback={latestOpenFeedbackByDeliverable.get(item.id) ?? null}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function NeedsChangesRow({
  deliverable,
  project,
  feedback,
}: {
  deliverable: AgencyDeliverable;
  project: AgencyProject | undefined;
  feedback: ReviewFeedback | null;
}) {
  return (
    <tr className="hover:bg-[var(--admin-bg)]">
      <td className="px-4 py-3 align-top">
        <p className="font-medium text-[var(--admin-ink)]">{deliverable.name}</p>
        <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">
          {project?.name ?? "Project"} · {deliverable.category}
        </p>
      </td>
      <td className="max-w-sm px-4 py-3 align-top">
        {feedback ? (
          <>
            <p className="whitespace-pre-line text-[var(--admin-ink)]">{feedback.message}</p>
            <p className="mt-1 text-[12px] text-[var(--admin-muted)]">
              {feedback.createdBy} · {formatReviewRelative(feedback.createdAt)}
            </p>
          </>
        ) : (
          <p className="text-[var(--admin-muted)]">No feedback message on file.</p>
        )}
      </td>
      <td className="px-4 py-3 align-top">
        <Link
          to={teamProjectHref(deliverable.projectId, { tab: "feedback" })}
          className="font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline"
        >
          Open feedback
        </Link>
      </td>
    </tr>
  );
}
