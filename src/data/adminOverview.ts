import type { AgencyClient } from "@/data/agencyClients";
import type { AgencyProject, AgencyProjectActivity } from "@/data/agencyProjects";
import type { ContractSummary, ProposalSummary } from "@/data/documentsRepository";
import { awaitingResponse } from "@/data/documents";
import type { AgencyDeliverable } from "@/data/files";
import { awaitingInvoicePayment } from "@/data/invoices";
import type { InvoiceSummary } from "@/data/invoicesRepository";
import type { Lead } from "@/data/leads";
import { isProductionProject, salesFlags } from "@/data/preProject";
import { needsAttention, type ReviewFeedback } from "@/data/review";
import { scopeStatus, type ClientScopeBrief } from "@/data/scopeBriefs";

export type OverviewAttentionItem = {
  id: string;
  name: string;
  body: string;
  stage: string;
  actionLabel: string;
  href: string;
  sort: number;
  clientId: string | null;
};

export type OverviewPipelineCounts = {
  lead: number;
  client: number;
  scope: number;
  project: number;
  proposal: number;
  contract: number;
  invoice: number;
  paid: number;
};

export type OverviewInvoiceTotals = {
  outstanding: number;
  dueSoon: number;
  overdue: number;
  paid: number;
};

export type OverviewActivityItem = {
  id: string;
  description: string;
  createdAt: string;
  related: string;
  href: string | null;
  kind: "lead" | "client" | "file" | "invoice" | "approval" | "status";
};

const pipelineStatuses = new Set(["draft", "sent", "viewed", "accepted", "expired"]);

/**
 * Cumulative running total for the last `points` days, built from real
 * per-item timestamps (never fabricated). Callers pass exactly the cohort
 * that matches a stat's live count (e.g. currently-active clients), so the
 * trend always ends at that same number -- it's a growth curve of *when*
 * today's total accumulated, not an invented history.
 */
export function buildCumulativeTrend(items: { at: string; weight?: number }[], points = 12): number[] {
  const dayMs = 24 * 60 * 60 * 1000;
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const perDay = new Array(points).fill(0) as number[];
  let before = 0;

  for (const item of items) {
    const date = new Date(item.at);
    if (Number.isNaN(date.getTime())) continue;
    const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    const daysAgo = Math.round((todayStart - dayStart) / dayMs);
    const bucket = points - 1 - daysAgo;
    const weight = item.weight ?? 1;
    if (bucket < 0) before += weight;
    else if (bucket < points) perDay[bucket] += weight;
  }

  const cumulative: number[] = [];
  let running = before;
  for (let i = 0; i < points; i++) {
    running += perDay[i];
    cumulative.push(running);
  }
  return cumulative;
}

export function dateInNextDays(dateStr: string, days: number): boolean {
  if (!dateStr) return false;
  const due = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(due.getTime())) return false;
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + days);
  return due >= start && due < end;
}

export const invoicePeriods = ["all", "thisMonth", "lastMonth", "lastYear"] as const;
export type InvoicePeriod = (typeof invoicePeriods)[number];

export function invoicePeriodLabel(period: InvoicePeriod): string {
  switch (period) {
    case "all":
      return "All";
    case "thisMonth":
      return "This Month";
    case "lastMonth":
      return "Last Month";
    case "lastYear":
      return "Last Year";
  }
}

/** Scopes invoices to a calendar period by issue date. "Last Year" means the previous calendar year (Jan-Dec), not a trailing 12 months. */
export function filterInvoicesByPeriod(rows: InvoiceSummary[], period: InvoicePeriod, now = new Date()): InvoiceSummary[] {
  if (period === "all") return rows;
  const year = now.getFullYear();
  const month = now.getMonth();
  let start: Date;
  let end: Date;
  if (period === "thisMonth") {
    start = new Date(year, month, 1);
    end = new Date(year, month + 1, 1);
  } else if (period === "lastMonth") {
    start = new Date(year, month - 1, 1);
    end = new Date(year, month, 1);
  } else {
    start = new Date(year - 1, 0, 1);
    end = new Date(year, 0, 1);
  }
  return rows.filter((row) => {
    const issued = new Date(`${row.issueDate.slice(0, 10)}T00:00:00`);
    return issued >= start && issued < end;
  });
}

