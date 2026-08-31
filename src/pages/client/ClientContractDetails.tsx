import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ConfirmDocumentModal } from "@/components/documents/ConfirmDocumentModal";
import { ContractDocumentView } from "@/components/documents/ContractDocumentView";
import { DocumentStatusBadge } from "@/components/documents/DocumentStatusBadge";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import {
  contractSignedCopyFromRow,
  effectiveDocumentStatus,
  formatDocumentTimestamp,
} from "@/data/documents";
import {
  acceptContract,
  declineContract,
  downloadContractPdf,
  fetchContractDetail,
  fetchProposalDetail,
  markContractViewed,
  uploadClientSignedCopy,
  type ContractDetail,
  type ProposalDetail,
} from "@/data/documentsRepository";
import { signedCopyFileInputAccept } from "@/data/fileUploadConfig";
import { downloadProjectFile } from "@/data/fileStorage";
import { AgencyDbError } from "@/lib/dbErrors";

export function ClientContractDetails() {
  const { id } = useParams();
  const { clients, projects, notify } = useLeads();
  const [detail, setDetail] = useState<ContractDetail | null>(null);
  const [proposalDetail, setProposalDetail] = useState<ProposalDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const signedCopyInput = useRef<HTMLInputElement>(null);

  async function load() {
    if (!id) return;
    const next = await fetchContractDetail(id);
    setDetail(next);
    if (!next) {
      setProposalDetail(null);
      return;
    }
    if (next.contract.proposal_id) {
      const proposal = await fetchProposalDetail(next.contract.proposal_id).catch(() => null);
      setProposalDetail(proposal);
    } else {
      setProposalDetail(null);
    }
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
  const canUploadCopy = status === "sent" || status === "viewed" || status === "accepted";
  const signedCopy = contractSignedCopyFromRow(detail.contract);
  const project = projects.find((item) => item.id === detail.contract.project_id);
  const proposalSource = proposalDetail?.published ?? proposalDetail?.working;

  return (
    <div className="w-full space-y-6">
      <Link to="/client/contracts" className="text-[12px] font-medium text-[var(--client-blue)] hover:underline">
        Contracts
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <p className="font-heading text-sm font-semibold tracking-tight">{detail.contract.contract_number}</p>
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

      {canRespond ? (
        <section className="rounded-[var(--client-radius)] border border-[rgb(0_80_240_/_0.22)] bg-[rgb(0_80_240_/_0.06)] p-5">
          <p className="font-heading text-base font-semibold text-[var(--client-ink)]">Contract Ready for Review</p>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--client-muted)]">
            Review the agreement, download a PDF, and accept it in this portal. You can also upload a signed copy. Uploading a
            file does not accept the contract.
          </p>
        </section>
      ) : null}

      <ContractDocumentView
        tone="client"
        document={{
          number: detail.contract.contract_number,
          revisionNumber: revision.revision_number,
          companyName: clients[0]?.businessName ?? "your company",
          contactName: clients[0]?.contactName,
          projectName: project?.name,
          proposalNumber: proposalDetail?.proposal.proposal_number,
          investmentCents: proposalSource?.investment_cents,
          acceptedAt: revision.accepted_at,
          acceptedEmail: revision.accepted_email,
          agencySignedAt: revision.agency_signed_at,
          agencySignedName: revision.agency_signed_name,
          agencySignedEmail: revision.agency_signed_email,
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

      {canUploadCopy ? (
        <div className="space-y-3 rounded-[var(--client-radius)] border border-[var(--client-line)] bg-[var(--client-card)] p-5">
          <p className="font-heading text-sm font-semibold text-[var(--client-ink)]">Upload signed contract</p>
          <p className="text-sm leading-relaxed text-[var(--client-muted)]">
            Optional. A PDF or image of a signed copy is stored separately from portal acceptance. Uploading a file does not
            mark this contract as accepted.
          </p>
          {signedCopy ? (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm text-[var(--client-ink)]">
                Current file: {signedCopy.fileName}
                <span className="text-[var(--client-muted)]">
                  {" "}
                  · Uploaded {formatDocumentTimestamp(signedCopy.uploadedAt)}
                </span>
              </p>
              <button
                type="button"
                className={secondaryBtn}
                onClick={async () => {
                  try {
                    await downloadProjectFile(signedCopy.storagePath, signedCopy.fileName);
                  } catch (caught) {
                    notify(caught instanceof AgencyDbError ? caught.message : "Unable to download the signed copy.");
                  }
                }}
              >
                Download signed copy
              </button>
            </div>
          ) : (
            <p className="text-sm text-[var(--client-muted)]">No signed copy uploaded yet.</p>
          )}
          <input
            ref={signedCopyInput}
            type="file"
            accept={signedCopyFileInputAccept}
            className="hidden"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              setUploadBusy(true);
              try {
                await uploadClientSignedCopy(detail.contract.id, file);
                notify("Signed copy uploaded. The contract is not marked accepted until you accept it in the portal.");
                await load();
              } catch (caught) {
                notify(caught instanceof AgencyDbError ? caught.message : "Unable to upload the signed copy.");
              } finally {
                setUploadBusy(false);
              }
            }}
          />
          <button
            type="button"
            disabled={uploadBusy || busy}
            className={secondaryBtn}
            onClick={() => signedCopyInput.current?.click()}
          >
            {uploadBusy ? "Uploading…" : signedCopy ? "Replace signed copy" : "Upload signed copy"}
          </button>
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
