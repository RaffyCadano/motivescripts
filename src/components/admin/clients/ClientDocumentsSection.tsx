import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DocumentStatusBadge } from "@/components/documents/DocumentStatusBadge";
import { adminStatusLabel } from "@/data/documents";
import {
  fetchContractSummaries,
  fetchProposalSummaries,
  type ContractSummary,
  type ProposalSummary,
} from "@/data/documentsRepository";
import { formatUsdFromCents } from "@/data/money";
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

  const latestProposal = proposals[0];
  const latestContract = contracts[0];

  return (
    <section
      id="agreements"
      className="scroll-mt-4 rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5"
    >
      <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Proposals & contracts</h2>
      {loading ? (
        <div className="mt-4 h-24 animate-pulse rounded-lg bg-[var(--admin-bg)]" />
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-[12px] text-[var(--admin-muted)]">Proposals</p>
            <p className="mt-1 font-heading text-2xl font-semibold tracking-tight">{proposals.length}</p>
            {latestProposal ? (
              <p className="mt-2 text-sm text-[var(--admin-ink)]">
                Latest:{" "}
                <Link className="font-semibold text-[var(--admin-blue)] hover:underline" to={`/admin/proposals/${latestProposal.id}`}>
                  {latestProposal.number}
                </Link>
                <span className="mt-1 block">
                  <DocumentStatusBadge status={latestProposal.effectiveStatus} />
                </span>
                <span className="mt-1 block text-[12px] text-[var(--admin-muted)]">
                  {formatUsdFromCents(latestProposal.investmentCents)}
                </span>
              </p>
            ) : (
              <p className="mt-2 text-sm text-[var(--admin-muted)]">No proposals yet.</p>
            )}
            <Link
              to={`/admin/proposals?client=${client.id}`}
              className="mt-3 inline-flex font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline"
            >
              View Proposals
            </Link>
          </div>
          <div>
            <p className="text-[12px] text-[var(--admin-muted)]">Contracts</p>
            <p className="mt-1 font-heading text-2xl font-semibold tracking-tight">{contracts.length}</p>
            {latestContract ? (
              <p className="mt-2 text-sm text-[var(--admin-ink)]">
                Latest:{" "}
                <Link className="font-semibold text-[var(--admin-blue)] hover:underline" to={`/admin/contracts/${latestContract.id}`}>
                  {latestContract.number}
                </Link>
                <span className="mt-1 block">
                  <DocumentStatusBadge status={latestContract.effectiveStatus} />
                </span>
                <span className="mt-1 block text-[12px] text-[var(--admin-muted)]">
                  {adminStatusLabel(latestContract.effectiveStatus)}
                </span>
              </p>
            ) : (
              <p className="mt-2 text-sm text-[var(--admin-muted)]">No contracts yet.</p>
            )}
            <Link
              to={`/admin/contracts?client=${client.id}`}
              className="mt-3 inline-flex font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline"
            >
              View Contracts
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
