import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { hasPermission, type StaffPermissionCode } from "@/auth/permissions";
import { ProgressBar } from "@/components/admin/ProgressBar";
import { useAgencyProject, useProjectDeliverables } from "@/components/admin/leads/LeadsProvider";
import { MilestoneStatusBadge } from "@/components/admin/projects/MilestoneStatusBadge";
import { ProjectActivityPanel } from "@/components/admin/projects/ProjectSupportPanels";
import { ProjectApprovalsPanel } from "@/components/admin/projects/ProjectApprovalsPanel";
import { ProjectFeedbackPanel } from "@/components/admin/projects/ProjectFeedbackPanel";
import { ProjectFilesPanel } from "@/components/admin/projects/ProjectFilesPanel";
import { ProjectMilestonesPanel } from "@/components/admin/projects/ProjectMilestonesPanel";
import { ProjectDevelopmentSection } from "@/components/admin/projects/ProjectDevelopmentSection";
import { ProjectProductionPipeline } from "@/components/admin/projects/ProjectProductionPipeline";
import { ProjectProductionTasksCard } from "@/components/admin/projects/ProjectProductionTasksCard";
import { ProjectStatusBadge } from "@/components/admin/projects/ProjectStatusBadge";
import { ProjectTeamRoster } from "@/components/admin/projects/ProjectTeamRoster";
import { useTeamDirectory } from "@/components/admin/team/useTeamDirectory";
import { TaskPriorityBadge } from "@/components/admin/projects/TaskPriorityBadge";
import { TaskStatusBadge } from "@/components/admin/projects/TaskStatusBadge";
import { TeamTaskDetail } from "@/components/team/TeamTaskDetail";
import { useTeamWork } from "@/components/team/useTeamWork";
import {
  calculateProjectProgress,
  currentMilestone,
  formatProjectDay,
  milestoneTaskCounts,
  upcomingMilestone,
  type AgencyMilestone,
  type AgencyProject,
  type AgencyTask,
  type AgencyTaskStatus,
} from "@/data/agencyProjects";
import { displayMilestoneName } from "@/data/projectMilestones";
import { taskInstructionPreview } from "@/data/productionTaskInstructions";
import { isAssignedToMe, myOpenTaskCount, projectWorkload, teamProjectHref, type TeamWorkTask } from "@/data/teamWorkspace";
import { AgencyDbError } from "@/lib/dbErrors";
import { cn } from "@/lib/cn";

const tabs = [
  { id: "overview", label: "Overview" },
  { id: "tasks", label: "Tasks" },
  { id: "milestones", label: "Milestones" },
  { id: "files", label: "Files", permission: "files.view" },
  { id: "feedback", label: "Feedback", permission: "files.view" },
  { id: "approvals", label: "Approvals", permission: "files.view" },
  { id: "activity", label: "Activity", permission: "activity.view" },
] as const;

type TabId = (typeof tabs)[number]["id"];

function isTabId(value: string | null): value is TabId {
  return tabs.some((item) => item.id === value);
}

