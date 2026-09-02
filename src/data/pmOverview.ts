import {
  calculateProjectProgress,
  currentMilestone,
  formatProjectDay,
  productionTaskStats,
  projectLaunchUrgency,
  projectListAttention,
  taskIsAssigned,
  type AgencyProject,
} from "@/data/agencyProjects";
import type { DiscoveryAttentionItem, DiscoveryIntake } from "@/data/discoveryIntake";
import { buildDiscoveryAttentionItems, buildDiscoveryStatusBoard } from "@/data/discoveryIntake";
import type { ConversationSummary } from "@/data/messaging";
import type { AgencyDeliverable } from "@/data/files";
import { needsAttention, type ReviewFeedback } from "@/data/review";
import { adminProjectHref, isTaskOverdue, type TeamWorkTask } from "@/data/teamWorkspace";

export type PmFollowUpItem = {
  id: string;
  projectId: string | null;
  clientId: string;
  name: string;
  body: string;
  stage: string;
  actionLabel: string;
  href: string;
  sort: number;
};

export type PmProjectHealthStatus = "healthy" | "attention" | "blocked";

export type PmProjectHealthItem = {
  projectId: string;
  projectName: string;
  clientName: string;
  status: PmProjectHealthStatus;
  reasons: string[];
  href: string;
};

export type PmNextActionItem = {
  id: string;
  label: string;
  body: string;
  href: string;
  sort: number;
};

export type PmDiscoveryStats = {
  awaitingReview: number;
  followUpRequired: number;
  underReview: number;
  awaitingClient: number;
};

export function activePmProjects(projects: AgencyProject[]): AgencyProject[] {
  return projects.filter((project) => !project.archived && project.status !== "Completed");
}

export function buildPmDiscoveryStats(intakes: DiscoveryIntake[], projectIds: Set<string>): PmDiscoveryStats {
  const scoped = intakes.filter((item) => projectIds.has(item.projectId));
  return {
    awaitingReview: scoped.filter((item) => item.status === "submitted").length,
    followUpRequired: scoped.filter((item) => item.status === "more_information_needed").length,
    underReview: scoped.filter((item) => item.status === "under_review").length,
    awaitingClient: scoped.filter((item) => item.status === "awaiting_client").length,
  };
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

export function buildPmClientFollowUps(input: {
  projects: AgencyProject[];
  projectIds: Set<string>;
  clientsById: Map<string, { businessName: string }>;
  deliverables: AgencyDeliverable[];
  feedback: ReviewFeedback[];
  conversations: ConversationSummary[];
  discoveryItems: DiscoveryAttentionItem[];
  limit?: number;
}): PmFollowUpItem[] {
  const items: PmFollowUpItem[] = [];
  const scopedProjects = input.projects.filter((project) => input.projectIds.has(project.id) && !project.archived);

  for (const discovery of input.discoveryItems) {
    if (discovery.status !== "awaiting_client" && discovery.status !== "more_information_needed") continue;
    items.push({
      id: `discovery-${discovery.id}`,
      projectId: discovery.projectId,
      clientId: scopedProjects.find((row) => row.id === discovery.projectId)?.clientId ?? "",
      name: discovery.projectName,
      body:
        discovery.status === "more_information_needed"
          ? "Discovery follow-up — client information requested."
          : "Discovery questionnaire sent — waiting on client.",
      stage: "Discovery",
      actionLabel: "Open Discovery",
      href: discovery.href,
      sort: discovery.status === "more_information_needed" ? 12 : 18,
    });
  }

  for (const project of scopedProjects) {
    if (project.status !== "Client Review") continue;
    items.push({
      id: `client-review-${project.id}`,
      projectId: project.id,
      clientId: project.clientId,
      name: project.name,
      body: "Client review waiting — follow up if needed.",
      stage: "Client Review",
      actionLabel: "Open Project",
      href: adminProjectHref(project.id),
      sort: 14,
    });
  }

  for (const conversation of input.conversations) {
    if (conversation.unreadCount <= 0 || conversation.status !== "open") continue;
    const projectMatch = conversation.projectId && input.projectIds.has(conversation.projectId);
    const clientMatch = scopedProjects.some((project) => project.clientId === conversation.clientId);
    if (!projectMatch && !clientMatch) continue;
    items.push({
      id: `message-${conversation.id}`,
      projectId: conversation.projectId,
      clientId: conversation.clientId,
      name: conversation.clientName || conversation.subject,
      body:
        conversation.unreadCount === 1
          ? "1 unread client message."
          : `${conversation.unreadCount} unread client messages.`,
      stage: "Messages",
      actionLabel: "Open Inbox",
      href: `/admin/messages?conversation=${conversation.id}`,
      sort: 10,
    });
  }

  for (const file of input.deliverables) {
    if (!input.projectIds.has(file.projectId)) continue;
    const project = scopedProjects.find((row) => row.id === file.projectId);
    if (!project) continue;
    if (file.status === "In Review") {
      items.push({
        id: `review-${file.id}`,
        projectId: file.projectId,
        clientId: project.clientId,
        name: project.name,
        body: `${file.name} is waiting for review.`,
        stage: "Review",
        actionLabel: "Open Files",
        href: adminProjectHref(file.projectId, { tab: "files" }),
        sort: 16,
      });
    }
  }

  for (const file of needsAttention(input.deliverables)) {
    if (!input.projectIds.has(file.projectId)) continue;
    const project = scopedProjects.find((row) => row.id === file.projectId);
    if (!project) continue;
    items.push({
      id: `changes-${file.id}`,
      projectId: file.projectId,
      clientId: project.clientId,
      name: project.name,
      body: `${file.name} has requested changes.`,
      stage: "Review",
      actionLabel: "Open Feedback",
      href: adminProjectHref(file.projectId, { tab: "feedback" }),
      sort: 13,
    });
  }

  const seenDeliverables = new Set(items.filter((item) => item.id.startsWith("changes-")).map((item) => item.id.replace("changes-", "")));
  for (const row of input.feedback.filter((item) => item.status === "Open")) {
    if (seenDeliverables.has(row.deliverableId)) continue;
    if (!input.projectIds.has(row.projectId)) continue;
    const project = scopedProjects.find((item) => item.id === row.projectId);
    if (!project) continue;
    items.push({
      id: `feedback-${row.id}`,
      projectId: row.projectId,
      clientId: project.clientId,
      name: project.name,
      body: "Open client feedback is waiting.",
      stage: "Review",
      actionLabel: "Open Feedback",
      href: adminProjectHref(row.projectId, { tab: "feedback" }),
      sort: 15,
    });
  }

  return items
    .sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name))
    .slice(0, input.limit ?? 8);
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

