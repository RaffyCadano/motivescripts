import { useEffect, useState } from "react";
import type { AgencyClient } from "@/data/agencyClients";
import type { AgencyProject } from "@/data/agencyProjects";
import { fetchContractSummaries, fetchProposalSummaries } from "@/data/documentsRepository";
import { fetchClientInvitations } from "@/data/invitationRepository";
import { fetchInvoiceSummaries } from "@/data/invoicesRepository";
import {
  adminClientWorkflowAction,
  adminFunnelCurrentId,
  isProductionProject,
  projectCommandFunnel,
  salesFlags,
  type AdminFunnelItem,
  type AdminWorkflowAction,
} from "@/data/preProject";
import { fetchClientScopeBrief } from "@/data/scopeBriefsRepository";
import type { ContractSummary, ProposalSummary } from "@/data/documentsRepository";
import type { InvoiceSummary } from "@/data/invoicesRepository";
import type { ClientScopeBrief } from "@/data/scopeBriefs";

export type ProjectWorkflowState = {
  loading: boolean;
  items: AdminFunnelItem[] | null;
  currentId: string | null;
  action: AdminWorkflowAction | null;
  brief: ClientScopeBrief | null;
  proposal: ProposalSummary | null;
  contract: ContractSummary | null;
  invoices: InvoiceSummary[];
  portalInvited: boolean;
  flags: ReturnType<typeof salesFlags> | null;
};

export function useProjectWorkflowState(
  project: AgencyProject | null,
  client: AgencyClient | null,
  portalLinked: boolean,
): ProjectWorkflowState {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<AdminFunnelItem[] | null>(null);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [action, setAction] = useState<AdminWorkflowAction | null>(null);
  const [brief, setBrief] = useState<ClientScopeBrief | null>(null);
  const [proposal, setProposal] = useState<ProposalSummary | null>(null);
  const [contract, setContract] = useState<ContractSummary | null>(null);
  const [invoices, setInvoices] = useState<InvoiceSummary[]>([]);
  const [portalInvited, setPortalInvited] = useState(false);
  const [flags, setFlags] = useState<ReturnType<typeof salesFlags> | null>(null);

  useEffect(() => {
    if (!project || !client) {
      setLoading(false);
      return;
    }
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
        const invited =
          portalLinked ||
          invitations.some((row) => row.effectiveStatus === "pending" || row.effectiveStatus === "accepted");
        const projectProposals = proposals.filter((row) => row.projectId === project.id);
        const projectContracts = contracts.filter((row) => row.projectId === project.id);
        const projectInvoices = nextInvoices.filter((row) => row.projectId === project.id);
        const nextFlags = salesFlags({
          brief: nextBrief,
          project,
          proposals: projectProposals,
          contracts: projectContracts,
          invoices: projectInvoices,
        });
        const funnel = projectCommandFunnel({
          portalInvited: invited,
          hasScope: nextFlags.hasScope,
          hasProject: true,
          proposalAccepted: nextFlags.proposalAccepted,
          contractAccepted: nextFlags.contractAccepted,
          invoicePaid: nextFlags.invoicePaid,
          projectStarted: isProductionProject(nextFlags.projectStatus),
        });
        const acceptedProposal = projectProposals.find((row) => row.effectiveStatus === "accepted");
        const acceptedContract = projectContracts.find((row) => row.effectiveStatus === "accepted");
        setBrief(nextBrief);
        setProposal(projectProposals[0] ?? null);
        setContract(projectContracts[0] ?? null);
        setInvoices(projectInvoices);
        setPortalInvited(invited);
        setFlags(nextFlags);
        setItems(funnel);
        setCurrentId(adminFunnelCurrentId(funnel));
        setAction(
          adminClientWorkflowAction({
            clientId: client.id,
            portalInvited: invited,
            hasScope: nextFlags.hasScope,
            hasProject: true,
            proposalAccepted: nextFlags.proposalAccepted,
            contractAccepted: nextFlags.contractAccepted,
            invoicePaid: nextFlags.invoicePaid,
            projectStarted: isProductionProject(nextFlags.projectStatus),
            projectId: project.id,
            projectStatus: nextFlags.projectStatus,
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
  }, [client, portalLinked, project?.id, project?.status]);

  return { loading, items, currentId, action, brief, proposal, contract, invoices, portalInvited, flags };
}
