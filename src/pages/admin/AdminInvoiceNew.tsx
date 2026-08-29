import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ConfirmDocumentModal } from "@/components/documents/ConfirmDocumentModal";
import { InvoiceDocumentView } from "@/components/invoices/InvoiceDocumentView";
import { InvoiceDraftForm, type InvoiceDraftFormValue } from "@/components/invoices/InvoiceDraftForm";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import { documentMailRecipientCopy, documentMailRecipients } from "@/data/documents";
import { fetchContractSummaries } from "@/data/documentsRepository";
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
  const [busy, setBusy] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [form, setForm] = useState<InvoiceDraftFormValue>({
    clientId: presetClient || clients[0]?.id || "",
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
          notes: invoiceNotesFromSettings(row) || current.notes,
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
    if (!form.clientId || busy) return;
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
        proposalId: null,
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
      <h1 className="font-heading text-[1.65rem] font-semibold tracking-tight">New invoice</h1>
      {clients.length === 0 ? (
        <p className="text-sm text-[var(--admin-muted)]">Add a client before creating an invoice.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} className={secondaryBtn} onClick={() => void persistNew(false)}>
              {busy ? "Saving…" : "Save Draft"}
            </button>
            <button type="button" disabled={busy} className={primaryBtn} onClick={() => setSendOpen(true)}>
              Send Invoice
            </button>
          </div>
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
            <form className="space-y-4 rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
              <InvoiceDraftForm
                value={form}
                items={items}
                disabled={busy}
                clients={clients.map((item) => ({ id: item.id, label: item.businessName }))}
                projects={clientProjects.map((item) => ({ id: item.id, label: item.name }))}
                contracts={clientContracts.map((item) => ({ id: item.id, label: item.number }))}
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
                companyName: client?.businessName ?? "Client",
                contactName: client?.contactName,
                email: client?.email,
                projectName: project?.name,
                contractNumber: contract?.number,
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
        </>
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

const primaryBtn =
  "inline-flex h-10 items-center rounded-[var(--admin-radius)] bg-[var(--admin-navy)] px-4 font-heading text-sm font-semibold text-white disabled:opacity-60";
const secondaryBtn =
  "inline-flex h-10 items-center rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-white px-4 font-heading text-sm font-semibold disabled:opacity-60";
