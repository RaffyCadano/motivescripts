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
export function blockedReason(task: Pick<TeamWorkTask, "description">): string | null {
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
};

export function developerDeploymentRows(projects: AgencyProject[]): DeveloperDeploymentRow[] {
  return projects
    .filter((project) => !project.archived)
    .map((project) => ({ projectId: project.id, projectName: project.name, development: project.development }));
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

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
