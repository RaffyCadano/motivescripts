/**
 * Pure selectors for the Developer Dashboard. Same style as pmOverview.ts: plain
 * functions over already-loaded data, no hooks/fetching. Every function here reads
 * only from data already fetched by useTeamWork()/timeEntriesRepository.ts -- nothing
 * here talks to Supabase directly.
 */
import type { AgencyDeliverable } from "@/data/files";
import type { AgencyProject } from "@/data/agencyProjects";
import { websiteMilestoneDefinition } from "@/data/projectMilestones";
import { needsAttention } from "@/data/review";
import { effectiveTaskType } from "@/data/taskTypes";
import { isDueSoon, type TeamWorkTask } from "@/data/teamWorkspace";
import type { ProjectDevelopment } from "@/data/projectDevelopment";
import type { TimeEntry } from "@/data/timeEntries";
import { taskBlockedReasonLabel } from "@/data/agencyProjects";

export function activeTasks(tasks: TeamWorkTask[]): TeamWorkTask[] {
  return tasks.filter((task) => task.status === "Todo" || task.status === "In Progress");
}

export function blockedTasks(tasks: TeamWorkTask[]): TeamWorkTask[] {
  return tasks.filter((task) => task.status === "Blocked");
}

export function reviewTasks(tasks: TeamWorkTask[]): TeamWorkTask[] {
  return tasks.filter((task) => task.status === "In Review");
}

/** "QA" here means task_type = 'qa' on a regular task -- there is no separate bug tracker. */
export function qaTasks(tasks: TeamWorkTask[]): TeamWorkTask[] {
  return tasks.filter((task) => effectiveTaskType(task) === "qa");
}

/** Non-empty reason for a blocked task, or null if none was written -- never invented. */
/**
 * Prefers the structured blocked_reason (set via the "Mark Blocked" picker)
 * over the free-text description -- the description fallback exists for
 * tasks blocked before that field existed, or via a path that never set one.
 */
export function blockedReason(task: Pick<TeamWorkTask, "description" | "blockedReason">): string | null {
  if (task.blockedReason) return taskBlockedReasonLabel(task.blockedReason);
  const trimmed = task.description.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * "Due This Week" -- reuses isDueSoon() (already excludes Completed tasks and overdue tasks;
 * isDueSoon's own bucket check only returns true for today/tomorrow/up-to-7-days-out) and then
 * excludes today specifically so this section doesn't just repeat Today's Tasks above it.
 */
export function dueThisWeekTasks(tasks: TeamWorkTask[], now = new Date()): TeamWorkTask[] {
  const today = isoDate(now);
  return tasks.filter((task) => isDueSoon(task, now) && task.dueDate !== today);
}

/**
 * Deliverables genuinely marked "Needs Changes" by the existing client-review workflow
 * (needsAttention() in src/data/review.ts is the canonical definition, already used by
 * pmOverview.ts -- not a new rule), scoped to the developer's own projects.
 */
export function needsChangesDeliverables(
  deliverables: AgencyDeliverable[],
  projectIds: Set<string>,
): AgencyDeliverable[] {
  return needsAttention(deliverables).filter((item) => projectIds.has(item.projectId));
}

export type DevelopmentPhaseProgress = {
  total: number;
  completed: number;
};

/**
 * Completed / total tasks belonging ONLY to this project's Development milestone (identified
 * via websiteMilestoneDefinition's existing name/alias matching, not a raw string compare --
 * the same normalization already used for milestone display elsewhere). Distinct from
 * calculateProjectProgress(), which spans every milestone. total === 0 means "no Development
 * tasks exist yet" -- callers must show an honest empty state, never 100%.
 */
export function developmentPhaseProgress(project: Pick<AgencyProject, "milestones" | "tasks">): DevelopmentPhaseProgress {
  const developmentMilestoneIds = new Set(
    project.milestones
      .filter((milestone) => websiteMilestoneDefinition(milestone.name)?.key === "development")
      .map((milestone) => milestone.id),
  );
  const developmentTasks = project.tasks.filter((task) => developmentMilestoneIds.has(task.milestoneId));
  return {
    total: developmentTasks.length,
    completed: developmentTasks.filter((task) => task.status === "Completed").length,
  };
}

export type DeveloperDeploymentRow = {
  projectId: string;
  projectName: string;
  development: ProjectDevelopment;
  project: AgencyProject;
};

export function developerDeploymentRows(projects: AgencyProject[]): DeveloperDeploymentRow[] {
  return projects
    .filter((project) => !project.archived)
    .map((project) => ({ projectId: project.id, projectName: project.name, development: project.development, project }));
}

function isoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Monday of the local calendar week containing `date`, as a date-only ISO string. */
function mondayOf(date: Date): string {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const weekday = start.getDay();
  const offsetToMonday = weekday === 0 ? -6 : 1 - weekday;
  start.setDate(start.getDate() + offsetToMonday);
  return isoDate(start);
}

export function hoursLoggedToday(entries: TimeEntry[], now = new Date()): number {
  const today = isoDate(now);
  return round2(entries.filter((entry) => entry.entryDate === today).reduce((total, entry) => total + entry.hours, 0));
}

export function hoursLoggedThisWeek(entries: TimeEntry[], now = new Date()): number {
  const weekStart = mondayOf(now);
  return round2(
    entries
      .filter((entry) => entry.entryDate >= weekStart && entry.entryDate <= isoDate(now))
      .reduce((total, entry) => total + entry.hours, 0),
  );
}

export type DailyHours = { date: string; label: string; hours: number };

/** Hours logged per local calendar day for the last `days` days, oldest first, ending today. Days with no entries are 0. */
export function hoursByDay(entries: TimeEntry[], days = 14, now = new Date()): DailyHours[] {
  const byDate = new Map<string, number>();
  for (const entry of entries) byDate.set(entry.entryDate, (byDate.get(entry.entryDate) ?? 0) + entry.hours);

  return Array.from({ length: days }, (_, index) => {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1 - index));
    const date = isoDate(day);
    return {
      date,
      label: day.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      hours: round2(byDate.get(date) ?? 0),
    };
  });
}

export type ProjectHours = { projectId: string; name: string; hours: number };

/** Total hours per project, largest first. Anything beyond `limit` rows is folded into one "Other projects" row. */
export function hoursByProject(entries: TimeEntry[], nameOf: (projectId: string) => string, limit = 6): ProjectHours[] {
  const totals = new Map<string, number>();
  for (const entry of entries) totals.set(entry.projectId, (totals.get(entry.projectId) ?? 0) + entry.hours);

  const rows = [...totals.entries()]
    .map(([projectId, hours]) => ({ projectId, name: nameOf(projectId), hours: round2(hours) }))
    .sort((a, b) => b.hours - a.hours);
  if (rows.length <= limit) return rows;

  const rest = rows.slice(limit - 1);
  return [
    ...rows.slice(0, limit - 1),
    { projectId: "other", name: "Other projects", hours: round2(rest.reduce((sum, row) => sum + row.hours, 0)) },
  ];
}

export type TaskStatusCount = { status: TeamWorkTask["status"]; count: number };

/** Task count per status, in workflow order, including zero counts so the chart's categories stay stable. */
export function taskStatusCounts(tasks: TeamWorkTask[]): TaskStatusCount[] {
  const order: TeamWorkTask["status"][] = ["Todo", "In Progress", "In Review", "Blocked", "Completed"];
  return order.map((status) => ({ status, count: tasks.filter((task) => task.status === status).length }));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
