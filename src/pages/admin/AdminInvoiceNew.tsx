import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ConfirmDocumentModal } from "@/components/documents/ConfirmDocumentModal";
import { InvoiceDocumentView } from "@/components/invoices/InvoiceDocumentView";
import { InvoiceDraftForm, type InvoiceDraftFormValue } from "@/components/invoices/InvoiceDraftForm";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import { documentMailRecipientCopy, documentMailRecipients } from "@/data/documents";
import {
  fetchContractDetail,
  fetchContractSummaries,
  fetchProposalDetail,
  proposalLineDrafts,
} from "@/data/documentsRepository";
import {
  emptyLineItem,
  invoiceDraftTotalCents,
  invoiceItemsFromSnapshot,
  invoiceSendBlockedReason,
  isoCalendarDate,
  isoCalendarDatePlusDays,
  type LineItemDraft,
} from "@/data/invoices";
import { createInvoice, saveInvoiceDraft, sendInvoice } from "@/data/invoicesRepository";
import { invoiceNotesFromSettings } from "@/data/settings";
import { fetchAgencySettings } from "@/data/settingsRepository";
import { AgencyDbError } from "@/lib/dbErrors";

export function AdminInvoiceNew() {
  const { clients, projects, notify, portalAccounts } = useLeads();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const presetClient = searchParams.get("client") ?? "";
  const presetProject = searchParams.get("project") ?? "";
  const presetContract = searchParams.get("contract") ?? "";
  const [accepted, setAccepted] = useState<{ id: string; number: string; clientId: string; projectId: string | null }[]>([]);
  const [items, setItems] = useState<LineItemDraft[]>([emptyLineItem()]);
  const [linkedProposalId, setLinkedProposalId] = useState<string | null>(null);
  const [seededContractNumber, setSeededContractNumber] = useState("");
  const [contractSeedReady, setContractSeedReady] = useState(!presetContract);
  const [busy, setBusy] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
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
    if (!presetContract) return;
    let active = true;
    void seedInvoiceFromContract(presetContract)
      .then((seed) => {
        if (!active || !seed) return;
        setLinkedProposalId(seed.proposalId);
        setSeededContractNumber(seed.contractNumber);
        setItems(seed.items);
        setForm((current) => ({
          ...current,
          clientId: seed.clientId || current.clientId,
          projectId: current.projectId || seed.projectId || "",
          contractId: seed.contractId || current.contractId,
          notes: mergeInvoiceNotes(current.notes, seed.notes),
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
  }, [presetContract]);

  const clientProjects = projects.filter((project) => project.clientId === form.clientId && !project.archived);
  const clientContracts = useMemo(
    () => accepted.filter((row) => row.clientId === form.clientId),
    [accepted, form.clientId],
  );
  const client = clients.find((item) => item.id === form.clientId);
  const mailRecipients = documentMailRecipients(
    client?.email,
    portalAccounts.filter((account) => account.clientId === form.clientId).map((account) => account.email),
  );
  const project = projects.find((item) => item.id === form.projectId);
  const contractOptions = useMemo(() => {
    const rows = clientContracts.map((item) => ({ id: item.id, label: item.number }));
    if (form.contractId && !rows.some((row) => row.id === form.contractId)) {
      rows.unshift({ id: form.contractId, label: seededContractNumber || "Selected contract" });
    }
    return rows;
  }, [clientContracts, form.contractId, seededContractNumber]);
  const contract = clientContracts.find((item) => item.id === form.contractId);
  const totals = invoiceDraftTotalCents(items, form.taxCents, form.discountCents);
  const previewItems = items
    .filter((item) => item.name.trim())
    .map((item, index) => ({
      description: item.name.trim(),
      quantity: item.quantity,
      unit_price_cents: item.unitPriceCents,
      total_cents: item.quantity * item.unitPriceCents,
      sort_order: index,
    }));

  async function persistNew(send: boolean) {
    if (busy) return;
    if (!form.clientId) {
      notify("Select a client first.");
      return;
    }
    if (send) {
      const blocked = invoiceSendBlockedReason(items, form.taxCents, form.discountCents, form.issueDate, form.dueDate);
      if (blocked) {
        notify(blocked);
        return;
      }
    }
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
        notify(result.emailed ? "Invoice sent." : "Invoice sent. The email could not be delivered.");
      } else {
        notify("Invoice saved as a draft.");
      }
      navigate(`/admin/invoices/${invoiceId}`);
    } catch (error) {
      notify(error instanceof AgencyDbError ? error.message : send ? "Unable to send this invoice." : "Unable to save this invoice.");
      if (invoiceId) navigate(`/admin/invoices/${invoiceId}`);
      else setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Link to="/admin/invoices" className="text-[12px] font-medium text-[var(--admin-blue)] hover:underline">
        Invoices
      </Link>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-heading text-[1.65rem] font-semibold tracking-tight">New invoice</h1>
        {clients.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy || !contractSeedReady} className={secondaryBtn} onClick={() => void persistNew(false)}>
              {busy ? "Saving…" : "Save Draft"}
            </button>
            <button type="button" disabled={busy || !contractSeedReady} className={primaryBtn} onClick={() => setSendOpen(true)}>
              Send Invoice
            </button>
          </div>
        ) : null}
      </div>
      {clients.length === 0 ? (
        <p className="text-sm text-[var(--admin-muted)]">Add a client before creating an invoice.</p>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
            <form className="space-y-4 rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
              <InvoiceDraftForm
                value={form}
                items={items}
                disabled={busy}
                lockClient={Boolean(presetClient || presetContract)}
                lockContract={Boolean(presetContract)}
                clients={clients.map((item) => ({ id: item.id, label: item.businessName }))}
                projects={clientProjects.map((item) => ({ id: item.id, label: item.name }))}
                contracts={contractOptions}
                onChange={setForm}
                onItemsChange={setItems}
              />
            </form>
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
                contractNumber: contract?.number || seededContractNumber || undefined,
                notes: form.notes,
                items: invoiceItemsFromSnapshot(previewItems),
                subtotalCents: totals.subtotal,
                taxCents: totals.tax,
                discountCents: totals.discount,
                totalCents: totals.total,
                amountPaidCents: 0,
                amountDueCents: totals.total,
              }}
            />
          </div>
      )}
      <ConfirmDocumentModal
        open={sendOpen}
        busy={busy}
        title="Send this invoice to the client?"
        description={`${documentMailRecipientCopy(mailRecipients, { companyName: client?.businessName, action: "send" })} They’ll see this invoice in the Client Portal. Email is attempted after send; a delivery failure will not undo the invoice.`}
        actionLabel="Send Invoice"
        onClose={() => setSendOpen(false)}
        onConfirm={() => {
          setSendOpen(false);
          void persistNew(true);
        }}
      />
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
        name: revision.title.trim() || "Website",
        unitPriceCents: investmentCents || centsFromMoneyText(revision.compensation),
      },
    ];
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
  };
}

const primaryBtn =
  "inline-flex h-10 items-center rounded-[var(--admin-radius)] bg-[var(--admin-navy)] px-4 font-heading text-sm font-semibold text-white disabled:opacity-60";
const secondaryBtn =
  "inline-flex h-10 items-center rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-white px-4 font-heading text-sm font-semibold disabled:opacity-60";
