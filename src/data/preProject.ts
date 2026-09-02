import type { AgencyProject, AgencyProjectStatus } from "@/data/agencyProjects";
import { awaitingResponse } from "@/data/documents";
import type { ContractSummary, ProposalSummary } from "@/data/documentsRepository";
import { awaitingInvoicePayment } from "@/data/invoices";
import type { InvoiceSummary } from "@/data/invoicesRepository";
import { scopeStatus, type ClientScopeBrief, type ScopeStatus } from "@/data/scopeBriefs";

export type PortalPhase =
  | "pre_project"
  | "scope_submitted"
  | "proposal_pending"
  | "contract_pending"
  | "payment_pending"
  | "project_active";

export type OnboardingStepId = "account" | "scope" | "proposal" | "contract" | "payment";

export type OnboardingStepState = "done" | "current" | "upcoming";

export type OnboardingStep = {
  id: OnboardingStepId;
  title: string;
  body: string;
  state: OnboardingStepState;
  statusLabel?: string;
  href?: string;
  actionLabel?: string;
};

export type AdminFunnelItem = {
  id: string;
  label: string;
  done: boolean;
};

export type AdminWorkflowAction = {
  title: string;
  body: string;
  currentStepId: string;
  primaryKind: "link" | "start_project" | "invite" | "none";
  primaryLabel: string | null;
  primaryHref: string | null;
  secondaryLabel: string | null;
  secondaryHref: string | null;
};

const productionStatuses = new Set<AgencyProjectStatus>(["In Development", "Client Review", "Completed"]);

export function isProductionProject(status: AgencyProjectStatus | null | undefined): boolean {
  return Boolean(status && productionStatuses.has(status));
}

export function portalPhaseLabel(phase: PortalPhase): string {
  switch (phase) {
    case "pre_project":
      return "Pre-Project";
    case "scope_submitted":
      return "Scope Submitted";
    case "proposal_pending":
      return "Proposal Pending";
    case "contract_pending":
      return "Contract Pending";
    case "payment_pending":
      return "Payment Pending";
    case "project_active":
      return "Project Active";
  }
}

export function portalPhaseTone(phase: PortalPhase): "progress" | "review" | "done" | "neutral" {
  if (phase === "project_active") return "done";
  if (phase === "pre_project") return "neutral";
  if (phase === "scope_submitted") return "progress";
  return "review";
}

export function derivePortalPhase(input: {
  hasScope: boolean;
  hasProject: boolean;
  projectStatus: AgencyProjectStatus | null;
  proposalAwaiting: boolean;
  contractAwaiting: boolean;
  invoiceAwaiting: boolean;
}): PortalPhase {
  if (input.hasProject && isProductionProject(input.projectStatus)) return "project_active";
  if (input.invoiceAwaiting) return "payment_pending";
  if (input.contractAwaiting) return "contract_pending";
  if (input.proposalAwaiting) return "proposal_pending";
  if (input.hasScope) return "scope_submitted";
  return "pre_project";
}

function latestProposal(rows: ProposalSummary[]): ProposalSummary | undefined {
  return rows.find((row) => row.effectiveStatus === "accepted") ?? rows.find((row) => awaitingResponse(row.effectiveStatus));
}

function latestContract(rows: ContractSummary[]): ContractSummary | undefined {
  return rows.find((row) => row.effectiveStatus === "accepted") ?? rows.find((row) => awaitingResponse(row.effectiveStatus));
}

function latestInvoice(rows: InvoiceSummary[]): InvoiceSummary | undefined {
  return (
    rows.find((row) => row.effectiveStatus === "paid") ??
    rows.find((row) => awaitingInvoicePayment(row.effectiveStatus) && row.amountDueCents > 0)
  );
}

