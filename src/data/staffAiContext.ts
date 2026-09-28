/**
 * The "here's what's actually going on" summary handed to the staff AI assistant alongside its
 * per-role knowledge prompt, so its answer to "what needs to be done" is grounded in the
 * person's real, current data instead of a guess.
 *
 * Deliberately self-contained (no runtime imports at all) so it can be unit tested in plain Node
 * (scripts/test-staff-ai-context.mjs) -- same convention as designerOverview.ts. StaffAiTaskInput
 * is a minimal shape rather than the full TeamWorkTask/AgencyTask type, so the same function
 * serves both "my own assigned tasks" (a developer, via useTeamWork()) and "every task across my
 * projects" (a PM, who rarely has tasks assigned to themself and needs their team's work instead).
 */

export type StaffAiTaskInput = {
  id: string;
  title: string;
  projectName: string;
  status: string;
  dueDate: string;
  blockedReason: string | null;
  description: string;
};

type DueBucket = "none" | "overdue" | "today" | "week" | "later";

/** Same day-diff arithmetic as teamWorkspace.ts's dueBucket(), with "week" standing in for its
 * isDueSoon()'s <=7-days-out cap so "due this week" doesn't quietly include something due next
 * month. */
function dueBucket(dueDate: string, now: Date): DueBucket {
  if (!dueDate) return "none";
  const due = new Date(`${dueDate}T00:00:00`);
  if (Number.isNaN(due.getTime())) return "none";
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const diff = Math.round((dueDay.getTime() - start.getTime()) / 86_400_000);
  if (diff < 0) return "overdue";
  if (diff === 0) return "today";
  if (diff <= 7) return "week";
  return "later";
}

/** A structured reason reads fine for the model as "waiting on client" -- no need for the
 * display-cased labels the UI uses (taskBlockedReasonLabel in agencyProjects.ts). */
function blockedReasonText(task: StaffAiTaskInput): string | null {
  if (task.blockedReason) return task.blockedReason.replace(/_/g, " ");
  const trimmed = task.description.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function taskLine(task: StaffAiTaskInput, extra?: string | null): string {
  return `- ${task.title} (${task.projectName})${extra ? ` — ${extra}` : ""}`;
}

/**
 * A compact, plain-text status report: blocked, overdue, due this week (excluding today, so it
 * doesn't just repeat "overdue"), and waiting in review, plus a running total of open work.
 * Role-agnostic -- what counts as "needs doing" is the same shape of question whether you're a
 * developer or a PM checking their queue; the role-specific knowledge prompt (and which tasks the
 * caller passes in -- one person's own vs. a whole project's) is what actually makes the
 * assistant's answer differ, not this function.
 */
export function buildStaffTaskContext(tasks: StaffAiTaskInput[], projectNames: string[], now = new Date()): string {
  const open = tasks.filter((task) => task.status !== "Completed");
  const blocked = open.filter((task) => task.status === "Blocked");
  const overdue = open.filter((task) => dueBucket(task.dueDate, now) === "overdue");
  const dueSoon = open.filter((task) => dueBucket(task.dueDate, now) === "week");
  const review = open.filter((task) => task.status === "In Review");

  const lines: string[] = [
    `Projects: ${projectNames.length > 0 ? projectNames.join(", ") : "none currently assigned"}.`,
    `${open.length} open task${open.length === 1 ? "" : "s"} total.`,
  ];

  if (blocked.length > 0) {
    lines.push("Blocked:", ...blocked.map((task) => taskLine(task, blockedReasonText(task))));
  }
  if (overdue.length > 0) {
    lines.push("Overdue:", ...overdue.map((task) => taskLine(task, `was due ${task.dueDate}`)));
  }
  if (dueSoon.length > 0) {
    lines.push("Due this week:", ...dueSoon.map((task) => taskLine(task, `due ${task.dueDate}`)));
  }
  if (review.length > 0) {
    lines.push("Waiting in review:", ...review.map((task) => taskLine(task)));
  }
  if (blocked.length === 0 && overdue.length === 0 && dueSoon.length === 0 && review.length === 0) {
    lines.push("Nothing blocked, overdue, due this week, or waiting in review right now.");
  }

  return lines.join("\n");
}

export const STAFF_AI_PILOT_TEMPLATES = ["developer", "project_manager"] as const;
export type StaffAiPilotTemplate = (typeof STAFF_AI_PILOT_TEMPLATES)[number];

export function isStaffAiPilotTemplate(value: string | null | undefined): value is StaffAiPilotTemplate {
  return (STAFF_AI_PILOT_TEMPLATES as readonly string[]).includes(value ?? "");
}
