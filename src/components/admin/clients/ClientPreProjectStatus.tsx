import { useEffect, useState } from "react";
import { useClientProjects, useLeads } from "@/components/admin/leads/LeadsProvider";
import type { AgencyClient } from "@/data/agencyClients";
import type { AgencyProject } from "@/data/agencyProjects";
import { fetchContractSummaries, fetchProposalSummaries, type ContractSummary, type ProposalSummary } from "@/data/documentsRepository";
import { fetchClientInvitations } from "@/data/invitationRepository";
import { fetchInvoiceSummaries, type InvoiceSummary } from "@/data/invoicesRepository";
import {
  adminClientWorkflowAction,
  adminEngagementLabel,
  isProductionProject,
  projectCommandFunnel,
  salesFlags,
  type AdminFunnelItem,
  type AdminWorkflowAction,
} from "@/data/preProject";
import { fetchClientScopeBrief } from "@/data/scopeBriefsRepository";
import type { ClientScopeBrief } from "@/data/scopeBriefs";

export type ClientWorkflowState = {
  loading: boolean;
  items: AdminFunnelItem[] | null;
  action: AdminWorkflowAction | null;
  stage: string;
  project: AgencyProject | null;
  brief: ClientScopeBrief | null;
  proposal: ProposalSummary | null;
  contract: ContractSummary | null;
  invoices: InvoiceSummary[];
  portalInvited: boolean;
};

export function useClientWorkflowState(client: AgencyClient) {
  const { portalAccounts } = useLeads();
  const projects = useClientProjects(client.id);
  const project = projects[0] ?? null;
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<AdminFunnelItem[] | null>(null);
  const [action, setAction] = useState<AdminWorkflowAction | null>(null);
  const [brief, setBrief] = useState<ClientScopeBrief | null>(null);
  const [proposal, setProposal] = useState<ProposalSummary | null>(null);
  const [contract, setContract] = useState<ContractSummary | null>(null);
  const [invoices, setInvoices] = useState<InvoiceSummary[]>([]);
  const [portalInvited, setPortalInvited] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void Promise.all([
      fetchClientScopeBrief(client.id).catch(() => null),
      fetchClientInvitations(client.id).catch(() => []),
      fetchProposalSummaries(client.id).catch(() => [] as ProposalSummary[]),
      fetchContractSummaries(client.id).catch(() => [] as ContractSummary[]),
      fetchInvoiceSummaries(client.id).catch(() => [] as InvoiceSummary[]),
    ])
      .then(([nextBrief, invitations, proposals, contracts, nextInvoices]) => {
        if (!active) return;
        const linked = portalAccounts.some((account) => account.clientId === client.id && account.role === "client");
        const invited =
          linked || invitations.some((row) => row.effectiveStatus === "pending" || row.effectiveStatus === "accepted");
        const flags = salesFlags({ brief: nextBrief, project, proposals, contracts, invoices: nextInvoices });
        const funnel = projectCommandFunnel({
          portalInvited: invited,
          hasScope: flags.hasScope,
          hasProject: flags.hasProject,
          proposalAccepted: flags.proposalAccepted,
          contractAccepted: flags.contractAccepted,
          invoicePaid: flags.invoicePaid,
          projectStarted: isProductionProject(flags.projectStatus),
        });
        const acceptedProposal = proposals.find((row) => row.effectiveStatus === "accepted");
        const acceptedContract = contracts.find((row) => row.effectiveStatus === "accepted");
        setBrief(nextBrief);
        setProposal(proposals[0] ?? null);
        setContract(contracts[0] ?? null);
        setInvoices(nextInvoices);
        setPortalInvited(invited);
        setItems(funnel);
        setAction(
          adminClientWorkflowAction({
            clientId: client.id,
            portalInvited: invited,
            hasScope: flags.hasScope,
            hasProject: flags.hasProject,
            proposalAccepted: flags.proposalAccepted,
            contractAccepted: flags.contractAccepted,
            invoicePaid: flags.invoicePaid,
            projectStarted: isProductionProject(flags.projectStatus),
            projectId: project?.id ?? null,
            projectStatus: flags.projectStatus,
            acceptedProposalId: acceptedProposal?.id ?? null,
            acceptedContractId: acceptedContract?.id ?? null,
          }),
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [client.id, portalAccounts, project?.id, project?.status]);

  return {
    loading,
    items,
    action,
    stage: adminEngagementLabel(Boolean(project), isProductionProject(project?.status)),
    project,
    brief,
    proposal,
    contract,
    invoices,
    portalInvited,
  };
}