export function salesFlags(input: {
  brief: ClientScopeBrief | null;
  project: AgencyProject | null;
  proposals: ProposalSummary[];
  contracts: ContractSummary[];
  invoices: InvoiceSummary[];
}) {
  const proposal = latestProposal(input.proposals);
  const contract = latestContract(input.contracts);
  const invoice = latestInvoice(input.invoices);
  const awaitingProposal = input.proposals.find((row) => awaitingResponse(row.effectiveStatus));
  const awaitingContract = input.contracts.find((row) => awaitingResponse(row.effectiveStatus));
  const awaitingInvoice = input.invoices.find(
    (row) => awaitingInvoicePayment(row.effectiveStatus) && row.amountDueCents > 0,
  );
  const actionProposal = awaitingProposal ?? proposal;
  const actionContract = awaitingContract ?? contract;
  const actionInvoice = awaitingInvoice ?? invoice;
  return {
    hasScope: scopeStatus(input.brief) === "submitted",
    scopeStatus: scopeStatus(input.brief),
    hasProject: Boolean(input.project),
    projectName: input.project?.name ?? null,
    projectStatus: input.project?.status ?? null,
    proposalId: actionProposal?.id ?? null,
    proposalNumber: actionProposal?.number ?? null,
    proposalAwaiting: Boolean(awaitingProposal),
    proposalAccepted: input.proposals.some((row) => row.effectiveStatus === "accepted"),
    contractId: actionContract?.id ?? null,
    contractNumber: actionContract?.number ?? null,
    contractAwaiting: Boolean(awaitingContract),
    contractAccepted: input.contracts.some((row) => row.effectiveStatus === "accepted"),
    invoiceId: actionInvoice?.id ?? null,
    invoiceNumber: actionInvoice?.number ?? null,
    invoiceAwaiting: Boolean(awaitingInvoice),
    invoicePaid: input.invoices.some((row) => row.effectiveStatus === "paid"),
  };
}

function scopeOnboardingStep(status: ScopeStatus): OnboardingStep {
  if (status === "submitted") {
    return {
      id: "scope",
      title: "Website Scope",
      statusLabel: "Submitted ✓",
      body: "Your requirements have been received.",
      state: "done",
      href: "/client/scope",
      actionLabel: "View Scope",
    };
  }
  if (status === "in_progress") {
    return {
      id: "scope",
      title: "Website Scope",
      statusLabel: "In progress",
      body: "Your scope is saved as a draft.",
      state: "current",
      href: "/client/scope",
      actionLabel: "Continue Scope",
    };
  }
  return {
    id: "scope",
    title: "Website Scope",
    statusLabel: "Not started",
    body: "Tell us what you want your website to include.",
    state: "current",
    href: "/client/scope",
    actionLabel: "Complete Scope",
  };
}

