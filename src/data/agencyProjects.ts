/**
 * Project, milestone, and task UI types and helpers.
 * Runtime records come from Supabase via LeadsProvider. This module has no seed rows.
 */

import { formatLeadDate, formatLeadSubmitted, formatLeadTimestamp } from "@/data/leads";
import type { ProjectDevelopment } from "@/data/projectDevelopment";
import type { TaskRecommendedRoleId } from "@/data/taskRecommendedRoles";
import type { TaskType } from "@/data/taskTypes";

export type { DeploymentStatus, ProjectDevelopment } from "@/data/projectDevelopment";
export { deploymentStatuses, emptyProjectDevelopment } from "@/data/projectDevelopment";

export const projectTypes = [
  "Website",
  "Website Redesign",
  "Landing Page",
  "E-commerce",
  "Maintenance",
  "Other",
] as const;
export type AgencyProjectType = (typeof projectTypes)[number];

export const projectStatuses = [
  "Planning",
  "In Development",
  "Client Review",
  "On Hold",
  "Completed",
] as const;
export type AgencyProjectStatus = (typeof projectStatuses)[number];

export const milestoneStatuses = ["Not Started", "In Progress", "Completed", "On Hold"] as const;
export type AgencyMilestoneStatus = (typeof milestoneStatuses)[number];

export const taskStatuses = ["Todo", "In Progress", "In Review", "Completed", "Blocked"] as const;
export type AgencyTaskStatus = (typeof taskStatuses)[number];

export const taskPriorities = ["Low", "Medium", "High", "Urgent"] as const;
export type AgencyTaskPriority = (typeof taskPriorities)[number];

export const projectApprovalStatuses = ["Pending", "Approved"] as const;
export type AgencyApprovalStatus = (typeof projectApprovalStatuses)[number];

export const projectBillingModes = ["fixed", "hourly"] as const;
export type ProjectBillingMode = (typeof projectBillingModes)[number];

export type AgencyMilestone = {
  id: string;
  name: string;
  description: string;
  status: AgencyMilestoneStatus;
  order: number;
  startDate: string;
  dueDate: string;
};

export type AgencyTask = {
  id: string;
  milestoneId: string;
  title: string;
  description: string;
  status: AgencyTaskStatus;
  priority: AgencyTaskPriority;
  assignee: string;
  assignedTo: string;
  dueDate: string;
  createdAt: string;
  completedAt: string | null;
  recommendedRole: TaskRecommendedRoleId | null;
  taskType: TaskType | null;
  referenceUrl: string;
  estimatedHours: number | null;
  deliverableId: string | null;
};

export type AgencyProjectFeedback = {
  id: string;
  body: string;
  status: "Open" | "Resolved";
  createdLabel: string;
};

export type AgencyProjectActivity = {
  id: string;
  description: string;
  createdAt: string;
  icon: "created" | "status" | "task" | "milestone" | "file" | "progress" | "review";
};

export type AgencyProject = {
  id: string;
  clientId: string;
  name: string;
  type: AgencyProjectType;
  description: string;
  status: AgencyProjectStatus;
  startDate: string;
  targetLaunchDate: string;
  createdAt: string;
  lastActivityAt: string;
  archived: boolean;
  approvalStatus: AgencyApprovalStatus;
  development: ProjectDevelopment;
  billingMode: ProjectBillingMode;
  hourlyRateCents: number | null;
  budgetedHours: number | null;
  milestones: AgencyMilestone[];
  tasks: AgencyTask[];
  feedback: AgencyProjectFeedback[];
  activity: AgencyProjectActivity[];
};

export type AgencyProjectDraft = {
  name: string;
  clientId: string;
  type: AgencyProjectType;
  description: string;
  status: AgencyProjectStatus;
  startDate: string;
  targetLaunchDate: string;
  development?: ProjectDevelopment;
  billingMode?: ProjectBillingMode;
  hourlyRateCents?: number | null;
  budgetedHours?: number | null;
};

