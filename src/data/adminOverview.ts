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

  for (const file of input.deliverables) {
    if (file.status === "Archived") continue;
    const project = projects.find((item) => item.id === file.projectId);
    const name = project ? clientName(input.clients, project.clientId, project.name) : "Project";
    if (file.status === "In Review") {
      items.push({
        id: `review-${file.id}`,
        name,
        body: "Website is waiting for your review.",
        stage: "Review",
        actionLabel: "Open Project",
        href: `/admin/projects/${file.projectId}?tab=files`,
        sort: 20,
        clientId: project?.clientId ?? null,
      });
    }
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
