import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ClientReviewLinkOut } from "@/components/tasks/TaskWorkspace";
import { TeamTaskCard } from "@/components/team/TeamTaskCard";
import { TeamTaskDetail } from "@/components/team/TeamTaskDetail";
import { useTeamWork } from "@/components/team/useTeamWork";
import { taskPriorities, type AgencyTaskPriority } from "@/data/agencyProjects";
import { effectiveTaskType } from "@/data/taskTypes";
import { filterTeamTasks, teamProjectHref, type TeamTaskFilter, type TeamWorkTask } from "@/data/teamWorkspace";
import { AgencyDbError } from "@/lib/dbErrors";

const filters: { id: TeamTaskFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "todo", label: "To Do" },
  { id: "progress", label: "In Progress" },
  { id: "review", label: "In Review" },
  { id: "completed", label: "Completed" },
  { id: "blocked", label: "Blocked" },
  { id: "overdue", label: "Overdue" },
];

export function TeamTasks() {
  const navigate = useNavigate();
  const { tasks, myProjects, deliverables, changeTaskStatus } = useTeamWork();
  const [filter, setFilter] = useState<TeamTaskFilter>("all");
  const [projectId, setProjectId] = useState<string | "All">("All");
  const [priority, setPriority] = useState<AgencyTaskPriority | "All">("All");
  const [openTask, setOpenTask] = useState<TeamWorkTask | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visible = useMemo(
    () => filterTeamTasks(tasks, filter, projectId, priority),
    [filter, priority, projectId, tasks],
  );

  async function onStatusChange(status: TeamWorkTask["status"]) {
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-[1.65rem] font-semibold tracking-tight md:text-3xl">My Tasks</h1>
        <p className="mt-1 text-sm text-[var(--admin-muted)]">Only tasks assigned to you.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {filters.map((item) => (
          <button
            key={item.id}
            type="button"
            className={
              filter === item.id
                ? "inline-flex h-9 items-center rounded-full bg-[var(--admin-navy)] px-3 font-heading text-[12px] font-semibold text-white"
                : "inline-flex h-9 items-center rounded-full border border-[var(--admin-line)] bg-white px-3 font-heading text-[12px] font-semibold text-[var(--admin-ink)]"
            }
            onClick={() => setFilter(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <select
          value={projectId}
          onChange={(event) => setProjectId(event.target.value)}
          className="h-10 rounded-lg border border-[var(--admin-line)] bg-white px-3 text-sm"
        >
          <option value="All">All projects</option>
          {myProjects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
        <select
          value={priority}
          onChange={(event) => setPriority(event.target.value as AgencyTaskPriority | "All")}
          className="h-10 rounded-lg border border-[var(--admin-line)] bg-white px-3 text-sm"
        >
          <option value="All">All priorities</option>
          {taskPriorities.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>

      {tasks.length === 0 ? (
        <div className="rounded-[var(--admin-radius)] border border-dashed border-[var(--admin-line)] bg-[var(--admin-card)] px-5 py-10">
          <p className="font-heading text-sm font-semibold text-[var(--admin-ink)]">No tasks assigned</p>
          <p className="mt-1 text-sm text-[var(--admin-muted)]">
            You’re all caught up. New tasks will appear here when they’re assigned to you.
          </p>
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-[var(--admin-radius)] border border-dashed border-[var(--admin-line)] bg-[var(--admin-card)] px-5 py-10">
          <p className="font-heading text-sm font-semibold text-[var(--admin-ink)]">No tasks match these filters.</p>
          <p className="mt-1 text-sm text-[var(--admin-muted)]">Try another status, project, or priority.</p>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {visible.map((task) => (
            <TeamTaskCard key={task.id} task={task} onOpen={setOpenTask} />
          ))}
        </div>
      )}

      {openTask ? (
        <TeamTaskDetail
          task={openTask}
          files={deliverables.filter((item) => item.projectId === openTask.projectId)}
          canUpdateStatus
          busy={busy}
          error={error}
          extra={
            effectiveTaskType(openTask) === "client_review" ? (
              <ClientReviewLinkOut
                onOpenFiles={() => {
                  const projectId = openTask.projectId;
                  setOpenTask(null);
                  navigate(teamProjectHref(projectId, { tab: "files" }));
                }}
              />
            ) : undefined
          }
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