export function clientOnboardingSteps(flags: ReturnType<typeof salesFlags>): OnboardingStep[] {
  const scope = scopeOnboardingStep(flags.scopeStatus);

  const proposal: OnboardingStep = flags.proposalAccepted
    ? {
        id: "proposal",
        title: "Review your proposal",
        body: flags.proposalNumber ? `${flags.proposalNumber} accepted.` : "Proposal accepted.",
        state: "done",
        href: flags.proposalId ? `/client/proposals/${flags.proposalId}` : "/client/proposals",
        actionLabel: "View proposal",
      }
    : flags.proposalAwaiting
      ? {
          id: "proposal",
          title: "Review your proposal",
          body: flags.proposalNumber
            ? `${flags.proposalNumber} is ready for you to review.`
            : "A proposal is ready for you to review.",
          state: "current",
          href: flags.proposalId ? `/client/proposals/${flags.proposalId}` : "/client/proposals",
          actionLabel: "Review proposal",
        }
      : {
          id: "proposal",
          title: "Review your proposal",
          body: "Coming next — we’ll send a proposal after we review your scope.",
          state: "upcoming",
        };

  const contract: OnboardingStep = flags.contractAccepted
    ? {
        id: "contract",
        title: "Review your contract",
        body: flags.contractNumber ? `${flags.contractNumber} accepted.` : "Contract accepted.",
        state: "done",
        href: flags.contractId ? `/client/contracts/${flags.contractId}` : "/client/contracts",
        actionLabel: "View contract",
      }
    : flags.contractAwaiting
      ? {
          id: "contract",
          title: "Review your contract",
          body: flags.contractNumber
            ? `${flags.contractNumber} is ready for you to review.`
            : "A contract is ready for you to review.",
          state: "current",
          href: flags.contractId ? `/client/contracts/${flags.contractId}` : "/client/contracts",
          actionLabel: "Review contract",
        }
      : {
          id: "contract",
          title: "Review your contract",
          body: "Coming next — after the proposal is accepted.",
          state: "upcoming",
        };

  const payment: OnboardingStep = flags.invoicePaid
    ? {
        id: "payment",
        title: "Complete payment",
        body: flags.invoiceNumber ? `${flags.invoiceNumber} is paid.` : "Payment received.",
        state: "done",
        href: flags.invoiceId ? `/client/invoices/${flags.invoiceId}` : "/client/invoices",
        actionLabel: "View invoice",
      }
    : flags.invoiceAwaiting
      ? {
          id: "payment",
          title: "Complete payment",
          body: flags.invoiceNumber
            ? `${flags.invoiceNumber} is waiting for payment.`
            : "An invoice is waiting for payment.",
          state: "current",
          href: flags.invoiceId ? `/client/invoices/${flags.invoiceId}` : "/client/invoices",
          actionLabel: "Pay invoice",
        }
      : {
          id: "payment",
          title: "Complete payment",
          body: "Coming next — after the contract is accepted.",
          state: "upcoming",
        };

  return [
    {
      id: "account",
      title: "Account created",
      body: "Your client portal is ready.",
      state: "done",
    },
    scope,
    proposal,
    contract,
    payment,
  ];
}

/** Lead-page strip. Later steps are done only when matching records already exist. */
export function deriveLeadFunnel(input: {
  converted: boolean;
  portalInvited?: boolean;
  hasScope?: boolean;
  hasProject?: boolean;
  proposalAccepted?: boolean;
  contractAccepted?: boolean;
  hasInvoice?: boolean;
  invoicePaid?: boolean;
}): AdminFunnelItem[] {
  return [
    { id: "lead", label: "Lead", done: input.converted },
    { id: "client", label: "Client", done: input.converted },
    { id: "invited", label: "Portal Invite", done: Boolean(input.portalInvited) },
    { id: "scope", label: "Scope", done: Boolean(input.hasScope) },
    { id: "project", label: "Project", done: Boolean(input.hasProject) },
    { id: "proposal", label: "Proposal", done: Boolean(input.proposalAccepted) },
    { id: "contract", label: "Contract", done: Boolean(input.contractAccepted) },
    { id: "invoice", label: "Invoice", done: Boolean(input.hasInvoice) },
    { id: "payment", label: "Payment", done: Boolean(input.invoicePaid) },
  ];
}

export function leadFunnelCurrentId(items: AdminFunnelItem[], converted: boolean): string {
  if (!converted) return "lead";
  return items.find((item) => !item.done)?.id ?? "client";
}

export function deriveAdminFunnel(input: {
  portalInvited: boolean;
  hasScope: boolean;
  hasProject: boolean;
  proposalAccepted: boolean;
  contractAccepted: boolean;
  invoicePaid: boolean;
  projectStarted: boolean;
}): AdminFunnelItem[] {
  return [
    { id: "invited", label: "Portal invited", done: input.portalInvited },
    { id: "scope", label: "Scope submitted", done: input.hasScope },
    { id: "project", label: "Project created", done: input.hasProject },
    { id: "proposal", label: "Proposal accepted", done: input.proposalAccepted },
    { id: "contract", label: "Contract signed", done: input.contractAccepted },
    { id: "invoice", label: "Invoice paid", done: input.invoicePaid },
    { id: "started", label: "Project started", done: input.projectStarted },
  ];
}

