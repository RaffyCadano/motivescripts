import { useMemo, useState } from "react";
import {
  Archive,
  MessageSquare,
  Pause,
  PencilLine,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { AdminActionsMenu } from "@/components/admin/AdminActionsMenu";
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
import { ProjectMilestonesPanel } from "@/components/admin/projects/ProjectMilestonesPanel";
import { ProjectOverview } from "@/components/admin/projects/ProjectOverview";
import { ProjectSectionNav } from "@/components/admin/projects/ProjectSectionNav";
import { ProjectStatusModal } from "@/components/admin/projects/ProjectStatusModal";
import { ProjectTasksPanel } from "@/components/admin/projects/ProjectTasksPanel";
import { TaskFormModal } from "@/components/admin/projects/TaskFormModal";
import { useAgencyProject, useLeads } from "@/components/admin/leads/LeadsProvider";
import { useTeamDirectory } from "@/components/admin/team/useTeamDirectory";
import {
  calculateProjectProgress,
  type AgencyMilestone,
  type AgencyMilestoneDraft,
  type AgencyProjectStatus,
  type AgencyTask,
} from "@/data/agencyProjects";
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
  } = useLeads();
  const { profile } = useAuth();
  const { data: teamData } = useTeamDirectory();
  const tabParam = searchParams.get("tab");
  const tab: ProjectSectionTabId = isProjectSectionTabId(tabParam) ? tabParam : "overview";
  const selectedFileId = searchParams.get("file");
  const [statusOpen, setStatusOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [milestoneOpen, setMilestoneOpen] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<AgencyMilestone | null>(null);
  const [removingMilestone, setRemovingMilestone] = useState<AgencyMilestone | null>(null);
  const [taskOpen, setTaskOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<AgencyTask | null>(null);
  const [taskMilestoneId, setTaskMilestoneId] = useState<string | undefined>(undefined);
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
  const progress = calculateProjectProgress(project);
  const headerAction = workflow.action;
  const showHeaderAction =
    headerAction &&
    headerAction.primaryKind === "link" &&
    headerAction.primaryLabel &&
    headerAction.primaryHref &&
    workflowPrimaryAllowed(headerAction, profile, canInviteClient(profile));

  return (
    <div className="space-y-6">
      <div>
        <Link to="/admin/projects" className="text-[12px] font-medium text-[var(--admin-blue)] hover:underline">
          Projects
        </Link>
        <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="font-heading text-[1.65rem] font-semibold tracking-tight md:text-3xl">{project.name}</h1>
            <p className="mt-1 text-sm text-[var(--admin-muted)]">
              {project.type}
              {" · "}
              {project.status}
              {" · "}
              {progress}%
              {project.archived ? " · Archived" : ""}
            </p>
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
      </div>

      <div className="grid gap-6 lg:grid-cols-[15.5rem_minmax(0,1fr)]">
        <ProjectSectionNav tab={tab} taskCount={openTaskCount} onSelect={setTab} />

        <div className="min-w-0">
          {tab === "overview" ? (
            <ProjectOverview project={project} client={client} workflow={workflow} onOpenTab={(next) => setTab(next as ProjectSectionTabId)} />
          ) : null}
          {tab === "tasks" ? (
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
            <ProjectFilesPanel project={project} selectedId={selectedFileId} onSelect={setSelectedFile} />
          ) : null}
          {tab === "feedback" ? <ProjectFeedbackPanel project={project} /> : null}
          {tab === "approvals" ? <ProjectApprovalsPanel project={project} /> : null}
          {tab === "activity" ? <ProjectActivityPanel project={project} /> : null}
        </div>
      </div>

      <ProjectStatusModal
        project={statusOpen ? project : null}
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
