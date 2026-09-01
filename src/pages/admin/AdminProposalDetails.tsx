import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  Ban,
  Check,
  Download,
  Eye,
  FileSignature,
  FolderKanban,
  Mail,
  PencilLine,
  RotateCcw,
  Save,
  Send,
  Trash2,
  Undo2,
} from "lucide-react";
import { AdminActionsMenu, type AdminActionsMenuItem } from "@/components/admin/AdminActionsMenu";
import { adminBlueBtn, adminGhostBtn, adminPrimaryBtn } from "@/components/admin/adminActionStyles";
import { AdminInfoTip } from "@/components/admin/AdminInfoTip";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ConfirmDocumentModal } from "@/components/documents/ConfirmDocumentModal";
import { DocumentStatusBadge } from "@/components/documents/DocumentStatusBadge";
import { LineItemsEditor } from "@/components/documents/LineItemsEditor";
import { LineListEditor } from "@/components/documents/LineListEditor";
import { ProposalDocumentView } from "@/components/documents/ProposalDocumentView";
import { ProposalAdditionalPanel, ProposalScopePanel } from "@/components/documents/ProposalPresetPanel";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import {
  defaultProposalLineItem,
  defaultProposalValidUntil,
  documentMailRecipientCopy,
  documentMailRecipients,
  effectiveDocumentStatus,
  lineItemTotalCents,
  lineItemsTotalCents,
  type LineItemDraft,
} from "@/data/documents";
import { applyProposalDraftDefaults, displayLineItemName } from "@/data/proposalPresets";
import { requestedScopeFromBrief, type ClientScopeBrief } from "@/data/scopeBriefs";
import { fetchClientScopeBrief } from "@/data/scopeBriefsRepository";
import {
  proposalAddonPriceOverrides,
  proposalDraftOverrides,
  proposalWebsitePriceCents,
  type AgencySettings,
} from "@/data/settings";
import { fetchAgencySettings } from "@/data/settingsRepository";
import {
  cancelProposal,
  deleteProposal,
  createProposalRevision,
  discardProposalDraft,
  downloadProposalPdf,
  fetchContractSummaries,
  fetchProposalDetail,
  proposalLineDrafts,
  saveProposalDraft,
  resendProposalEmail,
  restoreProposal,
  sendProposal,
  type ContractSummary,
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

function scrollToPreview() {
  const preview = document.getElementById("proposal-preview");
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

function relatedContract(
  contracts: ContractSummary[],
  proposalId: string,
  projectId: string | null,
): ContractSummary | null {
  return (
    contracts.find((row) => row.proposalId === proposalId) ??
    (projectId ? contracts.find((row) => row.projectId === projectId) : undefined) ??
    null
  );
}

export function AdminProposalDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { clients, projects, notify, reload, portalAccounts } = useLeads();
  const [detail, setDetail] = useState<ProposalDetail | null>(null);
  const [brief, setBrief] = useState<ClientScopeBrief | null>(null);
  const [linkedContract, setLinkedContract] = useState<ContractSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [resendOpen, setResendOpen] = useState(false);
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
  const settingsRef = useRef<AgencySettings | null>(null);

  async function load(generation?: number) {
    if (!id) return;
    const [next, settings] = await Promise.all([
      fetchProposalDetail(id),
      fetchAgencySettings().catch(() => settingsRef.current),
    ]);
    if (settings) settingsRef.current = settings;
    if (generation != null && generation !== loadGen.current) return;
    setDetail(next);
    if (!next) {
      setBrief(null);
      setLinkedContract(null);
      return;
    }
    const [nextBrief, contracts] = await Promise.all([
      fetchClientScopeBrief(next.proposal.client_id).catch(() => null),
      fetchContractSummaries(next.proposal.client_id).catch(() => [] as ContractSummary[]),
    ]);
    if (generation != null && generation !== loadGen.current) return;
    setBrief(nextBrief);
    setLinkedContract(relatedContract(contracts, next.proposal.id, next.proposal.project_id));
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
    const filled =
      next.working.status === "draft"
        ? applyProposalDraftDefaults(body, proposalDraftOverrides(settingsRef.current))
        : body;
    const nextForm: ProposalForm = {
      title: next.working.title,
      ...filled,
      validUntil: next.working.valid_until ?? "",
      adminNotes: next.adminNotes,
    };
    const nextItems = proposalLineDrafts(next, proposalWebsitePriceCents(settingsRef.current));
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
  const mailRecipients = documentMailRecipients(
    client?.email,
    portalAccounts
      .filter((account) => account.clientId === detail.proposal.client_id)
      .map((account) => account.email),
  );
  const isDraft = detail.working.status === "draft";
  const status = effectiveDocumentStatus(detail.working.status, detail.working.valid_until);
  const publishedStatus = detail.published
    ? effectiveDocumentStatus(detail.published.status, detail.published.valid_until)
    : null;
  const accepted = status === "accepted" || publishedStatus === "accepted";
  const current = detail;
  const requested = brief ? requestedScopeFromBrief(brief) : { pages: [] as string[], features: [] as string[] };
  const requestedLines = [...requested.pages, ...requested.features];

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

  function persistItems(nextItems: LineItemDraft[]) {
    itemsRef.current = nextItems;
    setItems(nextItems);
    if (!isDraft) return;
    void saveDraftRevision(current.working.id, form, nextItems).catch((error) => {
      notify(error instanceof AgencyDbError ? error.message : "Unable to save this proposal.");
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
        validUntil: form.validUntil || defaultProposalValidUntil(undefined, settingsRef.current?.defaultProposalValidDays ?? 30),
      };
      const nextItems = items.some((item) => item.name.trim())
        ? items
        : [defaultProposalLineItem(proposalWebsitePriceCents(settingsRef.current))];
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
  if (isDraft && detail.published) {
    proposalActions.push({
      id: "stop-editing",
      label: "Stop editing",
      icon: Undo2,
      disabled: busy,
      onSelect: () => setDiscardOpen(true),
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
      href: `/admin/contracts/new?client=${current.proposal.client_id}&proposal=${current.proposal.id}${current.proposal.project_id ? `&project=${current.proposal.project_id}` : ""}`,
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

  const namedItems = items.filter((item) => item.name.trim());
  const investmentCents = isDraft ? lineItemsTotalCents(namedItems) : detail.working.investment_cents;
  const createContractHref = `/admin/contracts/new?client=${detail.proposal.client_id}&proposal=${detail.proposal.id}${detail.proposal.project_id ? `&project=${detail.proposal.project_id}` : ""}`;
  const contractActionHref = linkedContract ? `/admin/contracts/${linkedContract.id}` : createContractHref;
  const contractActionLabel = linkedContract ? "Open Contract" : "Create Contract";

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
            {accepted ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-[rgb(16_185_129_/_0.12)] px-2.5 py-1 font-heading text-[12px] font-semibold text-emerald-800">
                <Check className="h-3.5 w-3.5" />
                Proposal Accepted
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-[var(--admin-muted)]">
            {client?.businessName ?? "Client"} · Revision {detail.working.revision_number}
            {project ? ` · ${project.name}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
            {isDraft ? (
              <>
                <button type="button" disabled={busy} className={adminGhostBtn} onClick={() => void onSave()}>
                  <Save className="mr-2 h-4 w-4" />
                  {busy ? "Saving…" : "Save Draft"}
                </button>
                <button type="button" className={adminGhostBtn} onClick={scrollToPreview}>
                  <Eye className="mr-2 h-4 w-4" />
                  Preview
                </button>
                <button type="button" disabled={busy} className={adminPrimaryBtn} onClick={() => setSendOpen(true)}>
                  <Send className="mr-2 h-4 w-4" />
                  Send Proposal
                </button>
              </>
            ) : accepted ? (
              <Link to={contractActionHref} className={adminPrimaryBtn}>
                <FileSignature className="mr-2 h-4 w-4" />
                {contractActionLabel}
              </Link>
            ) : status !== "cancelled" ? (
              <>
                <button type="button" className={adminGhostBtn} onClick={scrollToPreview}>
                  <Eye className="mr-2 h-4 w-4" />
                  View Proposal
                </button>
                <button type="button" disabled={busy} className={adminBlueBtn} onClick={() => setResendOpen(true)}>
                  <Mail className="mr-2 h-4 w-4" />
                  Send / Resend
                </button>
              </>
            ) : null}
            <AdminActionsMenu ariaLabel="Proposal actions" iconOnly items={proposalActions} />
          </div>
      </div>

      {accepted ? (
        <section className="rounded-[var(--admin-radius)] border border-[rgb(16_185_129_/_0.35)] bg-[rgb(16_185_129_/_0.06)] p-5">
          <p className="inline-flex items-center gap-1.5 font-heading text-base font-semibold text-emerald-800">
            <Check className="h-4 w-4" />
            Proposal Accepted ✓
          </p>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--admin-muted)]">
            {linkedContract
              ? "The client has accepted this proposal. A contract is already linked — open it to continue."
              : "The client has accepted this proposal. The next step is to prepare the contract."}
          </p>
          <Link to={contractActionHref} className={`${adminPrimaryBtn} mt-4`}>
            <FileSignature className="mr-2 h-4 w-4" />
            {contractActionLabel}
          </Link>
        </section>
      ) : null}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <div className="space-y-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--admin-muted)]">
            A. What are we proposing?
          </p>
          <ClientRequestedScope
            brief={brief}
            clientId={detail.proposal.client_id}
            clientName={client?.businessName}
          />
          <EditorCard
            title="Proposal Overview"
            helper="The introduction and project overview the client will read first."
          >
            <Field
              label="Proposal title"
              hint="The heading saved on this proposal. The client-facing document is titled Website Proposal."
              value={form.title}
              disabled={!isDraft}
              onChange={(value) => setForm({ ...form, title: value })}
            />
            <Area
              label="Overview"
              hint="Opening note to the client."
              value={form.introduction}
              disabled={!isDraft}
              rows={5}
              onChange={(value) => setForm({ ...form, introduction: value })}
            />
            <Area
              label="Project overview"
              hint="What the website will accomplish based on this client's goals."
              value={form.overview}
              disabled={!isDraft}
              rows={5}
              onChange={(value) => setForm({ ...form, overview: value })}
            />
          </EditorCard>

          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--admin-muted)]">
            B. What is included?
          </p>
          <EditorCard
            title="Scope of Work"
            helper="MotiveScripts' offer — not the original client request. Add or remove pages and functionality here."
          >
            <ProposalScopePanel
              scope={form.scope}
              requestedLines={requestedLines}
              disabled={!isDraft}
              onScopeChange={(scope) => patchDraft({ scope })}
            />
            <Area
              label="Scope list"
              hint="One item per line. Chips above write here. Use this for custom wording."
              value={form.scope}
              disabled={!isDraft}
              rows={8}
              onChange={(value) => setForm({ ...form, scope: value })}
            />
          </EditorCard>
          <EditorCard
            title="Deliverables"
            helper="What MotiveScripts will deliver. Seeded from the proposal scope; edit freely without changing the original client request."
          >
            <LineListEditor
              value={form.deliverablesText}
              disabled={!isDraft}
              addLabel="Add deliverable"
              placeholder="Add a deliverable"
              onChange={(deliverablesText) => patchDraft({ deliverablesText })}
            />
          </EditorCard>

          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--admin-muted)]">
            C. What costs extra?
          </p>
          <EditorCard
            title="Additional Services / Features"
            helper="Included extras stay in the offer at no added line item. Billed extras use the existing line-item prices."
          >
            <ProposalAdditionalPanel
              scope={form.scope}
              items={items}
              disabled={!isDraft}
              addonCents={proposalAddonPriceOverrides(settingsRef.current)}
              onScopeChange={(scope) => patchDraft({ scope })}
              onItemsChange={persistItems}
            />
          </EditorCard>

          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--admin-muted)]">
            D. What will the client pay and agree to?
          </p>
          <EditorCard
            title="Timeline"
            helper="Estimated timeline. Final dates may change based on content, feedback, approvals, and project requirements."
          >
            <Area
              label="Project timeline"
              value={form.timeline}
              disabled={!isDraft}
              rows={8}
              onChange={(value) => setForm({ ...form, timeline: value })}
            />
          </EditorCard>
          <EditorCard
            title="Investment"
            helper="Quantity × unit price in cents. The client sees names, descriptions, and totals — not this editor."
          >
            <div className="rounded-lg border border-[var(--admin-line)] bg-[var(--admin-bg)] p-4">
              {namedItems.length === 0 ? (
                <p className="text-sm text-[var(--admin-muted)]">Add a website line item to set the investment.</p>
              ) : (
                <ul className="space-y-3">
                  {namedItems.map((item) => (
                    <li key={item.key} className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-heading text-sm font-semibold text-[var(--admin-ink)]">
                          {displayLineItemName(item.name)}
                        </p>
                        {item.description ? (
                          <p className="mt-1 text-[12px] leading-5 text-[var(--admin-muted)]">{item.description}</p>
                        ) : null}
                      </div>
                      <p className="font-heading text-sm font-semibold text-[var(--admin-ink)]">
                        {formatUsdFromCents(lineItemTotalCents(item))}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-4 border-t border-[var(--admin-line)] pt-3 font-heading text-base font-semibold text-[var(--admin-ink)]">
                Total Investment — {formatUsdFromCents(investmentCents)}
              </p>
            </div>
            <div>
              <p className="flex items-center gap-1.5 text-sm font-semibold">
                Line items
                <AdminInfoTip text="The price list. Quantity × unit price is the investment the client sees." />
              </p>
              <p className="mt-1 text-[12px] text-[var(--admin-muted)]">
                Totals are calculated from quantity × unit price in cents.
              </p>
              <div className="mt-3">
                <LineItemsEditor items={items} disabled={!isDraft} onChange={setItems} />
              </div>
            </div>
          </EditorCard>
          <EditorCard title="Payment Terms" helper="When the deposit and remaining balance are due. This proposal does not charge a card.">
            <Area
              label="Payment terms"
              value={form.paymentTerms}
              disabled={!isDraft}
              rows={7}
              onChange={(value) => setForm({ ...form, paymentTerms: value })}
            />
          </EditorCard>
          <EditorCard title="Terms & Conditions" helper="The client agrees to these terms when they accept in the portal.">
            <Area
              label="Terms & conditions"
              value={form.terms}
              disabled={!isDraft}
              rows={10}
              onChange={(value) => setForm({ ...form, terms: value })}
            />
          </EditorCard>
          <EditorCard title="Notes" helper="Optional client-facing note on the proposal.">
            <Area
              label="Notes"
              value={form.notes}
              disabled={!isDraft}
              rows={4}
              onChange={(value) => setForm({ ...form, notes: value })}
            />
          </EditorCard>
          <EditorCard
            title="Proposal Settings"
            helper="The date through which the client can accept this proposal."
          >
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
              {form.validUntil ? (
                <p className="mt-2 text-sm text-[var(--admin-ink)]">
                  {new Date(`${form.validUntil}T00:00:00`).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              ) : null}
            </div>
          </EditorCard>
          <EditorCard
            title="Internal notes"
            helper="Staff only. Never shown on the proposal, PDF, or client portal."
          >
            <Area
              label="Internal notes (not shown to the client)"
              value={form.adminNotes}
              disabled={!isDraft}
              onChange={(value) => setForm({ ...form, adminNotes: value })}
            />
          </EditorCard>
        </div>

        <div id="proposal-preview" className="rounded-[var(--admin-radius)] transition-shadow xl:sticky xl:top-4">
          <p className="mb-3 font-heading text-sm font-semibold text-[var(--admin-ink)]">Client preview</p>
          <p className="mb-4 text-[12px] leading-5 text-[var(--admin-muted)]">
            This is what the client sees. Internal notes and editing controls are not included.
          </p>
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
              investmentCents,
            }}
          />
        </div>
      </div>

      <ConfirmDocumentModal
        open={sendOpen}
        busy={busy}
        title="Send this proposal to the client?"
        description={`${documentMailRecipientCopy(mailRecipients, { companyName: client?.businessName, action: "send" })} They’ll be able to review the exact version you’re sending. After it’s sent, this revision can’t be silently edited.`}
        actionLabel="Send Proposal"
        onClose={() => setSendOpen(false)}
        onConfirm={() => void onSend()}
      />
      <ConfirmDocumentModal
        open={resendOpen}
        busy={busy}
        title="Resend this proposal email?"
        description={`${documentMailRecipientCopy(mailRecipients, { companyName: client?.businessName, action: "resend" })} They’ll receive another copy of the last sent proposal.`}
        actionLabel="Resend email"
        onClose={() => setResendOpen(false)}
        onConfirm={async () => {
          setBusy(true);
          try {
            await resendProposalEmail(current.proposal.id);
            notify("Proposal email sent.");
            setResendOpen(false);
          } catch (error) {
            notify(error instanceof AgencyDbError ? error.message : "The email could not be sent.");
          } finally {
            setBusy(false);
          }
        }}
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

function EditorCard({
  title,
  helper,
  children,
}: {
  title: string;
  helper?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
      <div>
        <h2 className="font-heading text-sm font-semibold text-[var(--admin-ink)]">{title}</h2>
        {helper ? <p className="mt-1 text-sm leading-6 text-[var(--admin-muted)]">{helper}</p> : null}
      </div>
      {children}
    </section>
  );
}

function ClientRequestedScope({
  brief,
  clientId,
  clientName,
}: {
  brief: ClientScopeBrief | null;
  clientId: string;
  clientName?: string;
}) {
  const requested = brief ? requestedScopeFromBrief(brief) : { pages: [] as string[], features: [] as string[] };
  return (
    <section className="space-y-3 rounded-[var(--admin-radius)] border border-[rgb(16_185_129_/_0.28)] bg-[rgb(16_185_129_/_0.05)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-sm font-semibold text-[var(--admin-ink)]">Client requested scope</h2>
          <p className="mt-1 text-sm leading-6 text-[var(--admin-muted)]">
            What {clientName ?? "the client"} submitted. This is the source of truth for their request. Editing the
            proposal does not change this scope.
          </p>
        </div>
        <Link to={`/admin/clients/${clientId}`} className="text-xs font-semibold text-[var(--admin-navy)] hover:underline">
          View Full Scope
        </Link>
      </div>
      {!brief ? (
        <p className="text-sm text-[var(--admin-muted)]">No Website Scope submitted. You can still build this proposal.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--admin-muted)]">Pages</p>
            <ul className="mt-2 space-y-1 text-sm text-[var(--admin-ink)]">
              {requested.pages.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--admin-muted)]">Features</p>
            {requested.features.length ? (
              <ul className="mt-2 space-y-1 text-sm text-[var(--admin-ink)]">
                {requested.features.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-[var(--admin-muted)]">None listed</p>
            )}
          </div>
        </div>
      )}
    </section>
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
