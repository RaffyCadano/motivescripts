import { useState } from "react";
import { TaskPriorityBadge } from "@/components/admin/projects/TaskPriorityBadge";
import { dueLabel, type TeamWorkTask } from "@/data/teamWorkspace";
import type { AgencyTaskStatus } from "@/data/agencyProjects";
import { cn } from "@/lib/cn";

const BOARD_COLUMNS: AgencyTaskStatus[] = ["Todo", "In Progress", "In Review", "Blocked", "Completed"];

function columnLabel(status: AgencyTaskStatus): string {
  return status === "Todo" ? "To Do" : status;
}

type TeamTaskBoardProps = {
  tasks: TeamWorkTask[];
  onOpen: (task: TeamWorkTask) => void;
  onStatusChange: (task: TeamWorkTask, status: AgencyTaskStatus) => void | Promise<void>;
};

/** Drag between columns to change status. Uses the native HTML5 drag API (no library) --
 * touch browsers don't support it, so the List view (and each card's Open button, which
 * always works) stay the reliable path there. */
export function TeamTaskBoard({ tasks, onOpen, onStatusChange }: TeamTaskBoardProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<AgencyTaskStatus | null>(null);

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {BOARD_COLUMNS.map((status) => {
        const columnTasks = tasks.filter((task) => task.status === status);
        return (
          <div
            key={status}
            className={cn(
              "w-72 shrink-0 rounded-[var(--admin-radius)] border bg-[var(--admin-bg)] p-3",
              overColumn === status ? "border-[var(--admin-blue)]" : "border-[var(--admin-line)]",
            )}
            onDragOver={(event) => {
              event.preventDefault();
              setOverColumn(status);
            }}
            onDragLeave={() => setOverColumn((current) => (current === status ? null : current))}
            onDrop={(event) => {
              event.preventDefault();
              setOverColumn(null);
              const taskId = event.dataTransfer.getData("text/plain");
              const task = tasks.find((item) => item.id === taskId);
              if (task && task.status !== status) void onStatusChange(task, status);
            }}
          >
            <div className="flex items-center justify-between px-1 pb-2">
              <p className="font-heading text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--admin-muted)]">
                {columnLabel(status)}
              </p>
              <span className="text-[11px] text-[var(--admin-muted)]">{columnTasks.length}</span>
            </div>
            <div className="space-y-2">
              {columnTasks.map((task) => (
                <article
                  key={task.id}
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData("text/plain", task.id);
                    event.dataTransfer.effectAllowed = "move";
                    setDraggingId(task.id);
                  }}
                  onDragEnd={() => setDraggingId(null)}
                  onClick={() => onOpen(task)}
                  className={cn(
                    "cursor-grab rounded-lg border border-[var(--admin-line)] bg-[var(--admin-card)] p-3 active:cursor-grabbing",
                    draggingId === task.id && "opacity-50",
                  )}
                >
                  <p className="text-sm font-medium text-[var(--admin-ink)]">{task.title}</p>
                  <p className="mt-1 truncate text-[11px] text-[var(--admin-muted)]">{task.projectName}</p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <TaskPriorityBadge priority={task.priority} />
                    <span className="shrink-0 text-[11px] text-[var(--admin-muted)]">{dueLabel(task.dueDate)}</span>
                  </div>
                </article>
              ))}
              {columnTasks.length === 0 ? (
                <p className="px-1 py-2 text-[12px] text-[var(--admin-muted)]">No tasks</p>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
