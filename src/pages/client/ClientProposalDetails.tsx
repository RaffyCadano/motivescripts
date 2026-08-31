import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ConfirmDocumentModal } from "@/components/documents/ConfirmDocumentModal";
import { DocumentStatusBadge } from "@/components/documents/DocumentStatusBadge";
import { ProposalDocumentView } from "@/components/documents/ProposalDocumentView";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import { effectiveDocumentStatus, toSnapshotItems } from "@/data/documents";
import {
  acceptProposal,
  declineProposal,
  downloadProposalPdf,
  fetchProposalDetail,
  markProposalViewed,
  type ProposalDetail,
} from "@/data/documentsRepository";
import { AgencyDbError } from "@/lib/dbErrors";

export function ClientProposalDetails() {
  const { id } = useParams();
  const { clients, projects, notify } = useLeads();
  const [detail, setDetail] = useState<ProposalDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!id) return;
    const next = await fetchProposalDetail(id);
    setDetail(next);
    if (!next) return;
    try {
      await markProposalViewed(next.proposal.id);
      const refreshed = await fetchProposalDetail(id);
      if (refreshed) setDetail(refreshed);
    } catch {
      /* first-view tracking is best-effort and must not block reading */
    }
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    void load()
      .catch((caught) => setError(caught instanceof AgencyDbError ? caught.message : "Unable to load this proposal."))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) {
    return <div className="h-64 animate-pulse rounded-[var(--client-radius)] border border-[var(--client-line)] bg-[var(--client-card)]" />;
  }
  if (!detail) {
    return (
      <div>
        <h1 className="font-heading text-2xl font-semibold">Proposal not found</h1>
        <p className="mt-2 text-sm text-[var(--client-muted)]">{error ?? "This proposal isn’t available for your account."}</p>
        <Link to="/client/proposals" className="mt-3 inline-flex text-sm font-semibold text-[var(--client-blue)]">
          Back to proposals
        </Link>
      </div>
    );
  }

  const revision = detail.published ?? detail.working;
  const status = effectiveDocumentStatus(revision.status, revision.valid_until);
  const canRespond = status === "sent" || status === "viewed";
  const company = clients[0]?.businessName ?? "your company";
  const items = detail.snapshotItems.length > 0 ? detail.snapshotItems : toSnapshotItems(detail.items);

  return (
    <div className="w-full space-y-6">
      <Link to="/client/proposals" className="text-[12px] font-medium text-[var(--client-blue)] hover:underline">
        Proposals
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <p className="font-heading text-sm font-semibold tracking-tight">{detail.proposal.proposal_number}</p>
        <DocumentStatusBadge status={status} audience="client" />
        <button
          type="button"
          disabled={pdfBusy}
          className="inline-flex h-10 items-center rounded-[var(--client-radius)] border border-[var(--client-line)] bg-white px-4 font-heading text-sm font-semibold text-[var(--client-ink)] disabled:opacity-60"
          onClick={async () => {
            setPdfBusy(true);
            try {
              await downloadProposalPdf(detail.proposal.id);
            } catch (caught) {
              notify(caught instanceof AgencyDbError ? caught.message : "Unable to generate the proposal PDF. Please try again.");
            } finally {
              setPdfBusy(false);
            }
          }}
        >
          {pdfBusy ? "Generating PDF..." : "Download PDF"}
        </button>
      </div>
      {projects.find((item) => item.id === detail.proposal.project_id) ? (
        <p className="text-sm text-[var(--client-muted)]">{projects.find((item) => item.id === detail.proposal.project_id)?.name}</p>
      ) : null}

      <ProposalDocumentView
        tone="client"
        document={{
          number: detail.proposal.proposal_number,
          title: revision.title,
          revisionNumber: revision.revision_number,
          companyName: company,
          introduction: revision.introduction,
          overview: revision.overview,
          scope: revision.scope,
          deliverables: revision.deliverables_text,
          timeline: revision.timeline,
          paymentTerms: revision.payment_terms,
          terms: revision.terms,
          notes: revision.notes,
          validUntil: revision.valid_until,
          items,
          investmentCents: revision.investment_cents,
        }}
      />

      {canRespond ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" disabled={busy} className={primaryBtn} onClick={() => setAcceptOpen(true)}>
            Accept Proposal
          </button>
          <button type="button" disabled={busy} className={secondaryBtn} onClick={() => setDeclineOpen(true)}>
            Decline Proposal
          </button>
          <Link to="/client/messages" className={`${secondaryBtn} text-center`}>
            Discuss this proposal
          </Link>
          <button
            type="button"
            disabled={pdfBusy}
            className={secondaryBtn}
            onClick={async () => {
              setPdfBusy(true);
              try {
                await downloadProposalPdf(detail.proposal.id);
              } catch (caught) {
                notify(caught instanceof AgencyDbError ? caught.message : "Unable to generate the proposal PDF. Please try again.");
              } finally {
                setPdfBusy(false);
              }
            }}
          >
            {pdfBusy ? "Generating PDF..." : "Download PDF"}
          </button>
        </div>
      ) : null}

      <ConfirmDocumentModal
        tone="client"
        open={acceptOpen}
        busy={busy}
        title="Accept this proposal?"
        description="This confirms you agree to the scope and investment shown here. It does not charge a payment."
        actionLabel="Accept Proposal"
        onClose={() => setAcceptOpen(false)}
        onConfirm={async () => {
          setBusy(true);
          try {
            await acceptProposal(detail.proposal.id);
            notify("Proposal accepted.");
            setAcceptOpen(false);
            await load();
          } catch (caught) {
            notify(caught instanceof AgencyDbError ? caught.message : "Unable to accept this proposal.");
          } finally {
            setBusy(false);
          }
        }}
      />
      {declineOpen ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center p-4 sm:items-center">
          <button type="button" className="absolute inset-0 bg-[rgb(7_17_31_/_0.4)]" aria-label="Close" onClick={() => setDeclineOpen(false)} />
          <div className="relative w-full max-w-lg rounded-[var(--client-radius)] border border-[var(--client-line)] bg-white p-5">
            <h2 className="font-heading text-lg font-semibold">Decline proposal</h2>
            <p className="mt-2 text-sm text-[var(--client-muted)]">Optional reason for MotiveScripts.</p>
            <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={4} className="mt-4 w-full rounded-lg border border-[var(--client-line)] px-3 py-2 text-sm" />
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" className={secondaryBtn} onClick={() => setDeclineOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                className={primaryBtn}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await declineProposal(detail.proposal.id, reason);
                    notify("Proposal declined.");
                    setDeclineOpen(false);
                    await load();
                  } catch (caught) {
                    notify(caught instanceof AgencyDbError ? caught.message : "Unable to decline this proposal.");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Decline Proposal
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const primaryBtn =
  "inline-flex h-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--client-blue)] px-5 font-heading text-sm font-semibold text-white disabled:opacity-60";
const secondaryBtn =
  "inline-flex h-11 items-center justify-center rounded-[var(--radius-md)] border border-[var(--client-line)] bg-white px-5 font-heading text-sm font-semibold disabled:opacity-60";
