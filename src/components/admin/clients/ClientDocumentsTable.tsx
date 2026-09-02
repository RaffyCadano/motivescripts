import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { DocumentStatusBadge } from "@/components/documents/DocumentStatusBadge";
import { contractWorkflowLabel, proposalWorkspaceLabel } from "@/data/documents";
import type { ContractSummary, ProposalSummary } from "@/data/documentsRepository";

type DocumentRow = {
  id: string;
  document: string;
  status: ReactNode;
  count: number;
  href: string;
  actionLabel: string;
};

function buildRows(
  clientId: string,
  proposals: ProposalSummary[],
  contracts: ContractSummary[],
): DocumentRow[] {
  const latestProposal = proposals[0];
  const latestContract = contracts[0];

  return [
    {
      id: "proposals",
      document: "Proposals",
      status:
        proposals.length === 0 ? (
          <span className="text-[var(--admin-muted)]">No proposals yet</span>
        ) : (
          <DocumentStatusBadge
            status={latestProposal.effectiveStatus}
            label={proposalWorkspaceLabel(latestProposal.effectiveStatus)}
          />
        ),
      count: proposals.length,
      href: `/admin/proposals?client=${clientId}`,
      actionLabel: proposals.length === 0 ? "View Proposals" : "View →",
    },
    {
      id: "contracts",
      document: "Contracts",
      status:
        contracts.length === 0 ? (
          <span className="text-[var(--admin-muted)]">No contracts yet</span>
        ) : (
          <DocumentStatusBadge
            status={latestContract.effectiveStatus}
            label={contractWorkflowLabel({
              status: latestContract.effectiveStatus,
              agencySigned: latestContract.agencySigned,
              signedCopyUploaded: Boolean(latestContract.signedCopy),
            })}
          />
        ),
      count: contracts.length,
      href: `/admin/contracts?client=${clientId}`,
      actionLabel: contracts.length === 0 ? "View Contracts" : "View →",
    },
  ];
}

export function ClientDocumentsTable({
  clientId,
  proposals,
  contracts,
}: {
  clientId: string;
  proposals: ProposalSummary[];
  contracts: ContractSummary[];
}) {
  const rows = buildRows(clientId, proposals, contracts);

  return (
    <>
      <div className="mt-4 hidden overflow-x-auto md:block">
        <table className="w-full min-w-[36rem] text-left text-[13px]">
          <thead>
            <tr className="border-b border-[var(--admin-line)] text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--admin-muted)]">
              <th className="py-3 pr-4 font-semibold">Document</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold text-right">Count</th>
              <th className="py-3 pl-4 text-right font-semibold">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className="border-b border-[var(--admin-line)] last:border-b-0 hover:bg-[var(--admin-bg)]"
              >
                <td className="py-3.5 pr-4 font-heading font-semibold text-[var(--admin-ink)]">{row.document}</td>
                <td className="px-4 py-3.5">{row.status}</td>
                <td className="px-4 py-3.5 text-right text-[var(--admin-ink)]">{row.count}</td>
                <td className="py-3.5 pl-4 text-right">
                  <Link
                    to={row.href}
                    className="font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline"
                  >
                    {row.actionLabel}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="mt-4 space-y-3 md:hidden">
        {rows.map((row) => (
          <li
            key={row.id}
            className="rounded-xl border border-[var(--admin-line)] bg-[var(--admin-bg)] p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="font-heading text-sm font-semibold text-[var(--admin-ink)]">{row.document}</p>
              <span className="font-heading text-sm font-semibold text-[var(--admin-ink)]">{row.count}</span>
            </div>
            <div className="mt-2">{row.status}</div>
            <Link
              to={row.href}
              className="mt-3 inline-flex font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline"
            >
              {row.actionLabel}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
