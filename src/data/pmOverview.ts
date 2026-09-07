import {
  calculateProjectProgress,
  currentMilestone,
  productionTaskStats,
  projectLaunchUrgency,
  projectListAttention,
  taskIsAssigned,
  type AgencyProject,
} from "@/data/agencyProjects";
import type { DiscoveryAttentionItem, DiscoveryIntake } from "@/data/discoveryIntake";
import { buildDiscoveryAttentionItems, buildDiscoveryStatusBoard } from "@/data/discoveryIntake";
import { blockedReason } from "@/data/developerOverview";
import type { ConversationSummary } from "@/data/messaging";
import type { AgencyDeliverable } from "@/data/files";
import { awaitingReview, needsAttention, type ReviewFeedback } from "@/data/review";
import { adminProjectHref, adminProjectTasksHref, isTaskOverdue, type TeamWorkTask } from "@/data/teamWorkspace";

export type PmProjectHealthStatus = "healthy" | "attention" | "blocked";

export type PmProjectHealthItem = {
  projectId: string;
  projectName: string;
  clientName: string;
  status: PmProjectHealthStatus;
  reasons: string[];
  href: string;
};

export type PmAttentionKind = "blocked" | "overdue" | "needs-changes" | "in-review" | "discovery" | "unassigned";

export type PmAttentionItem = {
  id: string;
  kind: PmAttentionKind;
  label: string;
  body: string;
  href: string;
  sort: number;
};

export function activePmProjects(projects: AgencyProject[]): AgencyProject[] {
  return projects.filter((project) => !project.archived && project.status !== "Completed");
}

export function buildPmDiscoveryItems(input: {
  intakes: DiscoveryIntake[];
  projects: AgencyProject[];
  clientsById: Map<string, { businessName: string }>;
  projectIds: Set<string>;
  limit?: number;
}): DiscoveryAttentionItem[] {
  return buildDiscoveryAttentionItems({
    intakes: input.intakes,
    projects: input.projects,
    clientsById: input.clientsById,
  })
    .filter((item) => input.projectIds.has(item.projectId))
    .slice(0, input.limit ?? 8);
}

/** Full 6-status Discovery board scoped to this PM's assigned projects (includes Not Sent and Complete). */
export function buildPmDiscoveryBoard(input: {
  intakes: DiscoveryIntake[];
  projects: AgencyProject[];
  clientsById: Map<string, { businessName: string }>;
  projectIds: Set<string>;
}): DiscoveryAttentionItem[] {
  return buildDiscoveryStatusBoard(input);
}

export function projectCoordinationHint(input: {
  project: AgencyProject;
  intake: DiscoveryIntake | null;
  overdueTaskCount: number;
  deliverableNeedsChanges: boolean;
  deliverableInReview: boolean;
  openFeedbackCount: number;
}): string {
  const attention = projectListAttention(input.project);
  if (attention) return attention.body;
  if (input.intake?.status === "submitted") return "Discovery submitted — review and approve.";
  if (input.intake?.status === "more_information_needed") return "Discovery follow-up sent — waiting on client.";
  if (input.intake?.status === "awaiting_client") return "Discovery sent — waiting on client submission.";
  if (input.overdueTaskCount > 0) {
    return input.overdueTaskCount === 1 ? "1 overdue task assigned to you." : `${input.overdueTaskCount} overdue tasks assigned to you.`;
  }
  if (input.project.status === "Client Review") return "Client review in progress.";
  if (input.deliverableNeedsChanges) return "Deliverable has requested changes.";
  if (input.deliverableInReview) return "Website deliverable waiting for review.";
  if (input.openFeedbackCount > 0) return "Open client feedback needs a response.";
  const milestone = currentMilestone(input.project);
  if (milestone) return `Current phase: ${milestone.name}.`;
  return "No urgent coordination items.";
}