export function TeamProjectDetails() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const match = useAgencyProject(id);
  const { profile, tasks, deliverables, changeTaskStatus } = useTeamWork();
  const [openTask, setOpenTask] = useState<TeamWorkTask | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tabParam = searchParams.get("tab");
  const selectedFileId = searchParams.get("file");
  const canMessages = hasPermission(profile, "messages.view");

  const visibleTabs = tabs.filter((item) => {
    if (!("permission" in item) || !item.permission) return true;
    const code = item.permission as StaffPermissionCode;
    if (code === "files.view") {
      return hasPermission(profile, "files.view") || hasPermission(profile, "feedback.manage");
    }
    if (code === "activity.view") {
      return hasPermission(profile, "activity.view") || hasPermission(profile, "projects.view");
    }
    return hasPermission(profile, code);
  });

  const tab: TabId = isTabId(tabParam) && visibleTabs.some((item) => item.id === tabParam) ? tabParam : "overview";

  function setTab(next: TabId) {
    const nextParams = new URLSearchParams(searchParams);
    if (next === "overview") nextParams.delete("tab");
    else nextParams.set("tab", next);
    if (next !== "files") nextParams.delete("file");
    setSearchParams(nextParams, { replace: true });
  }

  function setSelectedFile(fileId: string | null) {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("tab", "files");
    if (fileId) nextParams.set("file", fileId);
    else nextParams.delete("file");
    setSearchParams(nextParams, { replace: true });
  }

  async function onStatusChange(status: AgencyTaskStatus) {
    if (!openTask) return;
    setBusy(true);
    setError(null);
    try {
      await changeTaskStatus(openTask, status);
      setOpenTask((current) => (current ? { ...current, status } : current));
    } catch (caught) {
      setError(caught instanceof AgencyDbError ? caught.message : "Unable to update this task.");
    } finally {
      setBusy(false);
    }
  }

  if (!match?.project) {
    return (
      <div>
        <h1 className="font-heading text-[1.65rem] font-semibold tracking-tight">Project not found</h1>
        <p className="mt-2 text-sm text-[var(--admin-muted)]">
          You can only open projects assigned to you.
        </p>
        <Link
          to="/team/projects"
          className="mt-4 inline-flex font-heading text-sm font-semibold text-[var(--admin-blue)] hover:underline"
        >
          Back to projects
        </Link>
      </div>
    );
  }

  const { project, client } = match;
  const work = projectWorkload(project);
  const milestone = currentMilestone(project);
  const nextMilestone = upcomingMilestone(project);
  const myOpen = myOpenTaskCount(project, profile?.id ?? "", profile?.fullName ?? "");
  const fileHref = (fileId: string) => teamProjectHref(project.id, { tab: "files", file: fileId });
  const progress = calculateProjectProgress(project);

  return (
    <div className="space-y-6">
      <div>
        <Link to="/team/projects" className="text-[12px] font-medium text-[var(--admin-blue)] hover:underline">
          My Projects
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-heading text-[1.65rem] font-semibold tracking-tight md:text-3xl">{project.name}</h1>
            <p className="mt-1 text-sm text-[var(--admin-muted)]">
              {client?.businessName ?? "Not set"} · {project.type}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              <span className="inline-flex items-center gap-2">
                <span className="text-[var(--admin-muted)]">Status</span>
                <ProjectStatusBadge status={project.status} />
              </span>
              <span>
                <span className="text-[var(--admin-muted)]">Progress</span>{" "}
                <span className="font-heading font-semibold text-[var(--admin-ink)]">{progress}%</span>
              </span>
              <span>
                <span className="text-[var(--admin-muted)]">Phase</span>{" "}
                <span className="font-medium text-[var(--admin-ink)]">
                  {milestone ? displayMilestoneName(milestone.name) : "Not set"}
                </span>
              </span>
            </div>
          </div>
          {canMessages && client ? (
            <Link
              to={`/team/messages?client=${client.id}&project=${project.id}`}
              className="inline-flex h-8 shrink-0 items-center rounded-lg border border-[var(--admin-line)] bg-white px-3 font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:bg-[var(--admin-bg)]"
            >
              Open messages
            </Link>
          ) : null}
        </div>
      </div>

      {project.status === "Planning" && project.tasks.length > 0 ? (
        <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] px-4 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--admin-muted)]">
            Production ready
          </p>
          <p className="mt-1 text-sm text-[var(--admin-muted)]">
            The production checklist from the approved scope is on Tasks. Work assigned to you also appears under My
            Tasks.
          </p>
          <button
            type="button"
            className="mt-3 font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline"
            onClick={() => setTab("tasks")}
          >
            View tasks
          </button>
        </section>
      ) : null}

      <nav aria-label="Project sections" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
        {visibleTabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 font-heading text-[12px] font-semibold",
              tab === item.id
                ? "bg-[var(--admin-navy)] text-white"
                : "bg-white text-[var(--admin-ink)] ring-1 ring-[var(--admin-line)] hover:bg-[var(--admin-hover)]",
            )}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {tab === "overview" ? (
        <TeamProjectOverview
          project={project}
          clientName={client?.businessName ?? "Not set"}
          work={work}
          milestone={milestone}
          nextMilestone={nextMilestone}
          myOpen={myOpen}
          onOpenTasks={() => setTab("tasks")}
        />
      ) : null}
      {tab === "tasks" ? (
        <TeamProjectTasks
          project={project}
          userId={profile?.id ?? ""}
          fullName={profile?.fullName ?? ""}
          onOpenTask={(task) => {
            const mapped = tasks.find((item) => item.id === task.id);
            setOpenTask(
              mapped ?? {
                id: task.id,
                projectId: project.id,
                projectName: project.name,
                clientId: project.clientId,
                clientName: client?.businessName ?? "Client",
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
                milestoneName: project.milestones.find((item) => item.id === task.milestoneId)?.name ?? "",
                recommendedRole: task.recommendedRole,
                taskType: task.taskType,
              },
            );
          }}
        />
      ) : null}
      {tab === "milestones" ? <ProjectMilestonesPanel project={project} /> : null}
      {tab === "files" ? (
        <ProjectFilesPanel project={project} selectedId={selectedFileId} onSelect={setSelectedFile} />
      ) : null}
      {tab === "feedback" ? <ProjectFeedbackPanel project={project} fileHref={fileHref} /> : null}
      {tab === "approvals" ? <ProjectApprovalsPanel project={project} fileHref={fileHref} /> : null}
      {tab === "activity" ? <ProjectActivityPanel project={project} /> : null}

      {openTask ? (
        <TeamTaskDetail
          task={openTask}
          files={deliverables.filter((item) => item.projectId === openTask.projectId)}
          canUpdateStatus={Boolean(
            profile?.id &&
              (openTask.assignedTo === profile.id ||
                (!openTask.assignedTo &&
                  profile.fullName.trim() &&
                  openTask.assignee.trim().toLowerCase() === profile.fullName.trim().toLowerCase())),
          )}
          busy={busy}
          error={error}
          onClose={() => {
            setOpenTask(null);
            setError(null);
          }}
          onStatusChange={(status) => void onStatusChange(status)}
        />
      ) : null}
    </div>
  );
}

