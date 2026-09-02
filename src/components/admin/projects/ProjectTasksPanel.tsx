import { TaskPriorityBadge } from "@/components/admin/projects/TaskPriorityBadge";
import { TaskRecommendedRoleNote } from "@/components/admin/projects/TaskRecommendedRoleNote";
import { TaskStatusBadge } from "@/components/admin/projects/TaskStatusBadge";
import {
  formatProjectDay,
  formatProductionTaskStats,
  productionTaskStats,
  type AgencyMilestone,
  type AgencyProject,
  type AgencyTask,
} from "@/data/agencyProjects";
import { displayMilestoneName, websiteMilestonePurpose } from "@/data/projectMilestones";
import { taskInstructionPreview } from "@/data/productionTaskInstructions";
import { resolveTaskRecommendedRole } from "@/data/taskRecommendedRoles";
import { isDiscoveryCoordinationTask } from "@/data/discoveryIntake";

type ProjectTasksPanelProps = {
  project: AgencyProject;
  onAdd: () => void;
  onAddForMilestone?: (milestone: AgencyMilestone) => void;
  onEdit: (task: AgencyTask) => void;
  onToggle: (task: AgencyTask) => void;
  onOpenDiscovery?: () => void;
  onOpenWorkspace: (task: AgencyTask) => void;
};

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
        <div>
          <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Tasks</h2>
          <p className="mt-1 text-[12px] text-[var(--admin-muted)]">
            {stats.total > 0
              ? `${formatProductionTaskStats(stats)}. Completing a task updates project progress immediately.`
              : "Completing a task updates project progress immediately. Generated production tasks can be edited, assigned, or removed."}
          </p>
          {stats.unassigned > 0 ? (
            <p className="mt-2 text-[12px] text-[var(--admin-ink)]">
              Needs assignment: {stats.unassigned} unassigned task{stats.unassigned === 1 ? "" : "s"}.
            </p>
          ) : null}
        </div>
        <button
          type="button"
          className="inline-flex h-9 min-w-[7.5rem] items-center justify-center rounded-lg border border-[var(--admin-line)] px-4 font-heading text-[12px] font-semibold text-[var(--admin-ink)] hover:bg-[var(--admin-bg)]"
          onClick={onAdd}
        >
          Add Task
        </button>
      </div>
      {project.tasks.length === 0 ? (
        <div className="mt-4">
          <p className="font-heading text-sm font-semibold text-[var(--admin-ink)]">No tasks yet</p>
          <p className="mt-1 text-sm text-[var(--admin-muted)]">Add tasks to begin tracking project progress.</p>
        </div>
      ) : (
        <div className="mt-5 space-y-6">
          {grouped.map((group) => (
            <div key={group.milestone?.id ?? "ungrouped"}>
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-heading text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--admin-muted)]">
                  {group.milestone ? displayMilestoneName(group.milestone.name) : "Ungrouped"}
                </h3>
                {group.milestone && onAddForMilestone ? (
                  <button
                    type="button"
                    className="font-heading text-[11px] font-semibold text-[var(--admin-blue)] hover:underline"
                    onClick={() => onAddForMilestone(group.milestone!)}
                  >
                    Add Task
                  </button>
                ) : null}
              </div>
              {group.tasks.length === 0 ? (
                <p className="mt-2 text-sm text-[var(--admin-muted)]">
                  {group.milestone
                    ? `${websiteMilestonePurpose(group.milestone.name, group.milestone.description)} No tasks yet.`
                    : "No tasks in this group."}
                </p>
              ) : (
                <ul className="mt-2 divide-y divide-[var(--admin-line)]">
                  {group.tasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      milestone={group.milestone}
                      onEdit={onEdit}
                      onToggle={onToggle}
                      onOpenDiscovery={onOpenDiscovery}
                      onOpenWorkspace={onOpenWorkspace}
                    />
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function TaskRow({
  task,
  milestone,
  onEdit,
  onToggle,
  onOpenDiscovery,
  onOpenWorkspace,
}: {
  task: AgencyTask;
  milestone: AgencyMilestone | null;
  onEdit: (task: AgencyTask) => void;
  onToggle: (task: AgencyTask) => void;
  onOpenDiscovery?: () => void;
  onOpenWorkspace: (task: AgencyTask) => void;
}) {
  const checked = task.status === "Completed";
  const preview = taskInstructionPreview(task.title, task.description);
  const recommendedRole = resolveTaskRecommendedRole(task);
  const showDiscovery = onOpenDiscovery && isDiscoveryCoordinationTask(task.title);
  return (
    <li className="flex flex-col gap-3 py-3 sm:flex-row sm:items-start sm:justify-between">
      <label className="flex min-w-0 cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 size-4 accent-[var(--admin-blue)]"
          checked={checked}
          onChange={() => onToggle(task)}
          aria-label={`${checked ? "Reopen" : "Complete"} ${task.title}`}
        />
        <span className="min-w-0">
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onOpenWorkspace(task);
            }}
            className={`block text-left text-sm font-medium hover:underline ${checked ? "text-[var(--admin-muted)] line-through" : "text-[var(--admin-ink)]"}`}
          >
            {task.title}
          </button>
          {preview ? <span className="mt-1 block text-[12px] text-[var(--admin-muted)]">{preview}</span> : null}
          <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <TaskStatusBadge status={task.status} />
            <TaskPriorityBadge priority={task.priority} />
            <TaskRecommendedRoleNote role={recommendedRole} />
            <span className="text-[12px] text-[var(--admin-muted)]">
              Assignee: <span className="text-[var(--admin-ink)]">{task.assignee.trim() || "Unassigned"}</span>
            </span>
            <span className="text-[12px] text-[var(--admin-muted)]">Due {formatProjectDay(task.dueDate)}</span>
            {milestone ? (
              <span className="text-[12px] text-[var(--admin-muted)]">{displayMilestoneName(milestone.name)}</span>
            ) : null}
          </span>
        </span>
      </label>
      <div className="flex shrink-0 flex-wrap gap-2 self-start">
        {showDiscovery ? (
          <button
            type="button"
            className="inline-flex h-8 items-center rounded-lg border border-[var(--admin-line)] px-2.5 font-heading text-[11px] font-semibold text-[var(--admin-blue)] hover:bg-[var(--admin-bg)]"
            onClick={onOpenDiscovery}
          >
            Open Discovery
          </button>
        ) : null}
        <button
          type="button"
          className="inline-flex h-8 items-center rounded-lg border border-[var(--admin-line)] px-2.5 font-heading text-[11px] font-semibold text-[var(--admin-ink)] hover:bg-[var(--admin-bg)]"
          onClick={() => onEdit(task)}
        >
          Edit
        </button>
      </div>
    </li>
  );
}