export function buildOverviewInvoiceTotals(rows: InvoiceSummary[]): OverviewInvoiceTotals {
  const open = rows.filter((row) => row.effectiveStatus !== "cancelled" && row.effectiveStatus !== "draft");
  return {
    outstanding: open.reduce((sum, row) => sum + row.amountDueCents, 0),
    dueSoon: open
      .filter((row) => awaitingInvoicePayment(row.effectiveStatus) && row.effectiveStatus !== "overdue" && dateInNextDays(row.dueDate, 7))
      .reduce((sum, row) => sum + row.amountDueCents, 0),
    overdue: open.filter((row) => row.effectiveStatus === "overdue").reduce((sum, row) => sum + row.amountDueCents, 0),
    paid: rows.filter((row) => row.effectiveStatus === "paid").reduce((sum, row) => sum + row.amountPaidCents, 0),
  };
}

export function buildOverviewPipeline(input: {
  leads: Lead[];
  clients: AgencyClient[];
  projects: AgencyProject[];
  briefs: ClientScopeBrief[];
  proposals: ProposalSummary[];
  contracts: ContractSummary[];
  invoices: InvoiceSummary[];
}): OverviewPipelineCounts {
  return {
    lead: input.leads.filter((item) => !item.convertedClientId && item.status !== "Lost").length,
    client: input.clients.filter((item) => item.status === "Active").length,
    scope: input.briefs.filter((item) => scopeStatus(item) === "submitted").length,
    project: input.projects.filter((item) => !item.archived).length,
    proposal: input.proposals.filter((item) => pipelineStatuses.has(item.effectiveStatus)).length,
    contract: input.contracts.filter((item) => pipelineStatuses.has(item.effectiveStatus)).length,
    invoice: input.invoices.filter((item) => item.effectiveStatus !== "cancelled" && item.effectiveStatus !== "draft").length,
    paid: input.invoices.filter((item) => item.effectiveStatus === "paid").length,
  };
}

function clientName(clients: AgencyClient[], clientId: string, fallback = "Client"): string {
  return clients.find((item) => item.id === clientId)?.businessName ?? fallback;
}

