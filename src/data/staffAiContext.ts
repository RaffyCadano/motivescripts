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

function usd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/** Keeps a section from running away on someone with a very long backlog; the model gets told
 * how many were left out rather than the list just silently stopping. */
function capped<T>(items: T[], limit: number, render: (item: T) => string): string[] {
  const lines = items.slice(0, limit).map(render);
  const remaining = items.length - limit;
  if (remaining > 0) lines.push(`…and ${remaining} more.`);
  return lines;
}

// ---- Sales --------------------------------------------------------------------------------------------------

export type StaffAiLeadInput = { id: string; clientLabel: string; status: string; createdAt: string; convertedClientId: string | null };
export type StaffAiProposalInput = {
  id: string;
  number: string;
  clientName: string;
  effectiveStatus: string;
  sentAt: string | null;
  validUntil: string | null;
  createdAt: string;
};
export type StaffAiContractInput = {
  id: string;
  number: string;
  clientName: string;
  effectiveStatus: string;
  agencySigned: boolean;
  sentAt: string | null;
  acceptedAt: string | null;
  createdAt: string;
};

/** Signed days from `value` to `now`: positive when `value` is in the past, negative when it's
 * still ahead. Callers that only ever mean "how long ago" clamp it themselves -- this stays
 * unclamped because buildAccountingAiContext's "days until due" needs the future (negative) case
 * intact, not flattened to 0 before it gets negated back to a positive countdown. */
