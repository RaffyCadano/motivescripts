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
};

export type TaskAssigneeOption = {
  id: string;
  name: string;
};

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
      });
      return;
    }
    setDraft({
      ...emptyDraft,
      milestoneId: defaultMilestoneId || milestones[0]?.id || "",
    });
  }, [defaultMilestoneId, milestones, open, task]);

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
            onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
            className={fieldClass}
          />
        </label>
        <label className="block text-[13px] font-medium text-[var(--admin-ink)]">
          Description
          <textarea
            rows={3}
            value={draft.description}
            onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
            className="mt-1.5 w-full rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-white px-3 py-2 text-sm text-[var(--admin-ink)] outline-none focus:border-[rgb(0_80_240_/_0.45)]"
          />
        </label>
        <label className="block text-[13px] font-medium text-[var(--admin-ink)]">
          Milestone
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
            Assigned to
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
                    {person.name}
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
          <label className="block text-[13px] font-medium text-[var(--admin-ink)]">
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
