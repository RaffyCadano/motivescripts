import { useEffect, useId, useRef, useState } from "react";
import { Ban, Download, FileSignature, FolderKanban, Mail, PencilLine, RotateCcw, Save, Send, Trash2, Undo2 } from "lucide-react";
import { AdminActionsMenu, type AdminActionsMenuItem } from "@/components/admin/AdminActionsMenu";
import { AdminInfoTip } from "@/components/admin/AdminInfoTip";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ConfirmDocumentModal } from "@/components/documents/ConfirmDocumentModal";
import { DocumentStatusBadge } from "@/components/documents/DocumentStatusBadge";
import { LineItemsEditor } from "@/components/documents/LineItemsEditor";
import { ProposalDocumentView } from "@/components/documents/ProposalDocumentView";
import { ProposalPresetPanel } from "@/components/documents/ProposalPresetPanel";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import { defaultProposalLineItem, defaultProposalValidUntil, effectiveDocumentStatus, lineItemsTotalCents, type LineItemDraft } from "@/data/documents";
import { applyProposalDraftDefaults } from "@/data/proposalPresets";
import {
  cancelProposal,
  createContract,
  deleteProposal,
  createProposalRevision,
  discardProposalDraft,
  downloadProposalPdf,
  fetchProposalDetail,
  proposalLineDrafts,
  saveProposalDraft,
  resendProposalEmail,
  restoreProposal,
  sendProposal,
  type ProposalDetail,
} from "@/data/documentsRepository";
import { formatUsdFromCents } from "@/data/money";
import { AgencyDbError } from "@/lib/dbErrors";

type ProposalForm = {
  title: string;
  introduction: string;
  overview: string;
  scope: string;
  deliverablesText: string;
  timeline: string;
  paymentTerms: string;
  terms: string;
  notes: string;
  validUntil: string;
  adminNotes: string;
};

const fieldClass =
  "mt-1.5 w-full rounded-lg border border-[var(--admin-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[rgb(0_80_240_/_0.45)] disabled:bg-[var(--admin-bg)]";

async function saveDraftRevision(
  revisionId: string,
  nextForm: ProposalForm,
  nextItems?: LineItemDraft[],
) {
  await saveProposalDraft({
    revisionId,
    ...nextForm,
    validUntil: nextForm.validUntil || null,
    items: nextItems,
    replaceItems: nextItems != null,
    adminNotes: nextForm.adminNotes,
  });
}

