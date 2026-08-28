import { Link } from "react-router-dom";
import { ProgressBar } from "@/components/admin/ProgressBar";
import { useProjectDeliverables, useProjectReview } from "@/components/admin/leads/LeadsProvider";
import { MilestoneStatusBadge } from "@/components/admin/projects/MilestoneStatusBadge";
import { ProjectDocumentsCard } from "@/components/admin/projects/ProjectDocumentsCard";
import { ProjectInvoicesCard } from "@/components/admin/projects/ProjectInvoicesCard";
import { ProjectStatusBadge } from "@/components/admin/projects/ProjectStatusBadge";
import { StaffAssignmentCard } from "@/components/admin/team/StaffAssignmentCard";
import { useTeamDirectory } from "@/components/admin/team/useTeamDirectory";
import type { AgencyClient } from "@/data/agencyClients";
import { currentVersion, formatFileRelative, recentDeliverables, versionLabel } from "@/data/files";
import { awaitingReview, latestFeedback, needsAttention } from "@/data/review";
import {
  calculateProjectProgress,
  currentMilestone,
  formatProjectDate,
  formatProjectDay,
  milestoneTaskCounts,
  taskCounts,
  upcomingTasks,
  type AgencyProject,
} from "@/data/agencyProjects";

type ProjectOverviewProps = {
  project: AgencyProject;
  client: AgencyClient | null;
  onOpenTab: (tab: string) => void;
};