export function buildPmNextActions(input: {
  projects: AgencyProject[];
  projectIds: Set<string>;
  tasks: TeamWorkTask[];
  discoveryItems: DiscoveryAttentionItem[];
  followUps: PmFollowUpItem[];
  health: PmProjectHealthItem[];
  limit?: number;
}): PmNextActionItem[] {
  const items: PmNextActionItem[] = [];
  const projectsById = new Map(input.projects.map((project) => [project.id, project]));

  for (const discovery of input.discoveryItems.filter((item) => item.status === "submitted")) {
    items.push({
      id: `next-discovery-${discovery.id}`,
      label: `Review ${discovery.projectName} discovery`,
      body: "Client submitted the discovery questionnaire.",
      href: discovery.href,
      sort: 0,
    });
  }

  for (const task of input.tasks.filter(isTaskOverdue).slice(0, 4)) {
    items.push({
      id: `next-task-${task.id}`,
      label: task.title,
      body: `Overdue on ${task.projectName}.`,
      href: adminProjectHref(task.projectId, { tab: "tasks" }),
      sort: 1,
    });
  }

  for (const task of input.tasks.filter((row) => row.status !== "Completed" && !isTaskOverdue(row)).slice(0, 2)) {
    items.push({
      id: `next-soon-${task.id}`,
      label: task.title,
      body: `Due ${task.dueDate ? formatProjectDay(task.dueDate) : "soon"} · ${task.projectName}.`,
      href: adminProjectHref(task.projectId, { tab: "tasks" }),
      sort: 3,
    });
  }

  for (const project of input.projects) {
    if (!input.projectIds.has(project.id) || project.archived) continue;
    const stats = productionTaskStats(project);
    const unassigned = project.tasks.filter((task) => task.status !== "Completed" && !taskIsAssigned(task)).length;
    if (unassigned > 0 && stats.total > 0) {
      items.push({
        id: `next-assign-${project.id}`,
        label: `Assign production tasks on ${project.name}`,
        body:
          unassigned === 1
            ? "1 open task still needs an assignee."
            : `${unassigned} open tasks still need assignees.`,
        href: adminProjectHref(project.id, { tab: "tasks" }),
        sort: 2,
      });
    }
  }

  for (const followUp of input.followUps.slice(0, 3)) {
    items.push({
      id: `next-follow-${followUp.id}`,
      label: `Follow up with ${followUp.name}`,
      body: followUp.body,
      href: followUp.href,
      sort: 4,
    });
  }

  for (const row of input.health.filter((item) => item.status !== "healthy")) {
    const project = projectsById.get(row.projectId);
    if (!project) continue;
    if (projectLaunchUrgency(project.targetLaunchDate, project.status) === "overdue") {
      items.push({
        id: `next-deadline-${row.projectId}`,
        label: `Review ${row.projectName} deadline`,
        body: row.reasons.find((reason) => reason.includes("launch")) ?? "Target launch date needs attention.",
        href: row.href,
        sort: 5,
      });
    }
  }

  const seen = new Set<string>();
  return items
    .filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    })
    .sort((a, b) => a.sort - b.sort || a.label.localeCompare(b.label))
    .slice(0, input.limit ?? 6);
}

export function pmProjectProgress(project: AgencyProject): number {
  return calculateProjectProgress(project);
}
