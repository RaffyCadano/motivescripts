/**
 * Pure selectors for the Content Writer Dashboard. Same style as developerOverview.ts and
 * designerOverview.ts: plain functions over data already loaded by useTeamWork(), no hooks or fetching.
 * Generic task and time selectors (activeTasks, reviewTasks, hoursByDay, and so on) are reused from
 * developerOverview.ts, not duplicated.
 *
 * Imports here are deliberately relative (and type-only where possible) so these functions can be unit
 * tested in plain Node (scripts/test-content-writer-overview.mjs).
 */
import type { AgencyProject } from "@/data/agencyProjects";
import type { AgencyDeliverable, DeliverableCategory } from "@/data/files";
import type { TeamWorkTask } from "@/data/teamWorkspace";
import { contentWriterPageForTitle } from "./productionTaskInstructions.ts";

/** Deliverable categories that hold written content. Design, Development and Asset files are not the writer's. */
export const contentFileCategories: readonly DeliverableCategory[] = ["Content", "Document"];

type CopyTaskShape = Pick<TeamWorkTask, "title" | "recommendedRole">;

/**
 * A copy task is one recommended for the Content Writer role (set when the production plan is generated),
 * or, for tasks generated before that field existed, a "Write <page> copy" task recognised by its title.
 */
export function isCopyTask(task: CopyTaskShape): boolean {
  if (task.recommendedRole) return task.recommendedRole === "content_writer";
  return contentWriterPageForTitle(task.title) !== null;
}

export type CopyProgress = { total: number; completed: number };

/**
 * Completed / total copy tasks on one project. total === 0 means "no copy tasks yet": callers must show an
 * honest empty state, never 100%.
 */
export function copyProgress(project: Pick<AgencyProject, "tasks">): CopyProgress {
  const tasks = project.tasks.filter(isCopyTask);
  return { total: tasks.length, completed: tasks.filter((task) => task.status === "Completed").length };
}

/** The page a "Write <page> copy" task is for (e.g. "Services page"), or null when it is not tied to one page. */
export function copyPageFor(task: Pick<TeamWorkTask, "title">): string | null {
  return contentWriterPageForTitle(task.title);
}

const pipelineOrder: Record<string, number> = { "In Progress": 0, "In Review": 1, Blocked: 2, Todo: 3, Completed: 4 };

/**
 * The writer's own copy tasks for the pipeline widget: open work first (in progress, then in review,
 * blocked, to do), completed last. Within a status the earliest due date comes first and undated tasks last.
 */
export function copyPipeline<T extends Pick<TeamWorkTask, "title" | "recommendedRole" | "status" | "dueDate">>(
  tasks: T[],
): T[] {
  return tasks
    .filter(isCopyTask)
    .sort((a, b) => {
      const byStatus = (pipelineOrder[a.status] ?? 9) - (pipelineOrder[b.status] ?? 9);
      if (byStatus !== 0) return byStatus;
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return 0;
    });
}

/** Non-archived written-content files (Content or Document) on the given projects. */
export function contentFilesFor<T extends Pick<AgencyDeliverable, "category" | "projectId" | "status">>(
  deliverables: T[],
  projectIds: Set<string>,
): T[] {
  return deliverables.filter(
    (item) => projectIds.has(item.projectId) && item.status !== "Archived" && contentFileCategories.includes(item.category),
  );
}
