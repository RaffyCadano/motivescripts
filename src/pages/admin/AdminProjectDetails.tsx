import { useState } from "react";
import { Archive, MessageSquare, Pause, PencilLine, RefreshCw, Trash2 } from "lucide-react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AdminActionsMenu } from "@/components/admin/AdminActionsMenu";
import { ConfirmDocumentModal } from "@/components/documents/ConfirmDocumentModal";
import { ProgressBar } from "@/components/admin/ProgressBar";
import { ConfirmArchiveProjectModal } from "@/components/admin/projects/ConfirmArchiveProjectModal";
import { ConfirmRemoveMilestoneModal } from "@/components/admin/projects/ConfirmRemoveMilestoneModal";
import { MilestoneFormModal } from "@/components/admin/projects/MilestoneFormModal";
import { ProjectActivityPanel } from "@/components/admin/projects/ProjectSupportPanels";
import { ProjectApprovalsPanel } from "@/components/admin/projects/ProjectApprovalsPanel";
import { ProjectFeedbackPanel } from "@/components/admin/projects/ProjectFeedbackPanel";
import { ProjectFilesPanel } from "@/components/admin/projects/ProjectFilesPanel";
import { ProjectFormModal } from "@/components/admin/projects/ProjectFormModal";
import { ProjectMilestonesPanel } from "@/components/admin/projects/ProjectMilestonesPanel";
import { ProjectOverview } from "@/components/admin/projects/ProjectOverview";
import { ProjectStatusBadge } from "@/components/admin/projects/ProjectStatusBadge";
import { ProjectStatusModal } from "@/components/admin/projects/ProjectStatusModal";
import { ProjectTasksPanel } from "@/components/admin/projects/ProjectTasksPanel";
import { TaskFormModal } from "@/components/admin/projects/TaskFormModal";
import { useAgencyProject, useLeads } from "@/components/admin/leads/LeadsProvider";
import {
  calculateProjectProgress,
  currentMilestone,
  formatProjectDay,
  milestoneTaskCounts,
  taskCounts,
  type AgencyMilestone,
  type AgencyMilestoneDraft,
  type AgencyProjectStatus,
  type AgencyTask,
} from "@/data/agencyProjects";
import { cn } from "@/lib/cn";

const tabs = [
  { id: "overview", label: "Overview" },
  { id: "tasks", label: "Tasks" },
  { id: "milestones", label: "Milestones" },
  { id: "files", label: "Files" },
  { id: "feedback", label: "Feedback" },
  { id: "approvals", label: "Approvals" },
  { id: "activity", label: "Activity" },
] as const;

type TabId = (typeof tabs)[number]["id"];

function isTabId(value: string | null): value is TabId {
  return tabs.some((item) => item.id === value);
}

