import { useEffect, useState } from "react";
import { Ban, Check, CopyPlus, Download, Eye, Receipt, RotateCcw, Save, Send, Trash2 } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { hasPermission } from "@/auth/permissions";
import { AdminActionsMenu, type AdminActionsMenuItem } from "@/components/admin/AdminActionsMenu";
import { adminGhostBtn, adminPrimaryBtn } from "@/components/admin/adminActionStyles";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import { ConfirmDocumentModal } from "@/components/documents/ConfirmDocumentModal";
import { ContractDocumentView } from "@/components/documents/ContractDocumentView";
import {
  ContractDraftForm,
  emptyContractDraft,
  type ContractDraftFormValue,
  type ContractProposalRef,
} from "@/components/documents/ContractDraftForm";
import { DocumentStatusBadge } from "@/components/documents/DocumentStatusBadge";
import { UnsavedChangesDialog, useUnsavedNavigation } from "@/components/documents/UnsavedChangesDialog";
import {
  calendarDateOrNull,
  calendarDateValue,
  contractIsAgencySigned,
  contractSignedCopyFromRow,
  contractWorkflowLabel,
  DEFAULT_CONTRACT_VALID_DAYS,
  defaultProposalValidUntil,
  documentMailRecipientCopy,
  documentMailRecipients,
  effectiveDocumentStatus,
  formatDocumentTimestamp,
} from "@/data/documents";
import {
  cancelContract,
  createContractRevision,
  deleteContract,
  restoreContract,
  downloadContractPdf,
  fetchContractDetail,
  fetchProposalDetail,
  saveContractDraft,
  sendContract,
  signContract,
  type ContractDetail,
  type ProposalDetail,
} from "@/data/documentsRepository";
import { downloadProjectFile } from "@/data/fileStorage";
import { fetchInvoiceSummaries, type InvoiceSummary } from "@/data/invoicesRepository";
import { formatUsdFromCents } from "@/data/money";
import { AgencyDbError } from "@/lib/dbErrors";

function formKey(value: ContractDraftFormValue) {
  return JSON.stringify(value);
}

function scrollToContractPreview() {
  const preview = document.getElementById("contract-preview");
  const scroller = document.getElementById("admin-main");
  if (!preview) return;
  const sideBySide = window.matchMedia("(min-width: 1280px)").matches;
  if (!sideBySide && scroller) {
    const previewRect = preview.getBoundingClientRect();
    const scrollerRect = scroller.getBoundingClientRect();
    const top = scroller.scrollTop + previewRect.top - scrollerRect.top - 12;
    scroller.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }
  preview.classList.add("ring-2", "ring-[var(--admin-blue)]", "ring-offset-2");
  window.setTimeout(() => {
    preview.classList.remove("ring-2", "ring-[var(--admin-blue)]", "ring-offset-2");
  }, 1400);
}

function proposalRefFromDetail(detail: ProposalDetail | null): ContractProposalRef | null {
  if (!detail) return null;
  const source = detail.published ?? detail.working;
  return {
    id: detail.proposal.id,
    number: detail.proposal.proposal_number,
    revisionNumber: source.revision_number,
    investmentCents: source.investment_cents,
  };
}

