/**
 * Pure selectors for the QA / Tester (Team Member) Dashboard. Same style as developerOverview.ts and
 * designerOverview.ts: plain functions over data already loaded by useTeamWork(), no hooks or fetching.
 * Generic task and time selectors are reused from developerOverview.ts, and project-level QA rules
 * (developmentComplete, qaLatestResult) from productionWorkflow.ts, not duplicated.
 *
 * Imports here are deliberately relative (and type-only where possible) so these functions can be unit
 * tested in plain Node (scripts/test-qa-overview.mjs).
 */
import type { AgencyProject } from "@/data/agencyProjects";
import type { TeamWorkTask } from "@/data/teamWorkspace";
import { effectiveTaskType } from "./taskTypes.ts";

type QaTaskShape = Pick<TeamWorkTask, "title" | "taskType" | "recommendedRole">;

/**
 * A QA task is one classified as task_type 'qa', or (for "Verify production website" and other checks that
 * classify as internal) one recommended for the Team Member / QA role.
 */
export function isQaTask(task: QaTaskShape): boolean {
  return effectiveTaskType(task) === "qa" || task.recommendedRole === "team_member";
}

export type QaResultCounts = { toTest: number; passed: number; failed: number };

/**
 * QA checks by outcome: "toTest" is every QA task not yet completed, "passed" / "failed" are completed
 * ones that recorded a result. A completed task with no recorded result is not counted as either.
 */
export function qaResultCounts(tasks: (QaTaskShape & Pick<TeamWorkTask, "status" | "qaResult">)[]): QaResultCounts {
  const qa = tasks.filter(isQaTask);
  return {
    toTest: qa.filter((task) => task.status !== "Completed").length,
    passed: qa.filter((task) => task.status === "Completed" && task.qaResult === "pass").length,
    failed: qa.filter((task) => task.status === "Completed" && task.qaResult === "fail").length,
  };
}

export type QaProgress = { total: number; completed: number };

/** Completed / total QA tasks on one project. total === 0 means "no QA tasks yet": never show 100%. */
export function qaProgress(project: Pick<AgencyProject, "tasks">): QaProgress {
  const tasks = project.tasks.filter(isQaTask);
  return { total: tasks.length, completed: tasks.filter((task) => task.status === "Completed").length };
}

type ResultTask = { qaResult: string | null; completedAt: string | null };

/**
 * The tester's failed checks that still need attention, most recently completed first. A failure stops
 * counting once a later QA task on the same project has passed (the re-test), so an old failure never
 * inflates the number forever. `projects` supplies every QA task on those projects, not just the tester's own.
 */
export function outstandingFailedChecks<
  T extends QaTaskShape & Pick<TeamWorkTask, "status" | "qaResult" | "projectId" | "completedAt">,
>(myTasks: T[], projects: { id: string; tasks: ResultTask[] }[]): T[] {
  const passesByProject = new Map<string, string[]>();
  for (const project of projects) {
    passesByProject.set(
      project.id,
      project.tasks.filter((task) => task.qaResult === "pass" && task.completedAt).map((task) => task.completedAt as string),
    );
  }
  return myTasks
    .filter((task) => isQaTask(task) && task.status === "Completed" && task.qaResult === "fail")
    .filter((task) => !(passesByProject.get(task.projectId) ?? []).some((passedAt) => passedAt > (task.completedAt ?? "")))
    .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));
}
