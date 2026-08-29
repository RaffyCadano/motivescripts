import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ConfirmDocumentModal } from "@/components/documents/ConfirmDocumentModal";
import { ContractDocumentView } from "@/components/documents/ContractDocumentView";
import { DocumentStatusBadge } from "@/components/documents/DocumentStatusBadge";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import { effectiveDocumentStatus } from "@/data/documents";
import {
  acceptContract,
  declineContract,
  downloadContractPdf,
  fetchContractDetail,
  markContractViewed,
  type ContractDetail,
} from "@/data/documentsRepository";
import { AgencyDbError } from "@/lib/dbErrors";

export function ClientContractDetails() {
  const { id } = useParams();
  const { clients, notify } = useLeads();
  const [detail, setDetail] = useState<ContractDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!id) return;
    const next = await fetchContractDetail(id);
    setDetail(next);
    if (!next) return;
    try {
      await markContractViewed(next.contract.id);
      const refreshed = await fetchContractDetail(id);
      if (refreshed) setDetail(refreshed);
    } catch {
      /* first-view tracking is best-effort and must not block reading */
    }
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    void load()
      .catch((caught) => setError(caught instanceof AgencyDbError ? caught.message : "Unable to load this contract."))
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
        <h1 className="font-heading text-2xl font-semibold">Contract not found</h1>
        <p className="mt-2 text-sm text-[var(--client-muted)]">{error ?? "This contract isn’t available for your account."}</p>
        <Link to="/client/contracts" className="mt-3 inline-flex text-sm font-semibold text-[var(--client-blue)]">
          Back to contracts
        </Link>
      </div>
    );
  }

  const revision = detail.published ?? detail.working;
  const status = effectiveDocumentStatus(revision.status, revision.expires_at);
  const canRespond = status === "sent" || status === "viewed";

  return (
    <div className="w-full space-y-6">
      <Link to="/client/contracts" className="text-[12px] font-medium text-[var(--client-blue)] hover:underline">
        Contracts
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-heading text-[1.75rem] font-semibold tracking-tight">{detail.contract.contract_number}</h1>
        <DocumentStatusBadge status={status} audience="client" />
        <button
          type="button"
          disabled={pdfBusy}
          className="inline-flex h-10 items-center rounded-[var(--client-radius)] border border-[var(--client-line)] bg-white px-4 font-heading text-sm font-semibold text-[var(--client-ink)] disabled:opacity-60"
          onClick={async () => {
            setPdfBusy(true);
            try {
              await downloadContractPdf(detail.contract.id);
            } catch (caught) {
              notify(caught instanceof AgencyDbError ? caught.message : "Unable to generate the contract PDF. Please try again.");
            } finally {
              setPdfBusy(false);
            }
          }}
        >
          {pdfBusy ? "Generating PDF..." : "Download PDF"}
        </button>
      </div>

      <ContractDocumentView
        tone="client"
        document={{
          number: detail.contract.contract_number,
          revisionNumber: revision.revision_number,
          companyName: clients[0]?.businessName ?? "your company",
          contactName: clients[0]?.contactName,
          acceptedAt: revision.accepted_at,
          acceptedEmail: revision.accepted_email,
          revision,
        }}
      />

      {canRespond ? (
        <div className="space-y-3 rounded-[var(--client-radius)] border border-[var(--client-line)] bg-[var(--client-card)] p-5">
          <label className="flex items-start gap-3 text-sm leading-relaxed">
            <input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} className="mt-1" />
            <span>I have reviewed and agree to this contract.</span>
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="button" disabled={busy || !agreed} className={primaryBtn} onClick={() => setAcceptOpen(true)}>
              Accept Contract
            </button>
            <button type="button" disabled={busy} className={secondaryBtn} onClick={() => setDeclineOpen(true)}>
              Decline
            </button>
            <button
              type="button"
              disabled={pdfBusy}
              className={secondaryBtn}
              onClick={async () => {
                setPdfBusy(true);
                try {
                  await downloadContractPdf(detail.contract.id);
                } catch (caught) {
                  notify(caught instanceof AgencyDbError ? caught.message : "Unable to generate the contract PDF. Please try again.");
                } finally {
                  setPdfBusy(false);
                }
              }}
            >
              {pdfBusy ? "Generating PDF..." : "Download PDF"}
            </button>
          </div>
        </div>
      ) : null}

      <ConfirmDocumentModal
        tone="client"
        open={acceptOpen}
        busy={busy}
        title="Accept this contract?"
        description="This records that your signed-in account agrees to the terms shown. It is not a qualified digital signature and does not collect payment."
        actionLabel="Accept Contract"
        onClose={() => setAcceptOpen(false)}
        onConfirm={async () => {
          setBusy(true);
          try {
            await acceptContract(detail.contract.id);
            notify("Contract accepted.");
            setAcceptOpen(false);
            await load();
          } catch (caught) {
            notify(caught instanceof AgencyDbError ? caught.message : "Unable to accept this contract.");
          } finally {
            setBusy(false);
          }
        }}
      />
      {declineOpen ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center p-4 sm:items-center">
          <button type="button" className="absolute inset-0 bg-[rgb(7_17_31_/_0.4)]" aria-label="Close" onClick={() => setDeclineOpen(false)} />
          <div className="relative w-full max-w-lg rounded-[var(--client-radius)] border border-[var(--client-line)] bg-white p-5">
            <h2 className="font-heading text-lg font-semibold">Decline contract</h2>
            <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={4} className="mt-4 w-full rounded-lg border border-[var(--client-line)] px-3 py-2 text-sm" placeholder="Optional reason" />
            <div className="mt-5 flex justify-end gap-2">
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
                    await declineContract(detail.contract.id, reason);
                    notify("Contract declined.");
                    setDeclineOpen(false);
                    await load();
                  } catch (caught) {
                    notify(caught instanceof AgencyDbError ? caught.message : "Unable to decline this contract.");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Decline
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