export function AdminProposalDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { clients, projects, notify, reload } = useLeads();
  const [detail, setDetail] = useState<ProposalDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [form, setForm] = useState<ProposalForm>({
    title: "",
    introduction: "",
    overview: "",
    scope: "",
    deliverablesText: "",
    timeline: "",
    paymentTerms: "",
    terms: "",
    notes: "",
    validUntil: "",
    adminNotes: "",
  });
  const [items, setItems] = useState<LineItemDraft[]>([]);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const loadGen = useRef(0);

  async function load(generation?: number) {
    if (!id) return;
    const next = await fetchProposalDetail(id);
    if (generation != null && generation !== loadGen.current) return;
    setDetail(next);
    if (next) {
      const body = {
        introduction: next.working.introduction,
        overview: next.working.overview,
        scope: next.working.scope,
        deliverablesText: next.working.deliverables_text,
        timeline: next.working.timeline,
        paymentTerms: next.working.payment_terms,
        terms: next.working.terms,
        notes: next.working.notes,
      };
      const filled = next.working.status === "draft" ? applyProposalDraftDefaults(body) : body;
      const nextForm: ProposalForm = {
        title: next.working.title,
        ...filled,
        validUntil: next.working.valid_until ?? "",
        adminNotes: next.adminNotes,
      };
      const nextItems = proposalLineDrafts(next);
      setForm(nextForm);
      setItems(nextItems);
      if (next.working.status !== "draft") return;
      if (generation != null && generation !== loadGen.current) return;
      const formChanged = JSON.stringify(filled) !== JSON.stringify(body);
      const collapsedDuplicates = nextItems.length < next.items.length;
      const filledDescriptions = next.items.some((row) => {
        const draft = nextItems.find((item) => item.name.trim().toLowerCase() === row.name.trim().toLowerCase());
        return Boolean(draft?.description.trim()) && !row.description.trim();
      });
      if (formChanged && !collapsedDuplicates && !filledDescriptions) {
        await saveDraftRevision(next.working.id, nextForm);
        return;
      }
      if (collapsedDuplicates || filledDescriptions) {
        await saveDraftRevision(next.working.id, nextForm, nextItems);
      }
    }
  }

  useEffect(() => {
    const generation = ++loadGen.current;
    setLoading(true);
    void load(generation)
      .catch((error) => notify(error instanceof AgencyDbError ? error.message : "Unable to load this proposal."))
      .finally(() => {
        if (generation === loadGen.current) setLoading(false);
      });
    return () => {
      loadGen.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) {
    return <div className="h-64 animate-pulse rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)]" />;
  }
  if (!detail || !id) {
    return (
      <div>
        <h1 className="font-heading text-2xl font-semibold">Proposal not found</h1>
        <Link to="/admin/proposals" className="mt-3 inline-flex text-sm font-semibold text-[var(--admin-blue)]">
          Back to proposals
        </Link>
      </div>
    );
  }

  const client = clients.find((item) => item.id === detail.proposal.client_id);
  const project = projects.find((item) => item.id === detail.proposal.project_id);
  const isDraft = detail.working.status === "draft";
  const status = effectiveDocumentStatus(detail.working.status, detail.working.valid_until);
  const publishedStatus = detail.published
    ? effectiveDocumentStatus(detail.published.status, detail.published.valid_until)
    : null;
  const current = detail;

  async function persist() {
    if (!isDraft) return;
    await saveDraftRevision(current.working.id, form, items);
  }

  function patchDraft(patch: Partial<ProposalForm>) {
    setForm((currentForm) => {
      const nextForm = { ...currentForm, ...patch };
      void saveDraftRevision(current.working.id, nextForm, itemsRef.current).catch((error) => {
        notify(error instanceof AgencyDbError ? error.message : "Unable to save this proposal.");
      });
      return nextForm;
    });
  }

  async function onSave() {
    setBusy(true);
    try {
      await persist();
      notify("Proposal saved.");
      await load();
      await reload();
    } catch (error) {
      notify(error instanceof AgencyDbError ? error.message : "Unable to save this proposal.");
    } finally {
      setBusy(false);
    }
  }

  async function onSend() {
    setBusy(true);
    try {
      const nextForm = {
        ...form,
        title: form.title.trim() || "Website proposal",
        validUntil: form.validUntil || defaultProposalValidUntil(),
      };
      const nextItems = items.some((item) => item.name.trim()) ? items : [defaultProposalLineItem()];
      setForm(nextForm);
      setItems(nextItems);
      await saveDraftRevision(current.working.id, nextForm, nextItems);
      const result = await sendProposal(current.proposal.id);
      notify(result.emailed ? "Proposal sent." : "Proposal sent. The email could not be delivered.");
      setSendOpen(false);
      await load();
      await reload();
    } catch (error) {
      notify(error instanceof AgencyDbError ? error.message : "Unable to send this proposal.");
    } finally {
      setBusy(false);
    }
  }

  const previewItems = isDraft
    ? items
        .filter((item) => item.name.trim())
        .map((item, index) => ({
          name: item.name,
          description: item.description,
          quantity: item.quantity,
          unit_price_cents: item.unitPriceCents,
          total_cents: item.quantity * item.unitPriceCents,
          sort_order: index,
        }))
    : detail.snapshotItems;

  const proposalActions: AdminActionsMenuItem[] = [
    {
      id: "pdf",
      label: pdfBusy ? "Generating PDF..." : "Download PDF",
      icon: Download,
      disabled: busy || pdfBusy,
      onSelect: async () => {
        setPdfBusy(true);
        try {
          await downloadProposalPdf(current.proposal.id);
        } catch (error) {
          notify(error instanceof AgencyDbError ? error.message : "Unable to generate the proposal PDF. Please try again.");
        } finally {
          setPdfBusy(false);
        }
      },
    },
  ];
  if (isDraft) {
    proposalActions.push(
      { id: "save", label: busy ? "Saving…" : "Save draft", icon: Save, disabled: busy, onSelect: () => void onSave() },
      { id: "send", label: "Send Proposal", icon: Send, disabled: busy, onSelect: () => setSendOpen(true) },
    );
    if (detail.published) {
      proposalActions.push({
        id: "stop-editing",
        label: "Stop editing",
        icon: Undo2,
        disabled: busy,
        onSelect: () => setDiscardOpen(true),
      });
    }
  } else if (status !== "cancelled") {
    proposalActions.push({
      id: "resend",
      label: "Resend email",
      icon: Mail,
      disabled: busy || pdfBusy,
      onSelect: async () => {
        setBusy(true);
        try {
          await resendProposalEmail(current.proposal.id);
          notify("Proposal email sent.");
        } catch (error) {
          notify(error instanceof AgencyDbError ? error.message : "The email could not be sent.");
        } finally {
          setBusy(false);
        }
      },
    });
  }
  if (publishedStatus === "accepted" && !project) {
    proposalActions.push({
      id: "create-project",
      label: "Create project",
      icon: FolderKanban,
      href: `/admin/clients/${detail.proposal.client_id}`,
    });
  }
  if (publishedStatus === "accepted") {
    proposalActions.push({
      id: "create-contract",
      label: "Create Contract",
      icon: FileSignature,
      disabled: busy,
      onSelect: async () => {
        setBusy(true);
        try {
          const contractId = await createContract({
            clientId: current.proposal.client_id,
            projectId: current.proposal.project_id,
            proposalId: current.proposal.id,
          });
          notify("Contract created.");
          navigate(`/admin/contracts/${contractId}`);
        } catch (error) {
          notify(error instanceof AgencyDbError ? error.message : "Unable to create a contract.");
          setBusy(false);
        }
      },
    });
  }
  if (!isDraft && status !== "cancelled") {
    proposalActions.push({
      id: "edit",
      label: "Edit",
      icon: PencilLine,
      disabled: busy,
      onSelect: async () => {
        setBusy(true);
        try {
          await createProposalRevision(current.proposal.id);
          notify("Editing a copy. The client still sees the last sent version until you send again.");
          await load();
        } catch (error) {
          notify(error instanceof AgencyDbError ? error.message : "Unable to create a revision.");
        } finally {
          setBusy(false);
        }
      },
    });
  }
  if (status !== "accepted" && status !== "cancelled") {
    proposalActions.push({
      id: "cancel",
      label: "Cancel proposal",
      icon: Ban,
      disabled: busy,
      danger: true,
      separatorBefore: true,
      onSelect: () => setCancelOpen(true),
    });
  }
  if (status === "cancelled") {
    proposalActions.push({
      id: "restore",
      label: "Restore",
      icon: RotateCcw,
      disabled: busy,
      onSelect: () => setRestoreOpen(true),
    });
  }
  if (status !== "accepted" && publishedStatus !== "accepted" && !detail.acceptedOnce) {
    proposalActions.push({
      id: "delete",
      label: "Delete proposal",
      icon: Trash2,
      disabled: busy,
      danger: true,
      separatorBefore: status === "cancelled",
      onSelect: () => setDeleteOpen(true),
    });
  }

  return (
    <div className="space-y-6">
      <Link to="/admin/proposals" className="text-[12px] font-medium text-[var(--admin-blue)] hover:underline">
        Proposals
      </Link>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-heading text-[1.65rem] font-semibold tracking-tight">{detail.proposal.proposal_number}</h1>
            <DocumentStatusBadge status={status} />
          </div>
          <p className="mt-1 text-sm text-[var(--admin-muted)]">
            {client?.businessName ?? "Client"} · Revision {detail.working.revision_number}
            {project ? ` · ${project.name}` : ""}
          </p>
        </div>
        <AdminActionsMenu ariaLabel="Proposal actions" items={proposalActions} />
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <form className="space-y-4 rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
          <h2 className="font-heading text-sm font-semibold">Proposal content</h2>
          <Field
            label="Title"
            hint="The heading the client sees at the top of the proposal."
            value={form.title}
            disabled={!isDraft}
            onChange={(value) => setForm({ ...form, title: value })}
          />
          <Area
            label="Introduction"
            hint="Opening note to the client. Shown as Overview on the proposal."
            value={form.introduction}
            disabled={!isDraft}
            rows={5}
            onChange={(value) => setForm({ ...form, introduction: value })}
          />
          <Area
            label="Project overview"
            hint="A short description of the website you plan to build."
            value={form.overview}
            disabled={!isDraft}
            rows={5}
            onChange={(value) => setForm({ ...form, overview: value })}
          />
          {isDraft ? (
            <ProposalPresetPanel
              scope={form.scope}
              deliverables={form.deliverablesText}
              items={items}
              onScopeChange={(scope) => patchDraft({ scope })}
              onDeliverablesChange={(deliverablesText) => patchDraft({ deliverablesText })}
              onItemsChange={(nextItems) => {
                itemsRef.current = nextItems;
                setItems(nextItems);
              }}
            />
          ) : null}
          <Area
            label="Scope of work"
            hint="What is included in this build. Scope chips write here. The client sees this section."
            value={form.scope}
            disabled={!isDraft}
            onChange={(value) => setForm({ ...form, scope: value })}
          />
          <Area
            label="Deliverables"
            hint="What you will hand over. Feature chips write here."
            value={form.deliverablesText}
            disabled={!isDraft}
            onChange={(value) => setForm({ ...form, deliverablesText: value })}
          />
          <Area
            label="Timeline"
            hint="When work happens and what can delay the dates."
            value={form.timeline}
            disabled={!isDraft}
            rows={7}
            onChange={(value) => setForm({ ...form, timeline: value })}
          />
          <div>
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              Line items
              <AdminInfoTip text="The price list. Quantity × unit price is the investment the client sees. Scope and Features do not add a dollar amount." />
            </p>
            <p className="mt-1 text-[12px] text-[var(--admin-muted)]">Totals are calculated from quantity × unit price in cents.</p>
            <div className="mt-3">
              <LineItemsEditor items={items} disabled={!isDraft} onChange={setItems} />
            </div>
          </div>
          <Area
            label="Payment terms"
            hint="When and how they pay. This proposal does not charge a card."
            value={form.paymentTerms}
            disabled={!isDraft}
            rows={7}
            onChange={(value) => setForm({ ...form, paymentTerms: value })}
          />
          <Area
            label="Terms & conditions"
            hint="The rules of this offer. They agree to this when they accept in the portal."
            value={form.terms}
            disabled={!isDraft}
            rows={10}
            onChange={(value) => setForm({ ...form, terms: value })}
          />
          <Area
            label="Notes"
            hint="An extra note on the client-facing proposal. Optional."
            value={form.notes}
            disabled={!isDraft}
            rows={4}
            onChange={(value) => setForm({ ...form, notes: value })}
          />
          <div>
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              <label htmlFor="proposal-valid-until">Valid until</label>
              <AdminInfoTip text="Last day the client can accept this revision. After that it expires." />
            </p>
            <input
              id="proposal-valid-until"
              type="date"
              disabled={!isDraft}
              value={form.validUntil}
              onChange={(event) => setForm({ ...form, validUntil: event.target.value })}
              className={fieldClass}
            />
          </div>
          <Area
            label="Internal notes (not shown to the client)"
            hint="Staff only. Never shown on the proposal, PDF, or client portal."
            value={form.adminNotes}
            disabled={!isDraft}
            onChange={(value) => setForm({ ...form, adminNotes: value })}
          />
          <p className="text-sm text-[var(--admin-muted)]">
            Calculated investment {formatUsdFromCents(isDraft ? lineItemsTotalCents(items) : detail.working.investment_cents)}
          </p>
        </form>

        <ProposalDocumentView
          document={{
            number: detail.proposal.proposal_number,
            title: form.title,
            revisionNumber: detail.working.revision_number,
            companyName: client?.businessName ?? "Client",
            introduction: form.introduction,
            overview: form.overview,
            scope: form.scope,
            deliverables: form.deliverablesText,
            timeline: form.timeline,
            paymentTerms: form.paymentTerms,
            terms: form.terms,
            notes: form.notes,
            validUntil: form.validUntil || null,
            items: previewItems,
            investmentCents: isDraft
              ? lineItemsTotalCents(items.filter((item) => item.name.trim()))
              : detail.working.investment_cents,
          }}
        />
      </div>

      <ConfirmDocumentModal
        open={sendOpen}
        busy={busy}
        title="Send this proposal to the client?"
        description="They’ll be able to review the exact version you’re sending. After it’s sent, this revision can’t be silently edited."
        actionLabel="Send Proposal"
        onClose={() => setSendOpen(false)}
        onConfirm={() => void onSend()}
      />
      <ConfirmDocumentModal
        open={cancelOpen}
        busy={busy}
        danger
        title="Cancel this proposal?"
        description="The client will no longer be able to review or accept it. You can restore it later if this was a mistake."
        actionLabel="Cancel proposal"
        onClose={() => setCancelOpen(false)}
        onConfirm={async () => {
          setBusy(true);
          try {
            await cancelProposal(current.proposal.id);
            notify("Proposal cancelled.");
            setCancelOpen(false);
            await load();
          } catch (error) {
            notify(error instanceof AgencyDbError ? error.message : "Unable to cancel this proposal.");
          } finally {
            setBusy(false);
          }
        }}
      />
      <ConfirmDocumentModal
        open={restoreOpen}
        busy={busy}
        title="Restore this proposal?"
        description="It will leave Cancelled and go back to draft or sent, depending on where it was before you cancelled it."
        actionLabel="Restore proposal"
        onClose={() => setRestoreOpen(false)}
        onConfirm={async () => {
          setBusy(true);
          try {
            await restoreProposal(current.proposal.id);
            notify("Proposal restored.");
            setRestoreOpen(false);
            await load();
            await reload();
          } catch (error) {
            notify(error instanceof AgencyDbError ? error.message : "Unable to restore this proposal.");
          } finally {
            setBusy(false);
          }
        }}
      />
      <ConfirmDocumentModal
        open={deleteOpen}
        busy={busy}
        danger
        title="Delete this proposal?"
        description="This permanently removes the proposal and its revisions. This cannot be undone."
        actionLabel="Delete proposal"
        onClose={() => setDeleteOpen(false)}
        onConfirm={async () => {
          setBusy(true);
          try {
            await deleteProposal(current.proposal.id);
            notify("Proposal deleted.");
            setDeleteOpen(false);
            await reload();
            navigate("/admin/proposals");
          } catch (error) {
            notify(error instanceof AgencyDbError ? error.message : "Unable to delete this proposal.");
            setBusy(false);
          }
        }}
      />
      <ConfirmDocumentModal
        open={discardOpen}
        busy={busy}
        title="Stop editing this proposal?"
        description="This draft will be discarded. The client still has the last sent version. You do not need to send again."
        actionLabel="Stop editing"
        onClose={() => setDiscardOpen(false)}
        onConfirm={async () => {
          setBusy(true);
          try {
            await discardProposalDraft(current.proposal.id);
            notify("Draft discarded. The last sent proposal is still in place.");
            setDiscardOpen(false);
            await load();
            await reload();
          } catch (error) {
            notify(error instanceof AgencyDbError ? error.message : "Unable to discard this draft.");
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
}

function Field({
  label,
  hint,
  value,
  disabled,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const inputId = useId();
  return (
    <div>
      <p className="flex items-center gap-1.5 text-sm font-semibold">
        <label htmlFor={inputId}>{label}</label>
        {hint ? <AdminInfoTip text={hint} /> : null}
      </p>
      <input
        id={inputId}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={fieldClass}
      />
    </div>
  );
}

function Area({
  label,
  hint,
  value,
  disabled,
  rows = 4,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  disabled?: boolean;
  rows?: number;
  onChange: (value: string) => void;
}) {
  const inputId = useId();
  return (
    <div>
      <p className="flex items-center gap-1.5 text-sm font-semibold">
        <label htmlFor={inputId}>{label}</label>
        {hint ? <AdminInfoTip text={hint} /> : null}
      </p>
      <textarea
        id={inputId}
        value={value}
        disabled={disabled}
        rows={rows}
        onChange={(event) => onChange(event.target.value)}
        className={fieldClass}
      />
    </div>
  );
}
