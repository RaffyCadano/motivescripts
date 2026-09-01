import { Link } from "react-router-dom";
import { TaskPriorityBadge } from "@/components/admin/projects/TaskPriorityBadge";
import { TaskStatusBadge } from "@/components/admin/projects/TaskStatusBadge";
import { formatProjectDay, taskStatuses, type AgencyTaskStatus } from "@/data/agencyProjects";
import type { AgencyDeliverable } from "@/data/files";
import { dueLabel, teamProjectHref, type TeamWorkTask } from "@/data/teamWorkspace";

type TeamTaskDetailProps = {
  task: TeamWorkTask;
  files: AgencyDeliverable[];
  canUpdateStatus: boolean;
  busy?: boolean;
  error?: string | null;
  onClose: () => void;
  onStatusChange: (status: AgencyTaskStatus) => void;
};

export function TeamTaskDetail({
  task,
  files,
  canUpdateStatus,
  busy,
  error,
  onClose,
  onStatusChange,
}: TeamTaskDetailProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <button type="button" className="absolute inset-0 bg-[rgb(7_17_31_/_0.32)]" aria-label="Close task" onClick={onClose} />
      <div
        role="dialog"
        aria-labelledby="team-task-title"
        className="relative z-10 max-h-[90svh] w-full max-w-lg overflow-auto rounded-t-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5 shadow-[0_16px_40px_rgb(7_17_31_/_0.12)] sm:rounded-[var(--admin-radius)]"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[12px] text-[var(--admin-muted)]">{task.clientName}</p>
            <h2 id="team-task-title" className="mt-1 font-heading text-lg font-semibold text-[var(--admin-ink)]">
              {task.title}
            </h2>
          </div>
          <button
            type="button"
            className="inline-flex h-9 items-center rounded-lg border border-[var(--admin-line)] px-3 font-heading text-[12px] font-semibold"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <TaskStatusBadge status={task.status} />
          <TaskPriorityBadge priority={task.priority} />
          <span className="text-[12px] text-[var(--admin-muted)]">{dueLabel(task.dueDate)}</span>
        </div>

        {task.description ? <p className="mt-4 text-sm leading-relaxed text-[var(--admin-ink)]">{task.description}</p> : null}

        <dl className="mt-5 grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-[12px] text-[var(--admin-muted)]">Project</dt>
            <dd className="mt-1 text-sm">{task.projectName}</dd>
          </div>
          <div>
            <dt className="text-[12px] text-[var(--admin-muted)]">Client</dt>
            <dd className="mt-1 text-sm">{task.clientName}</dd>
          </div>
          {task.milestoneName ? (
            <div>
              <dt className="text-[12px] text-[var(--admin-muted)]">Milestone</dt>
              <dd className="mt-1 text-sm">{task.milestoneName}</dd>
            </div>
          ) : null}
          <div>
            <dt className="text-[12px] text-[var(--admin-muted)]">Created</dt>
            <dd className="mt-1 text-sm">{formatProjectDay(task.createdAt)}</dd>
          </div>
          {task.completedAt ? (
            <div>
              <dt className="text-[12px] text-[var(--admin-muted)]">Completed</dt>
              <dd className="mt-1 text-sm">{formatProjectDay(task.completedAt)}</dd>
            </div>
          ) : null}
        </dl>

        {canUpdateStatus ? (
          <label className="mt-5 block text-[13px] font-medium text-[var(--admin-ink)]">
            Status
            <select
              className="mt-1.5 h-10 w-full rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-white px-3 text-sm outline-none focus:border-[rgb(0_80_240_/_0.45)]"
              value={task.status}
              disabled={busy}
              onChange={(event) => onStatusChange(event.target.value as AgencyTaskStatus)}
            >
              {taskStatuses.map((status) => (
                <option key={status} value={status}>
                  {status === "Todo" ? "To Do" : status}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {error ? <p className="mt-3 text-sm text-[#b45309]">{error}</p> : null}

        <section className="mt-6">
          <h3 className="font-heading text-sm font-semibold">Related files</h3>
          {files.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--admin-muted)]">No files on this project yet.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {files.map((file) => (
                <li key={file.id}>
                  <Link
                    to={teamProjectHref(task.projectId, { tab: "files", file: file.id })}
                    className="text-sm font-medium text-[var(--admin-blue)] hover:underline"
                  >
                    {file.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <Link
          to={teamProjectHref(task.projectId, { tab: "tasks" })}
          className="mt-6 inline-flex h-10 items-center rounded-[var(--admin-radius)] bg-[var(--admin-blue)] px-4 font-heading text-sm font-semibold text-white"
        >
          Open project workspace
        </Link>
      </div>
    </div>
  );
}