function TeamProjectOverview({
  project,
  clientName,
  work,
  milestone,
  nextMilestone,
  myOpen,
  onOpenTasks,
}: {
  project: AgencyProject;
  clientName: string;
  work: ReturnType<typeof projectWorkload>;
  milestone: AgencyMilestone | null;
  nextMilestone: AgencyMilestone | null;
  myOpen: number;
  onOpenTasks: () => void;
}) {
  const milestoneCounts = milestone ? milestoneTaskCounts(project, milestone.id) : null;
  const files = useProjectDeliverables(project.id);
  const team = useTeamDirectory();
  const assignedLabels = team.data
    ? Object.fromEntries(
        team.data.members.flatMap((member) =>
          member.projectAssignments
            .filter((item) => item.entityId === project.id)
            .map((item) => [member.id, item.label]),
        ),
      )
    : {};

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
      <div className="space-y-6">
        <ProjectProductionPipeline project={project} />
        {team.data ? (
          <ProjectTeamRoster
            members={team.data.members}
            projectId={project.id}
            clientId={project.clientId}
            assignedLabels={assignedLabels}
          />
        ) : null}
        <ProjectProductionTasksCard project={project} onOpenTasks={onOpenTasks} />
        <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
          <h2 className="font-heading text-sm font-semibold tracking-tight">Progress</h2>
          {work.total === 0 ? (
            <p className="mt-3 text-sm text-[var(--admin-muted)]">No production tasks on this project yet.</p>
          ) : (
            <>
              <p className="mt-3 font-heading text-3xl font-semibold tracking-tight">{work.progress}%</p>
              <p className="mt-1 text-sm text-[var(--admin-muted)]">
                {work.completed} of {work.total} tasks completed · {myOpen} assigned to you
              </p>
              <div className="mt-4">
                <ProgressBar value={work.progress} />
              </div>
            </>
          )}
          {milestone ? (
            <div className="mt-5 border-t border-[var(--admin-line)] pt-4">
              <p className="text-[12px] text-[var(--admin-muted)]">Current milestone</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <p className="font-heading text-sm font-semibold">{displayMilestoneName(milestone.name)}</p>
                <MilestoneStatusBadge status={milestone.status} />
              </div>
              <p className="mt-2 text-sm text-[var(--admin-muted)]">
                {milestoneCounts && milestoneCounts.total > 0
                  ? `${milestoneCounts.completed} of ${milestoneCounts.total} tasks in this milestone`
                  : "No tasks yet. Tasks can be added when the project reaches this stage."}
              </p>
            </div>
          ) : null}
          {nextMilestone ? (
            <p className="mt-3 text-sm text-[var(--admin-muted)]">Upcoming: {nextMilestone.name}</p>
          ) : null}
          <button
            type="button"
            className="mt-4 font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline"
            onClick={onOpenTasks}
          >
            View tasks
          </button>
        </section>

        <ProjectDevelopmentSection development={project.development} />
      </div>
      <aside className="space-y-4">
        <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
          <h2 className="font-heading text-sm font-semibold tracking-tight">Details</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-[12px] text-[var(--admin-muted)]">Client</dt>
              <dd className="mt-0.5 font-medium">{clientName}</dd>
            </div>
            <div>
              <dt className="text-[12px] text-[var(--admin-muted)]">Status</dt>
              <dd className="mt-0.5 font-medium">{project.status}</dd>
            </div>
            <div>
              <dt className="text-[12px] text-[var(--admin-muted)]">Target launch</dt>
              <dd className="mt-0.5 font-medium">{formatProjectDay(project.targetLaunchDate)}</dd>
            </div>
            <div>
              <dt className="text-[12px] text-[var(--admin-muted)]">Files</dt>
              <dd className="mt-0.5 font-medium">{files.length}</dd>
            </div>
          </dl>
        </section>
      </aside>
    </div>
  );
}

