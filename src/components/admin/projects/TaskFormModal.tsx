import { useEffect, useState, type FormEvent } from "react";
import { AdminDialog } from "@/components/admin/leads/AdminDialog";
import {
  taskPriorities,
  taskStatuses,
  type AgencyMilestone,
  type AgencyTask,
  type AgencyTaskDraft,
  type AgencyTaskPriority,
  type AgencyTaskStatus,
} from "@/data/agencyProjects";
import { displayMilestoneName } from "@/data/projectMilestones";
import {
  recommendedRoleForTaskTitle,
  resolveTaskRecommendedRole,
  TASK_RECOMMENDED_ROLE_OPTIONS,
  type TaskRecommendedRoleId,
} from "@/data/taskRecommendedRoles";
import { effectiveTaskType, TASK_TYPES, taskTypeLabel, type TaskType } from "@/data/taskTypes";
import { estimatedHoursForTitle } from "@/data/productionTaskInstructions";

const fieldClass =
  "mt-1.5 h-10 w-full rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-white px-3 text-sm text-[var(--admin-ink)] outline-none focus:border-[rgb(0_80_240_/_0.45)]";

const emptyDraft: AgencyTaskDraft = {
  title: "",
  description: "",
  milestoneId: "",
  status: "Todo",
  priority: "Medium",
  assignee: "",
  assignedTo: "",
  dueDate: "",
  recommendedRole: null,
  taskType: "internal",
  referenceUrl: "",
  estimatedHours: null,
};

export type TaskAssigneeOption = {
  id: string;
  name: string;
  roleLabel?: string;
};

function assigneeOptionLabel(person: TaskAssigneeOption): string {
  return person.roleLabel ? `${person.name} — ${person.roleLabel}` : person.name;
}

type TaskFormModalProps = {
  open: boolean;
  task?: AgencyTask | null;
  milestones: AgencyMilestone[];
  defaultMilestoneId?: string;
  assignees?: TaskAssigneeOption[];
  onClose: () => void;
  onSubmit: (draft: AgencyTaskDraft) => void;
};

