import { CalendarDays, ListChecks, Pencil, Plus } from "lucide-react";
import { TaskOriginBadge } from "@/components/admin/projects/TaskOriginBadge";
import { TaskPriorityBadge } from "@/components/admin/projects/TaskPriorityBadge";
import { TaskRecommendedRoleNote } from "@/components/admin/projects/TaskRecommendedRoleNote";
import { TaskStatusBadge } from "@/components/admin/projects/TaskStatusBadge";
import {
  formatProjectDay,
  productionTaskStats,
  type AgencyMilestone,
  type AgencyProject,
  type AgencyTask,
} from "@/data/agencyProjects";
import { displayMilestoneName, websiteMilestonePurpose } from "@/data/projectMilestones";
import { taskInstructionPreview } from "@/data/productionTaskInstructions";
import { resolveTaskRecommendedRole } from "@/data/taskRecommendedRoles";
import { isDiscoveryCoordinationTask } from "@/data/discoveryIntake";
import { cn } from "@/lib/cn";

type ProjectTasksPanelProps = {
  project: AgencyProject;
  onAdd: () => void;
  onAddForMilestone?: (milestone: AgencyMilestone) => void;
  onEdit: (task: AgencyTask) => void;
  onToggle: (task: AgencyTask) => void;
  onOpenDiscovery?: () => void;
  onOpenWorkspace: (task: AgencyTask) => void;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "")).toUpperCase() || "?";
}

function StatTile({ label, value, tone }: { label: string; value: number; tone?: "warn" | "good" }) {
  return (
    <div className="rounded-lg border border-[var(--admin-line)] bg-[var(--admin-bg)] px-3 py-2">
      <p
        className={cn(
          "font-heading text-lg font-semibold leading-tight",
          tone === "warn" ? "text-[#b45309]" : tone === "good" ? "text-[#0f7a56]" : "text-[var(--admin-ink)]",
        )}
      >
        {value}
      </p>
      <p className="text-[12px] text-[var(--admin-muted)]">{label}</p>
    </div>
  );
}

