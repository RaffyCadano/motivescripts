import type { ReactElement } from "react";
import { TeamTaskDetail } from "@/components/team/TeamTaskDetail";
import { TaskClientRequestPanel } from "@/components/tasks/TaskClientRequestPanel";
import { adminGhostBtn } from "@/components/admin/adminActionStyles";
import type { AgencyDeliverable } from "@/data/files";
import { earlierOpenMilestones, type AgencyProject, type AgencyTask, type AgencyTaskStatus } from "@/data/agencyProjects";
import { effectiveTaskType } from "@/data/taskTypes";
import type { TeamWorkTask } from "@/data/teamWorkspace";

type TaskWorkspaceProps = {
  task: AgencyTask;
  project: AgencyProject;
  clientName: string;
  deliverables: AgencyDeliverable[];
  busy?: boolean;
  error?: string | null;
  /** Assignee's current In Progress count, for the WIP-limit nudge. Omit when the caller has no cross-project task list. */
  wipCount?: number;
  onClose: () => void;
  onStatusChange: (status: AgencyTaskStatus) => void;
  onOpenDiscovery: () => void;
  onOpenFiles: () => void;
};

/**
 * Single entry point for "click a task, see its workspace." Reuses TeamTaskDetail for
 * the shared shell (instructions/status/related files) and injects a type-specific
 * `extra` section instead of duplicating any of Discovery, client review, or file
 * upload logic.
 */
export function TaskWorkspace({
  task,
  project,
  clientName,
  deliverables,
  busy,
  error,
  wipCount,
  onClose,
  onStatusChange,
  onOpenDiscovery,
  onOpenFiles,
}: TaskWorkspaceProps) {
  const taskType = effectiveTaskType(task);
  const milestone = project.milestones.find((item) => item.id === task.milestoneId);

  const teamTask: TeamWorkTask = {
    id: task.id,
    projectId: project.id,
    projectName: project.name,
    clientId: project.clientId,
    clientName,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    assignee: task.assignee,
    assignedTo: task.assignedTo,
    dueDate: task.dueDate,
    createdAt: task.createdAt,
    completedAt: task.completedAt,
    milestoneId: task.milestoneId,
    milestoneName: milestone?.name ?? "",
    recommendedRole: task.recommendedRole,
    taskType: task.taskType,
    referenceUrl: task.referenceUrl,
    estimatedHours: task.estimatedHours,
    deliverableId: task.deliverableId,
  };

  const projectFiles = deliverables.filter((item) => item.projectId === project.id);

  let extra: ReactElement | null = null;
  if (taskType === "discovery") {
    extra = (
      <DiscoveryLinkOut onOpenDiscovery={onOpenDiscovery} />
    );
  } else if (taskType === "content_collection") {
    extra = <TaskClientRequestPanel taskId={task.id} projectId={project.id} clientId={project.clientId} />;
  } else if (taskType === "client_review") {
    extra = <ClientReviewLinkOut onOpenFiles={onOpenFiles} />;
  }

  return (
    <TeamTaskDetail
      task={teamTask}
      files={projectFiles}
      canUpdateStatus
      busy={busy}
      error={error}
      workspace="admin"
      extra={extra}
      earlierOpen={earlierOpenMilestones(project, task.milestoneId)}
      wipCount={wipCount}
      onClose={onClose}
      onStatusChange={onStatusChange}
    />
  );
}

function DiscoveryLinkOut({ onOpenDiscovery }: { onOpenDiscovery: () => void }) {
  return (
    <section className="rounded-lg border border-[var(--admin-line)] bg-[var(--admin-bg)] p-4">
      <h3 className="font-heading text-sm font-semibold text-[var(--admin-ink)]">Discovery</h3>
      <p className="mt-1 text-sm text-[var(--admin-muted)]">
        This task is tracked through the project's Discovery workflow — send the request, review the
        submission, ask follow-up questions, or mark it complete there.
      </p>
      <button type="button" className={`${adminGhostBtn} mt-3`} onClick={onOpenDiscovery}>
        Open Discovery
      </button>
    </section>
  );
}

export function ClientReviewLinkOut({ onOpenFiles }: { onOpenFiles: () => void }) {
  return (
    <section className="rounded-lg border border-[var(--admin-line)] bg-[var(--admin-bg)] p-4">
      <h3 className="font-heading text-sm font-semibold text-[var(--admin-ink)]">Client Review</h3>
      <p className="mt-1 text-sm text-[var(--admin-muted)]">
        This task is resolved through the project's Files and Feedback workflow — submit the
        deliverable for review, and the client will approve or request changes there.
      </p>
      <button type="button" className={`${adminGhostBtn} mt-3`} onClick={onOpenFiles}>
        Open Files &amp; Feedback
      </button>
    </section>
  );
}