export function AdminContractDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { clients, projects, notify, reload, portalAccounts } = useLeads();
  const { profile } = useAuth();
  const canManage = hasPermission(profile, "contracts.manage");
  const [detail, setDetail] = useState<ContractDetail | null>(null);
  const [proposalDetail, setProposalDetail] = useState<ProposalDetail | null>(null);
  const [linkedInvoice, setLinkedInvoice] = useState<InvoiceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [signOpen, setSignOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [form, setForm] = useState<ContractDraftFormValue>(emptyContractDraft);
  const [baseline, setBaseline] = useState(formKey(emptyContractDraft()));
  const [allowLeave, setAllowLeave] = useState(false);
  const dirty = !allowLeave && !loading && formKey(form) !== baseline;
  const blocker = useUnsavedNavigation(dirty);

  async function load() {
    if (!id) return;
    const next = await fetchContractDetail(id);
    setDetail(next);
    if (!next) {
      setProposalDetail(null);
      setLinkedInvoice(null);
      return;
    }
    const [nextProposal, invoices] = await Promise.all([
      next.contract.proposal_id ? fetchProposalDetail(next.contract.proposal_id).catch(() => null) : Promise.resolve(null),
      fetchInvoiceSummaries(next.contract.client_id).catch(() => [] as InvoiceSummary[]),
    ]);
    setProposalDetail(nextProposal);
    setLinkedInvoice(
      invoices.find((row) => row.contractId === next.contract.id) ??
        (next.contract.project_id ? invoices.find((row) => row.projectId === next.contract.project_id) ?? null : null),
    );
    const nextForm: ContractDraftFormValue = {
      title: next.working.title,
      parties: next.working.parties,
      scope: next.working.scope,
      responsibilities: next.working.responsibilities,
      timeline: next.working.timeline,
      compensation: next.working.compensation,
      paymentTerms: next.working.payment_terms,
      confidentiality: next.working.confidentiality,
      intellectualProperty: next.working.intellectual_property,
      revisionsPolicy: next.working.revisions_policy,
      termination: next.working.termination,
      generalTerms: next.working.general_terms,
      effectiveDate: calendarDateValue(next.working.effective_date),
      expiresAt:
        calendarDateValue(next.working.expires_at) ||
        (next.working.status === "draft" ? defaultProposalValidUntil(undefined, DEFAULT_CONTRACT_VALID_DAYS) : ""),
      adminNotes: next.adminNotes,
    };
    setForm(nextForm);
    setBaseline(formKey(nextForm));
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    void load()
      .catch((error) => notify(error instanceof AgencyDbError ? error.message : "Unable to load this contract."))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) {
    return <div className="h-64 animate-pulse rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)]" />;
  }
  if (!detail) {
    return (
      <div>
        <h1 className="font-heading text-2xl font-semibold">Contract not found</h1>
        <Link to="/admin/contracts" className="mt-3 inline-flex text-sm font-semibold text-[var(--admin-blue)]">
          Back to contracts
        </Link>
      </div>
    );
  }

  const client = clients.find((item) => item.id === detail.contract.client_id);
  const project = projects.find((item) => item.id === detail.contract.project_id);
  const mailRecipients = documentMailRecipients(
    client?.email,
    portalAccounts
      .filter((account) => account.clientId === detail.contract.client_id)
      .map((account) => account.email),
  );
  const isDraft = detail.working.status === "draft";
  const status = effectiveDocumentStatus(detail.working.status, detail.working.expires_at);
  const publishedStatus = detail.published
    ? effectiveDocumentStatus(detail.published.status, detail.published.expires_at)
    : null;
  const accepted = status === "accepted" || publishedStatus === "accepted";
  const sentAwaiting = !isDraft && !accepted && status !== "cancelled" && status !== "declined";
  const agencySigned = contractIsAgencySigned(detail.working);
  const signedCopy = contractSignedCopyFromRow(detail.contract);
  const canSend = isDraft && agencySigned && canManage && !busy;
  const workflow = contractWorkflowLabel({
    status,
    agencySigned,
    signedCopyUploaded: Boolean(signedCopy),
  });
  const representativeName = profile?.fullName.trim() || profile?.email || "Authorized representative";
  const proposal = proposalRefFromDetail(proposalDetail);
  const createInvoiceHref = `/admin/invoices/new?client=${detail.contract.client_id}&contract=${detail.contract.id}${detail.contract.project_id ? `&project=${detail.contract.project_id}` : ""}`;
  const invoiceHref = linkedInvoice ? `/admin/invoices/${linkedInvoice.id}` : createInvoiceHref;
  const invoiceLabel = linkedInvoice ? "Open Invoice" : "Create Invoice";
  const preview = {
    title: form.title,
    parties: form.parties,
    scope: form.scope,
    responsibilities: form.responsibilities,
    timeline: form.timeline,
    compensation: form.compensation,
    payment_terms: form.paymentTerms,
    confidentiality: form.confidentiality,
    intellectual_property: form.intellectualProperty,
    revisions_policy: form.revisionsPolicy,
    termination: form.termination,
    general_terms: form.generalTerms,
    effective_date: calendarDateOrNull(form.effectiveDate),
    expires_at: calendarDateOrNull(form.expiresAt),
  };
  const current = detail;

  const contractActions: AdminActionsMenuItem[] = [
    {
      id: "pdf",
      label: pdfBusy ? "Generating PDF..." : "Download PDF",
      icon: Download,
      disabled: busy || pdfBusy,
      onSelect: async () => {
        setPdfBusy(true);
        try {
          await downloadContractPdf(current.contract.id);
        } catch (error) {
          notify(error instanceof AgencyDbError ? error.message : "Unable to generate the contract PDF. Please try again.");
        } finally {
          setPdfBusy(false);
        }
      },
    },
  ];
  if (signedCopy) {
    contractActions.push({
      id: "signed-copy",
      label: "Download signed copy",
      icon: Download,
      disabled: busy,
      onSelect: async () => {
        try {
          await downloadProjectFile(signedCopy.storagePath, signedCopy.fileName);
        } catch (error) {
          notify(error instanceof AgencyDbError ? error.message : "Unable to download the signed copy.");
        }
      },
    });
  }
  if (!isDraft && status !== "accepted" && status !== "cancelled") {
    contractActions.push({
      id: "revision",
      label: "New revision",
      icon: CopyPlus,
      disabled: busy,
      onSelect: async () => {
        setBusy(true);
        try {
          await createContractRevision(current.contract.id);
          notify("New revision created.");
          await load();
        } catch (error) {
          notify(error instanceof AgencyDbError ? error.message : "Unable to create a revision.");
        } finally {
          setBusy(false);
        }
      },
    });
  }
  if (publishedStatus === "accepted") {
    contractActions.push({
      id: "create-invoice",
      label: "Create Invoice",
      icon: Receipt,
      href: createInvoiceHref,
    });
  }
  if (status !== "accepted" && status !== "cancelled") {
    contractActions.push({
      id: "cancel",
      label: "Cancel contract",
      icon: Ban,
      disabled: busy,
      danger: true,
      separatorBefore: true,
      onSelect: () => setCancelOpen(true),
    });
  }
  if (status === "cancelled") {
    contractActions.push({
      id: "restore",
      label: "Restore",
      icon: RotateCcw,
      disabled: busy,
      onSelect: () => setRestoreOpen(true),
    });
  }
  if (status !== "accepted" && publishedStatus !== "accepted" && !detail.acceptedOnce) {
    contractActions.push({
      id: "delete",
      label: "Delete contract",
      icon: Trash2,
      disabled: busy,
      danger: true,
      separatorBefore: status === "cancelled",
      onSelect: () => setDeleteOpen(true),
    });
  }

  async function persist() {
    if (!isDraft) return;
    await saveContractDraft({
      revisionId: current.working.id,
      ...form,
      effectiveDate: calendarDateOrNull(form.effectiveDate),
      expiresAt: calendarDateOrNull(form.expiresAt) || defaultProposalValidUntil(undefined, DEFAULT_CONTRACT_VALID_DAYS),
    });
  }

  async function onSave() {
    setBusy(true);
    const willClearSignature = isDraft && agencySigned && dirty;
    try {
      await persist();
      notify(
        willClearSignature
          ? "Contract saved. Agency signature was cleared because the agreement changed."
          : "Contract saved.",
      );
      await load();
      await reload();
    } catch (error) {
      notify(error instanceof AgencyDbError ? error.message : "Unable to save this contract.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Link to="/admin/contracts" className="text-[12px] font-medium text-[var(--admin-blue)] hover:underline">
        Contracts
      </Link>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-heading text-[1.65rem] font-semibold tracking-tight">{detail.contract.contract_number}</h1>
            <DocumentStatusBadge status={status} />
            <span className="font-heading text-sm font-semibold text-[var(--admin-muted)]">{workflow}</span>
            {accepted ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-[rgb(16_185_129_/_0.12)] px-2.5 py-1 font-heading text-[12px] font-semibold text-emerald-800">
                <Check className="h-3.5 w-3.5" />
                Contract Accepted
              </span>
            ) : isDraft ? (
              <span className="font-heading text-sm font-semibold text-[var(--admin-muted)]">Contract Draft</span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-[var(--admin-muted)]">
            {client?.businessName ?? "Client"}
            {project ? ` · ${project.name}` : ""}
            {` · Revision ${detail.working.revision_number}`}
          </p>
          {proposal ? (
            <p className="mt-1 text-sm text-[var(--admin-muted)]">
              Based on accepted proposal{" "}
              <Link className="font-medium text-[var(--admin-blue)] hover:underline" to={`/admin/proposals/${proposal.id}`}>
                {proposal.number}
              </Link>
              {proposal.investmentCents ? ` · ${formatUsdFromCents(proposal.investmentCents)}` : ""}
            </p>
          ) : detail.contract.proposal_id ? (
            <p className="mt-1 text-sm text-[var(--admin-muted)]">
              <Link className="text-[var(--admin-blue)] hover:underline" to={`/admin/proposals/${detail.contract.proposal_id}`}>
                Related proposal
              </Link>
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isDraft ? (
            <>
              <button type="button" disabled={busy} className={adminGhostBtn} onClick={() => void onSave()}>
                <Save className="mr-2 h-4 w-4" />
                {busy ? "Saving…" : "Save Draft"}
              </button>
              <button type="button" className={adminGhostBtn} onClick={scrollToContractPreview}>
                <Eye className="mr-2 h-4 w-4" />
                Preview
              </button>
              <button
                type="button"
                disabled={!canSend}
                title={agencySigned ? undefined : "Agency signature required before sending."}
                className={adminPrimaryBtn}
                onClick={() => {
                  if (!canSend) return;
                  setSendOpen(true);
                }}
              >
                <Send className="mr-2 h-4 w-4" />
                Send Contract
              </button>
            </>
          ) : accepted ? (
            <Link to={invoiceHref} className={adminPrimaryBtn}>
              <Receipt className="mr-2 h-4 w-4" />
              {invoiceLabel}
            </Link>
          ) : status !== "cancelled" ? (
            <button type="button" className={adminGhostBtn} onClick={scrollToContractPreview}>
              <Eye className="mr-2 h-4 w-4" />
              View Contract
            </button>
          ) : null}
          <AdminActionsMenu ariaLabel="Contract actions" iconOnly items={contractActions} />
        </div>
      </div>

      {isDraft ? (
        <section className="rounded-[var(--admin-radius)] border border-[rgb(0_80_240_/_0.22)] bg-[rgb(0_80_240_/_0.04)] p-5">
          {agencySigned ? (
            <>
              <p className="inline-flex items-center gap-1.5 font-heading text-base font-semibold text-emerald-800">
                <Check className="h-4 w-4" />
                Agency Signature ✓
              </p>
              <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-[12px] text-[var(--admin-muted)]">Agency</dt>
                  <dd className="mt-1 text-sm font-medium text-[var(--admin-ink)]">MotiveScripts</dd>
                </div>
                <div>
                  <dt className="text-[12px] text-[var(--admin-muted)]">Authorized representative</dt>
                  <dd className="mt-1 text-sm font-medium text-[var(--admin-ink)]">
                    {detail.working.agency_signed_name || representativeName}
                  </dd>
                </div>
                <div>
                  <dt className="text-[12px] text-[var(--admin-muted)]">Signed</dt>
                  <dd className="mt-1 text-sm font-medium text-[var(--admin-ink)]">
                    {formatDocumentTimestamp(detail.working.agency_signed_at)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[12px] text-[var(--admin-muted)]">Signature status</dt>
                  <dd className="mt-1 text-sm font-semibold text-emerald-800">Signed</dd>
                </div>
              </dl>
              <p className="mt-4 text-sm font-semibold text-emerald-800">Agency signed ✓ — Ready to send to client.</p>
              <button
                type="button"
                disabled={!canSend}
                className={`${adminPrimaryBtn} mt-4`}
                onClick={() => setSendOpen(true)}
              >
                <Send className="mr-2 h-4 w-4" />
                Send Contract
              </button>
            </>
          ) : (
            <>
              <p className="font-heading text-base font-semibold text-[var(--admin-ink)]">Agency Signature</p>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--admin-muted)]">
                This contract must be signed by an authorized MotiveScripts representative before it can be sent to the
                client.
              </p>
              <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-[12px] text-[var(--admin-muted)]">Agency</dt>
                  <dd className="mt-1 text-sm font-medium text-[var(--admin-ink)]">MotiveScripts</dd>
                </div>
                <div>
                  <dt className="text-[12px] text-[var(--admin-muted)]">Authorized representative</dt>
                  <dd className="mt-1 text-sm font-medium text-[var(--admin-ink)]">{representativeName}</dd>
                </div>
                <div>
                  <dt className="text-[12px] text-[var(--admin-muted)]">Signature status</dt>
                  <dd className="mt-1 text-sm font-semibold text-[var(--admin-ink)]">Not signed</dd>
                </div>
              </dl>
              <p className="mt-4 text-sm text-[var(--admin-muted)]">Agency signature required before sending.</p>
              {canManage ? (
                <button
                  type="button"
                  disabled={busy}
                  className={`${adminPrimaryBtn} mt-4`}
                  onClick={() => setSignOpen(true)}
                >
                  Sign Contract
                </button>
              ) : (
                <p className="mt-3 text-sm text-[var(--admin-muted)]">
                  You can view this contract, but only an authorized MotiveScripts representative can sign it.
                </p>
              )}
            </>
          )}
        </section>
      ) : agencySigned ? (
        <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
          <p className="inline-flex items-center gap-1.5 font-heading text-base font-semibold text-emerald-800">
            <Check className="h-4 w-4" />
            Agency Signature ✓
          </p>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-[12px] text-[var(--admin-muted)]">Agency</dt>
              <dd className="mt-1 text-sm font-medium text-[var(--admin-ink)]">MotiveScripts</dd>
            </div>
            <div>
              <dt className="text-[12px] text-[var(--admin-muted)]">Authorized representative</dt>
              <dd className="mt-1 text-sm font-medium text-[var(--admin-ink)]">
                {detail.working.agency_signed_name || "Authorized representative"}
              </dd>
            </div>
            <div>
              <dt className="text-[12px] text-[var(--admin-muted)]">Signed</dt>
              <dd className="mt-1 text-sm font-medium text-[var(--admin-ink)]">
                {formatDocumentTimestamp(detail.working.agency_signed_at)}
              </dd>
            </div>
            <div>
              <dt className="text-[12px] text-[var(--admin-muted)]">Signature status</dt>
              <dd className="mt-1 text-sm font-semibold text-emerald-800">Signed</dd>
            </div>
          </dl>
        </section>
      ) : null}

      {sentAwaiting ? (
        <section className="rounded-[var(--admin-radius)] border border-[rgb(0_80_240_/_0.22)] bg-[rgb(0_80_240_/_0.04)] p-5">
          <p className="font-heading text-base font-semibold text-[var(--admin-ink)]">Contract Sent</p>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--admin-muted)]">
            Waiting for the client to review and accept the agreement.
          </p>
          <button type="button" className={`${adminPrimaryBtn} mt-4`} onClick={scrollToContractPreview}>
            <Eye className="mr-2 h-4 w-4" />
            View Contract
          </button>
        </section>
      ) : null}

      {accepted && !isDraft ? (
        <section className="rounded-[var(--admin-radius)] border border-[rgb(16_185_129_/_0.35)] bg-[rgb(16_185_129_/_0.06)] p-5">
          <p className="inline-flex items-center gap-1.5 font-heading text-base font-semibold text-emerald-800">
            <Check className="h-4 w-4" />
            Contract Accepted ✓
          </p>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--admin-muted)]">
            {linkedInvoice
              ? "The client has accepted the contract. An invoice is already linked — open it to continue."
              : "The client has accepted the contract. The next step is to create the invoice."}
          </p>
          <p className="mt-2 text-sm font-semibold text-[var(--admin-ink)]">
            Next step: {linkedInvoice ? "Open Invoice" : "Create Invoice"}
          </p>
          <Link to={invoiceHref} className={`${adminPrimaryBtn} mt-4`}>
            <Receipt className="mr-2 h-4 w-4" />
            {invoiceLabel}
          </Link>
        </section>
      ) : null}

      {detail.published || signedCopy ? (
        <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
          <p className="font-heading text-base font-semibold text-[var(--admin-ink)]">Client signed document</p>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--admin-muted)]">
            An uploaded PDF or image is optional and is not the same as portal acceptance.
          </p>
          {signedCopy ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-[var(--admin-ink)]">{signedCopy.fileName}</p>
                <p className="mt-1 text-[12px] text-[var(--admin-muted)]">
                  Uploaded {formatDocumentTimestamp(signedCopy.uploadedAt)}
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                className={adminGhostBtn}
                onClick={async () => {
                  try {
                    await downloadProjectFile(signedCopy.storagePath, signedCopy.fileName);
                  } catch (error) {
                    notify(error instanceof AgencyDbError ? error.message : "Unable to download the signed copy.");
                  }
                }}
              >
                <Download className="mr-2 h-4 w-4" />
                Download signed copy
              </button>
            </div>
          ) : (
            <p className="mt-3 text-sm text-[var(--admin-muted)]">No signed copy uploaded yet.</p>
          )}
        </section>
      ) : null}

      {proposal || client ? (
        <section className="space-y-3 rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
          <h2 className="font-heading text-sm font-semibold text-[var(--admin-ink)]">Contract Setup</h2>
          {proposal ? (
            <p className="text-sm leading-6 text-[var(--admin-muted)]">
              This contract is based on the accepted proposal. Scope, investment, and project details are carried
              forward so the agreement stays connected to the approved proposal.
            </p>
          ) : null}
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-[12px] text-[var(--admin-muted)]">Client</dt>
              <dd className="mt-1 text-sm font-medium text-[var(--admin-ink)]">{client?.businessName ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-[12px] text-[var(--admin-muted)]">Project</dt>
              <dd className="mt-1 text-sm font-medium text-[var(--admin-ink)]">{project?.name ?? "No project linked"}</dd>
            </div>
            {proposal ? (
              <>
                <div>
                  <dt className="text-[12px] text-[var(--admin-muted)]">Based on accepted proposal</dt>
                  <dd className="mt-1 text-sm font-medium text-[var(--admin-ink)]">
                    {proposal.number} · Revision {proposal.revisionNumber}
                  </dd>
                </div>
                <div>
                  <dt className="text-[12px] text-[var(--admin-muted)]">Investment</dt>
                  <dd className="mt-1 text-sm font-medium text-[var(--admin-ink)]">
                    {formatUsdFromCents(proposal.investmentCents)}
                  </dd>
                </div>
              </>
            ) : null}
          </dl>
        </section>
      ) : null}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <div className="space-y-3">
          {isDraft && agencySigned ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-900">
              Saving edits will clear the agency signature. Sign again before sending.
            </p>
          ) : null}
          <ContractDraftForm value={form} disabled={!isDraft} proposal={proposal} onChange={setForm} />
        </div>
        <div id="contract-preview" className="rounded-[var(--admin-radius)] transition-shadow xl:sticky xl:top-4">
          <p className="mb-3 font-heading text-sm font-semibold text-[var(--admin-ink)]">Client preview</p>
          <p className="mb-4 text-[12px] leading-5 text-[var(--admin-muted)]">
            This is what the client sees. Internal notes and editing controls are not included.
          </p>
          <ContractDocumentView
            document={{
              number: detail.contract.contract_number,
              revisionNumber: detail.working.revision_number,
              companyName: client?.businessName ?? "Client",
              contactName: client?.contactName,
              projectName: project?.name,
              proposalNumber: proposal?.number,
              investmentCents: proposal?.investmentCents,
              acceptedAt: detail.working.accepted_at,
              acceptedEmail: detail.working.accepted_email,
              agencySignedAt: detail.working.agency_signed_at,
              agencySignedName: detail.working.agency_signed_name,
              agencySignedEmail: detail.working.agency_signed_email,
              revision: preview,
            }}
          />
        </div>
      </div>

      <ConfirmDocumentModal
        open={signOpen}
        busy={busy}
        title="Sign this contract as MotiveScripts?"
        description={`This records that ${representativeName} approved the current draft. The contract still cannot be sent until you choose Send Contract. Saving later edits will clear this signature.`}
        actionLabel="Sign Contract"
        onClose={() => setSignOpen(false)}
        onConfirm={async () => {
          setBusy(true);
          try {
            await persist();
            await signContract(current.contract.id);
            notify("Contract signed by MotiveScripts.");
            setSignOpen(false);
            await load();
            await reload();
          } catch (error) {
            notify(error instanceof AgencyDbError ? error.message : "Unable to sign this contract.");
          } finally {
            setBusy(false);
          }
        }}
      />
      <ConfirmDocumentModal
        open={sendOpen}
        busy={busy}
        title="Send this contract to the client?"
        description={`${documentMailRecipientCopy(mailRecipients, { companyName: client?.businessName, action: "send" })} They’ll review this revision in the client portal and can accept it electronically. This is not a qualified digital signature.`}
        actionLabel="Send Contract"
        onClose={() => setSendOpen(false)}
        onConfirm={async () => {
          if (!agencySigned) {
            notify("Agency signature required before sending.");
            return;
          }
          setBusy(true);
          try {
            await persist();
            const latest = await fetchContractDetail(current.contract.id);
            if (!contractIsAgencySigned(latest?.working)) {
              notify("Agency signature required before sending.");
              setSendOpen(false);
              await load();
              return;
            }
            const result = await sendContract(current.contract.id);
            notify(result.emailed ? "Contract sent." : "Contract sent. The email could not be delivered.");
            setSendOpen(false);
            await load();
            await reload();
          } catch (error) {
            notify(error instanceof AgencyDbError ? error.message : "Unable to send this contract.");
          } finally {
            setBusy(false);
          }
        }}
      />
      <ConfirmDocumentModal
        open={cancelOpen}
        busy={busy}
        danger
        title="Cancel this contract?"
        description="The client will no longer be able to review or accept it. You can restore it later if this was a mistake."
        actionLabel="Cancel contract"
        onClose={() => setCancelOpen(false)}
        onConfirm={async () => {
          setBusy(true);
          try {
            await cancelContract(current.contract.id);
            notify("Contract cancelled.");
            setCancelOpen(false);
            await load();
          } catch (error) {
            notify(error instanceof AgencyDbError ? error.message : "Unable to cancel this contract.");
          } finally {
            setBusy(false);
          }
        }}
      />
      <ConfirmDocumentModal
        open={restoreOpen}
        busy={busy}
        title="Restore this contract?"
        description="It will leave Cancelled and go back to draft or sent, depending on where it was before you cancelled it."
        actionLabel="Restore contract"
        onClose={() => setRestoreOpen(false)}
        onConfirm={async () => {
          setBusy(true);
          try {
            await restoreContract(current.contract.id);
            notify("Contract restored.");
            setRestoreOpen(false);
            await load();
            await reload();
          } catch (error) {
            notify(error instanceof AgencyDbError ? error.message : "Unable to restore this contract.");
          } finally {
            setBusy(false);
          }
        }}
      />
      <ConfirmDocumentModal
        open={deleteOpen}
        busy={busy}
        danger
        title="Delete this contract?"
        description="This permanently removes the contract and its revisions. This cannot be undone."
        actionLabel="Delete contract"
        onClose={() => setDeleteOpen(false)}
        onConfirm={async () => {
          setBusy(true);
          try {
            await deleteContract(current.contract.id);
            notify("Contract deleted.");
            setDeleteOpen(false);
            setAllowLeave(true);
            await reload();
            navigate("/admin/contracts");
          } catch (error) {
            notify(error instanceof AgencyDbError ? error.message : "Unable to delete this contract.");
            setBusy(false);
          }
        }}
      />
      <UnsavedChangesDialog
        open={blocker.state === "blocked"}
        busy={busy}
        description="You have unsaved contract edits. Keep your changes, keep editing, or leave without saving."
        onKeepEditing={() => blocker.reset?.()}
        onDiscard={() => blocker.proceed?.()}
        onKeepChanges={async () => {
          if (busy) return;
          setBusy(true);
          try {
            await persist();
            setBaseline(formKey(form));
            notify("Contract saved.");
            blocker.proceed?.();
          } catch (error) {
            notify(error instanceof AgencyDbError ? error.message : "Unable to save this contract.");
            setBusy(false);
          }
        }}
      />
    </div>
  );
}
