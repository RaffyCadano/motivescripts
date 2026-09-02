import { useEffect, useState } from "react";
import { ClientDocumentsTable } from "@/components/admin/clients/ClientDocumentsTable";
import {
  fetchContractSummaries,
  fetchProposalSummaries,
  type ContractSummary,
  type ProposalSummary,
} from "@/data/documentsRepository";
import type { AgencyClient } from "@/data/agencyClients";

export function ClientDocumentsSection({ client }: { client: AgencyClient }) {
  const [proposals, setProposals] = useState<ProposalSummary[]>([]);
  const [contracts, setContracts] = useState<ContractSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void Promise.all([fetchProposalSummaries(client.id), fetchContractSummaries(client.id)])
      .then(([nextProposals, nextContracts]) => {
        if (!active) return;
        setProposals(nextProposals);
        setContracts(nextContracts);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [client.id]);

  return (
    <section
      id="agreements"
      className="scroll-mt-4 rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5"
    >
      <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Proposals & contracts</h2>
      {loading ? (
        <div className="mt-4 h-24 animate-pulse rounded-lg bg-[var(--admin-bg)]" />
      ) : (
        <ClientDocumentsTable clientId={client.id} proposals={proposals} contracts={contracts} />
      )}
    </section>
  );
}
