import type { AgencyMilestoneStatus, AgencyProject, AgencyTask } from "@/data/agencyProjects";
import { productionTaskStats, taskIsAssigned } from "@/data/agencyProjects";
import type { TeamMember } from "@/data/team";

export const PROJECT_TEAM_SLOTS = [
  { id: "project_manager", label: "Project Manager", templates: ["project_manager"] },
  { id: "developer", label: "Developer", templates: ["developer"] },
  { id: "designer", label: "Designer", templates: ["designer"] },
  { id: "content_writer", label: "Content Writer", templates: ["content_writer"] },
  { id: "team_member", label: "QA / Team Member", templates: ["team_member"] },
] as const;

export const PRODUCTION_PROJECT_SLOT_IDS = new Set<string>([
  "developer",
  "designer",
  "content_writer",
  "team_member",
]);

export type ProjectTeamSlotId = (typeof PROJECT_TEAM_SLOTS)[number]["id"];

export type ProjectTeamSlot = {
  id: ProjectTeamSlotId | string;
  label: string;
  names: string[];
};

export type ProductionPathStep = {
  id: string;
  label: string;
  done: boolean;
};

function slotFromTemplate(templateKey: string): ProjectTeamSlotId | null {
  if (templateKey === "project_manager") return "project_manager";
  if (templateKey === "developer") return "developer";
  if (templateKey === "designer") return "designer";
  if (templateKey === "content_writer") return "content_writer";
  if (templateKey === "team_member") return "team_member";
  return null;
}

function slotFromLabel(label: string): ProjectTeamSlotId | null {
  const value = label.trim().toLowerCase();
  if (!value) return null;
  if (/\b(project manager|project-manager|\bpm\b)\b/.test(value)) return "project_manager";
  if (/\b(developer|engineer|dev)\b/.test(value)) return "developer";
  if (/\bdesign/.test(value)) return "designer";
  if (/\b(content|writer|copy)\b/.test(value)) return "content_writer";
  if (/\b(qa|quality|tester|team member)\b/.test(value)) return "team_member";
  return null;
}

export function projectTeamSlots(
  members: TeamMember[],
  projectId: string,
  assignedLabels: Record<string, string>,
): ProjectTeamSlot[] {
  const assigned = members.filter((member) => member.projectAssignments.some((item) => item.entityId === projectId));
  const used = new Set<string>();
  const slots: ProjectTeamSlot[] = PROJECT_TEAM_SLOTS.map((slot) => {
    const names = assigned
      .filter((member) => {
        const fromTemplate = slotFromTemplate(member.templateKey);
        const fromLabel = slotFromLabel(assignedLabels[member.id] ?? "");
        const match = fromTemplate === slot.id || fromLabel === slot.id;
        if (match) used.add(member.id);
        return match;
      })
      .map((member) => member.fullName.trim() || member.email);
    return { id: slot.id, label: slot.label, names };
  });

  const extras = assigned.filter((member) => !used.has(member.id));
  for (const member of extras) {
    slots.push({
      id: member.id,
      label: member.templateLabel || member.jobTitle || "Team Member",
      names: [member.fullName.trim() || member.email],
    });
  }
  return slots;
}

export function milestonePipelineTone(
  status: AgencyMilestoneStatus,
  currentId: string | null,
  milestoneId: string,
): "done" | "current" | "upcoming" {
  if (status === "Completed") return "done";
  if (currentId === milestoneId) return "current";
  return "upcoming";
}

export function deriveProductionPath(input: {
  invoicePaid: boolean;
  project: Pick<AgencyProject, "status" | "approvalStatus" | "development" | "tasks">;
  staffAssigned: boolean;
  awaitingReview: boolean;
  approvedDeliverables: number;
  openFeedback: number;
}): ProductionPathStep[] {
  const stats = productionTaskStats(input.project);
  const workStarted = input.project.tasks.some(
    (task) => task.status === "In Progress" || task.status === "Completed" || task.status === "In Review",
  );
  const assignedWork = input.project.tasks.some(taskIsAssigned) || input.staffAssigned;
  const staging = Boolean(input.project.development.stagingUrl.trim());
  const production = Boolean(input.project.development.productionUrl.trim());
  const deployed =
    input.project.development.deploymentStatus !== "Not deployed" || staging || production;
  const reviewing = input.project.status === "Client Review" || input.awaitingReview;
  const approved = input.project.approvalStatus === "Approved" || input.approvedDeliverables > 0;
  const completed = input.project.status === "Completed";

  return [
    { id: "paid", label: "Client Pays", done: input.invoicePaid || stats.total > 0 },
    { id: "generated", label: "Production Tasks Generated", done: stats.total > 0 },
    { id: "assign", label: "PM/Admin Assigns Staff", done: assignedWork },
    { id: "work", label: "Team Works", done: workStarted },
    { id: "build", label: "Developer Builds Website", done: deployed || workStarted },
    { id: "staging", label: "Staging Deployment", done: staging },
    { id: "qa", label: "QA Tests", done: staging && stats.completed > 0 },
    { id: "fixes", label: "Fixes / Revisions", done: input.openFeedback === 0 && (reviewing || approved || completed) && stats.total > 0 },
    { id: "review", label: "Client Reviews", done: reviewing || approved || completed },
    { id: "approve", label: "Client Approves", done: approved || completed },
    { id: "launch", label: "Production Launch", done: production || completed },
    { id: "done", label: "Project Completed", done: completed },
  ];
}

export function taskAssigneeLabel(task: Pick<AgencyTask, "assignee" | "assignedTo">): string {
  return task.assignee.trim() || (task.assignedTo.trim() ? "Assigned" : "Unassigned");
}
