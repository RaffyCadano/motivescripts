import { useEffect, useState } from "react";
import { Ban, CopyPlus, Download, Receipt, RotateCcw, Save, Send, Trash2 } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AdminActionsMenu, type AdminActionsMenuItem } from "@/components/admin/AdminActionsMenu";
import { ConfirmDocumentModal } from "@/components/documents/ConfirmDocumentModal";
import { ContractDocumentView } from "@/components/documents/ContractDocumentView";
import { DocumentStatusBadge } from "@/components/documents/DocumentStatusBadge";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import { effectiveDocumentStatus } from "@/data/documents";
import {
  cancelContract,
  createContractRevision,
  deleteContract,
  restoreContract,
  downloadContractPdf,
  fetchContractDetail,
  saveContractDraft,
  sendContract,
  type ContractDetail,
} from "@/data/documentsRepository";
import { AgencyDbError } from "@/lib/dbErrors";

const fieldClass =
  "mt-1.5 w-full rounded-lg border border-[var(--admin-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[rgb(0_80_240_/_0.45)] disabled:bg-[var(--admin-bg)]";

export function AdminContractDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { clients, projects, notify, reload } = useLeads();
  const [detail, setDetail] = useState<ContractDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    parties: "",
    scope: "",
    responsibilities: "",
    timeline: "",
    compensation: "",
    paymentTerms: "",
    confidentiality: "",
    intellectualProperty: "",
    revisionsPolicy: "",
    termination: "",
    generalTerms: "",
    effectiveDate: "",
    expiresAt: "",
    adminNotes: "",
  });

  async function load() {
    if (!id) return;
    const next = await fetchContractDetail(id);
    setDetail(next);
    if (next) {
      setForm({
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
        effectiveDate: next.working.effective_date ?? "",
        expiresAt: next.working.expires_at ?? "",
        adminNotes: next.adminNotes,
      });
    }
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
  const isDraft = detail.working.status === "draft";
  const status = effectiveDocumentStatus(detail.working.status, detail.working.expires_at);
  const publishedStatus = detail.published
    ? effectiveDocumentStatus(detail.published.status, detail.published.expires_at)
    : null;
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
    effective_date: form.effectiveDate || null,
    expires_at: form.expiresAt || null,
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
  if (isDraft) {
    contractActions.push(
      {
        id: "save",
        label: busy ? "Saving…" : "Save draft",
        icon: Save,
        disabled: busy,
        onSelect: async () => {
          setBusy(true);
          try {
            await persist();
            notify("Contract saved.");
            await load();
            await reload();
          } catch (error) {
            notify(error instanceof AgencyDbError ? error.message : "Unable to save this contract.");
          } finally {
            setBusy(false);
          }
        },
      },
      { id: "send", label: "Send Contract", icon: Send, disabled: busy, onSelect: () => setSendOpen(true) },
    );
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
      href: `/admin/invoices/new?client=${detail.contract.client_id}&contract=${detail.contract.id}${detail.contract.project_id ? `&project=${detail.contract.project_id}` : ""}`,
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
      effectiveDate: form.effectiveDate || null,
      expiresAt: form.expiresAt || null,
    });
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
          </div>
          <p className="mt-1 text-sm text-[var(--admin-muted)]">
            {client?.businessName ?? "Client"} · Revision {detail.working.revision_number}
            {project ? ` · ${project.name}` : ""}
            {detail.contract.proposal_id ? (
              <>
                {" "}
                ·{" "}
                <Link className="text-[var(--admin-blue)] hover:underline" to={`/admin/proposals/${detail.contract.proposal_id}`}>
                  Related proposal
                </Link>
              </>
            ) : null}
          </p>
        </div>
        <AdminActionsMenu ariaLabel="Contract actions" items={contractActions} />
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <form className="space-y-4 rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
          <p className="text-[12px] text-[var(--admin-muted)]">
            Starting copy is a template for workflow only. Edit it before sending. This is not legal advice.
          </p>
          <Field label="Title" value={form.title} disabled={!isDraft} onChange={(value) => setForm({ ...form, title: value })} />
          <Area label="Parties" value={form.parties} disabled={!isDraft} onChange={(value) => setForm({ ...form, parties: value })} />
          <Area label="Scope" value={form.scope} disabled={!isDraft} onChange={(value) => setForm({ ...form, scope: value })} />
          <Area label="Responsibilities" value={form.responsibilities} disabled={!isDraft} onChange={(value) => setForm({ ...form, responsibilities: value })} />
          <Area label="Timeline" value={form.timeline} disabled={!isDraft} onChange={(value) => setForm({ ...form, timeline: value })} />
          <Area label="Compensation" value={form.compensation} disabled={!isDraft} onChange={(value) => setForm({ ...form, compensation: value })} />
          <Area label="Payment terms" value={form.paymentTerms} disabled={!isDraft} onChange={(value) => setForm({ ...form, paymentTerms: value })} />
          <Area label="Confidentiality" value={form.confidentiality} disabled={!isDraft} onChange={(value) => setForm({ ...form, confidentiality: value })} />
          <Area label="Intellectual property" value={form.intellectualProperty} disabled={!isDraft} onChange={(value) => setForm({ ...form, intellectualProperty: value })} />
          <Area label="Revisions" value={form.revisionsPolicy} disabled={!isDraft} onChange={(value) => setForm({ ...form, revisionsPolicy: value })} />
          <Area label="Termination" value={form.termination} disabled={!isDraft} onChange={(value) => setForm({ ...form, termination: value })} />
          <Area label="General terms" value={form.generalTerms} disabled={!isDraft} onChange={(value) => setForm({ ...form, generalTerms: value })} />
          <label className="block text-sm font-semibold">
            Effective date
            <input type="date" disabled={!isDraft} value={form.effectiveDate} onChange={(event) => setForm({ ...form, effectiveDate: event.target.value })} className={fieldClass} />
          </label>
          <label className="block text-sm font-semibold">
            Expires
            <input type="date" disabled={!isDraft} value={form.expiresAt} onChange={(event) => setForm({ ...form, expiresAt: event.target.value })} className={fieldClass} />
          </label>
          <Area label="Internal notes (not shown to the client)" value={form.adminNotes} disabled={!isDraft} onChange={(value) => setForm({ ...form, adminNotes: value })} />
        </form>
        <ContractDocumentView
          document={{
            number: detail.contract.contract_number,
            revisionNumber: detail.working.revision_number,
            companyName: client?.businessName ?? "Client",
            revision: preview,
          }}
        />
      </div>

      <ConfirmDocumentModal
        open={sendOpen}
        busy={busy}
        title="Send this contract to the client?"
        description="They’ll review this revision in the client portal and can accept it electronically. This is not a qualified digital signature."
        actionLabel="Send Contract"
        onClose={() => setSendOpen(false)}
        onConfirm={async () => {
          setBusy(true);
          try {
            await persist();
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
            await reload();
            navigate("/admin/contracts");
          } catch (error) {
            notify(error instanceof AgencyDbError ? error.message : "Unable to delete this contract.");
            setBusy(false);
          }
        }}
      />
    </div>
  );
}

function Field(props: { label: string; value: string; disabled?: boolean; onChange: (value: string) => void }) {
  return (
    <label className="block text-sm font-semibold">
      {props.label}
      <input value={props.value} disabled={props.disabled} onChange={(event) => props.onChange(event.target.value)} className={fieldClass} />
    </label>
  );
}

function Area(props: { label: string; value: string; disabled?: boolean; onChange: (value: string) => void }) {
  return (
    <label className="block text-sm font-semibold">
      {props.label}
      <textarea value={props.value} disabled={props.disabled} rows={4} onChange={(event) => props.onChange(event.target.value)} className={fieldClass} />
    </label>
  );
}