export function TaskFormModal({
  open,
  task,
  milestones,
  defaultMilestoneId,
  assignees = [],
  onClose,
  onSubmit,
}: TaskFormModalProps) {
  const [draft, setDraft] = useState<AgencyTaskDraft>(emptyDraft);

  useEffect(() => {
    if (!open) return;
    if (task) {
      setDraft({
        title: task.title,
        description: task.description,
        milestoneId: task.milestoneId,
        status: task.status,
        priority: task.priority,
        assignee: task.assignee,
        assignedTo: task.assignedTo,
        dueDate: task.dueDate,
        recommendedRole: resolveTaskRecommendedRole(task),
        taskType: effectiveTaskType(task),
        referenceUrl: task.referenceUrl,
        estimatedHours: task.estimatedHours,
      });
      return;
    }
    setDraft({
      ...emptyDraft,
      milestoneId: defaultMilestoneId || milestones[0]?.id || "",
    });
  }, [defaultMilestoneId, milestones, open, task]);

  function handleTitleChange(title: string) {
    setDraft((current) => ({
      ...current,
      title,
      recommendedRole: task ? current.recommendedRole : recommendedRoleForTaskTitle(title) ?? current.recommendedRole,
      estimatedHours: task ? current.estimatedHours : estimatedHoursForTitle(title) ?? current.estimatedHours,
    }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(draft);
    onClose();
  }

  return (
    <AdminDialog
      open={open}
      title={task ? "Edit Task" : "Add Task"}
      description="Tasks drive project progress. Completing a task updates the percentage immediately."
      onClose={onClose}
    >
      <form className="space-y-3" onSubmit={handleSubmit}>
        <label className="block text-[13px] font-medium text-[var(--admin-ink)]">
          Task name
          <input
            required
            value={draft.title}
            onChange={(event) => handleTitleChange(event.target.value)}
            className={fieldClass}
          />
        </label>
        <label className="block text-[13px] font-medium text-[var(--admin-ink)]">
          Description
          <textarea
            rows={12}
            value={draft.description}
            onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
            className="mt-1.5 w-full whitespace-pre-wrap rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-white px-3 py-2 text-sm leading-relaxed text-[var(--admin-ink)] outline-none focus:border-[rgb(0_80_240_/_0.45)]"
          />
        </label>
        <label className="block text-[13px] font-medium text-[var(--admin-ink)]">
          Reference link
          <input
            type="url"
            value={draft.referenceUrl}
            onChange={(event) => setDraft((current) => ({ ...current, referenceUrl: event.target.value }))}
            className={fieldClass}
            placeholder="https://figma.com/… or https://github.com/…"
          />
        </label>
        <label className="block text-[13px] font-medium text-[var(--admin-ink)]">
          Phase
          <select
            className={fieldClass}
            value={draft.milestoneId}
            onChange={(event) => setDraft((current) => ({ ...current, milestoneId: event.target.value }))}
          >
            <option value="">Ungrouped</option>
            {milestones.map((milestone) => (
              <option key={milestone.id} value={milestone.id}>
                {displayMilestoneName(milestone.name)}
              </option>
            ))}
          </select>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-[13px] font-medium text-[var(--admin-ink)]">
            Status
            <select
              required
              className={fieldClass}
              value={draft.status}
              onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as AgencyTaskStatus }))}
            >
              {taskStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-[13px] font-medium text-[var(--admin-ink)]">
            Priority
            <select
              required
              className={fieldClass}
              value={draft.priority}
              onChange={(event) =>
                setDraft((current) => ({ ...current, priority: event.target.value as AgencyTaskPriority }))
              }
            >
              {taskPriorities.map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-[13px] font-medium text-[var(--admin-ink)]">
            Recommended role
            <select
              className={fieldClass}
              value={draft.recommendedRole ?? ""}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  recommendedRole: (event.target.value || null) as TaskRecommendedRoleId | null,
                }))
              }
            >
              <option value="">None</option>
              {TASK_RECOMMENDED_ROLE_OPTIONS.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-[13px] font-medium text-[var(--admin-ink)]">
            Task type
            <select
              className={fieldClass}
              value={draft.taskType ?? "internal"}
              onChange={(event) => setDraft((current) => ({ ...current, taskType: event.target.value as TaskType }))}
            >
              {TASK_TYPES.map((type) => (
                <option key={type} value={type}>
                  {taskTypeLabel(type)}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-[13px] font-medium text-[var(--admin-ink)]">
            Estimated hours
            <input
              type="number"
              min="0"
              step="0.5"
              value={draft.estimatedHours ?? ""}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  estimatedHours: event.target.value === "" ? null : Number(event.target.value),
                }))
              }
              className={fieldClass}
              placeholder="Optional"
            />
          </label>
          <label className="block text-[13px] font-medium text-[var(--admin-ink)]">
            Assignee
            {assignees.length > 0 ? (
              <select
                className={fieldClass}
                value={draft.assignedTo}
                onChange={(event) => {
                  const assignedTo = event.target.value;
                  const name = assignees.find((item) => item.id === assignedTo)?.name ?? "";
                  setDraft((current) => ({ ...current, assignedTo, assignee: name }));
                }}
              >
                <option value="">Unassigned</option>
                {assignees.map((person) => (
                  <option key={person.id} value={person.id}>
                    {assigneeOptionLabel(person)}
                  </option>
                ))}
              </select>
            ) : (
              <input
                value={draft.assignee}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, assignee: event.target.value, assignedTo: "" }))
                }
                className={fieldClass}
                placeholder="Optional"
              />
            )}
          </label>
          <label className="block text-[13px] font-medium text-[var(--admin-ink)] sm:col-span-2">
            Due date
            <input
              type="date"
              value={draft.dueDate}
              onChange={(event) => setDraft((current) => ({ ...current, dueDate: event.target.value }))}
              className={fieldClass}
            />
          </label>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            className="inline-flex h-10 items-center rounded-[var(--admin-radius)] border border-[var(--admin-line)] px-4 font-heading text-sm font-semibold text-[var(--admin-ink)] hover:bg-[var(--admin-bg)]"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="inline-flex h-10 items-center rounded-[var(--admin-radius)] bg-[var(--admin-blue)] px-4 font-heading text-sm font-semibold text-white"
          >
            {task ? "Save changes" : "Add Task"}
          </button>
        </div>
      </form>
    </AdminDialog>
  );
}
