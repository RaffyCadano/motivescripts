import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ConfirmDocumentModal } from "@/components/documents/ConfirmDocumentModal";
import { InvoiceDocumentView } from "@/components/invoices/InvoiceDocumentView";
import { InvoiceDraftForm, type InvoiceDraftFormValue } from "@/components/invoices/InvoiceDraftForm";
import { InvoiceStatusBadge } from "@/components/invoices/InvoiceStatusBadge";
import { RecordPaymentModal } from "@/components/invoices/RecordPaymentModal";
import {
  adminBlueBtn,
  adminDangerBtn,
  adminGhostBtn,
  adminPrimaryBtn,
  adminSoftBtn,
} from "@/components/admin/adminActionStyles";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import { fetchContractSummaries } from "@/data/documentsRepository";
import {
  canCancelInvoice,
  canRecordInvoicePayment,
  emptyLineItem,
  formatInvoiceDate,
  invoiceDraftTotalCents,
  invoiceHasActivePayments,
  invoiceSendBlockedReason,
  isoCalendarDate,
  isoCalendarDatePlusDays,
  paymentMethodLabel,
  paymentStatusLabel,
  type LineItemDraft,
} from "@/data/invoices";
import {
  cancelInvoice,
  downloadInvoicePdf,
  fetchInvoiceDetail,
  invoiceLineDrafts,
  recordInvoicePayment,
  resendInvoiceEmail,
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
  const { clients, projects, notify, reload } = useLeads();
  const [detail, setDetail] = useState<InvoiceDetail | null>(null);
  const [accepted, setAccepted] = useState<{ id: string; number: string; clientId: string; projectId: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
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
  const project = projects.find((item) => item.id === (form.projectId || detail?.invoice.project_id));
  const clientContracts = useMemo(
    () => accepted.filter((row) => row.clientId === (detail?.invoice.client_id ?? "")),
    [accepted, detail?.invoice.client_id],
  );
  const contract = clientContracts.find((item) => item.id === (form.contractId || detail?.invoice.contract_id));

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
  const locked = !isDraft || hasPayments;
  const totals = isDraft
    ? invoiceDraftTotalCents(items, form.taxCents, form.discountCents)
    : {
        subtotal: current.invoice.subtotal_cents,
        tax: current.invoice.tax_cents,
        discount: current.invoice.discount_cents,
        total: current.invoice.total_cents,
      };
  const previewItems = isDraft
    ? items
        .filter((item) => item.name.trim())
        .map((item, index) => ({
          description: item.name.trim(),
          quantity: item.quantity,
          unit_price_cents: item.unitPriceCents,
          total_cents: item.quantity * item.unitPriceCents,
          sort_order: index,
        }))
    : current.snapshotItems.length > 0
      ? current.snapshotItems
      : current.items.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unit_price_cents: item.unit_price_cents,
          total_cents: item.total_cents,
          sort_order: item.sort_order,
        }));
  const money = (cents: number) => formatMoneyFromCents(cents, current.invoice.currency);
  const activity = (client?.activity ?? []).filter((item) =>
    item.description.toLowerCase().includes(current.invoice.invoice_number.toLowerCase()),
  );

  async function persist() {
    if (!isDraft) return;
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
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || pdfBusy}
            className={adminSoftBtn}
            onClick={async () => {
              setPdfBusy(true);
              try {
                await downloadInvoicePdf(current.invoice.id);
              } catch (error) {
                notify(error instanceof AgencyDbError ? error.message : "Unable to generate invoice PDF. Please try again.");
              } finally {
                setPdfBusy(false);
              }
            }}
          >
            {pdfBusy ? "Generating PDF..." : "Download PDF"}
          </button>
          {isDraft ? (
            <>
              <button
                type="button"
                disabled={busy}
                className={adminGhostBtn}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await persist();
                    notify("Invoice saved.");
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
              <button type="button" disabled={busy} className={adminPrimaryBtn} onClick={() => setSendOpen(true)}>
                Send Invoice
              </button>
            </>
          ) : current.invoice.status !== "cancelled" ? (
            <button
              type="button"
              disabled={busy || pdfBusy}
              className={adminBlueBtn}
              onClick={async () => {
                setBusy(true);
                try {
                  await resendInvoiceEmail(current.invoice.id);
                  notify("Invoice email sent.");
                } catch (error) {
                  notify(error instanceof AgencyDbError ? error.message : "The email could not be sent.");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Resend email
            </button>
          ) : null}
          {canRecordInvoicePayment(current.effectiveStatus) ? (
            <button type="button" disabled={busy} className={adminPrimaryBtn} onClick={() => setPayOpen(true)}>
              Record Payment
            </button>
          ) : null}
          {canCancelInvoice(current.effectiveStatus, hasPayments) ? (
            <button type="button" disabled={busy} className={adminDangerBtn} onClick={() => setCancelOpen(true)}>
              Cancel invoice
            </button>
          ) : null}
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

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <form className="space-y-4 rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
          <h2 className="font-heading text-sm font-semibold">Invoice information</h2>
          <InvoiceDraftForm
            value={form}
            items={items}
            showClient={false}
            disabled={locked || busy}
            clients={clients.map((item) => ({ id: item.id, label: item.businessName }))}
            projects={projects
              .filter((item) => item.clientId === current.invoice.client_id && !item.archived)
              .map((item) => ({ id: item.id, label: item.name }))}
            contracts={clientContracts.map((item) => ({ id: item.id, label: item.number }))}
            onChange={setForm}
            onItemsChange={setItems}
          />
        </form>
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
        title="Send this invoice to the client?"
        description="They’ll see this exact invoice in the Client Portal. Email is attempted after send; a delivery failure will not undo the invoice."
        actionLabel="Send Invoice"
        onClose={() => setSendOpen(false)}
        onConfirm={async () => {
          const blocked = invoiceSendBlockedReason(items, form.taxCents, form.discountCents, form.issueDate, form.dueDate);
          if (blocked) {
            notify(blocked);
            return;
          }
          setBusy(true);
          try {
            await persist();
            const result = await sendInvoice(current.invoice.id);
            notify(result.emailed ? "Invoice sent." : "Invoice sent. The email could not be delivered.");
            setSendOpen(false);
            await load();
            await reload();
          } catch (error) {
            notify(error instanceof AgencyDbError ? error.message : "Unable to send this invoice.");
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