export type AgencyMilestoneDraft = {
  name: string;
  description: string;
  status: AgencyMilestoneStatus;
  startDate: string;
  dueDate: string;
};

export type AgencyTaskDraft = {
  title: string;
  description: string;
  milestoneId: string;
  status: AgencyTaskStatus;
  priority: AgencyTaskPriority;
  assignee: string;
  assignedTo: string;
  dueDate: string;
  recommendedRole: TaskRecommendedRoleId | null;
  taskType: TaskType | null;
  referenceUrl: string;
  estimatedHours: number | null;
};

export function taskStatusLabel(status: AgencyTaskStatus): string {
  if (status === "Todo") return "To Do";
  return status;
}

export function calculateProjectProgress(project: Pick<AgencyProject, "tasks">): number {
  if (project.tasks.length === 0) return 0;
  const completed = project.tasks.filter((task) => task.status === "Completed").length;
  return Math.round((completed / project.tasks.length) * 100);
}

export function taskCounts(project: Pick<AgencyProject, "tasks">) {
  const total = project.tasks.length;
  const completed = project.tasks.filter((task) => task.status === "Completed").length;
  return { total, completed };
}

export function taskIsAssigned(task: Pick<AgencyTask, "assignedTo" | "assignee">): boolean {
  return Boolean(task.assignedTo.trim() || task.assignee.trim());
}

export function productionTaskStats(project: Pick<AgencyProject, "tasks">) {
  const total = project.tasks.length;
  const completed = project.tasks.filter((task) => task.status === "Completed").length;
  const assigned = project.tasks.filter(taskIsAssigned).length;
  const remaining = total - completed;
  const unassigned = project.tasks.filter((task) => !taskIsAssigned(task) && task.status !== "Completed").length;
  return { total, completed, assigned, remaining, unassigned };
}

export function formatProductionTaskStats(stats: ReturnType<typeof productionTaskStats>): string {
  return `${stats.total} total · ${stats.assigned} assigned · ${stats.completed} completed · ${stats.remaining} remaining`;
}

export function milestoneProductionRows(project: Pick<AgencyProject, "milestones" | "tasks">) {
  return [...project.milestones]
    .sort((a, b) => a.order - b.order)
    .map((milestone) => ({
      id: milestone.id,
      name: milestone.name,
      status: milestone.status,
      ...milestoneTaskCounts(project, milestone.id),
    }));
}

export function milestoneTaskCounts(project: Pick<AgencyProject, "tasks">, milestoneId: string) {
  const tasks = project.tasks.filter((task) => task.milestoneId === milestoneId);
  const completed = tasks.filter((task) => task.status === "Completed").length;
  const total = tasks.length;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  return { total, completed, percent };
}

/**
 * Milestones ordered earlier than the given one that still have open (not
 * Completed) tasks -- a soft heads-up, not an enforced dependency. Deliberately
 * not a hard block: real work often reasonably overlaps stages (a developer
 * scaffolding while design is still being finalized), so this only informs,
 * it never prevents a status change.
 */
export function earlierOpenMilestones(
  project: Pick<AgencyProject, "milestones" | "tasks">,
  milestoneId: string,
): { name: string; openCount: number }[] {
  const target = project.milestones.find((item) => item.id === milestoneId);
  if (!target) return [];
  return [...project.milestones]
    .filter((item) => item.order < target.order)
    .sort((a, b) => a.order - b.order)
    .map((item) => ({ name: item.name, ...milestoneTaskCounts(project, item.id) }))
    .filter((item) => item.total - item.completed > 0)
    .map((item) => ({ name: item.name, openCount: item.total - item.completed }));
}

export function currentMilestone(project: AgencyProject): AgencyMilestone | null {
  const ordered = [...project.milestones].sort((a, b) => a.order - b.order);
  return (
    ordered.find((item) => item.status === "In Progress") ??
    ordered.find((item) => item.status === "Not Started") ??
    ordered.find((item) => item.status === "On Hold") ??
    ordered.at(-1) ??
    null
  );
}

