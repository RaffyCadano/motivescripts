import { Link } from "react-router-dom";
import { TaskOriginBadge } from "@/components/admin/projects/TaskOriginBadge";
import { TaskPriorityBadge } from "@/components/admin/projects/TaskPriorityBadge";
import { TaskRecommendedRoleNote } from "@/components/admin/projects/TaskRecommendedRoleNote";
import { TaskStatusBadge } from "@/components/admin/projects/TaskStatusBadge";
import { formatProjectDay } from "@/data/agencyProjects";
import { displayMilestoneName } from "@/data/projectMilestones";
import { resolveTaskRecommendedRole } from "@/data/taskRecommendedRoles";
import {
  adminProjectTasksHref,
  dueBucket,
  type TeamWorkTask,
} from "@/data/teamWorkspace";
import { cn } from "@/lib/cn";

type MyTaskRowProps = {
  task: TeamWorkTask;
  onOpen: (task: TeamWorkTask) => void;
  projectHref: (projectId: string) => string;
};

type MyTaskListProps = {
  tasks: TeamWorkTask[];
  onOpen: (task: TeamWorkTask) => void;
  /** Where the "Project" link/button goes. Defaults to the admin project workspace. */
  projectHref?: (projectId: string) => string;
};

export function MyTaskTable({ tasks, onOpen, projectHref = adminProjectTasksHref }: MyTaskListProps) {
  return (
    <div className="hidden overflow-hidden rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] md:block">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-[var(--admin-line)] bg-[var(--admin-bg)] text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--admin-muted)]">
          <tr>
            <th className="px-4 py-3 font-heading">Task</th>
            <th className="px-4 py-3 font-heading">Project</th>
            <th className="px-4 py-3 font-heading">Phase</th>
            <th className="px-4 py-3 font-heading">Priority</th>
            <th className="px-4 py-3 font-heading">Due</th>
            <th className="px-4 py-3 font-heading">Status</th>
            <th className="px-4 py-3 font-heading">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--admin-line)]">
          {tasks.map((task) => (
            <MyTaskTableRow key={task.id} task={task} onOpen={onOpen} projectHref={projectHref} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MyTaskTableRow({ task, onOpen, projectHref }: MyTaskRowProps) {
  const recommendedRole = resolveTaskRecommendedRole(task);
  const bucket = dueBucket(task.dueDate);
  const phase = task.milestoneName.trim() ? displayMilestoneName(task.milestoneName) : "—";

  return (
    <tr className="hover:bg-[var(--admin-bg)]">
      <td className="px-4 py-3">
        <button
          type="button"
          className="text-left font-medium text-[var(--admin-ink)] hover:text-[var(--admin-blue)]"
          onClick={() => onOpen(task)}
        >
          {task.title}
        </button>
        {recommendedRole ? (
          <div className="mt-1">
            <TaskRecommendedRoleNote role={recommendedRole} />
          </div>
        ) : null}
      </td>
      <td className="px-4 py-3">
        <Link to={projectHref(task.projectId)} className="text-[var(--admin-blue)] hover:underline">
          {task.projectName}
        </Link>
      </td>
      <td className="px-4 py-3 text-[var(--admin-muted)]">{phase}</td>
      <td className="px-4 py-3">
        <TaskPriorityBadge priority={task.priority} />
      </td>
      <td className={cn("px-4 py-3", bucket === "overdue" ? "font-medium text-[#b45309]" : "text-[var(--admin-muted)]")}>
        {task.dueDate ? formatProjectDay(task.dueDate) : "Not set"}
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <TaskStatusBadge status={task.status} />
          {task.origin === "client" ? <TaskOriginBadge /> : null}
        </div>
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
          <Link to={projectHref(task.projectId)} className="font-heading text-[12px] font-semibold text-[var(--admin-muted)] hover:text-[var(--admin-blue)] hover:underline">
            View project
          </Link>
        </div>
      </td>
    </tr>
  );
}

export function MyTaskMobileList({ tasks, onOpen, projectHref = adminProjectTasksHref }: MyTaskListProps) {
  return (
    <ul className="space-y-3 md:hidden">
      {tasks.map((task) => (
        <MyTaskMobileCard key={task.id} task={task} onOpen={onOpen} projectHref={projectHref} />
      ))}
    </ul>
  );
}

function MyTaskMobileCard({ task, onOpen, projectHref }: MyTaskRowProps) {
  const recommendedRole = resolveTaskRecommendedRole(task);
  const bucket = dueBucket(task.dueDate);
  const phase = task.milestoneName.trim() ? displayMilestoneName(task.milestoneName) : "Ungrouped";

  return (
    <li className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-4">
      <button
        type="button"
        className="text-left font-heading text-sm font-semibold text-[var(--admin-ink)] hover:text-[var(--admin-blue)]"
        onClick={() => onOpen(task)}
      >
        {task.title}
      </button>
      <p className="mt-1 text-[13px] text-[var(--admin-muted)]">{task.projectName}</p>
      <p className="mt-1 text-[12px] text-[var(--admin-muted)]">
        {phase} · {task.priority}
      </p>
      {recommendedRole ? (
        <div className="mt-2">
          <TaskRecommendedRoleNote role={recommendedRole} />
        </div>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <span className={cn("text-[12px] font-medium", bucket === "overdue" ? "text-[#b45309]" : "text-[var(--admin-muted)]")}>
          {task.dueDate ? formatProjectDay(task.dueDate) : "No due date"}
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          <TaskStatusBadge status={task.status} />
          {task.origin === "client" ? <TaskOriginBadge /> : null}
        </div>
      </div>
      <div className="mt-3 flex gap-3">
        <button
          type="button"
          className="font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline"
          onClick={() => onOpen(task)}
        >
          Open
        </button>
        <Link to={projectHref(task.projectId)} className="font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline">
          View project
        </Link>
      </div>
    </li>
  );
}