function projectHealthReasons(input: {
  project: AgencyProject;
  intake: DiscoveryIntake | null;
  overdueTaskCount: number;
  unassignedOpenTasks: number;
  deliverableNeedsChanges: boolean;
  deliverableInReview: boolean;
  openFeedbackCount: number;
  hasUnreadMessages: boolean;
}): { status: PmProjectHealthStatus; reasons: string[] } {
  const reasons: string[] = [];

  if (input.project.status === "On Hold") {
    reasons.push("Project is on hold.");
    return { status: "blocked", reasons };
  }

  const attention = projectListAttention(input.project);
  if (attention) reasons.push(attention.body);

  if (input.intake?.status === "submitted") reasons.push("Discovery ready for review.");
  if (input.intake?.status === "more_information_needed") reasons.push("Discovery follow-up required.");

  if (input.overdueTaskCount > 0) {
    reasons.push(input.overdueTaskCount === 1 ? "1 overdue task." : `${input.overdueTaskCount} overdue tasks.`);
  }

  if (input.unassignedOpenTasks > 0) {
    reasons.push(
      input.unassignedOpenTasks === 1
        ? "1 open production task unassigned."
        : `${input.unassignedOpenTasks} open production tasks unassigned.`,
    );
  }

  if (input.deliverableNeedsChanges) reasons.push("Deliverable has requested changes.");
  if (input.deliverableInReview) reasons.push("Deliverable waiting for review.");
  if (input.openFeedbackCount > 0) reasons.push("Open client feedback.");
  if (input.hasUnreadMessages) reasons.push("Unread client messages.");

  const launch = projectLaunchUrgency(input.project.targetLaunchDate, input.project.status);
  if (launch === "overdue") reasons.push("Target launch date is overdue.");
  else if (launch === "soon") reasons.push("Target launch date is approaching.");

  if (reasons.length === 0) return { status: "healthy", reasons: ["On track."] };

  const blocked = input.intake?.status === "more_information_needed";
  return { status: blocked ? "blocked" : "attention", reasons };
}

export function buildPmProjectHealth(input: {
  projects: AgencyProject[];
  projectIds: Set<string>;
  clientsById: Map<string, { businessName: string }>;
  tasks: TeamWorkTask[];
  intakes: DiscoveryIntake[];
  deliverables: AgencyDeliverable[];
  feedback: ReviewFeedback[];
  conversations: ConversationSummary[];
  limit?: number;
}): PmProjectHealthItem[] {
  const intakesByProject = new Map(input.intakes.map((item) => [item.projectId, item]));
  const rows: PmProjectHealthItem[] = [];

  for (const project of activePmProjects(input.projects)) {
    if (!input.projectIds.has(project.id)) continue;
    const intake = intakesByProject.get(project.id) ?? null;
    const projectTasks = input.tasks.filter((task) => task.projectId === project.id && task.status !== "Completed");
    const overdueTaskCount = projectTasks.filter(isTaskOverdue).length;
    const unassignedOpenTasks = project.tasks.filter((task) => task.status !== "Completed" && !taskIsAssigned(task)).length;
    const projectDeliverables = input.deliverables.filter((item) => item.projectId === project.id);
    const deliverableNeedsChanges = projectDeliverables.some((item) => item.status === "Needs Changes");
    const deliverableInReview = projectDeliverables.some((item) => item.status === "In Review");
    const openFeedbackCount = input.feedback.filter((item) => item.projectId === project.id && item.status === "Open").length;
    const hasUnreadMessages = input.conversations.some(
      (item) =>
        item.unreadCount > 0 &&
        item.status === "open" &&
        (item.projectId === project.id || item.clientId === project.clientId),
    );
    const { status, reasons } = projectHealthReasons({
      project,
      intake,
      overdueTaskCount,
      unassignedOpenTasks,
      deliverableNeedsChanges,
      deliverableInReview,
      openFeedbackCount,
      hasUnreadMessages,
    });

    rows.push({
      projectId: project.id,
      projectName: project.name,
      clientName: input.clientsById.get(project.clientId)?.businessName ?? "Client",
      status,
      reasons,
      href: adminProjectHref(project.id),
    });
  }

  const rank: Record<PmProjectHealthStatus, number> = { blocked: 0, attention: 1, healthy: 2 };
  return rows
    .sort((a, b) => rank[a.status] - rank[b.status] || a.projectName.localeCompare(b.projectName))
    .slice(0, input.limit ?? 8);
}