export function ProjectOverview({ project, client, onOpenTab }: ProjectOverviewProps) {
  const progress = calculateProjectProgress(project);
  const counts = taskCounts(project);
  const milestone = currentMilestone(project);
  const milestoneCounts = milestone ? milestoneTaskCounts(project, milestone.id) : null;
  const upcoming = upcomingTasks(project);
  const deliverables = useProjectDeliverables(project.id);
  const recentFiles = recentDeliverables(deliverables);
  const review = useProjectReview(project.id);
  const team = useTeamDirectory();
  const waiting = awaitingReview(deliverables);
  const attention = needsAttention(deliverables);
  const openFeedback = review.feedback.filter((item) => item.status === "Open");
  const resolvedFeedback = review.feedback.filter((item) => item.status === "Resolved");
  const latest = latestFeedback(review.feedback);
  const approvedCount = deliverables.filter((item) => item.status === "Approved").length;
  const latestDeliverable = latest ? deliverables.find((item) => item.id === latest.deliverableId) : null;
  const latestVersion = latest
    ? latestDeliverable?.versions.find((entry) => entry.id === latest.versionId)
    : undefined;

  return (
    <div className="space-y-6">
      {attention.length > 0 ? (
        <p className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] px-4 py-3 text-sm text-[var(--admin-ink)]">
          {attention.length} deliverable{attention.length === 1 ? "" : "s"} need{attention.length === 1 ? "s" : ""} attention
        </p>
      ) : null}

      {team.data ? (
        <StaffAssignmentCard
          kind="project"
          entityId={project.id}
          entityClientId={project.clientId}
          members={team.data.members}
          assignedUserIds={team.data.members
            .filter((member) => member.projectAssignments.some((item) => item.entityId === project.id))
            .map((member) => member.id)}
          assignedLabels={Object.fromEntries(
            team.data.members.flatMap((member) =>
              member.projectAssignments
                .filter((item) => item.entityId === project.id)
                .map((item) => [member.id, item.label]),
            ),
          )}
          onChanged={() => void team.reload()}
        />
      ) : null}

      <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
        <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Project Progress</h2>
        {counts.total === 0 ? (
          <p className="mt-3 text-sm text-[var(--admin-muted)]">Add tasks to start tracking project progress.</p>
        ) : (
          <>
            <p className="mt-3 font-heading text-3xl font-semibold tracking-tight text-[var(--admin-ink)]">{progress}%</p>
            <p className="mt-1 text-sm text-[var(--admin-muted)]">
              {counts.completed} of {counts.total} tasks completed
            </p>
            <div className="mt-4">
              <ProgressBar value={progress} />
            </div>
          </>
        )}
      </section>

      <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
        <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Current Milestone</h2>
        {milestone ? (
          <>
            <p className="mt-3 font-heading text-base font-semibold text-[var(--admin-ink)]">{milestone.name}</p>
            <div className="mt-2">
              <MilestoneStatusBadge status={milestone.status} />
            </div>
            {milestoneCounts && milestoneCounts.total > 0 ? (
              <p className="mt-3 text-sm text-[var(--admin-muted)]">
                {milestoneCounts.completed} of {milestoneCounts.total} tasks completed
              </p>
            ) : (
              <p className="mt-3 text-sm text-[var(--admin-muted)]">No tasks in this milestone yet.</p>
            )}
          </>
        ) : (
          <p className="mt-3 text-sm text-[var(--admin-muted)]">No milestones yet</p>
        )}
      </section>

      <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Upcoming</h2>
          <button
            type="button"
            className="font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline"
            onClick={() => onOpenTab("tasks")}
          >
            View tasks
          </button>
        </div>
        {upcoming.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--admin-muted)]">No upcoming tasks.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {upcoming.map((item) => (
              <li key={item.id}>
                <p className="text-sm font-medium text-[var(--admin-ink)]">{item.title}</p>
                <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">Due {formatProjectDay(item.dueDate)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
        <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Project summary</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-[12px] text-[var(--admin-muted)]">Client</dt>
            <dd className="mt-1">
              {client ? (
                <Link className="text-sm font-medium text-[var(--admin-blue)] hover:underline" to={`/admin/clients/${client.id}`}>
                  {client.businessName}
                </Link>
              ) : (
                <span className="text-sm text-[var(--admin-muted)]">Unknown client</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-[12px] text-[var(--admin-muted)]">Type</dt>
            <dd className="mt-1 text-sm font-medium text-[var(--admin-ink)]">{project.type}</dd>
          </div>
          <div>
            <dt className="text-[12px] text-[var(--admin-muted)]">Status</dt>
            <dd className="mt-1">
              <ProjectStatusBadge status={project.status} />
            </dd>
          </div>
          <div>
            <dt className="text-[12px] text-[var(--admin-muted)]">Approval</dt>
            <dd className="mt-1 text-sm font-medium text-[var(--admin-ink)]">{project.approvalStatus}</dd>
          </div>
          <div>
            <dt className="text-[12px] text-[var(--admin-muted)]">Started</dt>
            <dd className="mt-1 text-sm font-medium text-[var(--admin-ink)]">{formatProjectDay(project.startDate)}</dd>
          </div>
          <div>
            <dt className="text-[12px] text-[var(--admin-muted)]">Target launch</dt>
            <dd className="mt-1 text-sm font-medium text-[var(--admin-ink)]">{formatProjectDay(project.targetLaunchDate)}</dd>
          </div>
        </dl>
        <p className="mt-4 text-sm leading-relaxed text-[var(--admin-ink)]">{project.description}</p>
      </section>

      <ProjectDocumentsCard projectId={project.id} clientId={project.clientId} />
      <ProjectInvoicesCard projectId={project.id} clientId={project.clientId} />

      <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Recent activity</h2>
          <button
            type="button"
            className="font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline"
            onClick={() => onOpenTab("activity")}
          >
            View activity
          </button>
        </div>
        {project.activity.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--admin-muted)]">No activity yet</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {project.activity.slice(0, 3).map((item) => (
              <li key={item.id}>
                <p className="text-sm text-[var(--admin-ink)]">{item.description}</p>
                <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">{formatProjectDate(item.createdAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Recent files</h2>
          <button
            type="button"
            className="font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline"
            onClick={() => onOpenTab("files")}
          >
            View All Files
          </button>
        </div>
        {recentFiles.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--admin-muted)]">No deliverables in this project yet.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {recentFiles.map((item) => {
              const current = currentVersion(item);
              return (
                <li key={item.id}>
                  <p className="text-sm font-medium text-[var(--admin-ink)]">{item.name}</p>
                  <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">
                    {current ? versionLabel(current.versionNumber) : "No versions"}
                    <span aria-hidden="true"> · </span>
                    {formatFileRelative(item.updatedAt)}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Client Review</h2>
          <button
            type="button"
            className="font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline"
            onClick={() => onOpenTab("approvals")}
          >
            View
          </button>
        </div>
        {waiting.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--admin-muted)]">Nothing waiting for client review.</p>
        ) : (
          <>
            <p className="mt-3 text-sm text-[var(--admin-ink)]">
              {waiting.length} item{waiting.length === 1 ? "" : "s"} awaiting review
            </p>
            <ul className="mt-3 space-y-3">
              {waiting.slice(0, 3).map((item) => {
                const current = currentVersion(item);
                return (
                  <li key={item.id}>
                    <p className="text-sm font-medium text-[var(--admin-ink)]">{item.name}</p>
                    <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">
                      {current ? versionLabel(current.versionNumber) : "No version"} · In Review
                    </p>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>

      <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Approvals</h2>
          <button
            type="button"
            className="font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline"
            onClick={() => onOpenTab("approvals")}
          >
            View Approvals
          </button>
        </div>
        <p className="mt-3 text-sm text-[var(--admin-ink)]">
          {approvedCount} approved · {waiting.length} awaiting review
        </p>
        <ul className="mt-3 space-y-3">
          {waiting.slice(0, 2).map((item) => {
            const current = currentVersion(item);
            return (
              <li key={item.id}>
                <p className="text-sm font-medium text-[var(--admin-ink)]">{item.name}</p>
                <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">
                  {current ? versionLabel(current.versionNumber) : "No version"} · Awaiting Review
                </p>
              </li>
            );
          })}
          {deliverables
            .filter((item) => item.status === "Approved")
            .slice(0, 2)
            .map((item) => {
              const current = currentVersion(item);
              return (
                <li key={item.id}>
                  <p className="text-sm font-medium text-[var(--admin-ink)]">{item.name}</p>
                  <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">
                    {current ? versionLabel(current.versionNumber) : "No version"} · Approved
                  </p>
                </li>
              );
            })}
        </ul>
      </section>

      <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Feedback</h2>
          <button
            type="button"
            className="font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline"
            onClick={() => onOpenTab("feedback")}
          >
            View Feedback
          </button>
        </div>
        {latest ? (
          <>
            <p className="mt-3 text-sm text-[var(--admin-ink)]">
              {openFeedback.length} open · {resolvedFeedback.length} resolved
            </p>
            <p className="mt-2 text-sm font-medium text-[var(--admin-ink)]">
              {latestDeliverable?.name ?? "Deliverable"} {latestVersion ? versionLabel(latestVersion.versionNumber) : ""}
            </p>
            <p className="mt-1 text-sm text-[var(--admin-muted)]">“{latest.message}”</p>
          </>
        ) : (
          <p className="mt-3 text-sm text-[var(--admin-muted)]">No feedback yet.</p>
        )}
      </section>
    </div>
  );
}