export function buildOverviewAttention(
  input: {
    leads: Lead[];
    clients: AgencyClient[];
    projects: AgencyProject[];
    briefs: ClientScopeBrief[];
    proposals: ProposalSummary[];
    contracts: ContractSummary[];
    invoices: InvoiceSummary[];
    deliverables: AgencyDeliverable[];
    feedback: ReviewFeedback[];
  },
  limit = 8,
): OverviewAttentionItem[] {
  const items: OverviewAttentionItem[] = [];
  const projects = input.projects.filter((item) => !item.archived);
  const briefsByClient = new Map(input.briefs.map((item) => [item.clientId, item]));

  for (const lead of input.leads) {
    if (lead.convertedClientId || lead.status !== "New") continue;
    items.push({
      id: `lead-${lead.id}`,
      name: lead.businessName,
      body: "New inquiry waiting for contact.",
      stage: "Lead",
      actionLabel: "Contact",
      href: `/admin/leads/${lead.id}`,
      sort: 70,
      clientId: null,
    });
  }

  for (const client of input.clients) {
    if (client.status === "Archived") continue;
    const project = projects.find((item) => item.clientId === client.id) ?? null;
    const proposals = input.proposals.filter((item) => item.clientId === client.id);
    const contracts = input.contracts.filter((item) => item.clientId === client.id);
    const invoices = input.invoices.filter((item) => item.clientId === client.id);
    const flags = salesFlags({
      brief: briefsByClient.get(client.id) ?? null,
      project,
      proposals,
      contracts,
      invoices,
    });
    const name = client.businessName;
    const projectQuery = project ? `&project=${project.id}` : "";

    if (flags.hasScope && !flags.hasProject) {
      items.push({
        id: `scope-${client.id}`,
        name,
        body: "Scope submitted — create the project.",
        stage: "Scope",
        actionLabel: "Create Project",
        href: `/admin/projects/new?client=${client.id}`,
        sort: 50,
        clientId: client.id,
      });
    } else if (flags.hasProject && proposals.length === 0) {
      items.push({
        id: `need-proposal-${client.id}`,
        name,
        body: "Project created — proposal is the next step.",
        stage: "Project",
        actionLabel: "Create Proposal",
        href: `/admin/proposals/new?client=${client.id}${projectQuery}`,
        sort: 45,
        clientId: client.id,
      });
    }

    for (const proposal of proposals) {
      if (proposal.effectiveStatus === "draft") {
        items.push({
          id: `proposal-draft-${proposal.id}`,
          name,
          body: `${proposal.number} is a draft waiting to be completed.`,
          stage: "Proposal",
          actionLabel: "Open Proposal",
          href: `/admin/proposals/${proposal.id}`,
          sort: 40,
          clientId: client.id,
        });
      } else if (awaitingResponse(proposal.effectiveStatus)) {
        items.push({
          id: `proposal-wait-${proposal.id}`,
          name,
          body: `${proposal.number} is waiting for the client.`,
          stage: "Proposal",
          actionLabel: "View Proposal",
          href: `/admin/proposals/${proposal.id}`,
          sort: 42,
          clientId: client.id,
        });
      }
    }

    if (flags.proposalAccepted && contracts.length === 0) {
      items.push({
        id: `need-contract-${client.id}`,
        name,
        body: "Proposal accepted — contract is the next step.",
        stage: "Contract",
        actionLabel: "Create Contract",
        href: `/admin/contracts/new?client=${client.id}${projectQuery}${flags.proposalId ? `&proposal=${flags.proposalId}` : ""}`,
        sort: 35,
        clientId: client.id,
      });
    }

    for (const contract of contracts) {
      if (contract.effectiveStatus === "draft") {
        items.push({
          id: `contract-draft-${contract.id}`,
          name,
          body: `${contract.number} is waiting to be sent.`,
          stage: "Contract",
          actionLabel: "Open Contract",
          href: `/admin/contracts/${contract.id}`,
          sort: 32,
          clientId: client.id,
        });
      } else if (awaitingResponse(contract.effectiveStatus)) {
        items.push({
          id: `contract-wait-${contract.id}`,
          name,
          body: `${contract.number} is waiting for acceptance.`,
          stage: "Contract",
          actionLabel: "View Contract",
          href: `/admin/contracts/${contract.id}`,
          sort: 33,
          clientId: client.id,
        });
      }
    }

    if (flags.contractAccepted && invoices.length === 0 && !isProductionProject(flags.projectStatus)) {
      items.push({
        id: `need-invoice-${client.id}`,
        name,
        body: "Contract accepted — invoice is the next step.",
        stage: "Invoice",
        actionLabel: "Create Invoice",
        href: `/admin/invoices/new?client=${client.id}${projectQuery}${flags.contractId ? `&contract=${flags.contractId}` : ""}`,
        sort: 28,
        clientId: client.id,
      });
    }
  }

  for (const invoice of input.invoices) {
    const name = clientName(input.clients, invoice.clientId, invoice.number);
    if (invoice.effectiveStatus === "overdue") {
      items.push({
        id: `invoice-overdue-${invoice.id}`,
        name,
        body: "Invoice is overdue.",
        stage: "Invoice",
        actionLabel: "View Invoice",
        href: `/admin/invoices/${invoice.id}`,
        sort: 10,
        clientId: invoice.clientId,
      });
    } else if (awaitingInvoicePayment(invoice.effectiveStatus)) {
      items.push({
        id: `invoice-unpaid-${invoice.id}`,
        name,
        body: `${invoice.number} is sent and unpaid.`,
        stage: "Invoice",
        actionLabel: "View Invoice",
        href: `/admin/invoices/${invoice.id}`,
        sort: 15,
        clientId: invoice.clientId,
      });
    }
  }

  // Grouped by project (not one row per deliverable) so a project with several
  // files in review at once shows a single row instead of identical-looking
  // duplicates -- the count still says how many are waiting.
  const inReviewByProject = new Map<string, number>();
  for (const file of input.deliverables) {
    if (file.status !== "In Review") continue;
    inReviewByProject.set(file.projectId, (inReviewByProject.get(file.projectId) ?? 0) + 1);
  }
  for (const [projectId, count] of inReviewByProject) {
    const project = projects.find((item) => item.id === projectId);
    const name = project ? clientName(input.clients, project.clientId, project.name) : "Project";
    items.push({
      id: `review-${projectId}`,
      name,
      body: count === 1 ? "Website is waiting for your review." : `${count} deliverables are waiting for your review.`,
      stage: "Review",
      actionLabel: "Open Project",
      href: `/admin/projects/${projectId}?tab=files`,
      sort: 20,
      clientId: project?.clientId ?? null,
    });
  }

  for (const file of needsAttention(input.deliverables)) {
    const project = projects.find((item) => item.id === file.projectId);
    const name = project ? clientName(input.clients, project.clientId, project.name) : "Project";
    items.push({
      id: `changes-${file.id}`,
      name,
      body: `${file.name} has requested changes waiting for the agency.`,
      stage: "Review",
      actionLabel: "Open Feedback",
      href: `/admin/projects/${file.projectId}?tab=feedback`,
      sort: 18,
      clientId: project?.clientId ?? null,
    });
  }

  const openFeedback = input.feedback.filter((item) => item.status === "Open");
  const seenDeliverable = new Set(items.filter((item) => item.id.startsWith("changes-")).map((item) => item.id.replace("changes-", "")));
  for (const item of openFeedback) {
    if (seenDeliverable.has(item.deliverableId)) continue;
    seenDeliverable.add(item.deliverableId);
    const file = input.deliverables.find((row) => row.id === item.deliverableId);
    const project = projects.find((row) => row.id === item.projectId);
    const name = project ? clientName(input.clients, project.clientId, project.name) : "Project";
    items.push({
      id: `feedback-${item.id}`,
      name,
      body: file ? `Open feedback on ${file.name}.` : "Open client feedback is waiting.",
      stage: "Review",
      actionLabel: "Open Feedback",
      href: `/admin/projects/${item.projectId}?tab=feedback`,
      sort: 19,
      clientId: project?.clientId ?? null,
    });
  }

  return items.sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name)).slice(0, limit);
}

