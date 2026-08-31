import { Link } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { hasPermission } from "@/auth/permissions";
import { adminPrimaryBtn } from "@/components/admin/adminActionStyles";
import { DocumentStatusBadge } from "@/components/documents/DocumentStatusBadge";
import type { DocumentStatus } from "@/data/documents";
import type { ContractSummary, ProposalSummary } from "@/data/documentsRepository";
import { formatUsdFromCents } from "@/data/money";

function proposalAction(
  status: DocumentStatus,
  clientId: string,
  projectId: string,
  proposalId: string,
  hasContract: boolean,
): { title: string; body: string; primary: string; href: string } {
  if (status === "draft") {
    return {
      title: "Proposal Draft",
      body: "The proposal is being prepared.",
      primary: "Continue Proposal",
      href: `/admin/proposals/${proposalId}`,
    };
  }
  if (status === "sent" || status === "viewed") {
    return {
      title: "Proposal Sent",
      body: "Waiting for the client to review and respond.",
      primary: "View Proposal",
      href: `/admin/proposals/${proposalId}`,
    };
  }
  if (status === "accepted") {
    if (!hasContract) {
      return {
        title: "Proposal Accepted ✓",
        body: "The proposal has been accepted. The next step is the contract.",
        primary: "Create Contract",
        href: `/admin/contracts/new?client=${clientId}&proposal=${proposalId}&project=${projectId}`,
      };
    }
    return {
      title: "Proposal Accepted ✓",
      body: "The proposal has been accepted. The next step is the contract.",
      primary: "View Proposal",
      href: `/admin/proposals/${proposalId}`,
    };
  }
  if (status === "declined") {
    return {
      title: "Proposal Declined",
      body: "Open the proposal to review the client’s response.",
      primary: "View Proposal",
      href: `/admin/proposals/${proposalId}`,
    };
  }
  return {
    title: status === "expired" ? "Proposal Expired" : "Proposal Cancelled",
    body: "Open the proposal to review it or create a revision.",
    primary: "View Proposal",
    href: `/admin/proposals/${proposalId}`,
  };
}

export function ProjectDocumentsCard({
  projectId,
  clientId,
  proposal,
  contract,
  loading,
}: {
  projectId: string;
  clientId: string;
  proposal: ProposalSummary | null;
  contract: ContractSummary | null;
  loading: boolean;
}) {
  const { profile } = useAuth();
  const canCreateProposal = hasPermission(profile, "proposals.manage");
  const canViewProposal = hasPermission(profile, "proposals.view");
  const canCreateContract = hasPermission(profile, "contracts.manage");
  const createHref = `/admin/proposals/new?client=${clientId}&project=${projectId}`;

  if (loading) {
    return <div className="h-28 animate-pulse rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)]" />;
  }

  const action = proposal
    ? proposalAction(proposal.effectiveStatus, clientId, projectId, proposal.id, Boolean(contract))
    : null;
  const showPrimary =
    action &&
    (action.primary === "Create Contract"
      ? canCreateContract
      : action.primary === "Continue Proposal" || action.primary === "View Proposal"
        ? canViewProposal
        : true);

  return (
    <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
      <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Agreement</h2>

      {!proposal ? (
        <div className="mt-4 rounded-xl border border-[rgb(0_80_240_/_0.22)] bg-[rgb(0_80_240_/_0.04)] px-4 py-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--admin-blue)]">Next action</p>
          <p className="mt-2 font-heading text-lg font-semibold tracking-tight text-[var(--admin-ink)]">Create Proposal</p>
          <p className="mt-1 text-sm leading-6 text-[var(--admin-muted)]">
            Project created → next step: Create Proposal. No proposal is linked to this project yet.
          </p>
          {canCreateProposal ? (
            <Link to={createHref} className={`${adminPrimaryBtn} mt-4 justify-center sm:inline-flex`}>
              Create Proposal
            </Link>
          ) : (
            <p className="mt-3 text-sm text-[var(--admin-muted)]">You don’t have permission to create proposals.</p>
          )}
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-[rgb(0_80_240_/_0.22)] bg-[rgb(0_80_240_/_0.04)] px-4 py-5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-heading text-lg font-semibold tracking-tight text-[var(--admin-ink)]">{action?.title}</p>
            <DocumentStatusBadge status={proposal.effectiveStatus} />
          </div>
          <p className="mt-1 text-sm leading-6 text-[var(--admin-muted)]">{action?.body}</p>
          {proposal.number ? (
            <p className="mt-2 text-[12px] text-[var(--admin-muted)]">
              {canViewProposal ? (
                <Link className="font-semibold text-[var(--admin-blue)] hover:underline" to={`/admin/proposals/${proposal.id}`}>
                  {proposal.number}
                </Link>
              ) : (
                proposal.number
              )}
              {proposal.title ? ` · ${proposal.title}` : ""}
              <span className="mt-0.5 block">{formatUsdFromCents(proposal.investmentCents)}</span>
            </p>
          ) : null}
          {showPrimary && action ? (
            <Link to={action.href} className={`${adminPrimaryBtn} mt-4 justify-center sm:inline-flex`}>
              {action.primary}
            </Link>
          ) : action?.primary === "Create Contract" && canViewProposal ? (
            <Link to={`/admin/proposals/${proposal.id}`} className={`${adminPrimaryBtn} mt-4 justify-center sm:inline-flex`}>
              View Proposal
            </Link>
          ) : null}
        </div>
      )}

      {contract ? (
        <div className="mt-4 border-t border-[var(--admin-line)] pt-4">
          <p className="text-[12px] text-[var(--admin-muted)]">Contract</p>
          <Link className="mt-1 inline-flex text-sm font-medium text-[var(--admin-blue)] hover:underline" to={`/admin/contracts/${contract.id}`}>
            {contract.number}
          </Link>
          <p className="mt-1 text-sm text-[var(--admin-ink)]">{contract.title}</p>
          <div className="mt-2">
            <DocumentStatusBadge status={contract.effectiveStatus} />
          </div>
        </div>
      ) : null}
    </section>
  );
}
