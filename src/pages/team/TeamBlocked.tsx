import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { TaskPriorityBadge } from "@/components/admin/projects/TaskPriorityBadge";
import { ClientReviewLinkOut } from "@/components/tasks/TaskWorkspace";
import { TeamEmptyState } from "@/components/team/TeamEmptyState";
import { TeamTaskDetail } from "@/components/team/TeamTaskDetail";
import { useTeamWork } from "@/components/team/useTeamWork";
import { earlierOpenMilestones } from "@/data/agencyProjects";
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

  const blocked = useMemo(() => blockedTasks(tasks), [tasks]);

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
        <h1 className="font-heading text-[1.65rem] font-semibold tracking-tight md:text-3xl">Blocked</h1>
        <p className="mt-1 text-sm text-[var(--admin-muted)]">Tasks marked Blocked that need your attention.</p>
      </div>

      {blocked.length === 0 ? (
        <TeamEmptyState title="You're all clear — no blocked work." body="Tasks marked Blocked will show up here." />
      ) : (
        <div className="overflow-x-auto rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)]">
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
              {blocked.map((task) => (
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
          onStatusChange={(status) => void onStatusChange(status)}
        />
      ) : null}
    </div>
  );
}
