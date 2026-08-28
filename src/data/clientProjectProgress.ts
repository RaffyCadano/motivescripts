import type { ClientTask, ProjectStage, ProjectStageStatus } from "@/data/clientPortal";
import type { AgencyMilestone, AgencyProject, AgencyTask } from "@/data/agencyProjects";

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
    label: milestone.name,
    status: milestoneStageStatus(sorted, index),
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
