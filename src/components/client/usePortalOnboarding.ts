import { useEffect, useMemo, useState } from "react";
import { usePortalSession } from "@/components/admin/leads/LeadsProvider";
import {
  fetchClientContractSummaries,
  fetchClientProposalSummaries,
  type ContractSummary,
  type ProposalSummary,
} from "@/data/documentsRepository";
import { fetchClientInvoiceSummaries, type InvoiceSummary } from "@/data/invoicesRepository";
import {
  clientOnboardingSteps,
  derivePortalPhase,
  portalPhaseLabel,
  portalPhaseTone,
  salesFlags,
} from "@/data/preProject";
import { fetchClientScopeBrief } from "@/data/scopeBriefsRepository";
import type { ClientScopeBrief } from "@/data/scopeBriefs";

export function usePortalOnboarding() {
  const session = usePortalSession();
  const [brief, setBrief] = useState<ClientScopeBrief | null>(null);
  const [proposals, setProposals] = useState<ProposalSummary[]>([]);
  const [contracts, setContracts] = useState<ContractSummary[]>([]);
  const [invoices, setInvoices] = useState<InvoiceSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session.client?.id) {
      setBrief(null);
      setProposals([]);
      setContracts([]);
      setInvoices([]);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    void Promise.all([
      fetchClientScopeBrief(session.client.id).catch(() => null),
      fetchClientProposalSummaries().catch(() => [] as ProposalSummary[]),
      fetchClientContractSummaries().catch(() => [] as ContractSummary[]),
      fetchClientInvoiceSummaries().catch(() => [] as InvoiceSummary[]),
    ]).then(([nextBrief, nextProposals, nextContracts, nextInvoices]) => {
      if (!active) return;
      setBrief(nextBrief);
      setProposals(nextProposals);
      setContracts(nextContracts);
      setInvoices(nextInvoices);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [session.client?.id]);

  const flags = useMemo(
    () =>
      salesFlags({
        brief,
        project: session.project,
        proposals,
        contracts,
        invoices,
      }),
    [brief, session.project, proposals, contracts, invoices],
  );
  const phase = derivePortalPhase(flags);
  const steps = useMemo(() => clientOnboardingSteps(flags), [flags]);

  return {
    client: session.client,
    project: session.project,
    brief,
    flags,
    phase,
    phaseLabel: portalPhaseLabel(phase),
    phaseTone: portalPhaseTone(phase),
    steps,
    loading,
  };
}
