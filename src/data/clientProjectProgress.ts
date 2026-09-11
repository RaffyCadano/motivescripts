import type { ClientTask, ProjectStage, ProjectStageStatus } from "@/data/clientPortal";
import type { AgencyMilestone, AgencyProject, AgencyTask } from "@/data/agencyProjects";
import type { AgencyDeliverable } from "@/data/files";
import { displayMilestoneName } from "@/data/projectMilestones";
import {
  checkpointApproved,
  clientReviewComplete,
  developmentComplete,
  qaLatestResult,
} from "@/data/productionWorkflow";

function milestoneStageStatus(milestones: AgencyMilestone[], index: number): ProjectStageStatus {
  const sorted = milestones;
  const currentIdx = sorted.findIndex((item) => item.status === "In Progress");
  const fallbackIdx = currentIdx === -1 ? sorted.findIndex((item) => item.status !== "Completed") : currentIdx;
  if (sorted[index]?.status === "Completed") return "complete";
  if (index === fallbackIdx && fallbackIdx !== -1) return "current";
  return "upcoming";
}

export function timelineStagesFromProject(project: AgencyProject | null | undefined): ProjectStage[] {
  if (!project?.milestones.length) return [];
  const sorted = [...project.milestones].sort((a, b) => a.order - b.order);
  return sorted.map((milestone, index) => ({
    id: milestone.id,
    label: displayMilestoneName(milestone.name),
    status: milestoneStageStatus(sorted, index),
  }));
}

/**
 * Simple 6-step delivery checklist for the client portal (Section 20 of the
 * production workflow spec): "what do you need from me?" -- distinct from
 * timelineStagesFromProject() above, which shows raw milestone status.
 * These steps mirror the same server-enforced gates as
 * src/data/productionWorkflow.ts's Admin/PM summary, simplified to what a
 * client needs to see (payment status is shown separately in Invoices, so
 * it's intentionally not a step here). No internal tasks, staff, or
 * deployment details -- only checkpoint/gate booleans.
 */
export function clientDeliveryStages(
  project: AgencyProject | null | undefined,
  deliverables: AgencyDeliverable[],
): ProjectStage[] {
  if (!project) return [];
  const steps = [
    { id: "design", label: "Design Approved", done: checkpointApproved(deliverables, "overall_design") },
    { id: "development", label: "Development", done: developmentComplete(project) },
    { id: "qa", label: "QA", done: qaLatestResult(project) === "pass" },
    { id: "review", label: "Your Review", done: clientReviewComplete(project) },
    { id: "final_approval", label: "Final Approval", done: checkpointApproved(deliverables, "final_website") },
    { id: "launch", label: "Launch", done: project.development.deploymentStatus === "Production" },
  ];
  const currentIndex = steps.findIndex((step) => !step.done);
  return steps.map((step, index) => ({
    id: step.id,
    label: step.label,
    status: step.done ? "complete" : index === currentIndex ? "current" : "upcoming",
  }));
}

export function clientTasksFromProject(project: AgencyProject | null | undefined): ClientTask[] {
  if (!project?.tasks.length) return [];
  return [...project.tasks]
    .sort((a, b) => a.title.localeCompare(b.title))
    .map((task: AgencyTask) => ({
      id: task.id,
      label: task.title,
      status: task.status === "Completed" ? "done" : "open",
    }));
}