function TeamProjectTasks({
  project,
  userId,
  fullName,
  onOpenTask,
}: {
  project: AgencyProject;
  userId: string;
  fullName: string;
  onOpenTask: (task: AgencyTask) => void;
}) {
  const orderedMilestones = [...project.milestones].sort((a, b) => a.order - b.order);
  const grouped = [
    ...orderedMilestones.map((milestone) => ({
      milestone,
      tasks: project.tasks.filter((task) => task.milestoneId === milestone.id),
    })),
    {
      milestone: null,
      tasks: project.tasks.filter(
        (task) => !task.milestoneId || !orderedMilestones.some((item) => item.id === task.milestoneId),
      ),
    },
  ].filter((group) => group.tasks.length > 0 || group.milestone);

  return (
    <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
      <h2 className="font-heading text-sm font-semibold tracking-tight">Tasks</h2>
      <p className="mt-1 text-[12px] text-[var(--admin-muted)]">
        Update status on tasks assigned to you. Unassigned production tasks stay visible until an admin assigns them.
      </p>
      {project.tasks.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--admin-muted)]">No tasks on this project yet.</p>
      ) : (
        <div className="mt-5 space-y-6">
          {grouped.map((group) => (
            <div key={group.milestone?.id ?? "ungrouped"}>
              <h3 className="font-heading text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--admin-muted)]">
                {group.milestone?.name ?? "Ungrouped"}
              </h3>
              {group.tasks.length === 0 ? (
                <p className="mt-2 text-sm text-[var(--admin-muted)]">No tasks in this milestone.</p>
              ) : (
                <ul className="mt-2 divide-y divide-[var(--admin-line)]">
                  {group.tasks.map((task) => {
                    const mine = isAssignedToMe(task, userId, fullName);
                    const preview = taskInstructionPreview(task.title, task.description);
                    return (
                      <li key={task.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <p className={cn("text-sm font-medium", task.status === "Completed" && "text-[var(--admin-muted)] line-through")}>
                            {task.title}
                          </p>
                          {preview ? <p className="mt-1 text-[12px] text-[var(--admin-muted)]">{preview}</p> : null}
                          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                            <TaskStatusBadge status={task.status} />
                            <TaskPriorityBadge priority={task.priority} />
                            <span className="text-[12px] text-[var(--admin-muted)]">
                              {mine ? "Assigned to you" : task.assignee.trim() || "Unassigned"}
                            </span>
                            <span className="text-[12px] text-[var(--admin-muted)]">Due {formatProjectDay(task.dueDate)}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="inline-flex h-8 shrink-0 items-center self-start rounded-lg border border-[var(--admin-line)] px-2.5 font-heading text-[11px] font-semibold hover:bg-[var(--admin-bg)]"
                          onClick={() => onOpenTask(task)}
                        >
                          {mine ? "Update" : "View"}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
