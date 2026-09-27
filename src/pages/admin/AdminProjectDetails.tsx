import { useMemo, useState } from "react";
import { projectPackageLabels } from "@/data/projectPackages";
import {
  Archive,
  Building2,
  CalendarDays,
  FolderKanban,
  MessageSquare,
  Pause,
  PauseCircle,
  PencilLine,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { hasPermission } from "@/auth/permissions";
import { ProjectStatusBadge } from "@/components/admin/projects/ProjectStatusBadge";
import { AdminActionsMenu } from "@/components/admin/AdminActionsMenu";
import { Breadcrumbs } from "@/components/admin/Breadcrumbs";
import { adminPrimaryBtn } from "@/components/admin/adminActionStyles";
import { canInviteClient, workflowPrimaryAllowed } from "@/components/admin/projects/workflowPermissions";
import { useProjectWorkflowState } from "@/components/admin/projects/useProjectWorkflowState";
import { ConfirmDocumentModal } from "@/components/documents/ConfirmDocumentModal";
import { ConfirmArchiveProjectModal } from "@/components/admin/projects/ConfirmArchiveProjectModal";
import { ConfirmRemoveMilestoneModal } from "@/components/admin/projects/ConfirmRemoveMilestoneModal";
import { MilestoneFormModal } from "@/components/admin/projects/MilestoneFormModal";
import { ProjectActivityPanel } from "@/components/admin/projects/ProjectSupportPanels";
import { ProjectApprovalsPanel } from "@/components/admin/projects/ProjectApprovalsPanel";
import { ProjectFeedbackPanel } from "@/components/admin/projects/ProjectFeedbackPanel";
import { ProjectFilesPanel } from "@/components/admin/projects/ProjectFilesPanel";
import { ProjectTimePanel } from "@/components/admin/projects/ProjectTimePanel";
import { ProjectVersionsPanel } from "@/components/admin/projects/ProjectVersionsPanel";
import { ProjectAccessPanel } from "@/components/admin/projects/ProjectAccessPanel";
import { ProjectMilestonesPanel } from "@/components/admin/projects/ProjectMilestonesPanel";
import { ProjectOverview } from "@/components/admin/projects/ProjectOverview";
import { ProjectSectionNav } from "@/components/admin/projects/ProjectSectionNav";
import { PauseWebsiteDialog } from "@/components/admin/projects/PauseWebsiteDialog";
import { ProjectWebsitePauseBanner } from "@/components/admin/projects/ProjectWebsitePauseBanner";
import { ProjectStatusModal } from "@/components/admin/projects/ProjectStatusModal";
import { ProjectTasksPanel } from "@/components/admin/projects/ProjectTasksPanel";
import { TaskFormModal } from "@/components/admin/projects/TaskFormModal";
import { TaskWorkspace } from "@/components/tasks/TaskWorkspace";
import { useAgencyProject, useLeads } from "@/components/admin/leads/LeadsProvider";
import { useTeamDirectory } from "@/components/admin/team/useTeamDirectory";
import {
  calculateProjectProgress,
  formatProjectDay,
  type AgencyMilestone,
  type AgencyMilestoneDraft,
  type AgencyProjectStatus,
  type AgencyTask,
  type AgencyTaskStatus,
} from "@/data/agencyProjects";
import { AgencyDbError } from "@/lib/dbErrors";
import { isProjectSectionTabId, projectOpenTaskCount, type ProjectSectionTabId } from "@/data/projectSectionNav";
import { productionTaskAssigneeOptions } from "@/data/team";

export function AdminProjectDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const match = useAgencyProject(id);
  const {
    setProjectStatus,
    archiveProject,
    deleteProject,
    addMilestone,
    updateMilestone,
    setMilestoneStatus,
    moveMilestone,
    removeMilestone,
    addTask,
    updateTask,
    toggleTaskComplete,
    portalAccounts,
    deliverables,
  } = useLeads();
  const { profile } = useAuth();
  const { data: teamData } = useTeamDirectory();
  const tabParam = searchParams.get("tab");
  const tab: ProjectSectionTabId = isProjectSectionTabId(tabParam) ? tabParam : "overview";
  const selectedFileId = searchParams.get("file");
  const [statusOpen, setStatusOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pauseOpen, setPauseOpen] = useState(false);
  const [milestoneOpen, setMilestoneOpen] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<AgencyMilestone | null>(null);
  const [removingMilestone, setRemovingMilestone] = useState<AgencyMilestone | null>(null);
  const [taskOpen, setTaskOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<AgencyTask | null>(null);
  const [taskMilestoneId, setTaskMilestoneId] = useState<string | undefined>(undefined);
  const openTaskId = searchParams.get("task");
  const [workspaceBusy, setWorkspaceBusy] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const projectId = match?.project.id ?? "";
  const clientId = match?.client?.id;
  const portalLinked = clientId
    ? portalAccounts.some((account) => account.clientId === clientId && account.role === "client")
    : false;
  const workflow = useProjectWorkflowState(match?.project ?? null, match?.client ?? null, portalLinked);
  const assignees = useMemo(
    () => productionTaskAssigneeOptions(teamData?.members ?? [], projectId),
    [projectId, teamData?.members],
  );
  const openTaskCount = useMemo(
    () => (match?.project ? projectOpenTaskCount(match.project.tasks) : 0),
    [match?.project],
  );

  function setTab(next: ProjectSectionTabId) {
    const nextParams = new URLSearchParams(searchParams);
    if (next === "overview") nextParams.delete("tab");
    else nextParams.set("tab", next);
    if (next !== "files") nextParams.delete("file");
    setSearchParams(nextParams, { replace: true });
  }

  function openDiscovery() {
    setTab("overview");
    requestAnimationFrame(() => {
      document.getElementById("project-discovery")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function closeWorkspace() {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("task");
    setSearchParams(nextParams);
  }

  function openDiscoveryFromWorkspace() {
    closeWorkspace();
    openDiscovery();
  }

  function openFilesFromWorkspace() {
    closeWorkspace();
    setTab("files");
  }

  async function handleWorkspaceStatusChange(task: AgencyTask, status: AgencyTaskStatus) {
    setWorkspaceBusy(true);
    setWorkspaceError(null);
    try {
      await updateTask(match!.project.id, task.id, {
        title: task.title,
        description: task.description,
        milestoneId: task.milestoneId,
        status,
        priority: task.priority,
        assignee: task.assignee,
        assignedTo: task.assignedTo,
        dueDate: task.dueDate,
        recommendedRole: task.recommendedRole,
        taskType: task.taskType,
        referenceUrl: task.referenceUrl,
        estimatedHours: task.estimatedHours,
      });
    } catch (caught) {
      setWorkspaceError(caught instanceof AgencyDbError ? caught.message : "Unable to update this task.");
    } finally {
      setWorkspaceBusy(false);
    }
  }

  function setSelectedFile(fileId: string | null) {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("tab", "files");
    if (fileId) nextParams.set("file", fileId);
    else nextParams.delete("file");
    setSearchParams(nextParams, { replace: true });
  }

  if (!match?.project) {
    return (
      <div>
        <h1 className="font-heading text-[1.65rem] font-semibold tracking-tight">Project not found</h1>
        <p className="mt-2 text-sm text-[var(--admin-muted)]">That project isn’t in the database.</p>
        <Link
          to="/admin/projects"
          className="mt-4 inline-flex font-heading text-sm font-semibold text-[var(--admin-blue)] hover:underline"
        >
          Back to projects
        </Link>
      </div>
    );
  }

  const { project, client } = match;
  const openTask = openTaskId ? (project.tasks.find((item) => item.id === openTaskId) ?? null) : null;
  const progress = calculateProjectProgress(project);
  // A launched website that isn't already paused can be paused by hand.
  const canPauseWebsite =
    hasPermission(profile, "projects.manage") &&
    project.development.deploymentStatus === "Production" &&
    !project.development.pausedAt;
  const headerAction = workflow.action;
  const showHeaderAction =
    headerAction &&
    headerAction.primaryKind === "link" &&
    headerAction.primaryLabel &&
    headerAction.primaryHref &&
    // This same action also drives the "Next step" nudge on the client's own page, where "Open
    // Project" correctly jumps here. Shown on the project's own header, that link points at the
    // page already open, so it is dropped rather than offered as a no-op button.
    headerAction.primaryHref !== `/admin/projects/${project.id}` &&
    workflowPrimaryAllowed(headerAction, profile, canInviteClient(profile));

  return (
    <div className="space-y-6">
      <div>
        <Link to="/admin/projects" className="text-[12px] font-medium text-[var(--admin-blue)] hover:underline">
          Projects
        </Link>
        <div className="mt-2 rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5 shadow-[0_1px_2px_rgb(7_17_31_/_0.04)] md:p-6">
          <div className="flex flex-col items-start gap-4 lg:flex-row lg:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <span
                aria-hidden="true"
                className="flex size-14 shrink-0 items-center justify-center rounded-full bg-[var(--admin-navy)] text-white"
              >
                <FolderKanban size={22} strokeWidth={2} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="truncate font-heading text-[1.5rem] font-semibold tracking-tight md:text-[1.75rem]">
                    {project.name}
                  </h1>
                  <ProjectStatusBadge status={project.status} />
                  {project.archived ? (
                    <span className="rounded-full bg-[var(--admin-bg)] px-2 py-0.5 font-heading text-xs font-semibold text-[var(--admin-muted)]">
                      Archived
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 text-sm text-[var(--admin-muted)]">
                  {project.type}
                  {project.package ? ` · ${projectPackageLabels[project.package]} package` : ""}
                  {" · "}
                  {progress}% complete
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {showHeaderAction ? (
                <Link to={headerAction.primaryHref!} className={`${adminPrimaryBtn} justify-center`}>
                  {headerAction.primaryLabel}
                </Link>
              ) : null}
              <AdminActionsMenu
              ariaLabel={`Actions for ${project.name}`}
              items={[
              { id: "edit", label: "Edit Project", icon: PencilLine, href: `/admin/projects/${project.id}/edit` },
              ...(client
                ? [
                    {
                      id: "conversation",
                      label: "Open conversation",
                      icon: MessageSquare,
                      href: `/admin/messages?client=${client.id}&project=${project.id}`,
                    },
                  ]
                : []),
              { id: "status", label: "Change Status", icon: RefreshCw, onSelect: () => setStatusOpen(true) },
              {
                id: "hold",
                label: "Put On Hold",
                icon: Pause,
                onSelect: () => setProjectStatus(project.id, "On Hold"),
              },
              ...(canPauseWebsite
                ? [
                    {
                      id: "pause-website",
                      label: "Pause website",
                      icon: PauseCircle,
                      onSelect: () => setPauseOpen(true),
                    },
                  ]
                : []),
              {
                id: "archive",
                label: "Archive Project",
                icon: Archive,
                danger: true,
                separatorBefore: true,
                onSelect: () => setArchiveOpen(true),
              },
              {
                id: "delete",
                label: "Delete project",
                icon: Trash2,
                danger: true,
                onSelect: () => setDeleteOpen(true),
              },
            ]}
              />
            </div>
          </div>

          <dl className="mt-4 grid gap-2.5 sm:grid-cols-3">
            {client ? (
              <Link
                to={`/admin/clients/${client.id}`}
                className="flex items-center gap-2.5 rounded-lg bg-[var(--admin-bg)] px-3 py-2 hover:bg-[var(--admin-hover)]"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[rgb(0_80_240_/_0.08)] text-[var(--admin-blue)]">
                  <Building2 size={15} strokeWidth={2} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <dt className="text-[11px] text-[var(--admin-muted)]">Client</dt>
                  <dd className="truncate font-heading text-[13px] font-semibold text-[var(--admin-blue)]">{client.businessName}</dd>
                </div>
              </Link>
            ) : null}
            <div className="flex items-center gap-2.5 rounded-lg bg-[var(--admin-bg)] px-3 py-2">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[rgb(0_80_240_/_0.08)] text-[var(--admin-blue)]">
                <FolderKanban size={15} strokeWidth={2} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <dt className="text-[11px] text-[var(--admin-muted)]">Type</dt>
                <dd className="truncate font-heading text-[13px] font-semibold text-[var(--admin-ink)]">{project.type}</dd>
              </div>
            </div>
            <div className="flex items-center gap-2.5 rounded-lg bg-[var(--admin-bg)] px-3 py-2">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[rgb(0_80_240_/_0.08)] text-[var(--admin-blue)]">
                <CalendarDays size={15} strokeWidth={2} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <dt className="text-[11px] text-[var(--admin-muted)]">Target launch</dt>
                <dd className="truncate font-heading text-[13px] font-semibold text-[var(--admin-ink)]">{formatProjectDay(project.targetLaunchDate)}</dd>
              </div>
            </div>
          </dl>
        </div>
      </div>

      <ProjectWebsitePauseBanner project={project} canManage={hasPermission(profile, "projects.manage")} />

      <div className="grid gap-6 lg:grid-cols-[15.5rem_minmax(0,1fr)]">
        <ProjectSectionNav tab={tab} taskCount={openTaskCount} onSelect={setTab} />

        <div className="min-w-0">
          {tab === "overview" ? (
            <ProjectOverview project={project} client={client} workflow={workflow} onOpenTab={(next) => setTab(next as ProjectSectionTabId)} />
          ) : null}
          {tab === "tasks" && openTask ? (
            <TaskWorkspace
              task={openTask}
              project={project}
              clientName={client?.businessName ?? "Client"}
              deliverables={deliverables}
              busy={workspaceBusy}
              error={workspaceError}
              variant="page"
              breadcrumb={
                <Breadcrumbs
                  items={[
                    { label: "Projects", href: "/admin/projects" },
                    { label: project.name, href: `/admin/projects/${project.id}` },
                    { label: openTask.title },
                  ]}
                />
              }
              onClose={closeWorkspace}
              onStatusChange={(status) => void handleWorkspaceStatusChange(openTask, status)}
              onOpenDiscovery={openDiscoveryFromWorkspace}
              onOpenFiles={openFilesFromWorkspace}
            />
          ) : tab === "tasks" ? (
            <ProjectTasksPanel
              project={project}
              onAdd={() => {
                setEditingTask(null);
                setTaskMilestoneId(undefined);
                setTaskOpen(true);
              }}
              onAddForMilestone={(milestone) => {
                setEditingTask(null);
                setTaskMilestoneId(milestone.id);
                setTaskOpen(true);
              }}
              onEdit={(task) => {
                setEditingTask(task);
                setTaskOpen(true);
              }}
              onToggle={(task) => toggleTaskComplete(project.id, task.id)}
              onOpenDiscovery={openDiscovery}
              onOpenWorkspace={(task) => {
                setWorkspaceError(null);
                const nextParams = new URLSearchParams(searchParams);
                nextParams.set("tab", "tasks");
                nextParams.set("task", task.id);
                setSearchParams(nextParams);
              }}
            />
          ) : null}
          {tab === "milestones" ? (
            <ProjectMilestonesPanel
              project={project}
              onAdd={() => {
                setEditingMilestone(null);
                setMilestoneOpen(true);
              }}
              onAddTask={(item) => {
                setEditingTask(null);
                setTaskMilestoneId(item.id);
                setTaskOpen(true);
              }}
              onEdit={(item) => {
                setEditingMilestone(item);
                setMilestoneOpen(true);
              }}
              onComplete={(item) => setMilestoneStatus(project.id, item.id, "Completed")}
              onReopen={(item) => setMilestoneStatus(project.id, item.id, "In Progress")}
              onHold={(item) => setMilestoneStatus(project.id, item.id, "On Hold")}
              onMove={(item, direction) => moveMilestone(project.id, item.id, direction)}
              onRemove={setRemovingMilestone}
            />
          ) : null}
          {tab === "files" ? (
            <ProjectFilesPanel
              project={project}
              selectedId={selectedFileId}
              onSelect={setSelectedFile}
              breadcrumbItems={[{ label: "Files", href: `/admin/projects/${project.id}?tab=files` }]}
            />
          ) : null}
          {tab === "time" ? <ProjectTimePanel project={project} /> : null}
          {tab === "versions" ? <ProjectVersionsPanel project={project} /> : null}
          {tab === "access" ? <ProjectAccessPanel project={project} /> : null}
          {tab === "feedback" ? <ProjectFeedbackPanel project={project} /> : null}
          {tab === "approvals" ? <ProjectApprovalsPanel project={project} /> : null}
          {tab === "activity" ? <ProjectActivityPanel project={project} /> : null}
        </div>
      </div>

      <ProjectStatusModal
        project={statusOpen ? project : null}
        deliverables={deliverables.filter((item) => item.projectId === project.id)}
        onClose={() => setStatusOpen(false)}
        onSave={(status: AgencyProjectStatus) => {
          setProjectStatus(project.id, status);
          setStatusOpen(false);
        }}
      />
      <ConfirmArchiveProjectModal
        project={archiveOpen ? project : null}
        onClose={() => setArchiveOpen(false)}
        onConfirm={() => {
          archiveProject(project.id);
          setArchiveOpen(false);
        }}
      />
      <PauseWebsiteDialog project={project} open={pauseOpen} onClose={() => setPauseOpen(false)} />
      <ConfirmDocumentModal
        open={deleteOpen}
        danger
        title="Delete this project?"
        description="This permanently removes the project, including its tasks, files, and activity. This cannot be undone. Proposals, contracts, or invoices on this project must be removed first."
        actionLabel="Delete project"
        onClose={() => setDeleteOpen(false)}
        onConfirm={async () => {
          const deleted = await deleteProject(project.id);
          if (!deleted) return;
          setDeleteOpen(false);
          navigate("/admin/projects");
        }}
      />
      <MilestoneFormModal
        open={milestoneOpen}
        milestone={editingMilestone}
        onClose={() => {
          setMilestoneOpen(false);
          setEditingMilestone(null);
        }}
        onSubmit={(draft: AgencyMilestoneDraft) => {
          if (editingMilestone) updateMilestone(project.id, editingMilestone.id, draft);
          else addMilestone(project.id, draft);
        }}
      />
      <ConfirmRemoveMilestoneModal
        milestone={removingMilestone}
        onClose={() => setRemovingMilestone(null)}
        onConfirm={() => {
          if (removingMilestone) removeMilestone(project.id, removingMilestone.id);
          setRemovingMilestone(null);
        }}
      />
      <TaskFormModal
        open={taskOpen}
        task={editingTask}
        milestones={project.milestones}
        defaultMilestoneId={taskMilestoneId}
        assignees={assignees}
        onClose={() => {
          setTaskOpen(false);
          setEditingTask(null);
          setTaskMilestoneId(undefined);
        }}
        onSubmit={(draft) => {
          if (editingTask) updateTask(project.id, editingTask.id, draft);
          else addTask(project.id, draft);
        }}
      />
    </div>
  );
}
