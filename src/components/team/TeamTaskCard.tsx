import { Link } from "react-router-dom";
import { TaskPriorityBadge } from "@/components/admin/projects/TaskPriorityBadge";
import { TaskStatusBadge } from "@/components/admin/projects/TaskStatusBadge";
import { dueBucket, dueLabel, type TeamWorkTask } from "@/data/teamWorkspace";
import { cn } from "@/lib/cn";

type TeamTaskCardProps = {
  task: TeamWorkTask;
  onOpen: (task: TeamWorkTask) => void;
};

export function TeamTaskCard({ task, onOpen }: TeamTaskCardProps) {
  const bucket = dueBucket(task.dueDate);

  return (
    <article className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <button
            type="button"
            className="text-left font-heading text-sm font-semibold text-[var(--admin-ink)] hover:text-[var(--admin-blue)]"
            onClick={() => onOpen(task)}
          >
            {task.title}
          </button>
          <p className="mt-1 text-[13px] text-[var(--admin-muted)]">{task.clientName}</p>
          <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">{task.projectName}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <TaskStatusBadge status={task.status} />
          <TaskPriorityBadge priority={task.priority} />
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <p
          className={cn(
            "text-[12px] font-medium",
            bucket === "overdue" ? "text-[#b45309]" : "text-[var(--admin-muted)]",
          )}
        >
          {dueLabel(task.dueDate)}
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline"
            onClick={() => onOpen(task)}
          >
            Open task
          </button>
          <Link
            to={`/admin/projects/${task.projectId}?tab=tasks`}
            className="font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline"
          >
            View project
          </Link>
        </div>
      </div>
    </article>
  );
}