export function upcomingMilestone(project: AgencyProject): AgencyMilestone | null {
  const ordered = [...project.milestones].sort((a, b) => a.order - b.order);
  const current = currentMilestone(project);
  if (!current) return ordered.find((item) => item.status !== "Completed") ?? null;
  return ordered.find((item) => item.order > current.order && item.status !== "Completed") ?? null;
}

export function upcomingTasks(project: AgencyProject, limit = 3): AgencyTask[] {
  return project.tasks
    .filter((task) => task.status !== "Completed")
    .slice()
    .sort((a, b) => {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    })
    .slice(0, limit);
}

export function syncMilestoneStatuses(project: AgencyProject): AgencyProject {
  const milestones = project.milestones.map((milestone) => {
    if (milestone.status === "On Hold") return milestone;
    const { total, completed } = milestoneTaskCounts(project, milestone.id);
    if (total > 0 && completed === total) return { ...milestone, status: "Completed" as const };
    if (milestone.status === "Not Started") {
      const started = project.tasks.some(
        (task) =>
          task.milestoneId === milestone.id && (task.status === "In Progress" || task.status === "Completed"),
      );
      if (started) return { ...milestone, status: "In Progress" as const };
    }
    return milestone;
  });
  return { ...project, milestones };
}

export function filterProjects(
  projects: AgencyProject[],
  clientsById: Map<string, { businessName: string }>,
  query: string,
  status: AgencyProjectStatus | "All",
  clientId: string | "All",
  type: AgencyProjectType | "All",
): AgencyProject[] {
  const needle = query.trim().toLowerCase();
  return projects.filter((project) => {
    if (project.archived) return false;
    if (status !== "All" && project.status !== status) return false;
    if (clientId !== "All" && project.clientId !== clientId) return false;
    if (type !== "All" && project.type !== type) return false;
    if (!needle) return true;
    const clientName = clientsById.get(project.clientId)?.businessName ?? "";
    return (
      project.name.toLowerCase().includes(needle) ||
      clientName.toLowerCase().includes(needle) ||
      project.type.toLowerCase().includes(needle)
    );
  });
}

export function formatProjectDay(value: string): string {
  if (!value) return "Not set";
  return formatLeadSubmitted(value.includes("T") ? value : `${value}T12:00:00`);
}

export function formatProjectDayShort(value: string): string {
  if (!value) return "—";
  const date = new Date(value.includes("T") ? value : `${value}T12:00:00`);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function parseProjectDay(value: string): Date | null {
  if (!value.trim()) return null;
  const date = new Date(value.includes("T") ? value : `${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatProjectLaunch(value: string): string {
  if (!value.trim()) return "Not scheduled";
  return formatProjectDay(value);
}

export type ProjectLaunchUrgency = "none" | "scheduled" | "soon" | "overdue";

export function projectLaunchUrgency(value: string, status: AgencyProjectStatus): ProjectLaunchUrgency {
  const date = parseProjectDay(value);
  if (!date) return "none";
  if (status === "Completed") return "scheduled";
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (day < start) return "overdue";
  const soon = new Date(start);
  soon.setDate(soon.getDate() + 7);
  if (day < soon) return "soon";
  return "scheduled";
}

export function projectListAttention(project: AgencyProject): { body: string } | null {
  if (project.archived) return null;
  if (projectLaunchUrgency(project.targetLaunchDate, project.status) === "overdue") {
    return { body: "Target launch date is overdue." };
  }
  if (project.status === "Client Review") {
    return { body: "Client Review — waiting for the client." };
  }
  if (project.status === "On Hold") {
    return { body: "This project is on hold." };
  }
  return null;
}

export {
  formatLeadDate as formatProjectDate,
  formatLeadSubmitted as formatProjectSince,
  formatLeadTimestamp as formatProjectTimestamp,
};
