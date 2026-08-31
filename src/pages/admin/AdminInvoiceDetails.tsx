import { useEffect, useMemo, useState } from "react";
import { Ban, Download, Mail, PencilLine, RotateCcw, Send, Trash2 } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AdminActionsMenu, type AdminActionsMenuItem } from "@/components/admin/AdminActionsMenu";
import { adminGhostBtn, adminPrimaryBtn } from "@/components/admin/adminActionStyles";
import { ConfirmDocumentModal } from "@/components/documents/ConfirmDocumentModal";
import { InvoiceDocumentView } from "@/components/invoices/InvoiceDocumentView";
import { InvoiceDraftForm, type InvoiceDraftFormValue } from "@/components/invoices/InvoiceDraftForm";
import { InvoiceStatusBadge } from "@/components/invoices/InvoiceStatusBadge";
import { InvoiceWorkflowSteps } from "@/components/invoices/InvoiceWorkflowSteps";
import { RecordPaymentModal } from "@/components/invoices/RecordPaymentModal";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import { documentMailRecipientCopy, documentMailRecipients } from "@/data/documents";
import { fetchContractSummaries } from "@/data/documentsRepository";
import {
  canCancelInvoice,
  canDeleteInvoice,
  canEditSentInvoice,
  canRecordInvoicePayment,
  canRestoreInvoice,
  emptyLineItem,
  formatInvoiceDate,
  invoiceDraftTotalCents,
  invoiceHasActivePayments,
  invoiceLinkingBlockedReason,
  invoiceSendBlockedReason,
  invoiceSendConfirmCopy,
  invoiceSentMessage,
  isoCalendarDate,
  isoCalendarDatePlusDays,
  paymentMethodLabel,
  paymentStatusLabel,
  previewInvoiceDraftItems,
  type LineItemDraft,
} from "@/data/invoices";
import {
  cancelInvoice,
  deleteInvoice,
  downloadInvoicePdf,
  fetchInvoiceDetail,
  invoiceLineDrafts,
  recordInvoicePayment,
  reopenInvoiceDraft,
  resendInvoiceEmail,
  restoreInvoice,
  reverseInvoicePayment,
  saveInvoiceDraft,
  sendInvoice,
  type InvoiceDetail,
} from "@/data/invoicesRepository";
import { formatMoneyFromCents } from "@/data/money";
import { formatClientDate } from "@/data/agencyClients";
import { AgencyDbError } from "@/lib/dbErrors";

