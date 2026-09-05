import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Eye, Save, Send } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { hasPermission } from "@/auth/permissions";
import { adminGhostBtn, adminPrimaryBtn } from "@/components/admin/adminActionStyles";
import { NeedClientEmpty } from "@/components/admin/NeedClientEmpty";
import { ConfirmDocumentModal } from "@/components/documents/ConfirmDocumentModal";
import { documentMailRecipientCopy, documentMailRecipients } from "@/data/documents";
import { InvoiceBillingTypeCard } from "@/components/invoices/InvoiceBillingTypeCard";
import { InvoiceDocumentView } from "@/components/invoices/InvoiceDocumentView";
import { InvoiceDraftForm, type InvoiceDraftFormValue } from "@/components/invoices/InvoiceDraftForm";
import { InvoiceStatusBadge } from "@/components/invoices/InvoiceStatusBadge";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import {
  fetchContractDetail,
  fetchContractSummaries,
  fetchProposalDetail,
  proposalLineDrafts,
} from "@/data/documentsRepository";
import {
  applyInvoiceBillingNotes,
  emptyLineItem,
  formatInvoiceDate,
  invoiceDraftTotalCents,
  invoiceItemsForBillingType,
  invoiceLinkingBlockedReason,
  invoiceSendBlockedReason,
  invoiceSendConfirmCopy,
  invoiceSentMessage,
  isoCalendarDate,
  isoCalendarDatePlusDays,
  previewInvoiceDraftItems,
  splitInvoiceInvestmentCents,
  suggestedInvoiceBillingType,
  type InvoiceBillingType,
  type LineItemDraft,
} from "@/data/invoices";
import { createInvoice, fetchInvoiceSummaries, saveInvoiceDraft, sendInvoice, type InvoiceSummary } from "@/data/invoicesRepository";
import { formatMoneyFromCents, formatUsdFromCents } from "@/data/money";
import { invoiceNotesFromSettings } from "@/data/settings";
import { fetchAgencySettings } from "@/data/settingsRepository";
import { AgencyDbError } from "@/lib/dbErrors";

type AcceptedContract = { id: string; number: string; clientId: string; projectId: string | null };

