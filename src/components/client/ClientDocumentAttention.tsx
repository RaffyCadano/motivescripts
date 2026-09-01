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

type Banner = {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  href: string;
  label: string;
};

export function ClientDocumentAttention() {
  const [banner, setBanner] = useState<Banner | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.all([
      fetchClientProposalSummaries(),
      fetchClientContractSummaries(),
      fetchClientInvoiceSummaries(),
    ]).then(([proposals, contracts, invoices]) => {
      if (!active) return;
      const proposal = proposals.find((row) => awaitingResponse(row.effectiveStatus));
      const contract = contracts.find((row) => awaitingResponse(row.effectiveStatus));
      const invoice = invoices.find(
        (row) => awaitingInvoicePayment(row.effectiveStatus) && row.amountDueCents > 0,
      );
      setBanner(bannerFromDocuments(proposal, contract, invoice));
    });
    return () => {
      active = false;
    };
  }, []);

  if (!banner) return null;

  return (
    <section className="rounded-[var(--client-radius)] border border-[rgb(0_80_240_/_0.22)] bg-[var(--client-card)] p-5 md:p-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--client-muted)]">{banner.eyebrow}</p>
      <h2 className="mt-1 font-heading text-lg font-semibold tracking-tight text-[var(--client-ink)]">{banner.title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-[var(--client-muted)]">{banner.body}</p>
      <Link
        to={banner.href}
        className="mt-5 inline-flex h-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--client-blue)] px-5 font-heading text-sm font-semibold text-white hover:bg-[var(--client-bright)]"
      >
        {banner.label}
      </Link>
    </section>
  );
}

function bannerFromDocuments(
  proposal: ProposalSummary | undefined,
  contract: ContractSummary | undefined,
  invoice: InvoiceSummary | undefined,
): Banner | null {
  if (proposal) {
    return {
      id: proposal.id,
      eyebrow: "Proposal ready for review",
      title: "Review your proposal",
      body: `${proposal.number} is ready. Review the scope, investment, timeline, and terms before accepting or declining.`,
      href: `/client/proposals/${proposal.id}`,
      label: "Review Proposal",
    };
  }
  if (contract) {
    return {
      id: contract.id,
      eyebrow: "Contract ready for review",
      title: "Review your contract",
      body: `${contract.number} is ready. Review your website agreement, then accept or decline.`,
      href: `/client/contracts/${contract.id}`,
      label: "Review Contract",
    };
  }
  if (invoice) {
    return {
      id: invoice.id,
      eyebrow: "Invoice ready for payment",
      title: "Pay your invoice",
      body: `${invoice.number} is ready for payment.`,
      href: `/client/invoices/${invoice.id}`,
      label: "View & Pay Invoice",
    };
  }
  return null;
}
