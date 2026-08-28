import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DocumentStatusBadge } from "@/components/documents/DocumentStatusBadge";
import {
  fetchContractSummaries,
  fetchProposalSummaries,
  type ContractSummary,
  type ProposalSummary,
} from "@/data/documentsRepository";
import { formatUsdFromCents } from "@/data/money";

export function ProjectDocumentsCard({ projectId, clientId }: { projectId: string; clientId: string }) {
  const [proposal, setProposal] = useState<ProposalSummary | null>(null);
  const [contract, setContract] = useState<ContractSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void Promise.all([fetchProposalSummaries(clientId), fetchContractSummaries(clientId)])
      .then(([proposals, contracts]) => {
        if (!active) return;
        setProposal(proposals.find((row) => row.projectId === projectId) ?? null);
        setContract(contracts.find((row) => row.projectId === projectId) ?? null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [clientId, projectId]);

  if (loading) {
    return <div className="h-28 animate-pulse rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)]" />;
  }
  if (!proposal && !contract) return null;

  return (
    <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
      <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Agreement</h2>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2">
        {proposal ? (
          <div>
            <dt className="text-[12px] text-[var(--admin-muted)]">Proposal</dt>
            <dd className="mt-1">
              <Link className="text-sm font-medium text-[var(--admin-blue)] hover:underline" to={`/admin/proposals/${proposal.id}`}>
                {proposal.number}
              </Link>
              <p className="mt-1 text-sm text-[var(--admin-ink)]">{proposal.title}</p>
              <p className="mt-1 text-[12px] text-[var(--admin-muted)]">{formatUsdFromCents(proposal.investmentCents)}</p>
              <div className="mt-2">
                <DocumentStatusBadge status={proposal.effectiveStatus} />
              </div>
            </dd>
          </div>
        ) : null}
        {contract ? (
          <div>
            <dt className="text-[12px] text-[var(--admin-muted)]">Contract</dt>
            <dd className="mt-1">
              <Link className="text-sm font-medium text-[var(--admin-blue)] hover:underline" to={`/admin/contracts/${contract.id}`}>
                {contract.number}
              </Link>
              <p className="mt-1 text-sm text-[var(--admin-ink)]">{contract.title}</p>
              <div className="mt-2">
                <DocumentStatusBadge status={contract.effectiveStatus} />
              </div>
            </dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}