function scrollToInvoicePreview() {
  const preview = document.getElementById("invoice-preview");
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

export function AdminInvoiceNew() {
  const { clients, projects, notify, portalAccounts } = useLeads();
  const { profile } = useAuth();
  const canManage = hasPermission(profile, "invoices.manage");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const presetClient = searchParams.get("client") ?? "";
  const presetProject = searchParams.get("project") ?? "";
  const presetContract = searchParams.get("contract") ?? "";
  const [accepted, setAccepted] = useState<AcceptedContract[]>([]);
  const [items, setItems] = useState<LineItemDraft[]>([emptyLineItem()]);
  const [linkedProposalId, setLinkedProposalId] = useState<string | null>(null);
  const [seededContractNumber, setSeededContractNumber] = useState("");
  const [contractSeedReady, setContractSeedReady] = useState(!presetContract);
  const [investmentCents, setInvestmentCents] = useState(0);
  const [sourceItems, setSourceItems] = useState<LineItemDraft[]>([]);
  const [billingType, setBillingType] = useState<InvoiceBillingType>(presetContract ? "deposit" : "custom");
  const [relatedInvoices, setRelatedInvoices] = useState<InvoiceSummary[]>([]);
  const billingTouched = useRef(false);
  const [busy, setBusy] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const saving = useRef(false);
  const [form, setForm] = useState<InvoiceDraftFormValue>({
    clientId: presetClient,
    projectId: presetProject,
    contractId: presetContract,
    issueDate: isoCalendarDate(),
    dueDate: isoCalendarDatePlusDays(14),
    currency: "USD",
    taxCents: 0,
    discountCents: 0,
    notes: "",
    adminNotes: "",
  });

  useEffect(() => {
    let active = true;
    void fetchAgencySettings()
      .then((row) => {
        if (!active) return;
        setForm((current) => ({
          ...current,
          dueDate: isoCalendarDatePlusDays(row.defaultInvoiceDueDays),
          currency: row.currency || current.currency,
          notes: mergeInvoiceNotes(invoiceNotesFromSettings(row), current.notes),
        }));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    void fetchContractSummaries().then((rows) => {
      setAccepted(
        rows
          .filter((row) => row.effectiveStatus === "accepted")
          .map((row) => ({ id: row.id, number: row.number, clientId: row.clientId, projectId: row.projectId })),
      );
    });
  }, []);

  useEffect(() => {
    if (!presetProject || form.clientId) return;
    const match = projects.find((row) => row.id === presetProject);
    if (!match) return;
    setForm((current) => ({
      ...current,
      clientId: match.clientId,
      projectId: current.projectId || match.id,
    }));
  }, [form.clientId, presetProject, projects]);

  useEffect(() => {
    if (!presetContract) return;
    const match = accepted.find((row) => row.id === presetContract);
    if (!match) return;
    setForm((current) => ({
      ...current,
      clientId: match.clientId,
      contractId: match.id,
      projectId: current.projectId || match.projectId || "",
    }));
  }, [accepted, presetContract]);

  useEffect(() => {
    if (!form.clientId) {
      setRelatedInvoices([]);
      return;
    }
    let active = true;
    void fetchInvoiceSummaries(form.clientId)
      .then((rows) => {
        if (active) setRelatedInvoices(rows);
      })
      .catch(() => {
        if (active) setRelatedInvoices([]);
      });
    return () => {
      active = false;
    };
  }, [form.clientId]);

  useEffect(() => {
    const contractId = form.contractId.trim();
    if (!contractId) {
      setInvestmentCents(0);
      setSourceItems([]);
      if (!presetContract) {
        setLinkedProposalId(null);
        setSeededContractNumber("");
      }
      setContractSeedReady(true);
      return;
    }
    let active = true;
    setContractSeedReady(false);
    void seedInvoiceFromContract(contractId)
      .then((seed) => {
        if (!active || !seed) return;
        setLinkedProposalId(seed.proposalId);
        setSeededContractNumber(seed.contractNumber);
        setSourceItems(seed.items);
        setInvestmentCents(seed.investmentCents);
        const related = relatedInvoices.filter((row) => {
          if (row.status === "cancelled") return false;
          if (row.contractId === seed.contractId) return true;
          if (seed.projectId && row.projectId === seed.projectId) return true;
          return false;
        });
        const nextType = billingTouched.current
          ? billingType
          : suggestedInvoiceBillingType(related, splitInvoiceInvestmentCents(seed.investmentCents).depositCents);
        const nextItems = invoiceItemsForBillingType(nextType, seed.items, seed.investmentCents);
        setBillingType(nextType);
        setItems(nextItems ?? seed.items);
        setForm((current) => ({
          ...current,
          clientId: seed.clientId || current.clientId,
          projectId: current.projectId || seed.projectId || "",
          contractId: seed.contractId || current.contractId,
          notes: applyInvoiceBillingNotes(mergeInvoiceNotes(current.notes, seed.notes), nextType),
          adminNotes: seed.adminNotes || current.adminNotes,
        }));
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setContractSeedReady(true);
      });
    return () => {
      active = false;
    };
    // Seed from the selected accepted contract. relatedInvoices is read for the first suggestion only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.contractId]);

  const projectRelatedInvoices = useMemo(
    () =>
      relatedInvoices.filter((row) => {
        if (row.status === "cancelled") return false;
        if (form.contractId && row.contractId === form.contractId) return true;
        if (form.projectId && row.projectId === form.projectId) return true;
        return false;
      }),
    [relatedInvoices, form.contractId, form.projectId],
  );

  useEffect(() => {
    if (billingTouched.current || investmentCents <= 0) return;
    const nextType = suggestedInvoiceBillingType(
      projectRelatedInvoices,
      splitInvoiceInvestmentCents(investmentCents).depositCents,
    );
    if (nextType === billingType) return;
    const nextItems = invoiceItemsForBillingType(nextType, sourceItems, investmentCents);
    setBillingType(nextType);
    if (nextItems) setItems(nextItems);
    setForm((current) => ({ ...current, notes: applyInvoiceBillingNotes(current.notes, nextType) }));
  }, [projectRelatedInvoices, investmentCents, sourceItems, billingType]);

  function chooseBillingType(type: InvoiceBillingType) {
    billingTouched.current = true;
    setBillingType(type);
    const nextItems = invoiceItemsForBillingType(type, sourceItems, investmentCents);
    if (nextItems) setItems(nextItems);
    setForm((current) => ({ ...current, notes: applyInvoiceBillingNotes(current.notes, type) }));
  }

  const clientProjects = projects.filter(
    (project) => project.clientId === form.clientId && (!project.archived || project.id === form.projectId),
  );
  const client = clients.find((item) => item.id === form.clientId);
  const project = projects.find((item) => item.id === form.projectId);
  const mailRecipients = documentMailRecipients(
    client?.email,
    portalAccounts.filter((account) => account.clientId === form.clientId).map((account) => account.email),
  );
  const clientContracts = useMemo(
    () =>
      accepted.filter((row) => {
        if (row.clientId !== form.clientId) return false;
        if (form.projectId && row.projectId && row.projectId !== form.projectId) return false;
        return true;
      }),
    [accepted, form.clientId, form.projectId],
  );
  const contractOptions = useMemo(() => {
    const rows = clientContracts.map((item) => ({
      id: item.id,
      label: item.number,
      projectId: item.projectId,
    }));
    if (form.contractId && !rows.some((row) => row.id === form.contractId)) {
      const fallback = accepted.find((row) => row.id === form.contractId);
      rows.unshift({
        id: form.contractId,
        label: fallback?.number || seededContractNumber || "Selected contract",
        projectId: fallback?.projectId ?? null,
      });
    }
    return rows;
  }, [accepted, clientContracts, form.contractId, seededContractNumber]);
  const contract = accepted.find((item) => item.id === form.contractId);
  const contractNumber = contract?.number || seededContractNumber || "";
  const totals = invoiceDraftTotalCents(items, form.taxCents, form.discountCents);
  const money = (cents: number) => formatMoneyFromCents(cents, form.currency);
  const linkingReason = invoiceLinkingBlockedReason({
    clientId: form.clientId,
    projectId: form.projectId,
    contractId: form.contractId,
    projects,
    contracts: accepted.concat(
      form.contractId && !accepted.some((row) => row.id === form.contractId)
        ? [
            {
              id: form.contractId,
              number: seededContractNumber || "Selected contract",
              clientId: form.clientId,
              projectId: form.projectId || null,
            },
          ]
        : [],
    ),
  });
  const sendReason =
    linkingReason || invoiceSendBlockedReason(items, form.taxCents, form.discountCents, form.issueDate, form.dueDate);
  const canSave = !linkingReason && contractSeedReady && !busy;
  const canSend = canSave && !invoiceSendBlockedReason(items, form.taxCents, form.discountCents, form.issueDate, form.dueDate);
  const lockClient = Boolean(presetClient || presetContract || presetProject);
  const lockProject = Boolean(presetProject || (presetContract && form.projectId));
  const sendCopy = invoiceSendConfirmCopy({
    companyName: client?.businessName || "",
    totalLabel: money(totals.total),
    dueLabel: formatInvoiceDate(form.dueDate),
  });

  async function persistNew(send: boolean) {
    if (saving.current) {
      notify("This invoice is still saving. Try again in a moment.");
      return;
    }
    if (linkingReason) {
      notify(linkingReason);
      return;
    }
    if (form.dueDate && form.issueDate && form.dueDate < form.issueDate) {
      notify("Due date must be on or after the issue date.");
      return;
    }
    if (send) {
      const blocked = invoiceSendBlockedReason(items, form.taxCents, form.discountCents, form.issueDate, form.dueDate);
      if (blocked) {
        notify(blocked);
        return;
      }
    }
    saving.current = true;
    setBusy(true);
    let invoiceId: string | null = null;
    try {
      invoiceId = await createInvoice({
        clientId: form.clientId,
        projectId: form.projectId || null,
        contractId: form.contractId || null,
        proposalId: linkedProposalId,
      });
      await saveInvoiceDraft({
        invoiceId,
        issueDate: form.issueDate,
        dueDate: form.dueDate,
        currency: form.currency,
        taxCents: form.taxCents,
        discountCents: form.discountCents,
        notes: form.notes,
        projectId: form.projectId || null,
        contractId: form.contractId || null,
        proposalId: linkedProposalId,
        adminNotes: form.adminNotes,
        items,
      });
      if (send) {
        const result = await sendInvoice(invoiceId);
        notify(invoiceSentMessage(result.emailed));
      } else {
        notify("Invoice saved as a draft.");
      }
      setSendOpen(false);
      navigate(`/admin/invoices/${invoiceId}`);
    } catch (error) {
      notify(error instanceof AgencyDbError ? error.message : send ? "Unable to send this invoice." : "Unable to save this invoice.");
      if (invoiceId) {
        setSendOpen(false);
        navigate(`/admin/invoices/${invoiceId}`);
      }
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  function onSendClick() {
    if (!canSend) {
      notify(sendReason || "Add the required invoice information before sending.");
      return;
    }
    setSendOpen(true);
  }

  function editorActions() {
    if (clients.length === 0 || !canManage) return null;
    return (
      <InvoiceEditorActions
        busy={busy}
        canSave={canSave}
        canSend={canSend}
        sendReason={sendReason}
        onSave={() => void persistNew(false)}
        onSend={onSendClick}
        onPreview={scrollToInvoicePreview}
      />
    );
  }

  const contextLine = [client?.businessName, project?.name].filter(Boolean).join(" · ");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Link to="/admin/invoices" className="text-[12px] font-medium text-[var(--admin-blue)] hover:underline">
          Invoices
        </Link>
        {presetContract ? (
          <Link
            to={`/admin/contracts/${presetContract}`}
            className="text-[12px] font-medium text-[var(--admin-blue)] hover:underline"
          >
            Contract
          </Link>
        ) : null}
      </div>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-heading text-[1.65rem] font-semibold tracking-tight">Create Invoice</h1>
            <InvoiceStatusBadge status="draft" />
            <span className="font-heading text-sm font-semibold text-[var(--admin-muted)]">Invoice Draft</span>
            {contractNumber ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-[rgb(16_185_129_/_0.12)] px-2.5 py-1 font-heading text-[12px] font-semibold text-emerald-800">
                <Check className="h-3.5 w-3.5" />
                Linked to accepted contract
              </span>
            ) : null}
          </div>
          {contextLine ? <p className="mt-1 text-sm text-[var(--admin-muted)]">{contextLine}</p> : null}
          {contractNumber && form.contractId ? (
            <p className="mt-1 text-sm text-[var(--admin-muted)]">
              Based on accepted contract{" "}
              <Link className="font-medium text-[var(--admin-blue)] hover:underline" to={`/admin/contracts/${form.contractId}`}>
                {contractNumber}
              </Link>
              {investmentCents > 0 ? ` · Project ${formatUsdFromCents(investmentCents)}` : ""}
              {totals.total > 0 ? ` · Invoice ${formatUsdFromCents(totals.total)}` : ""}
            </p>
          ) : (
            <p className="mt-1 max-w-2xl text-sm text-[var(--admin-muted)]">
              Create an invoice for an approved project or contract. Review the billing details before sending it to the
              client.
            </p>
          )}
        </div>
        {editorActions()}
      </div>
      {clients.length > 0 && canManage && contractNumber ? (
        <section className="rounded-[var(--admin-radius)] border border-[rgb(16_185_129_/_0.35)] bg-[rgb(16_185_129_/_0.06)] p-5">
          <p className="inline-flex items-center gap-1.5 font-heading text-base font-semibold text-emerald-800">
            <Check className="h-4 w-4" />
            Linked to accepted contract ✓
          </p>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--admin-muted)]">
            The client has accepted the contract. Review the billing details, then save a draft or send this invoice.
          </p>
          <p className="mt-2 text-sm font-semibold text-[var(--admin-ink)]">Next step: Send Invoice</p>
          <button type="button" disabled={!canSend} className={`${adminPrimaryBtn} mt-4`} onClick={onSendClick}>
            <Send className="mr-2 h-4 w-4" />
            Send Invoice
          </button>
        </section>
      ) : null}
      {clients.length > 0 && canManage && sendReason ? (
        <p className="text-sm text-[var(--admin-muted)]">{sendReason}</p>
      ) : null}
      {!canManage ? (
        <p className="text-sm text-[var(--admin-muted)]">You don’t have permission to create invoices.</p>
      ) : clients.length === 0 ? (
        <NeedClientEmpty document="invoice" />
      ) : (
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
          <form className="space-y-6" onSubmit={(event) => event.preventDefault()}>
            <InvoiceBillingTypeCard
              currency={form.currency}
              investmentCents={investmentCents}
              billingType={billingType}
              relatedInvoices={projectRelatedInvoices}
              disabled={busy || !contractSeedReady}
              onChange={chooseBillingType}
            />
            <InvoiceDraftForm
              value={form}
              items={items}
              disabled={busy || !contractSeedReady}
              lockClient={lockClient}
              lockProject={lockProject}
              lockContract={Boolean(presetContract)}
              lineItemsHelper={
                investmentCents > 0
                  ? "The Payment amount choice above fills these line items. You can still edit them. The invoice total is these line items, not the proposal investment."
                  : undefined
              }
              clients={clients.map((item) => ({ id: item.id, label: item.businessName }))}
              projects={clientProjects.map((item) => ({ id: item.id, label: item.name }))}
              contracts={contractOptions}
              onChange={setForm}
              onItemsChange={setItems}
            />
          </form>
          <div id="invoice-preview" className="rounded-[var(--admin-radius)] transition-shadow xl:sticky xl:top-4">
            <p className="mb-3 font-heading text-sm font-semibold text-[var(--admin-ink)]">Client preview</p>
            <p className="mb-4 text-[12px] leading-5 text-[var(--admin-muted)]">
              This is what the client sees. Internal notes and editing controls are not included.
            </p>
            <InvoiceDocumentView
              document={{
                number: "MS-INV-DRAFT",
                issueDate: form.issueDate,
                dueDate: form.dueDate,
                currency: form.currency,
                companyName: client?.businessName || "—",
                contactName: client?.contactName,
                email: client?.email,
                projectName: project?.name,
                contractNumber: contractNumber || undefined,
                notes: form.notes,
                items: previewInvoiceDraftItems(items),
                subtotalCents: totals.subtotal,
                taxCents: totals.tax,
                discountCents: totals.discount,
                totalCents: totals.total,
                amountPaidCents: 0,
                amountDueCents: totals.total,
              }}
            />
          </div>
        </div>
      )}
      <ConfirmDocumentModal
        open={sendOpen}
        busy={busy}
        title={sendCopy.title}
        description={
          <div className="space-y-3">
            <dl className="space-y-2">
              <div className="flex justify-between gap-4">
                <dt>Total</dt>
                <dd className="font-medium text-[var(--admin-ink)]">{sendCopy.totalLabel}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Due</dt>
                <dd className="font-medium text-[var(--admin-ink)]">{sendCopy.dueLabel}</dd>
              </div>
            </dl>
            <p>
              {documentMailRecipientCopy(mailRecipients, { companyName: client?.businessName, action: "send" })} This
              emails the client and makes the invoice available in their portal.
            </p>
          </div>
        }
        actionLabel="Send Invoice"
        cancelLabel="Cancel"
        onClose={() => {
          if (!busy) setSendOpen(false);
        }}
        onConfirm={() => void persistNew(true)}
      />
    </div>
  );
}

function InvoiceEditorActions({
  busy,
  canSave,
  sendReason,
  onSave,
  onSend,
  onPreview,
}: {
  busy: boolean;
  canSave: boolean;
  canSend: boolean;
  sendReason: string | null;
  onSave: () => void;
  onSend: () => void;
  onPreview: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={!canSave}
        title="Save this invoice without sending it to the client."
        className={adminGhostBtn}
        onClick={onSave}
      >
        <Save className="mr-2 h-4 w-4" />
        {busy ? "Saving…" : "Save Draft"}
      </button>
      <button type="button" title="Preview what the client will receive." className={adminGhostBtn} onClick={onPreview}>
        <Eye className="mr-2 h-4 w-4" />
        Preview
      </button>
      <button
        type="button"
        disabled={busy}
        title={sendReason || "Send this invoice to the client and make it available in the client portal."}
        className={adminPrimaryBtn}
        onClick={onSend}
      >
        <Send className="mr-2 h-4 w-4" />
        Send Invoice
      </button>
    </div>
  );
}

function mergeInvoiceNotes(left: string, right: string): string {
  const first = left.trim();
  const second = right.trim();
  if (!second) return first;
  if (!first) return second;
  if (first.includes(second)) return first;
  if (second.includes(first)) return second;
  return `${first}\n\n${second}`;
}

function centsFromMoneyText(text: string): number {
  const match = text.replace(/,/g, "").match(/\$\s*(\d+(?:\.\d{1,2})?)/);
  if (!match) return 0;
  const dollars = Number(match[1]);
  return Number.isFinite(dollars) ? Math.round(dollars * 100) : 0;
}

async function seedInvoiceFromContract(contractId: string): Promise<{
  clientId: string;
  projectId: string;
  contractId: string;
  contractNumber: string;
  proposalId: string | null;
  items: LineItemDraft[];
  notes: string;
  adminNotes: string;
  investmentCents: number;
} | null> {
  const detail = await fetchContractDetail(contractId);
  if (!detail) return null;
  const revision = detail.published ?? detail.working;
  const proposalId = detail.contract.proposal_id;
  let items: LineItemDraft[] = [];
  let investmentCents = 0;
  if (proposalId) {
    const proposal = await fetchProposalDetail(proposalId).catch(() => null);
    const source = proposal?.published ?? proposal?.working;
    investmentCents = source?.investment_cents ?? 0;
    if (proposal) items = proposalLineDrafts(proposal).filter((item) => item.name.trim());
  }
  if (items.length === 0) {
    items = [
      {
        ...emptyLineItem(),
        name: revision.title.trim() || "Website Design & Development",
        unitPriceCents: investmentCents || centsFromMoneyText(revision.compensation),
      },
    ];
  }
  if (investmentCents <= 0) {
    investmentCents = invoiceDraftTotalCents(items, 0, 0).subtotal || centsFromMoneyText(revision.compensation);
  }
  return {
    clientId: detail.contract.client_id,
    projectId: detail.contract.project_id ?? "",
    contractId: detail.contract.id,
    contractNumber: detail.contract.contract_number,
    proposalId,
    items,
    notes: revision.payment_terms.trim(),
    adminNotes: `Copied from contract ${detail.contract.contract_number}.`,
    investmentCents,
  };
}
