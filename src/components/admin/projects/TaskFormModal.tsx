import { CalendarClock, FileText, ListChecks } from "lucide-react";
import { useEffect, useId, useState, type FormEvent } from "react";
import { AdminDialog } from "@/components/admin/leads/AdminDialog";
import {
  DialogActions,
  DialogField,
  DialogSection,
  DialogSelect,
  dialogInputClass,
  dialogTextareaClass,
} from "@/components/admin/dialog/formKit";

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
import { cn } from "@/lib/cn";


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
  const formId = useId();

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

  function handleMilestoneChange(milestoneId: string) {
    const milestoneDueDate = milestones.find((item) => item.id === milestoneId)?.dueDate ?? "";
    setDraft((current) => ({
      ...current,
      milestoneId,
      dueDate: task || current.dueDate ? current.dueDate : milestoneDueDate,
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
      icon={ListChecks}
      title={task ? "Edit Task" : "Add Task"}
      description="Tasks drive project progress. Completing a task updates the percentage immediately."
      size="xl"
      onClose={onClose}
      footer={<DialogActions formId={formId} submitLabel={task ? "Save changes" : "Add Task"} onCancel={onClose} />}
    >
      <form id={formId} className="space-y-6" onSubmit={handleSubmit}>
        <DialogSection title="Task" icon={FileText}>
          <div className="space-y-4">
            <DialogField label="Task name" required>
              <input
                required
                value={draft.title}
                onChange={(event) => handleTitleChange(event.target.value)}
                className={dialogInputClass}
                placeholder="What needs to be done?"
              />
            </DialogField>
            <DialogField label="Description" hint="Steps, context and anything the person doing it needs to know.">
              <textarea
                rows={5}
                value={draft.description}
                onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
                className={cn(dialogTextareaClass, "whitespace-pre-wrap")}
              />
            </DialogField>
            <DialogField label="Reference link" hint="A Figma file, GitHub page or any link that helps.">
              <input
                type="url"
                value={draft.referenceUrl}
                onChange={(event) => setDraft((current) => ({ ...current, referenceUrl: event.target.value }))}
                className={dialogInputClass}
                placeholder="https://figma.com/… or https://github.com/…"
              />
            </DialogField>
          </div>
        </DialogSection>

        <DialogSection title="Planning" icon={CalendarClock}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <DialogField label="Phase">
              <DialogSelect value={draft.milestoneId} onChange={(event) => handleMilestoneChange(event.target.value)}>
                <option value="">Ungrouped</option>
                {milestones.map((milestone) => (
                  <option key={milestone.id} value={milestone.id}>
                    {displayMilestoneName(milestone.name)}
                  </option>
                ))}
              </DialogSelect>
            </DialogField>
            <DialogField label="Status" required>
              <DialogSelect
                required
                value={draft.status}
                onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as AgencyTaskStatus }))}
              >
                {taskStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </DialogSelect>
            </DialogField>
            <DialogField label="Priority" required>
              <DialogSelect
                required
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
              </DialogSelect>
            </DialogField>
            <DialogField label="Task type">
              <DialogSelect
                value={draft.taskType ?? "internal"}
                onChange={(event) => setDraft((current) => ({ ...current, taskType: event.target.value as TaskType }))}
              >
                {TASK_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {taskTypeLabel(type)}
                  </option>
                ))}
              </DialogSelect>
            </DialogField>
            <DialogField label="Recommended role">
              <DialogSelect
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
              </DialogSelect>
            </DialogField>
            <DialogField label="Assignee">
              {assignees.length > 0 ? (
                <DialogSelect
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
                </DialogSelect>
              ) : (
                <input
                  value={draft.assignee}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, assignee: event.target.value, assignedTo: "" }))
                  }
                  className={dialogInputClass}
                  placeholder="Optional"
                />
              )}
            </DialogField>
            <DialogField label="Estimated hours">
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
                className={dialogInputClass}
                placeholder="Optional"
              />
            </DialogField>
            <DialogField label="Due date" className="sm:col-span-2 lg:col-span-2">
              <input
                type="date"
                value={draft.dueDate}
                onChange={(event) => setDraft((current) => ({ ...current, dueDate: event.target.value }))}
                className={dialogInputClass}
              />
            </DialogField>
          </div>
        </DialogSection>
      </form>
    </AdminDialog>
  );
}
