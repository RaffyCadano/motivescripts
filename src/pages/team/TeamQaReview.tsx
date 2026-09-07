import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { TaskStatusBadge } from "@/components/admin/projects/TaskStatusBadge";
import { ClientReviewLinkOut } from "@/components/tasks/TaskWorkspace";
import { CountBadge } from "@/components/team/CountBadge";
import { TeamEmptyState } from "@/components/team/TeamEmptyState";
import { TeamTaskDetail } from "@/components/team/TeamTaskDetail";
import { useTeamWork } from "@/components/team/useTeamWork";
import { earlierOpenMilestones, formatProjectDay } from "@/data/agencyProjects";
import { qaTasks, reviewTasks } from "@/data/developerOverview";
import { effectiveTaskType } from "@/data/taskTypes";
import { dueBucket, inProgressCount, teamProjectHref, type TeamWorkTask } from "@/data/teamWorkspace";
import { AgencyDbError } from "@/lib/dbErrors";
import { cn } from "@/lib/cn";

export function TeamQaReview() {
  const navigate = useNavigate();
  const { profile, tasks, myProjects, deliverables, changeTaskStatus } = useTeamWork();
  const [openTask, setOpenTask] = useState<TeamWorkTask | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const qa = useMemo(() => qaTasks(tasks), [tasks]);
  const inReview = useMemo(() => reviewTasks(tasks), [tasks]);

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
        <h1 className="font-heading text-[1.65rem] font-semibold tracking-tight md:text-3xl">QA & Review</h1>
        <p className="mt-1 text-sm text-[var(--admin-muted)]">Tasks classified as QA, and tasks waiting for review.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="font-heading text-sm font-semibold tracking-tight">QA</h2>
            <CountBadge count={qa.length} />
          </div>
          {qa.length === 0 ? (
            <TeamEmptyState title="No QA tasks assigned to you." body="Tasks classified as QA will show up here." />
          ) : (
            <QaReviewTable tasks={qa} onOpen={setOpenTask} />
          )}
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="font-heading text-sm font-semibold tracking-tight">Review</h2>
            <CountBadge count={inReview.length} />
          </div>
          {inReview.length === 0 ? (
            <TeamEmptyState title="Nothing is waiting for review." body="Tasks marked In Review will show up here." />
          ) : (
            <QaReviewTable tasks={inReview} onOpen={setOpenTask} />
          )}
        </section>
      </div>

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

/** Compact task table for a half-width column -- fewer columns than the admin MyTaskTable, which needs full page width. */
function QaReviewTable({ tasks, onOpen }: { tasks: TeamWorkTask[]; onOpen: (task: TeamWorkTask) => void }) {
  return (
    <div className="overflow-x-auto rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)]">
      <table className="w-full min-w-[520px] text-left text-sm">
        <thead className="border-b border-[var(--admin-line)] bg-[var(--admin-bg)] text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--admin-muted)]">
          <tr>
            <th className="px-4 py-3 font-heading">Task</th>
            <th className="px-4 py-3 font-heading">Due</th>
            <th className="px-4 py-3 font-heading">Status</th>
            <th className="px-4 py-3 font-heading">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--admin-line)]">
          {tasks.map((task) => {
            const bucket = dueBucket(task.dueDate);
            return (
              <tr key={task.id} className="hover:bg-[var(--admin-bg)]">
                <td className="px-4 py-3">
                  <button
                    type="button"
                    className="text-left font-medium text-[var(--admin-ink)] hover:text-[var(--admin-blue)]"
                    onClick={() => onOpen(task)}
                  >
                    {task.title}
                  </button>
                  <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">{task.projectName}</p>
                </td>
                <td className={cn("px-4 py-3", bucket === "overdue" ? "font-medium text-[#b45309]" : "text-[var(--admin-muted)]")}>
                  {task.dueDate ? formatProjectDay(task.dueDate) : "Not set"}
                </td>
                <td className="px-4 py-3">
                  <TaskStatusBadge status={task.status} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className="font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline"
                      onClick={() => onOpen(task)}
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
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