export function adminFunnelCurrentId(items: AdminFunnelItem[]): string {
  return items.find((item) => !item.done)?.id ?? items[items.length - 1]?.id ?? "invited";
}

const clientCommandLabels: Record<string, string> = {
  client: "Client",
  invited: "Portal Invited",
  scope: "Scope Submitted",
  project: "Project Created",
  proposal: "Proposal",
  contract: "Contract Signed",
  invoice: "Invoice Paid",
  started: "Project Started",
};

/** Compact neutral labels for commercial progress trackers. */
export const commercialStageLabels: Record<string, string> = {
  client: "Client",
  invited: "Portal",
  scope: "Scope",
  project: "Project",
  proposal: "Proposal",
  contract: "Contract",
  invoice: "Invoice",
  started: "Start",
  lead: "Lead",
  payment: "Payment",
};

/** Same commercial funnel as deriveAdminFunnel, with a completed Client step for the account page. */
export function clientCommandFunnel(input: Parameters<typeof deriveAdminFunnel>[0]): AdminFunnelItem[] {
  return [
    { id: "client", label: clientCommandLabels.client, done: true },
    ...deriveAdminFunnel(input).map((item) => ({
      ...item,
      label: clientCommandLabels[item.id] ?? item.label,
    })),
  ];
}

/** Full commercial funnel for a project workspace — uses live portal/scope/project records. */
export function projectCommandFunnel(input: Parameters<typeof deriveAdminFunnel>[0]): AdminFunnelItem[] {
  return [
    { id: "client", label: commercialStageLabels.client, done: true },
    ...deriveAdminFunnel(input).map((item) => ({
      ...item,
      label: commercialStageLabels[item.id] ?? item.label,
    })),
  ];
}

export function adminClientWorkflowAction(input: {
  clientId: string;
  portalInvited: boolean;
  hasScope: boolean;
  hasProject: boolean;
  proposalAccepted: boolean;
  contractAccepted: boolean;
  invoicePaid: boolean;
  projectStarted: boolean;
  projectId: string | null;
  projectStatus: AgencyProjectStatus | null;
  acceptedProposalId: string | null;
  acceptedContractId: string | null;
}): AdminWorkflowAction {
  const projectHref = input.projectId ? `/admin/projects/${input.projectId}` : null;
  const createProject = `/admin/projects/new?client=${input.clientId}`;
  const createProposal = `/admin/proposals/new?client=${input.clientId}${input.projectId ? `&project=${input.projectId}` : ""}`;
  const createContract = `/admin/contracts/new?client=${input.clientId}${input.projectId ? `&project=${input.projectId}` : ""}${input.acceptedProposalId ? `&proposal=${input.acceptedProposalId}` : ""}`;
  const createInvoice = `/admin/invoices/new?client=${input.clientId}${input.projectId ? `&project=${input.projectId}` : ""}${input.acceptedContractId ? `&contract=${input.acceptedContractId}` : ""}`;

  if (input.projectStarted && projectHref) {
    return {
      title: "Project in production",
      body: "This project is underway. Open the project workspace to manage tasks, files, and reviews.",
      currentStepId: "started",
      primaryKind: "link",
      primaryLabel: "Open Project",
      primaryHref: projectHref,
      secondaryLabel: null,
      secondaryHref: null,
    };
  }

  if (input.invoicePaid && !input.projectStarted && input.projectId) {
    return {
      title: "Payment received ✓ — production ready",
      body: "The invoice is paid and the initial production task plan is ready. Start production when you are ready. This sets the project to In Development.",
      currentStepId: "started",
      primaryKind: "start_project",
      primaryLabel: "Start Project",
      primaryHref: null,
      secondaryLabel: "Open Project",
      secondaryHref: projectHref,
    };
  }

  if (input.contractAccepted && !input.invoicePaid) {
    return {
      title: "Contract signed — ready for invoice/payment",
      body: "Create an invoice so the client can pay and production can begin.",
      currentStepId: "invoice",
      primaryKind: "link",
      primaryLabel: "Create Invoice",
      primaryHref: createInvoice,
      secondaryLabel: projectHref ? "Open Project" : null,
      secondaryHref: projectHref,
    };
  }

  if (input.proposalAccepted && !input.contractAccepted) {
    return {
      title: "Proposal accepted — ready for contract",
      body: "The client accepted the proposal. Create the contract next.",
      currentStepId: "contract",
      primaryKind: "link",
      primaryLabel: "Create Contract",
      primaryHref: createContract,
      secondaryLabel: projectHref ? "Open Project" : null,
      secondaryHref: projectHref,
    };
  }

  if (input.hasProject && !input.proposalAccepted) {
    return {
      title: "Project created — ready for proposal",
      body: "The project record is in place. Create a proposal from the submitted requirements.",
      currentStepId: "proposal",
      primaryKind: "link",
      primaryLabel: "Create Proposal",
      primaryHref: createProposal,
      secondaryLabel: projectHref ? "Open Project" : null,
      secondaryHref: projectHref,
    };
  }

  if (input.hasScope && !input.hasProject) {
    return {
      title: "Ready for Project Setup",
      body: "The client has submitted their website requirements. Review the scope below, then create the project.",
      currentStepId: "project",
      primaryKind: "link",
      primaryLabel: "Create Project",
      primaryHref: createProject,
      secondaryLabel: null,
      secondaryHref: null,
    };
  }

  if (!input.portalInvited) {
    return {
      title: "Invite client to portal",
      body: "Send the client a portal invitation so they can complete the Website Scope.",
      currentStepId: "invited",
      primaryKind: "invite",
      primaryLabel: "Invite Client",
      primaryHref: null,
      secondaryLabel: "Create Project",
      secondaryHref: createProject,
    };
  }

  return {
    title: "Waiting for Website Scope",
    body: "No scope has been submitted yet. You can still create a project if you already have the project brief.",
    currentStepId: "scope",
    primaryKind: "none",
    primaryLabel: null,
    primaryHref: null,
    secondaryLabel: "Create Project",
    secondaryHref: createProject,
  };
}