/**
 * "Needs My Attention" -- a single, prioritized queue merging existing attention signals
 * (blocked tasks, overdue tasks, deliverables needing changes, discovery submissions
 * awaiting review, deliverables awaiting review, unassigned production tasks). Every item
 * type reuses an existing status/review definition (isTaskOverdue, needsAttention,
 * awaitingReview, taskIsAssigned) -- this is a new aggregation view, not a new status system.
 */
export function buildPmAttentionQueue(input: {
  tasks: TeamWorkTask[];
  projects: AgencyProject[];
  projectIds: Set<string>;
  deliverables: AgencyDeliverable[];
  discoveryItems: DiscoveryAttentionItem[];
  limit?: number;
}): PmAttentionItem[] {
  const items: PmAttentionItem[] = [];
  const scopedDeliverables = input.deliverables.filter((item) => input.projectIds.has(item.projectId));
  const projectsById = new Map(input.projects.map((project) => [project.id, project]));

  for (const task of input.tasks.filter((task) => task.status === "Blocked")) {
    items.push({
      id: `blocked-${task.id}`,
      kind: "blocked",
      label: task.title,
      body: `Blocked on ${task.projectName} — ${blockedReason(task) ?? "no reason provided"}.`,
      href: adminProjectTasksHref(task.projectId),
      sort: 0,
    });
  }

  for (const task of input.tasks.filter(isTaskOverdue)) {
    items.push({
      id: `overdue-${task.id}`,
      kind: "overdue",
      label: task.title,
      body: `Overdue on ${task.projectName}.`,
      href: adminProjectTasksHref(task.projectId),
      sort: 1,
    });
  }

  for (const item of needsAttention(scopedDeliverables)) {
    const project = projectsById.get(item.projectId);
    items.push({
      id: `needs-changes-${item.id}`,
      kind: "needs-changes",
      label: item.name,
      body: project ? `Needs changes — ${project.name}.` : "Needs changes.",
      href: adminProjectHref(item.projectId, { tab: "feedback" }),
      sort: 2,
    });
  }

  for (const discovery of input.discoveryItems.filter((item) => item.status === "submitted")) {
    items.push({
      id: `discovery-${discovery.id}`,
      kind: "discovery",
      label: `Review ${discovery.projectName} discovery`,
      body: "Client submitted the discovery questionnaire.",
      href: discovery.href,
      sort: 3,
    });
  }

  for (const item of awaitingReview(scopedDeliverables)) {
    const project = projectsById.get(item.projectId);
    items.push({
      id: `in-review-${item.id}`,
      kind: "in-review",
      label: item.name,
      body: project ? `Awaiting review — ${project.name}.` : "Awaiting review.",
      href: adminProjectHref(item.projectId, { tab: "files" }),
      sort: 4,
    });
  }

  for (const project of input.projects) {
    if (!input.projectIds.has(project.id) || project.archived) continue;
    const stats = productionTaskStats(project);
    const unassigned = project.tasks.filter((task) => task.status !== "Completed" && !taskIsAssigned(task)).length;
    if (unassigned > 0 && stats.total > 0) {
      items.push({
        id: `unassigned-${project.id}`,
        kind: "unassigned",
        label: `Assign production tasks on ${project.name}`,
        body: unassigned === 1 ? "1 open task still needs an assignee." : `${unassigned} open tasks still need assignees.`,
        href: adminProjectHref(project.id, { tab: "tasks" }),
        sort: 5,
      });
    }
  }

  return items.sort((a, b) => a.sort - b.sort || a.label.localeCompare(b.label)).slice(0, input.limit ?? 10);
}

export function pmProjectProgress(project: AgencyProject): number {
  return calculateProjectProgress(project);
}
