import { TaskPriorityBadge } from "@/components/admin/projects/TaskPriorityBadge";
import { TaskStatusBadge } from "@/components/admin/projects/TaskStatusBadge";
import { formatProjectDay, type AgencyMilestone, type AgencyProject, type AgencyTask } from "@/data/agencyProjects";

type ProjectTasksPanelProps = {
  project: AgencyProject;
  onAdd: () => void;
  onEdit: (task: AgencyTask) => void;
  onToggle: (task: AgencyTask) => void;
};

export function ProjectTasksPanel({ project, onAdd, onEdit, onToggle }: ProjectTasksPanelProps) {
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
          <p className="mt-1 text-[12px] text-[var(--admin-muted)]">Completing a task updates project progress immediately.</p>
        </div>
        <button
          type="button"
          className="inline-flex h-9 items-center rounded-lg border border-[var(--admin-line)] px-3 font-heading text-[12px] font-semibold text-[var(--admin-ink)] hover:bg-[var(--admin-bg)]"
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
              <h3 className="font-heading text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--admin-muted)]">
                {group.milestone?.name ?? "Ungrouped"}
              </h3>
              {group.tasks.length === 0 ? (
                <p className="mt-2 text-sm text-[var(--admin-muted)]">No tasks in this milestone.</p>
              ) : (
                <ul className="mt-2 divide-y divide-[var(--admin-line)]">
                  {group.tasks.map((task) => (
                    <TaskRow key={task.id} task={task} milestone={group.milestone} onEdit={onEdit} onToggle={onToggle} />
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
}: {
  task: AgencyTask;
  milestone: AgencyMilestone | null;
  onEdit: (task: AgencyTask) => void;
  onToggle: (task: AgencyTask) => void;
}) {
  const checked = task.status === "Completed";
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
          <span className={`block text-sm font-medium ${checked ? "text-[var(--admin-muted)] line-through" : "text-[var(--admin-ink)]"}`}>
            {task.title}
          </span>
          {task.description ? <span className="mt-1 block text-[12px] text-[var(--admin-muted)]">{task.description}</span> : null}
          <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <TaskStatusBadge status={task.status} />
            <TaskPriorityBadge priority={task.priority} />
            <span className="text-[12px] text-[var(--admin-muted)]">{task.assignee}</span>
            <span className="text-[12px] text-[var(--admin-muted)]">Due {formatProjectDay(task.dueDate)}</span>
            {milestone ? <span className="text-[12px] text-[var(--admin-muted)]">{milestone.name}</span> : null}
          </span>
        </span>
      </label>
      <button
        type="button"
        className="inline-flex h-8 shrink-0 items-center self-start rounded-lg border border-[var(--admin-line)] px-2.5 font-heading text-[11px] font-semibold text-[var(--admin-ink)] hover:bg-[var(--admin-bg)]"
        onClick={() => onEdit(task)}
      >
        Edit
      </button>
    </li>
  );
}
