import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { TaskPriorityBadge } from "@/components/admin/projects/TaskPriorityBadge";
import { ClientReviewLinkOut } from "@/components/tasks/TaskWorkspace";
import { TeamEmptyState } from "@/components/team/TeamEmptyState";
import { TeamTaskDetail } from "@/components/team/TeamTaskDetail";
import { useTeamWork } from "@/components/team/useTeamWork";
import { earlierOpenMilestones, taskPriorities, type AgencyTaskPriority } from "@/data/agencyProjects";
import { blockedReason, blockedTasks } from "@/data/developerOverview";
import { effectiveTaskType } from "@/data/taskTypes";
import { inProgressCount, teamProjectHref, type TeamWorkTask } from "@/data/teamWorkspace";
import { AgencyDbError } from "@/lib/dbErrors";

export function TeamBlocked() {
  const navigate = useNavigate();
  const { profile, tasks, myProjects, deliverables, changeTaskStatus } = useTeamWork();
  const [openTask, setOpenTask] = useState<TeamWorkTask | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState<AgencyTaskPriority | "All">("All");

  const blocked = useMemo(() => blockedTasks(tasks), [tasks]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return blocked.filter((task) => {
      if (priority !== "All" && task.priority !== priority) return false;
      if (!needle) return true;
      const reason = blockedReason(task) ?? "";
      return (
        task.title.toLowerCase().includes(needle) ||
        task.projectName.toLowerCase().includes(needle) ||
        reason.toLowerCase().includes(needle)
      );
    });
  }, [blocked, priority, search]);

  async function onStatusChange(status: TeamWorkTask["status"], blockedReason?: string | null, qaResult?: string | null) {
    if (!openTask) return;
    setBusy(true);
    setError(null);
    try {
      await changeTaskStatus(openTask, status, blockedReason, qaResult);
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
        <h1 className="font-heading text-[1.65rem] font-semibold tracking-tight md:text-3xl">Blocked</h1>
        <p className="mt-1 text-sm text-[var(--admin-muted)]">Tasks marked Blocked that need your attention.</p>
      </div>

      {blocked.length === 0 ? (
        <TeamEmptyState title="You're all clear — no blocked work." body="Tasks marked Blocked will show up here." />
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search task, project, or reason"
              className="h-10 min-w-0 flex-1 rounded-lg border border-[var(--admin-line)] bg-white px-3 text-sm outline-none focus:border-[rgb(0_80_240_/_0.45)]"
            />
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

          {visible.length === 0 ? (
            <TeamEmptyState title="No blocked tasks match your filters." body="Try a different search term or priority." />
          ) : (
        <>
        <ul className="space-y-3 md:hidden">
          {visible.map((task) => (
            <li key={task.id} className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-4">
              <button
                type="button"
                className="text-left font-heading text-sm font-semibold text-[var(--admin-ink)] hover:text-[var(--admin-blue)]"
                onClick={() => setOpenTask(task)}
              >
                {task.title}
              </button>
              <p className="mt-1 text-[13px] text-[var(--admin-muted)]">{task.projectName}</p>
              <div className="mt-2">
                <TaskPriorityBadge priority={task.priority} />
              </div>
              <p className="mt-2 text-[13px] text-[var(--admin-ink)]">{blockedReason(task) ?? "No reason provided"}</p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  className="font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline"
                  onClick={() => setOpenTask(task)}
                >
                  Open
                </button>
                <Link
                  to={teamProjectHref(task.projectId, { tab: "tasks" })}
                  className="font-heading text-[12px] font-semibold text-[var(--admin-muted)] hover:text-[var(--admin-blue)] hover:underline"
                >
                  View project
                </Link>
              </div>
            </li>
          ))}
        </ul>
        <div className="hidden overflow-x-auto rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] md:block">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-[var(--admin-line)] bg-[var(--admin-bg)] text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--admin-muted)]">
              <tr>
                <th className="px-4 py-3 font-heading">Task</th>
                <th className="px-4 py-3 font-heading">Priority</th>
                <th className="px-4 py-3 font-heading">Reason</th>
                <th className="px-4 py-3 font-heading">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--admin-line)]">
              {visible.map((task) => (
                <tr key={task.id} className="hover:bg-[var(--admin-bg)]">
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      className="text-left font-medium text-[var(--admin-ink)] hover:text-[var(--admin-blue)]"
                      onClick={() => setOpenTask(task)}
                    >
                      {task.title}
                    </button>
                    <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">{task.projectName}</p>
                  </td>
                  <td className="px-4 py-3">
                    <TaskPriorityBadge priority={task.priority} />
                  </td>
                  <td className="px-4 py-3 text-[var(--admin-ink)]">{blockedReason(task) ?? "No reason provided"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        className="font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline"
                        onClick={() => setOpenTask(task)}
                      >
                        Open
                      </button>
                      <Link
                        to={teamProjectHref(task.projectId, { tab: "tasks" })}
                        className="font-heading text-[12px] font-semibold text-[var(--admin-muted)] hover:text-[var(--admin-blue)] hover:underline"
                      >
                        View project
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
          )}
        </>
      )}

      {openTask ? (
        <TeamTaskDetail
          task={openTask}
          files={deliverables.filter((item) => item.projectId === openTask.projectId)}
          canUpdateStatus
          busy={busy}
          error={error}
          earlierOpen={(() => {
            const project = myProjects.find((item) => item.id === openTask.projectId);
            return project ? earlierOpenMilestones(project, openTask.milestoneId) : undefined;
          })()}
          wipCount={inProgressCount(tasks, profile?.id ?? "", profile?.fullName ?? "")}
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
          onStatusChange={(status, blockedReason, qaResult) => void onStatusChange(status, blockedReason, qaResult)}
        />
      ) : null}
    </div>
  );
}
