import type { ReactElement, ReactNode } from "react";
import { TeamTaskDetail } from "@/components/team/TeamTaskDetail";
import { TaskClientRequestPanel } from "@/components/tasks/TaskClientRequestPanel";
import { adminGhostBtn } from "@/components/admin/adminActionStyles";
import type { AgencyDeliverable } from "@/data/files";
import { earlierOpenMilestones, type AgencyProject, type AgencyTask, type AgencyTaskStatus } from "@/data/agencyProjects";
import { contentWriterPageForTitle } from "@/data/productionTaskInstructions";
import { checkpointApproved, developmentComplete, qaLatestResult } from "@/data/productionWorkflow";
import type { ProjectDevelopment } from "@/data/projectDevelopment";
import { effectiveTaskType, type TaskType } from "@/data/taskTypes";
import type { TeamWorkTask } from "@/data/teamWorkspace";
import { safeHttpHref } from "@/lib/safeUrl";

type TaskWorkspaceProps = {
  task: AgencyTask;
  project: AgencyProject;
  clientName: string;
  deliverables: AgencyDeliverable[];
  busy?: boolean;
  error?: string | null;
  /** Assignee's current In Progress count, for the WIP-limit nudge. Omit when the caller has no cross-project task list. */
  wipCount?: number;
  /** See TeamTaskDetail: "modal" (default) or "page" for an in-flow, non-overlay render. */
  variant?: "modal" | "page";
  /** Rendered above the title in "page" variant only. */
  breadcrumb?: ReactNode;
  onClose: () => void;
  onStatusChange: (
    status: AgencyTaskStatus,
    blockedReason?: string | null,
    qaResult?: string | null,
    qaFailNote?: string | null,
  ) => void;
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
  variant,
  breadcrumb,
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
    origin: task.origin,
    blockedReason: task.blockedReason,
    qaResult: task.qaResult,
    qaFailNote: task.qaFailNote,
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
  } else {
    extra = taskContextExtra(task, taskType, project, projectFiles, onOpenFiles);
  }

  return (
    <TeamTaskDetail
      task={teamTask}
      files={projectFiles}
      canUpdateStatus
      busy={busy}
      error={error}
      workspace="admin"
      variant={variant}
      breadcrumb={breadcrumb}
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

/**
 * Read-only visibility for the content writer: which page this copy is for,
 * and a real link to the project's repository/branch so they know where it
 * will eventually live. Never expects them to open or touch the repo
 * themselves -- MotiveScripts has no GitHub integration; the developer adds
 * the finished copy to the site from here, same as always.
 */
export function ContentWriterRepositoryPanel({ page, development }: { page: string; development: ProjectDevelopment }) {
  const repoHref = safeHttpHref(development.repositoryUrl);
  return (
    <section className="rounded-lg border border-[var(--admin-line)] bg-[var(--admin-bg)] p-4">
      <h3 className="font-heading text-sm font-semibold text-[var(--admin-ink)]">Where this goes</h3>
      <p className="mt-1 text-sm text-[var(--admin-muted)]">
        This copy is for the {page}. You don't need to open or touch the repository yourself — write it
        here, and the developer will add it to the site from there.
      </p>
      {repoHref ? (
        <div className="mt-3 space-y-1">
          <a
            href={repoHref}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-[var(--admin-blue)] hover:underline"
          >
            Open Repository ↗
          </a>
          {development.repositoryBranch.trim() ? (
            <p className="text-[12px] text-[var(--admin-muted)]">Branch: {development.repositoryBranch}</p>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 text-[12px] text-[var(--admin-muted)]">
          No repository has been set for this project yet.
        </p>
      )}
    </section>
  );
}

/**
 * Same "where this fits, here's the relevant link" idea as the content
 * writer panel above, extended to Designer/Developer/Team Member -- the
 * other three production-team roles (Section: "do the same for all roles
 * except admin"). All read-only, all derived from data that already exists
 * (deliverables, project_development, task history) -- no new schema, no
 * GitHub integration, nothing to sync. Admin/PM already see all of this
 * directly on the full project workspace, so this is deliberately not
 * wired into any admin-only view.
 */
export function taskContextExtra(
  task: { title: string },
  taskType: TaskType,
  project: Pick<AgencyProject, "milestones" | "tasks" | "development">,
  projectDeliverables: AgencyDeliverable[],
  onOpenFiles: () => void,
): ReactElement | null {
  const contentWriterPage = contentWriterPageForTitle(task.title);
  if (contentWriterPage) {
    return <ContentWriterRepositoryPanel page={contentWriterPage} development={project.development} />;
  }
  if (taskType === "design") {
    return (
      <DesignerCheckpointPanel
        approved={checkpointApproved(projectDeliverables, "overall_design")}
        onOpenFiles={onOpenFiles}
      />
    );
  }
  if (taskType === "production") {
    return (
      <DeveloperGatePanel
        designApproved={checkpointApproved(projectDeliverables, "overall_design")}
        devComplete={developmentComplete(project)}
        repoHref={safeHttpHref(project.development.repositoryUrl)}
        branch={project.development.repositoryBranch}
        stagingHref={safeHttpHref(project.development.stagingUrl)}
      />
    );
  }
  if (taskType === "qa") {
    return (
      <QaContextPanel
        devComplete={developmentComplete(project)}
        stagingHref={safeHttpHref(project.development.stagingUrl)}
        qaResult={qaLatestResult(project)}
      />
    );
  }
  return null;
}

/** Designer: whether their work already feeds an approved checkpoint, or is still building toward one. */
function DesignerCheckpointPanel({ approved, onOpenFiles }: { approved: boolean; onOpenFiles: () => void }) {
  return (
    <section className="rounded-lg border border-[var(--admin-line)] bg-[var(--admin-bg)] p-4">
      <h3 className="font-heading text-sm font-semibold text-[var(--admin-ink)]">Design Approval</h3>
      <p className="mt-1 text-sm text-[var(--admin-muted)]">
        {approved
          ? "The Overall Website Design is already approved. Keep new design work consistent with it."
          : "This work feeds the Overall Website Design deliverable — the client needs to approve that before Development can start."}
      </p>
      <button type="button" className={`${adminGhostBtn} mt-3`} onClick={onOpenFiles}>
        Open Files &amp; Feedback
      </button>
    </section>
  );
}

/** Developer: the gate that unlocked this task, plus the repo/branch/staging they need to actually do the work. */
function DeveloperGatePanel({
  designApproved,
  devComplete,
  repoHref,
  branch,
  stagingHref,
}: {
  designApproved: boolean;
  devComplete: boolean;
  repoHref: string | null;
  branch: string;
  stagingHref: string | null;
}) {
  return (
    <section className="rounded-lg border border-[var(--admin-line)] bg-[var(--admin-bg)] p-4">
      <h3 className="font-heading text-sm font-semibold text-[var(--admin-ink)]">Development</h3>
      {!designApproved ? (
        <p className="mt-1 text-sm text-[#b45309]">
          Overall Design isn't approved yet — new Development work is locked until it is.
        </p>
      ) : (
        <p className="mt-1 text-sm text-[var(--admin-muted)]">
          {devComplete
            ? "All Development tasks are marked Completed."
            : "Overall Design is approved — Development is unlocked."}
        </p>
      )}
      {repoHref || stagingHref ? (
        <div className="mt-3 space-y-1">
          {repoHref ? (
            <a
              href={repoHref}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-sm font-medium text-[var(--admin-blue)] hover:underline"
            >
              Open Repository ↗
            </a>
          ) : null}
          {branch.trim() ? <p className="text-[12px] text-[var(--admin-muted)]">Branch: {branch}</p> : null}
          {stagingHref ? (
            <a
              href={stagingHref}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 block text-sm font-medium text-[var(--admin-blue)] hover:underline"
            >
              Open Staging ↗
            </a>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

/** Team Member/QA: confirms the gate that unlocked QA, the staging link to actually test against, and the last verdict on file. */
function QaContextPanel({
  devComplete,
  stagingHref,
  qaResult,
}: {
  devComplete: boolean;
  stagingHref: string | null;
  qaResult: "pass" | "fail" | null;
}) {
  return (
    <section className="rounded-lg border border-[var(--admin-line)] bg-[var(--admin-bg)] p-4">
      <h3 className="font-heading text-sm font-semibold text-[var(--admin-ink)]">QA</h3>
      {!devComplete ? (
        <p className="mt-1 text-sm text-[#b45309]">
          Development isn't complete yet — this task shouldn't be actionable until it is.
        </p>
      ) : (
        <p className="mt-1 text-sm text-[var(--admin-muted)]">
          Development is complete. Test against staging and record a Pass or Fail when you complete this task.
        </p>
      )}
      {qaResult ? (
        <p className="mt-1 text-[12px] text-[var(--admin-muted)]">
          Most recent QA result on file: {qaResult === "pass" ? "Passed" : "Failed"}
        </p>
      ) : null}
      {stagingHref ? (
        <a
          href={stagingHref}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block text-sm font-medium text-[var(--admin-blue)] hover:underline"
        >
          Open Staging ↗
        </a>
      ) : null}
    </section>
  );
}
