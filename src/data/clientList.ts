import { calculateProjectProgress, type AgencyProject } from "@/data/agencyProjects";
import type { ContractSummary, ProposalSummary } from "@/data/documentsRepository";
import type { InvoiceSummary } from "@/data/invoicesRepository";
import { clientCommercialStage, salesFlags, type ClientCommercialStage } from "@/data/preProject";
import type { ClientScopeBrief } from "@/data/scopeBriefs";

export type ClientListRecords = {
  briefs: ClientScopeBrief[];
  proposals: ProposalSummary[];
  contracts: ContractSummary[];
  invoices: InvoiceSummary[];
};

export function clientListProjects(projects: AgencyProject[], clientId: string): AgencyProject[] {
  return projects.filter((project) => project.clientId === clientId && !project.archived);
}

export function featuredClientProject(projects: AgencyProject[]): AgencyProject | null {
  const open = projects.filter((project) => project.status !== "Completed");
  const pool = open.length > 0 ? open : projects;
  return [...pool].sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt))[0] ?? null;
}

export function clientProjectSummary(project: AgencyProject): string {
  return `${project.status} · ${calculateProjectProgress(project)}%`;
}

export function clientListNextAction(
  clientId: string,
  projects: AgencyProject[],
  records: ClientListRecords,
  options?: { canCreateProposal?: boolean; canViewProjects?: boolean },
): { label: string; href: string } {
  const clientProjects = clientListProjects(projects, clientId);
  const featured = featuredClientProject(clientProjects);
  const project = featured ?? clientProjects[0] ?? null;
  const proposals = records.proposals.filter((item) => item.clientId === clientId);
  const flags = salesFlags({
    brief: records.briefs.find((item) => item.clientId === clientId) ?? null,
    project,
    proposals,
    contracts: records.contracts.filter((item) => item.clientId === clientId),
    invoices: records.invoices.filter((item) => item.clientId === clientId),
  });
  const projectQuery = project ? `&project=${project.id}` : "";

  if (flags.hasScope && !flags.hasProject) {
    return { label: "Review Scope", href: `/admin/clients/${clientId}` };
  }
  if (flags.hasProject && proposals.length === 0 && options?.canCreateProposal) {
    return { label: "Create Proposal", href: `/admin/proposals/new?client=${clientId}${projectQuery}` };
  }
  if (options?.canViewProjects && featured) {
    return { label: "Open Project", href: `/admin/projects/${featured.id}` };
  }
  return { label: "View", href: `/admin/clients/${clientId}` };
}

export function workflowStageForClient(
  clientId: string,
  projects: AgencyProject[],
  records: ClientListRecords,
): ClientCommercialStage {
  const clientProjects = clientListProjects(projects, clientId);
  const project = clientProjects[0] ?? null;
  const proposals = records.proposals.filter((item) => item.clientId === clientId);
  const flags = salesFlags({
    brief: records.briefs.find((item) => item.clientId === clientId) ?? null,
    project,
    proposals,
    contracts: records.contracts.filter((item) => item.clientId === clientId),
    invoices: records.invoices.filter((item) => item.clientId === clientId),
  });
  const stage = clientCommercialStage(flags);
  if (stage === "Project" && proposals.length > 0) return "Proposal";
  return stage;
}
