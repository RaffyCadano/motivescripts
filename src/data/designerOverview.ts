/**
 * Pure selectors for the Designer Dashboard. Same style as developerOverview.ts: plain functions over
 * data already loaded by useTeamWork(), no hooks or fetching. Time and task selectors (activeTasks,
 * reviewTasks, hoursByDay, and so on) are reused from developerOverview.ts, not duplicated.
 *
 * Imports here are deliberately relative (and type-only where possible) so these functions can be unit
 * tested in plain Node (scripts/test-designer-overview.mjs).
 */
import type { AgencyProject } from "@/data/agencyProjects";
import type { AgencyDeliverable, DesignCheckpoint } from "@/data/files";
import type { ReviewFeedback } from "@/data/review";
import { websiteMilestoneDefinition } from "./projectMilestones.ts";

export type DesignPhaseProgress = { total: number; completed: number };

/**
 * Completed / total tasks under this project's Design milestone (matched with the same name/alias
 * normalization used elsewhere). total === 0 means "no design tasks yet": callers must show an honest
 * empty state, never 100%.
 */
export function designPhaseProgress(project: Pick<AgencyProject, "milestones" | "tasks">): DesignPhaseProgress {
  const designMilestoneIds = new Set(
    project.milestones
      .filter((milestone) => websiteMilestoneDefinition(milestone.name)?.key === "design")
      .map((milestone) => milestone.id),
  );
  const tasks = project.tasks.filter((task) => designMilestoneIds.has(task.milestoneId));
  return { total: tasks.length, completed: tasks.filter((task) => task.status === "Completed").length };
}

export const deliverableStatusOrder = ["Draft", "In Review", "Needs Changes", "Approved"] as const;
export type CountedDeliverableStatus = (typeof deliverableStatusOrder)[number];
export type DeliverableStatusCount = { status: CountedDeliverableStatus; count: number };

/** Files per status in workflow order, including zeros so the chart's categories stay stable. Archived files are not counted. */
export function deliverableStatusCounts(deliverables: Pick<AgencyDeliverable, "status">[]): DeliverableStatusCount[] {
  return deliverableStatusOrder.map((status) => ({
    status,
    count: deliverables.filter((item) => item.status === status).length,
  }));
}

export const designCheckpointOrder: DesignCheckpoint[] = ["initial_concept", "logo_brand", "overall_design", "final_website"];

export type CheckpointState = "Not uploaded" | CountedDeliverableStatus;
export type CheckpointRow = { checkpoint: DesignCheckpoint; state: CheckpointState; deliverableId: string | null };

/**
 * Where each design approval checkpoint stands for ONE project's deliverables. Mirrors the server rule
 * project_checkpoint_approved(): a checkpoint is Approved when ANY non-archived deliverable tagged with it
 * is Approved. Otherwise it reports the status of the most recently updated one, or "Not uploaded".
 */
export function checkpointRows(
  deliverables: Pick<AgencyDeliverable, "id" | "status" | "designCheckpoint" | "updatedAt">[],
): CheckpointRow[] {
  return designCheckpointOrder.map((checkpoint) => {
    const tagged = deliverables.filter((item) => item.designCheckpoint === checkpoint && item.status !== "Archived");
    if (tagged.length === 0) return { checkpoint, state: "Not uploaded", deliverableId: null };
    const approved = tagged.find((item) => item.status === "Approved");
    if (approved) return { checkpoint, state: "Approved", deliverableId: approved.id };
    const latest = [...tagged].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
    return { checkpoint, state: latest.status as CountedDeliverableStatus, deliverableId: latest.id };
  });
}

/** Client feedback that has not been marked resolved yet, on the given projects. */
export function openFeedbackFor<T extends Pick<ReviewFeedback, "status" | "projectId">>(
  feedback: T[],
  projectIds: Set<string>,
): T[] {
  return feedback.filter((item) => item.status === "Open" && projectIds.has(item.projectId));
}