export function ProjectTasksPanel({
  project,
  onAdd,
  onAddForMilestone,
  onEdit,
  onToggle,
  onOpenDiscovery,
  onOpenWorkspace,
}: ProjectTasksPanelProps) {
  const stats = productionTaskStats(project);
  const percent = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
  const orderedMilestones = [...project.milestones].sort((a, b) => a.order - b.order);
  const grouped = [
    ...orderedMilestones.map((milestone) => ({
      milestone,
      tasks: project.tasks.filter((task) => task.milestoneId === milestone.id),
    })),
    {
      milestone: null,
      tasks: project.tasks.filter((task) => !task.milestoneId || !orderedMilestones.some((item) => item.id === task.milestoneId)),
    },
  ].filter((group) => group.tasks.length > 0 || group.milestone);

  return (
    <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[rgb(0_80_240_/_0.08)] text-[var(--admin-blue)]">
            <ListChecks size={15} strokeWidth={2} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Tasks</h2>
            <p className="text-[12px] text-[var(--admin-muted)]">
              {stats.total > 0
                ? "Completing a task updates project progress immediately."
                : "Completing a task updates project progress immediately. Generated production tasks can be edited, assigned, or removed."}
            </p>
          </div>
        </div>
        <button
          type="button"
          className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[var(--admin-line)] px-3.5 font-heading text-[12px] font-semibold text-[var(--admin-ink)] hover:bg-[var(--admin-bg)]"
          onClick={onAdd}
        >
          <Plus size={14} strokeWidth={2.4} aria-hidden="true" />
          Add Task
        </button>
      </div>

      {stats.total > 0 ? (
        <div className="mt-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatTile label="Total" value={stats.total} />
            <StatTile label="Assigned" value={stats.assigned} />
            <StatTile label="Completed" value={stats.completed} tone={stats.completed === stats.total ? "good" : undefined} />
            <StatTile label="Remaining" value={stats.remaining} />
          </div>
          <div
            className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--admin-line)]"
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Tasks completed"
          >
            <div className={cn("h-full rounded-full", percent === 100 ? "bg-[#0f7a56]" : "bg-[var(--admin-blue)]")} style={{ width: `${percent}%` }} />
          </div>
          {stats.unassigned > 0 ? (
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-950">
              Needs assignment: {stats.unassigned} unassigned task{stats.unassigned === 1 ? "" : "s"}.
            </p>
          ) : null}
        </div>
      ) : null}

      {project.tasks.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-[var(--admin-line)] bg-[var(--admin-bg)] px-4 py-6 text-center">
          <p className="font-heading text-sm font-semibold text-[var(--admin-ink)]">No tasks yet</p>
          <p className="mt-1 text-sm text-[var(--admin-muted)]">Add tasks to begin tracking project progress.</p>
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {grouped.map((group) => {
            const done = group.tasks.filter((task) => task.status === "Completed").length;
            return (
              <div key={group.milestone?.id ?? "ungrouped"} className="overflow-hidden rounded-lg border border-[var(--admin-line)]">
                <div className="flex items-center justify-between gap-3 border-b border-[var(--admin-line)] bg-[var(--admin-bg)] px-4 py-2.5">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <h3 className="truncate font-heading text-sm font-semibold text-[var(--admin-ink)]">
                      {group.milestone ? displayMilestoneName(group.milestone.name) : "Ungrouped"}
                    </h3>
                    {group.tasks.length > 0 ? (
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-0.5 font-heading text-[11px] font-semibold",
                          done === group.tasks.length ? "bg-[rgb(16_185_129_/_0.1)] text-[#0f7a56]" : "bg-[rgb(0_80_240_/_0.08)] text-[var(--admin-blue)]",
                        )}
                      >
                        {done}/{group.tasks.length} done
                      </span>
                    ) : null}
                  </div>
                  {group.milestone && onAddForMilestone ? (
                    <button
                      type="button"
                      className="inline-flex shrink-0 items-center gap-1 font-heading text-xs font-semibold text-[var(--admin-blue)] hover:underline"
                      onClick={() => onAddForMilestone(group.milestone!)}
                    >
                      <Plus size={13} strokeWidth={2.4} aria-hidden="true" />
                      Add Task
                    </button>
                  ) : null}
                </div>
                {group.tasks.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-[var(--admin-muted)]">
                    {group.milestone
                      ? `${websiteMilestonePurpose(group.milestone.name, group.milestone.description)} No tasks yet.`
                      : "No tasks in this group."}
                  </p>
                ) : (
                  <ul className="divide-y divide-[var(--admin-line)]">
                    {group.tasks.map((task) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        onEdit={onEdit}
                        onToggle={onToggle}
                        onOpenDiscovery={onOpenDiscovery}
                        onOpenWorkspace={onOpenWorkspace}
                      />
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function TaskRow({
  task,
  onEdit,
  onToggle,
  onOpenDiscovery,
  onOpenWorkspace,
}: {
  task: AgencyTask;
  onEdit: (task: AgencyTask) => void;
  onToggle: (task: AgencyTask) => void;
  onOpenDiscovery?: () => void;
  onOpenWorkspace: (task: AgencyTask) => void;
}) {
  const checked = task.status === "Completed";
  const preview = taskInstructionPreview(task.title, task.description);
  const recommendedRole = resolveTaskRecommendedRole(task);
  const showDiscovery = onOpenDiscovery && isDiscoveryCoordinationTask(task.title);
  const assignee = task.assignee.trim();
  return (
    <li className={cn("flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-start sm:justify-between", checked && "bg-[var(--admin-bg)]/40")}>
      <div className="flex min-w-0 items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 size-4 shrink-0 cursor-pointer accent-[var(--admin-blue)]"
          checked={checked}
          onChange={() => onToggle(task)}
          aria-label={`${checked ? "Reopen" : "Complete"} ${task.title}`}
        />
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => onOpenWorkspace(task)}
            className={cn(
              "block text-left text-sm font-semibold hover:underline",
              checked ? "text-[var(--admin-muted)] line-through decoration-[var(--admin-line)]" : "text-[var(--admin-ink)]",
            )}
          >
            {task.title}
          </button>
          {preview ? <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-[var(--admin-muted)]">{preview}</p> : null}
          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <TaskStatusBadge status={task.status} />
            {task.origin === "client" ? <TaskOriginBadge /> : null}
            <TaskPriorityBadge priority={task.priority} />
            <TaskRecommendedRoleNote role={recommendedRole} />
            <span className="inline-flex items-center gap-1.5 text-[12px] text-[var(--admin-ink)]">
              <span
                aria-hidden="true"
                className={cn(
                  "flex size-5 items-center justify-center rounded-full font-heading text-[9px] font-semibold",
                  assignee ? "bg-[rgb(0_80_240_/_0.1)] text-[var(--admin-blue)]" : "bg-amber-100 text-amber-800",
                )}
              >
                {assignee ? initials(assignee) : "?"}
              </span>
              <span className="sr-only">Assignee: </span>
              {assignee || <span className="text-[#b45309]">Unassigned</span>}
            </span>
            <span className="inline-flex items-center gap-1 text-[12px] text-[var(--admin-muted)]">
              <CalendarDays size={13} strokeWidth={2} aria-hidden="true" />
              Due {formatProjectDay(task.dueDate)}
            </span>
          </div>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2 self-start">
        {showDiscovery ? (
          <button
            type="button"
            className="inline-flex h-8 items-center rounded-lg border border-[var(--admin-line)] px-2.5 font-heading text-xs font-semibold text-[var(--admin-blue)] hover:bg-[var(--admin-bg)]"
            onClick={onOpenDiscovery}
          >
            Open Discovery
          </button>
        ) : null}
        <button
          type="button"
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--admin-line)] px-2.5 font-heading text-xs font-semibold text-[var(--admin-ink)] hover:bg-[var(--admin-bg)]"
          onClick={() => onEdit(task)}
        >
          <Pencil size={12} strokeWidth={2.2} aria-hidden="true" />
          Edit
        </button>
      </div>
    </li>
  );
}