function daysDiff(value: string, now: Date): number {
  const date = new Date(value.includes("T") ? value : `${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return 0;
  const start = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((start(now) - start(date)) / 86_400_000);
}

function daysBetween(value: string, now: Date): number {
  return Math.max(0, daysDiff(value, now));
}

/** Sent, viewed: the client has it and hasn't answered yet. */
function awaitingClient(status: string): boolean {
  return status === "sent" || status === "viewed";
}

/**
 * Leads waiting for a first response, proposals and contracts the client has that we're waiting
 * on (or that need our own signature), oldest/most-at-risk first. Mirrors salesOverview.ts's
 * leadsToFollowUp/proposalsAwaitingResponse/contractsNeedingAction, kept as small local
 * reimplementations rather than imports so this file stays runtime-import-free and unit-testable.
 */
export function buildSalesAiContext(
  input: { leads: StaffAiLeadInput[]; proposals: StaffAiProposalInput[]; contracts: StaffAiContractInput[] },
  now = new Date(),
): string {
  const followUpLeads = input.leads
    .filter((lead) => lead.status === "New" && !lead.convertedClientId)
    .map((lead) => ({ ...lead, ageDays: daysBetween(lead.createdAt, now) }))
    .sort((a, b) => b.ageDays - a.ageDays);

  const openProposals = input.proposals
    .filter((proposal) => awaitingClient(proposal.effectiveStatus))
    .map((proposal) => ({ ...proposal, ageDays: daysBetween(proposal.sentAt ?? proposal.createdAt, now) }))
    .sort((a, b) => b.ageDays - a.ageDays);

  const needsSignature = input.contracts.filter(
    (contract) => contract.effectiveStatus === "accepted" && !contract.agencySigned,
  );
  const awaitingContracts = input.contracts
    .filter((contract) => awaitingClient(contract.effectiveStatus))
    .map((contract) => ({ ...contract, ageDays: daysBetween(contract.sentAt ?? contract.createdAt, now) }))
    .sort((a, b) => b.ageDays - a.ageDays);

  const lines: string[] = [];
  if (followUpLeads.length > 0) {
    lines.push(
      `${followUpLeads.length} lead(s) waiting for a first response:`,
      ...capped(followUpLeads, 8, (lead) => `- ${lead.clientLabel}, waiting ${lead.ageDays} day${lead.ageDays === 1 ? "" : "s"}`),
    );
  } else {
    lines.push("No new leads waiting for a first response.");
  }
  if (openProposals.length > 0) {
    lines.push(
      `${openProposals.length} proposal(s) sent, awaiting the client:`,
      ...capped(openProposals, 8, (p) => `- ${p.number} (${p.clientName}), sent ${p.ageDays} day${p.ageDays === 1 ? "" : "s"} ago`),
    );
  }
  if (needsSignature.length > 0) {
    lines.push(
      `${needsSignature.length} contract(s) the client accepted, waiting on our signature:`,
      ...capped(needsSignature, 8, (c) => `- ${c.number} (${c.clientName})`),
    );
  }
  if (awaitingContracts.length > 0) {
    lines.push(
      `${awaitingContracts.length} contract(s) sent, awaiting the client:`,
      ...capped(awaitingContracts, 8, (c) => `- ${c.number} (${c.clientName}), sent ${c.ageDays} day${c.ageDays === 1 ? "" : "s"} ago`),
    );
  }
  if (openProposals.length === 0 && needsSignature.length === 0 && awaitingContracts.length === 0) {
    lines.push("No proposals or contracts currently awaiting anyone.");
  }
  return lines.join("\n");
}

// ---- Accounting -----------------------------------------------------------------------------------------------

export type StaffAiInvoiceInput = {
  id: string;
  number: string;
  clientName: string;
  effectiveStatus: string;
  amountDueCents: number;
  dueDate: string;
  createdAt: string;
};

/** Sent, viewed, part-paid, or overdue: money the client still owes and has been asked for. */
function awaitingPayment(status: string): boolean {
  return status === "sent" || status === "viewed" || status === "partially_paid" || status === "overdue";
}

/**
 * Overdue invoices, invoices due within the next 7 days, and drafts never sent -- mirrors
 * accountingOverview.ts's overdueInvoices/invoicesDueSoon/draftInvoices, kept as small local
 * reimplementations for the same reason as buildSalesAiContext.
 */
export function buildAccountingAiContext(invoices: StaffAiInvoiceInput[], now = new Date()): string {
  const overdue = invoices
    .filter((invoice) => invoice.effectiveStatus === "overdue")
    .map((invoice) => ({ ...invoice, daysOverdue: Math.max(1, daysBetween(invoice.dueDate, now)) }))
    .sort((a, b) => b.daysOverdue - a.daysOverdue);

  const dueSoon = invoices
    .filter((invoice) => invoice.effectiveStatus !== "overdue" && awaitingPayment(invoice.effectiveStatus) && invoice.dueDate)
    .map((invoice) => ({ ...invoice, daysUntilDue: -daysDiff(invoice.dueDate, now) }))
    .filter((invoice) => invoice.daysUntilDue >= 0 && invoice.daysUntilDue < 7)
    .sort((a, b) => a.daysUntilDue - b.daysUntilDue);

  const drafts = invoices
    .filter((invoice) => invoice.effectiveStatus === "draft")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const lines: string[] = [];
  if (overdue.length > 0) {
    const totalOverdueCents = overdue.reduce((sum, invoice) => sum + invoice.amountDueCents, 0);
    lines.push(
      `${overdue.length} overdue invoice(s), ${usd(totalOverdueCents)} total:`,
      ...capped(overdue, 8, (inv) => `- ${inv.number} (${inv.clientName}), ${usd(inv.amountDueCents)}, ${inv.daysOverdue} day(s) overdue`),
    );
  } else {
    lines.push("No overdue invoices.");
  }
  if (dueSoon.length > 0) {
    lines.push(
      `${dueSoon.length} invoice(s) due within 7 days:`,
      ...capped(dueSoon, 8, (inv) => `- ${inv.number} (${inv.clientName}), ${usd(inv.amountDueCents)}, due in ${inv.daysUntilDue} day(s)`),
    );
  }
  if (drafts.length > 0) {
    lines.push(`${drafts.length} draft invoice(s) never sent:`, ...capped(drafts, 8, (inv) => `- ${inv.number} (${inv.clientName})`));
  }
  return lines.join("\n");
}

export const STAFF_AI_TEMPLATES = [
  "developer",
  "designer",
  "content_writer",
  "team_member",
  "project_manager",
  "sales",
  "accounting",
  "admin",
] as const;
export type StaffAiTemplate = (typeof STAFF_AI_TEMPLATES)[number];

export function isStaffAiTemplate(value: string | null | undefined): value is StaffAiTemplate {
  return (STAFF_AI_TEMPLATES as readonly string[]).includes(value ?? "");
}