export function AdminInvoiceDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { clients, projects, notify, reload, portalAccounts } = useLeads();
  const [detail, setDetail] = useState<InvoiceDetail | null>(null);
  const [accepted, setAccepted] = useState<{ id: string; number: string; clientId: string; projectId: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [resendOpen, setResendOpen] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [reverseId, setReverseId] = useState<string | null>(null);
  const [items, setItems] = useState<LineItemDraft[]>([emptyLineItem()]);
  const [form, setForm] = useState<InvoiceDraftFormValue>({
    clientId: "",
    projectId: "",
    contractId: "",
    issueDate: isoCalendarDate(),
    dueDate: isoCalendarDatePlusDays(14),
    currency: "USD",
    taxCents: 0,
    discountCents: 0,
    notes: "",
    adminNotes: "",
  });

  async function load() {
    if (!id) return;
    const next = await fetchInvoiceDetail(id);
    setDetail(next);
    if (next) {
      setForm({
        clientId: next.invoice.client_id,
        projectId: next.invoice.project_id ?? "",
        contractId: next.invoice.contract_id ?? "",
        issueDate: next.invoice.issue_date,
        dueDate: next.invoice.due_date,
        currency: next.invoice.currency,
        taxCents: next.invoice.tax_cents,
        discountCents: next.invoice.discount_cents,
        notes: next.invoice.notes,
        adminNotes: next.adminNotes,
      });
      setItems(invoiceLineDrafts(next));
    }
  }

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
    let active = true;
    setLoading(true);
    void load()
      .catch((error) => notify(error instanceof AgencyDbError ? error.message : "Unable to load this invoice."))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const client = clients.find((item) => item.id === detail?.invoice.client_id);
  const mailRecipients = documentMailRecipients(
    client?.email,
    portalAccounts
      .filter((account) => account.clientId === detail?.invoice.client_id)
      .map((account) => account.email),
  );
  const project = projects.find((item) => item.id === (form.projectId || detail?.invoice.project_id));
  const clientContracts = useMemo(
    () =>
      accepted.filter((row) => {
        if (row.clientId !== (detail?.invoice.client_id ?? "")) return false;
        if (form.projectId && row.projectId && row.projectId !== form.projectId) return false;
        return true;
      }),
    [accepted, detail?.invoice.client_id, form.projectId],
  );
  const contract = accepted.find((item) => item.id === (form.contractId || detail?.invoice.contract_id));
  const contractOptions = useMemo(() => {
    const rows = clientContracts.map((item) => ({
      id: item.id,
      label: item.number,
      projectId: item.projectId,
    }));
    const selectedId = form.contractId || detail?.invoice.contract_id || "";
    if (selectedId && !rows.some((row) => row.id === selectedId)) {
      const extra = accepted.find((row) => row.id === selectedId);
      if (extra) {
        rows.unshift({ id: extra.id, label: extra.number, projectId: extra.projectId });
      }
    }
    return rows;
  }, [accepted, clientContracts, detail?.invoice.contract_id, form.contractId]);

  if (loading) {
    return <div className="h-64 animate-pulse rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)]" />;
  }
  if (!detail || !id) {
    return (
      <div>
        <h1 className="font-heading text-2xl font-semibold">Invoice not found</h1>
        <Link to="/admin/invoices" className="mt-3 inline-flex text-sm font-semibold text-[var(--admin-blue)]">
          Back to invoices
        </Link>
      </div>
    );
  }

  const current = detail;
  const isDraft = current.invoice.status === "draft";
  const hasPayments = invoiceHasActivePayments(current.payments);
  const locked = hasPayments || !isDraft;
  const totals = isDraft
    ? invoiceDraftTotalCents(items, form.taxCents, form.discountCents)
    : {
        subtotal: current.invoice.subtotal_cents,
        tax: current.invoice.tax_cents,
        discount: current.invoice.discount_cents,
        total: current.invoice.total_cents,
      };
  const previewItems = isDraft
    ? previewInvoiceDraftItems(items)
    : current.snapshotItems.length > 0
      ? current.snapshotItems
      : current.items.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unit_price_cents: item.unit_price_cents,
          total_cents: item.total_cents,
          sort_order: item.sort_order,
        }));
  const linkingReason = invoiceLinkingBlockedReason({
    clientId: current.invoice.client_id,
    projectId: form.projectId,
    contractId: form.contractId,
    projects,
    contracts: accepted.concat(
      form.contractId && !accepted.some((row) => row.id === form.contractId)
        ? [
            {
              id: form.contractId,
              number: contract?.number || "Selected contract",
              clientId: current.invoice.client_id,
              projectId: form.projectId || null,
            },
          ]
        : [],
    ),
  });
  const sendReason = invoiceSendBlockedReason(items, form.taxCents, form.discountCents, form.issueDate, form.dueDate);
  const sendCopy = invoiceSendConfirmCopy({
    companyName: client?.businessName || current.billTo?.businessName || "",
    totalLabel: formatMoneyFromCents(totals.total, current.invoice.currency),
    dueLabel: formatInvoiceDate(form.dueDate || current.invoice.due_date),
  });
  const money = (cents: number) => formatMoneyFromCents(cents, current.invoice.currency);
  const activity = (client?.activity ?? []).filter((item) =>
    item.description.toLowerCase().includes(current.invoice.invoice_number.toLowerCase()),
  );

  async function persist() {
    if (!isDraft) return;
    const linksChanged =
      form.projectId !== (current.invoice.project_id ?? "") || form.contractId !== (current.invoice.contract_id ?? "");
    if (linksChanged && linkingReason) throw new AgencyDbError(linkingReason);
    if (form.dueDate && form.issueDate && form.dueDate < form.issueDate) {
      throw new AgencyDbError("Due date must be on or after the issue date.");
    }
    await saveInvoiceDraft({
      invoiceId: current.invoice.id,
      issueDate: form.issueDate,
      dueDate: form.dueDate,
      currency: form.currency,
      taxCents: form.taxCents,
      discountCents: form.discountCents,
      notes: form.notes,
      projectId: form.projectId || null,
      contractId: form.contractId || null,
      proposalId: current.invoice.proposal_id,
      adminNotes: form.adminNotes,
      items,
    });
  }

  async function sendDraft() {
    const blocked = invoiceSendBlockedReason(items, form.taxCents, form.discountCents, form.issueDate, form.dueDate);
    if (blocked) {
      notify(blocked);
      return;
    }
    setBusy(true);
    try {
      await saveInvoiceDraft({
        invoiceId: current.invoice.id,
        issueDate: form.issueDate,
        dueDate: form.dueDate,
        currency: form.currency,
        taxCents: form.taxCents,
        discountCents: form.discountCents,
        notes: form.notes,
        projectId: form.projectId || null,
        contractId: form.contractId || null,
        proposalId: current.invoice.proposal_id,
        adminNotes: form.adminNotes,
        items,
      });
      const result = await sendInvoice(current.invoice.id);
      notify(invoiceSentMessage(result.emailed));
      setSendOpen(false);
      await load();
      await reload();
    } catch (error) {
      notify(error instanceof AgencyDbError ? error.message : "Unable to send this invoice.");
    } finally {
      setBusy(false);
    }
  }

  const invoiceActions: AdminActionsMenuItem[] = [
    {
      id: "pdf",
      label: pdfBusy ? "Generating PDF..." : "Download PDF",
      icon: Download,
      disabled: busy || pdfBusy,
      onSelect: async () => {
        setPdfBusy(true);
        try {
          await downloadInvoicePdf(current.invoice.id);
        } catch (error) {
          notify(error instanceof AgencyDbError ? error.message : "Unable to generate invoice PDF. Please try again.");
        } finally {
          setPdfBusy(false);
        }
      },
    },
  ];
  if (isDraft) {
    invoiceActions.push({
      id: "send",
      label: "Send Invoice",
      icon: Send,
      disabled: busy,
      onSelect: () => {
        if (sendReason) {
          notify(sendReason);
          return;
        }
        setSendOpen(true);
      },
    });
  } else if (current.invoice.status !== "cancelled") {
    invoiceActions.push({
      id: "resend",
      label: "Resend email",
      icon: Mail,
      disabled: busy || pdfBusy,
      onSelect: () => setResendOpen(true),
    });
  }
  if (canEditSentInvoice(current.effectiveStatus, hasPayments)) {
    invoiceActions.push({
      id: "edit",
      label: "Edit",
      icon: PencilLine,
      disabled: busy,
      onSelect: () => setEditOpen(true),
    });
  }
  if (canRestoreInvoice(current.effectiveStatus, hasPayments)) {
    invoiceActions.push({
      id: "restore",
      label: "Restore",
      icon: RotateCcw,
      disabled: busy,
      onSelect: () => setRestoreOpen(true),
    });
  }
  if (canRecordInvoicePayment(current.effectiveStatus)) {
    invoiceActions.push({
      id: "pay",
      label: "Record Payment",
      disabled: busy,
      onSelect: () => setPayOpen(true),
    });
  }
  if (canCancelInvoice(current.effectiveStatus, hasPayments)) {
    invoiceActions.push({
      id: "cancel",
      label: "Cancel invoice",
      icon: Ban,
      disabled: busy,
      danger: true,
      separatorBefore: true,
      onSelect: () => setCancelOpen(true),
    });
  }
  if (canDeleteInvoice(current.effectiveStatus, current.payments.length, current.invoice.amount_paid_cents)) {
    invoiceActions.push({
      id: "delete",
      label: "Delete invoice",
      icon: Trash2,
      disabled: busy,
      danger: true,
      separatorBefore: !canCancelInvoice(current.effectiveStatus, hasPayments),
      onSelect: () => setDeleteOpen(true),
    });
  }

  return (
    <div className="space-y-6">
      <Link to="/admin/invoices" className="text-[12px] font-medium text-[var(--admin-blue)] hover:underline">
        Invoices
      </Link>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-heading text-[1.65rem] font-semibold tracking-tight">{current.invoice.invoice_number}</h1>
            <InvoiceStatusBadge status={current.effectiveStatus} />
          </div>
          <p className="mt-1 text-sm text-[var(--admin-muted)]">
            {client?.businessName ?? "Client"}
            {project ? ` · ${project.name}` : ""}
            {contract ? ` · ${contract.number}` : ""}
          </p>
          <InvoiceWorkflowSteps status={current.effectiveStatus} className="mt-3" />
          {contract ? (
            <p className="mt-2 text-sm text-[var(--admin-muted)]">
              <span className="font-heading font-semibold text-emerald-800">Linked to accepted contract ✓</span>
              <span className="ml-2 font-mono text-[12px] text-[var(--admin-ink)]">{contract.number}</span>
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-start gap-2">
          {isDraft ? (
            <>
              <button
                type="button"
                disabled={busy}
                title="Save this invoice without sending it to the client."
                className={adminGhostBtn}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await persist();
                    notify("Invoice saved as a draft.");
                    await load();
                    await reload();
                  } catch (error) {
                    notify(error instanceof AgencyDbError ? error.message : "Unable to save this invoice.");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? "Saving…" : "Save Draft"}
              </button>
              <button
                type="button"
                disabled={busy}
                title={sendReason || "Send this invoice to the client and make it available in the client portal."}
                className={adminPrimaryBtn}
                onClick={() => {
                  if (sendReason) {
                    notify(sendReason);
                    return;
                  }
                  setSendOpen(true);
                }}
              >
                Send Invoice
              </button>
            </>
          ) : null}
          <AdminActionsMenu ariaLabel="Invoice actions" iconOnly items={invoiceActions} />
        </div>
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Total", money(isDraft ? totals.total : current.invoice.total_cents)],
          ["Paid", money(current.invoice.amount_paid_cents)],
          ["Amount due", money(isDraft ? totals.total : current.invoice.amount_due_cents)],
          ["Due date", formatInvoiceDate(form.dueDate || current.invoice.due_date)],
        ].map(([label, value]) => (
          <article key={label} className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] px-4 py-3">
            <p className="text-[12px] text-[var(--admin-muted)]">{label}</p>
            <p className="mt-1 font-heading text-lg font-semibold tracking-tight">{value}</p>
          </article>
        ))}
      </section>

      {locked && !isDraft ? (
        <p className="text-sm text-[var(--admin-muted)]">
          Line items and totals are locked after send
          {hasPayments ? " and after a payment is recorded" : ""}. Record a payment or reverse one if a correction is needed.
        </p>
      ) : null}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <form id="invoice-form" className="space-y-6" onSubmit={(event) => event.preventDefault()}>
          <InvoiceDraftForm
            value={form}
            items={items}
            showClient={false}
            disabled={locked || busy}
            clients={clients.map((item) => ({ id: item.id, label: item.businessName }))}
            projects={projects
              .filter(
                (item) =>
                  item.clientId === current.invoice.client_id && (!item.archived || item.id === form.projectId),
              )
              .map((item) => ({ id: item.id, label: item.name }))}
            contracts={contractOptions}
            onChange={setForm}
            onItemsChange={setItems}
          />
          {isDraft ? (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  title="Save this invoice without sending it to the client."
                  className={adminGhostBtn}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await persist();
                      notify("Invoice saved as a draft.");
                      await load();
                      await reload();
                    } catch (error) {
                      notify(error instanceof AgencyDbError ? error.message : "Unable to save this invoice.");
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {busy ? "Saving…" : "Save Draft"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  title={sendReason || "Send this invoice to the client and make it available in the client portal."}
                  className={adminPrimaryBtn}
                  onClick={() => {
                    if (sendReason) {
                      notify(sendReason);
                      return;
                    }
                    setSendOpen(true);
                  }}
                >
                  Send Invoice
                </button>
              </div>
              <p className="max-w-md text-[12px] leading-5 text-[var(--admin-muted)]">
                Save this invoice without sending it to the client.
              </p>
              <p className="max-w-md text-[12px] leading-5 text-[var(--admin-muted)]">
                Send this invoice to the client and make it available in the client portal.
              </p>
              {sendReason ? <p className="max-w-md text-[12px] leading-5 text-amber-800">{sendReason}</p> : null}
            </div>
          ) : null}
        </form>
        <div className="xl:sticky xl:top-4">
          <p className="mb-1 text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--admin-muted)]">
            Client preview
          </p>
          <p className="mb-3 text-sm leading-6 text-[var(--admin-muted)]">
            This is what the client will receive. Internal notes are not included.
          </p>
          <InvoiceDocumentView
            document={{
              number: current.invoice.invoice_number,
              issueDate: form.issueDate,
              dueDate: form.dueDate,
              currency: form.currency,
              companyName: current.billTo?.businessName || client?.businessName || "Client",
              contactName: current.billTo?.contactName || client?.contactName,
              email: current.billTo?.email || client?.email,
              projectName: project?.name,
              contractNumber: contract?.number,
              notes: form.notes,
              items: previewItems,
              subtotalCents: totals.subtotal,
              taxCents: totals.tax,
              discountCents: totals.discount,
              totalCents: totals.total,
              amountPaidCents: current.invoice.amount_paid_cents,
              amountDueCents: isDraft ? totals.total : current.invoice.amount_due_cents,
            }}
          />
        </div>
      </div>

      <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
        <h2 className="font-heading text-sm font-semibold">Payment history</h2>
        {current.payments.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--admin-muted)]">No payments recorded yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[56rem] text-left text-[13px]">
              <thead>
                <tr className="border-b border-[var(--admin-line)] text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--admin-muted)]">
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Amount</th>
                  <th className="py-2 pr-4">Method</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Reference</th>
                  <th className="py-2 pr-4">Stripe</th>
                  <th className="py-2 pr-4">Notes</th>
                  <th className="py-2 pr-4">Recorded by</th>
                  <th className="py-2"> </th>
                </tr>
              </thead>
              <tbody>
                {current.payments.map((payment) => (
                  <tr key={payment.id} className="border-b border-[var(--admin-line)] last:border-b-0">
                    <td className="py-3 pr-4">{formatInvoiceDate(payment.payment_date)}</td>
                    <td className="py-3 pr-4">
                      {money(payment.amount_cents)}
                      {payment.reversed_at ? (
                        <span className="ml-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--admin-muted)]">
                          Reversed
                        </span>
                      ) : null}
                    </td>
                    <td className="py-3 pr-4">{paymentMethodLabel(payment.payment_method)}</td>
                    <td className="py-3 pr-4">{paymentStatusLabel(payment.reversed_at)}</td>
                    <td className="py-3 pr-4">{payment.reference || "—"}</td>
                    <td className="py-3 pr-4 font-mono text-[12px]">
                      {payment.stripe_payment_intent_id || "—"}
                    </td>
                    <td className="py-3 pr-4">{payment.notes || "—"}</td>
                    <td className="py-3 pr-4">{payment.recorded_by_label || "—"}</td>
                    <td className="py-3">
                      {!payment.reversed_at ? (
                        <button
                          type="button"
                          className="font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline"
                          onClick={() => setReverseId(payment.id)}
                        >
                          Reverse
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
        <h2 className="font-heading text-sm font-semibold">Activity</h2>
        {activity.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--admin-muted)]">No invoice activity recorded on this client yet.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {activity.map((item) => (
              <li key={item.id}>
                <p className="text-sm">{item.description}</p>
                <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">{formatClientDate(item.createdAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ConfirmDocumentModal
        open={sendOpen}
        busy={busy}
        title={sendCopy.title}
        description={`${documentMailRecipientCopy(mailRecipients, { companyName: client?.businessName, action: "send" })} This emails the client and makes the invoice available in their portal.`}
        actionLabel="Send Invoice"
        cancelLabel="Cancel"
        onClose={() => setSendOpen(false)}
        onConfirm={() => void sendDraft()}
      />
      <ConfirmDocumentModal
        open={resendOpen}
        busy={busy}
        title="Resend this invoice email?"
        description={`${documentMailRecipientCopy(mailRecipients, { companyName: client?.businessName, action: "resend" })} They’ll receive another copy of this invoice.`}
        actionLabel="Resend email"
        onClose={() => setResendOpen(false)}
        onConfirm={async () => {
          setBusy(true);
          try {
            await resendInvoiceEmail(current.invoice.id);
            notify("Invoice email sent.");
            setResendOpen(false);
          } catch (error) {
            notify(error instanceof AgencyDbError ? error.message : "The email could not be sent.");
          } finally {
            setBusy(false);
          }
        }}
      />
      <ConfirmDocumentModal
        open={restoreOpen}
        busy={busy}
        title="Restore this invoice?"
        description="It will leave Cancelled and go back to draft or sent, depending on where it was before you cancelled it."
        actionLabel="Restore invoice"
        onClose={() => setRestoreOpen(false)}
        onConfirm={async () => {
          setBusy(true);
          try {
            await restoreInvoice(current.invoice.id);
            notify("Invoice restored.");
            setRestoreOpen(false);
            await load();
            await reload();
          } catch (error) {
            notify(error instanceof AgencyDbError ? error.message : "Unable to restore this invoice.");
          } finally {
            setBusy(false);
          }
        }}
      />
      <ConfirmDocumentModal
        open={editOpen}
        busy={busy}
        title="Edit this invoice?"
        description="It will become a draft again. Line items and totals can be changed. The client will not see it until you send it."
        actionLabel="Edit invoice"
        onClose={() => setEditOpen(false)}
        onConfirm={async () => {
          setBusy(true);
          try {
            await reopenInvoiceDraft(current.invoice.id);
            notify("Invoice is a draft again. You can edit and send it.");
            setEditOpen(false);
            await load();
            await reload();
          } catch (error) {
            notify(error instanceof AgencyDbError ? error.message : "Unable to edit this invoice.");
          } finally {
            setBusy(false);
          }
        }}
      />
      <ConfirmDocumentModal
        open={cancelOpen}
        busy={busy}
        danger
        title="Cancel this invoice?"
        description="The client will no longer see it in the portal. Paid invoices and invoices with payments cannot be cancelled."
        actionLabel="Cancel invoice"
        onClose={() => setCancelOpen(false)}
        onConfirm={async () => {
          setBusy(true);
          try {
            await cancelInvoice(current.invoice.id);
            notify("Invoice cancelled.");
            setCancelOpen(false);
            await load();
            await reload();
          } catch (error) {
            notify(error instanceof AgencyDbError ? error.message : "Unable to cancel this invoice.");
          } finally {
            setBusy(false);
          }
        }}
      />
      <ConfirmDocumentModal
        open={deleteOpen}
        busy={busy}
        danger
        title="Delete this invoice?"
        description="This permanently removes the invoice. Invoices with payments cannot be deleted. This cannot be undone."
        actionLabel="Delete invoice"
        onClose={() => setDeleteOpen(false)}
        onConfirm={async () => {
          setBusy(true);
          try {
            await deleteInvoice(current.invoice.id);
            notify("Invoice deleted.");
            setDeleteOpen(false);
            await reload();
            navigate("/admin/invoices");
          } catch (error) {
            notify(error instanceof AgencyDbError ? error.message : "Unable to delete this invoice.");
            setBusy(false);
          }
        }}
      />
      <RecordPaymentModal
        open={payOpen}
        busy={busy}
        amountDueCents={current.invoice.amount_due_cents}
        currency={current.invoice.currency}
        onClose={() => setPayOpen(false)}
        onConfirm={async (input) => {
          setBusy(true);
          try {
            await recordInvoicePayment({
              invoiceId: current.invoice.id,
              amountCents: input.amountCents,
              paymentDate: input.paymentDate,
              method: input.method,
              reference: input.reference,
              notes: input.notes,
            });
            notify("Payment recorded.");
            setPayOpen(false);
            await load();
            await reload();
          } catch (error) {
            notify(error instanceof AgencyDbError ? error.message : "Unable to record this payment.");
          } finally {
            setBusy(false);
          }
        }}
      />
      <ConfirmDocumentModal
        open={Boolean(reverseId)}
        busy={busy}
        title="Reverse this payment?"
        description="The original payment stays in history. Amounts due are recalculated. This does not issue a refund through a processor."
        actionLabel="Reverse payment"
        onClose={() => setReverseId(null)}
        onConfirm={async () => {
          if (!reverseId) return;
          setBusy(true);
          try {
            await reverseInvoicePayment(reverseId);
            notify("Payment reversed.");
            setReverseId(null);
            await load();
            await reload();
          } catch (error) {
            notify(error instanceof AgencyDbError ? error.message : "Unable to reverse this payment.");
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
}