/**
 * Pure "next step" reminders -- no client-specific document number, so several
 * of them read as identical rows once there are a few clients at that stage.
 * Deliberately excludes anything referencing a specific proposal/contract/
 * invoice/feedback (those stay itemized -- each is a distinct thing to open).
 */
const GROUPABLE_REMINDERS: Partial<Record<string, string>> = {
  "Create Project": "have a submitted scope ready to become a project.",
  "Create Proposal": "have a project ready for a proposal.",
  "Create Contract": "have an accepted proposal ready for a contract.",
  "Create Invoice": "have an accepted contract ready for an invoice.",
};

/**
 * Display-only compacting for a long attention list: once 3+ items share the
 * same groupable reminder action, collapse them into a single "N clients ..."
 * summary row that links back to this same page's Attention filter, instead
 * of one near-identical row per client. Does not change what counts as
 * needing attention -- callers should keep using the un-grouped list (e.g.
 * for an Attention filter's client-id set) and only pass the compacted
 * result to what's actually rendered.
 */
export function compactAttentionItems(items: OverviewAttentionItem[], threshold = 3): OverviewAttentionItem[] {
  const groups = new Map<string, OverviewAttentionItem[]>();
  const rest: OverviewAttentionItem[] = [];

  for (const item of items) {
    if (!GROUPABLE_REMINDERS[item.actionLabel]) {
      rest.push(item);
      continue;
    }
    const list = groups.get(item.actionLabel) ?? [];
    list.push(item);
    groups.set(item.actionLabel, list);
  }

  const result = [...rest];
  for (const [actionLabel, group] of groups) {
    if (group.length < threshold) {
      result.push(...group);
      continue;
    }
    result.push({
      id: `summary-${actionLabel}`,
      name: `${group.length} clients`,
      body: GROUPABLE_REMINDERS[actionLabel]!,
      stage: group[0].stage,
      actionLabel: "View all",
      href: "/admin/clients?attention=1",
      sort: Math.min(...group.map((entry) => entry.sort)),
      clientId: null,
    });
  }

  return result.sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name));
}

