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

export function adminEngagementLabel(hasProject: boolean, projectStarted: boolean): string {
  if (projectStarted) return "Active project";
  if (hasProject) return "Project created";
  return "Pre-Project";
}