export function AdminProjectDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const match = useAgencyProject(id);
  const {
    clients,
    updateProject,
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
  } = useLeads();
  const tabParam = searchParams.get("tab");
  const tab: TabId = isTabId(tabParam) ? tabParam : "overview";
  const selectedFileId = searchParams.get("file");
  const [editOpen, setEditOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [milestoneOpen, setMilestoneOpen] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<AgencyMilestone | null>(null);
  const [removingMilestone, setRemovingMilestone] = useState<AgencyMilestone | null>(null);
  const [taskOpen, setTaskOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<AgencyTask | null>(null);

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
  const counts = taskCounts(project);
  const milestone = currentMilestone(project);
  const milestoneCounts = milestone ? milestoneTaskCounts(project, milestone.id) : null;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/admin/projects" className="text-[12px] font-medium text-[var(--admin-blue)] hover:underline">
          Projects
        </Link>
        <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            {client ? (
              <Link
                to={`/admin/clients/${client.id}`}
                className="text-[12px] font-medium text-[var(--admin-muted)] hover:text-[var(--admin-blue)] hover:underline"
              >
                {client.businessName}
              </Link>
            ) : (
              <p className="text-[12px] text-[var(--admin-muted)]">Unknown client</p>
            )}
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <h1 className="font-heading text-[1.65rem] font-semibold tracking-tight md:text-3xl">{project.name}</h1>
              <ProjectStatusBadge status={project.status} />
            </div>
            <p className="mt-1 text-sm text-[var(--admin-muted)]">
              {project.type}
              <span aria-hidden="true"> · </span>
              Progress {progress}%
              {counts.total > 0 ? ` · ${counts.completed} of ${counts.total} tasks` : ""}
              {project.archived ? " · Archived" : ""}
            </p>
          </div>
          <AdminActionsMenu
            ariaLabel={`Actions for ${project.name}`}
            items={[
              { id: "edit", label: "Edit Project", icon: PencilLine, onSelect: () => setEditOpen(true) },
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

      <nav aria-label="Project sections" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
        {tabs.map((item) => (
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

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
        <div>
          {tab === "overview" ? <ProjectOverview project={project} client={client} onOpenTab={(next) => setTab(next as TabId)} /> : null}
          {tab === "tasks" ? (
            <ProjectTasksPanel
              project={project}
              onAdd={() => {
                setEditingTask(null);
                setTaskOpen(true);
              }}
              onEdit={(task) => {
                setEditingTask(task);
                setTaskOpen(true);
              }}
              onToggle={(task) => toggleTaskComplete(project.id, task.id)}
            />
          ) : null}
          {tab === "milestones" ? (
            <ProjectMilestonesPanel
              project={project}
              onAdd={() => {
                setEditingMilestone(null);
                setMilestoneOpen(true);
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

        <aside className="space-y-4">
          <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
            <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Progress</h2>
            <p className="mt-3 font-heading text-3xl font-semibold text-[var(--admin-ink)]">{progress}%</p>
            <p className="mt-1 text-[12px] text-[var(--admin-muted)]">
              {counts.total === 0 ? "Add tasks to start tracking project progress." : `${counts.completed} of ${counts.total} tasks completed`}
            </p>
            <div className="mt-3">
              <ProgressBar value={progress} />
            </div>
          </section>
          <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
            <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Current milestone</h2>
            {milestone ? (
              <>
                <p className="mt-3 font-heading text-sm font-semibold text-[var(--admin-ink)]">{milestone.name}</p>
                <p className="mt-1 text-[12px] text-[var(--admin-muted)]">
                  {milestoneCounts && milestoneCounts.total > 0
                    ? `${milestoneCounts.completed} of ${milestoneCounts.total} tasks completed`
                    : "No tasks yet"}
                </p>
              </>
            ) : (
              <p className="mt-3 text-sm text-[var(--admin-muted)]">No milestones yet</p>
            )}
          </section>
          <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
            <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Details</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-[12px] text-[var(--admin-muted)]">Client</dt>
                <dd className="mt-0.5">
                  {client ? (
                    <Link className="font-medium text-[var(--admin-blue)] hover:underline" to={`/admin/clients/${client.id}`}>
                      {client.businessName}
                    </Link>
                  ) : (
                    "Unknown client"
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-[12px] text-[var(--admin-muted)]">Started</dt>
                <dd className="mt-0.5 font-medium text-[var(--admin-ink)]">{formatProjectDay(project.startDate)}</dd>
              </div>
              <div>
                <dt className="text-[12px] text-[var(--admin-muted)]">Target launch</dt>
                <dd className="mt-0.5 font-medium text-[var(--admin-ink)]">{formatProjectDay(project.targetLaunchDate)}</dd>
              </div>
              <div>
                <dt className="text-[12px] text-[var(--admin-muted)]">Approval</dt>
                <dd className="mt-0.5 font-medium text-[var(--admin-ink)]">{project.approvalStatus}</dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>

      <ProjectFormModal
        mode="edit"
        open={editOpen}
        clients={clients}
        project={project}
        onClose={() => setEditOpen(false)}
        onSubmit={(draft) => updateProject(project.id, draft)}
      />
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
        onClose={() => {
          setTaskOpen(false);
          setEditingTask(null);
        }}
        onSubmit={(draft) => {
          if (editingTask) updateTask(project.id, editingTask.id, draft);
          else addTask(project.id, draft);
        }}
      />
    </div>
  );
}