export function buildClientListAttention(
  input: Omit<Parameters<typeof buildOverviewAttention>[0], "leads">,
): OverviewAttentionItem[] {
  return buildOverviewAttention({ ...input, leads: [] }, 24).filter((item) => Boolean(item.clientId));
}

function activityKind(description: string, icon?: string): OverviewActivityItem["kind"] {
  const text = description.toLowerCase();
  if (text.includes("invoice") || text.includes("payment") || icon === "invoice") return "invoice";
  if (text.includes("approv") || text.includes("feedback") || text.includes("review")) return "approval";
  if (text.includes("file") || text.includes("version") || text.includes("deliverable") || icon === "file") return "file";
  if (text.includes("lead") || icon === "lead") return "lead";
  if (text.includes("client") || text.includes("converted") || icon === "converted" || icon === "created") return "client";
  return "status";
}

export function buildOverviewActivity(input: {
  leads: Lead[];
  clients: AgencyClient[];
  projects: AgencyProject[];
}): OverviewActivityItem[] {
  const rows: OverviewActivityItem[] = [];

  for (const lead of input.leads) {
    for (const item of lead.activity) {
      rows.push({
        id: `lead-${item.id}`,
        description: item.description,
        createdAt: item.createdAt,
        related: lead.businessName,
        href: `/admin/leads/${lead.id}`,
        kind: activityKind(item.description, "lead"),
      });
    }
  }

  for (const client of input.clients) {
    for (const item of client.activity) {
      rows.push({
        id: `client-${item.id}`,
        description: item.description,
        createdAt: item.createdAt,
        related: client.businessName,
        href: `/admin/clients/${client.id}`,
        kind: activityKind(item.description, item.icon),
      });
    }
  }

  for (const project of input.projects) {
    const client = input.clients.find((item) => item.id === project.clientId);
    for (const item of project.activity as AgencyProjectActivity[]) {
      rows.push({
        id: `project-${item.id}`,
        description: item.description,
        createdAt: item.createdAt,
        related: client?.businessName ?? project.name,
        href: `/admin/projects/${project.id}`,
        kind: activityKind(item.description, item.icon),
      });
    }
  }

  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8);
}

export function overviewHrefAllowed(
  href: string,
  can: (code: "leads.view" | "clients.view" | "projects.view" | "proposals.view" | "contracts.view" | "invoices.view" | "files.view" | "messages.view") => boolean,
): boolean {
  if (href.startsWith("/admin/leads")) return can("leads.view");
  if (href.startsWith("/admin/clients")) return can("clients.view");
  if (href.startsWith("/admin/projects")) return can("projects.view");
  if (href.startsWith("/admin/proposals")) return can("proposals.view");
  if (href.startsWith("/admin/contracts")) return can("contracts.view");
  if (href.startsWith("/admin/invoices")) return can("invoices.view");
  if (href.startsWith("/admin/files")) return can("files.view");
  if (href.startsWith("/admin/messages")) return can("messages.view");
  return true;
}
