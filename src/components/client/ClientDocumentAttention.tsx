import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { awaitingResponse } from "@/data/documents";
import {
  fetchClientContractSummaries,
  fetchClientProposalSummaries,
  type ContractSummary,
  type ProposalSummary,
} from "@/data/documentsRepository";
import { awaitingInvoicePayment } from "@/data/invoices";
import { fetchClientInvoiceSummaries, type InvoiceSummary } from "@/data/invoicesRepository";
import { formatMoneyFromCents } from "@/data/money";

export function ClientDocumentAttention() {
  const [proposal, setProposal] = useState<ProposalSummary | null>(null);
  const [contract, setContract] = useState<ContractSummary | null>(null);
  const [invoice, setInvoice] = useState<InvoiceSummary | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.all([
      fetchClientProposalSummaries(),
      fetchClientContractSummaries(),
      fetchClientInvoiceSummaries(),
    ]).then(([proposals, contracts, invoices]) => {
      if (!active) return;
      setProposal(proposals.find((row) => awaitingResponse(row.effectiveStatus)) ?? null);
      setContract(contracts.find((row) => awaitingResponse(row.effectiveStatus)) ?? null);
      setInvoice(
        invoices.find((row) => awaitingInvoicePayment(row.effectiveStatus) && row.amountDueCents > 0) ?? null,
      );
    });
    return () => {
      active = false;
    };
  }, []);

  if (!proposal && !contract && !invoice) return null;

  return (
    <div className="space-y-3">
      {proposal ? (
        <p className="rounded-[var(--client-radius)] border border-[rgb(0_80_240_/_0.22)] bg-[var(--client-card)] px-4 py-3 text-sm text-[var(--client-ink)]">
          A proposal is awaiting your review ({proposal.number}).{" "}
          <Link to={`/client/proposals/${proposal.id}`} className="font-heading font-semibold text-[var(--client-blue)] hover:underline">
            Review proposal
          </Link>
        </p>
      ) : null}
      {contract ? (
        <p className="rounded-[var(--client-radius)] border border-[rgb(0_80_240_/_0.22)] bg-[var(--client-card)] px-4 py-3 text-sm text-[var(--client-ink)]">
          A contract is awaiting your acceptance ({contract.number}).{" "}
          <Link to={`/client/contracts/${contract.id}`} className="font-heading font-semibold text-[var(--client-blue)] hover:underline">
            Review contract
          </Link>
        </p>
      ) : null}
      {invoice ? (
        <p className="rounded-[var(--client-radius)] border border-[rgb(0_80_240_/_0.22)] bg-[var(--client-card)] px-4 py-3 text-sm text-[var(--client-ink)]">
          {invoice.effectiveStatus === "overdue"
            ? `Invoice ${invoice.number} is past due (${formatMoneyFromCents(invoice.amountDueCents, invoice.currency)}). `
            : `Invoice ${invoice.number} has ${formatMoneyFromCents(invoice.amountDueCents, invoice.currency)} due. `}
          <Link to={`/client/invoices/${invoice.id}`} className="font-heading font-semibold text-[var(--client-blue)] hover:underline">
            View invoice
          </Link>
        </p>
      ) : null}
    </div>
  );
}