export function adminEngagementLabel(hasProject: boolean, projectStarted: boolean): string {
  if (projectStarted) return "Active project";
  if (hasProject) return "Project created";
  return "Pre-Project";
}

export const clientCommercialStages = [
  "Pre-Project",
  "Project",
  "Proposal",
  "Contract",
  "Invoice",
  "Production",
  "Complete",
] as const;

export type ClientCommercialStage = (typeof clientCommercialStages)[number];

/** Current commercial stage from live records — not a stored client status. */
export function clientCommercialStage(flags: ReturnType<typeof salesFlags>): ClientCommercialStage {
  if (flags.projectStatus === "Completed") return "Complete";
  if (isProductionProject(flags.projectStatus)) return "Production";
  if (flags.invoicePaid) return "Production";
  if (flags.invoiceAwaiting || (flags.contractAccepted && !flags.invoicePaid)) return "Invoice";
  if (flags.contractAwaiting || (flags.proposalAccepted && !flags.contractAccepted)) return "Contract";
  if (flags.proposalAwaiting || flags.proposalId) return "Proposal";
  if (flags.hasProject) return "Project";
  return "Pre-Project";
}

export function projectWorkspaceFunnel(input: {
  portalInvited: boolean;
  hasScope: boolean;
  proposalAccepted: boolean;
  contractAccepted: boolean;
  invoicePaid: boolean;
  projectStarted: boolean;
}): AdminFunnelItem[] {
  return projectCommandFunnel({
    portalInvited: input.portalInvited,
    hasScope: input.hasScope,
    hasProject: true,
    proposalAccepted: input.proposalAccepted,
    contractAccepted: input.contractAccepted,
    invoicePaid: input.invoicePaid,
    projectStarted: input.projectStarted,
  });
}

export function projectWorkspaceStepLabel(item: AdminFunnelItem): string {
  return commercialStageLabels[item.id] ?? item.label;
}
