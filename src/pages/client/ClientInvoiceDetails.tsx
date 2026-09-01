import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { InvoiceDocumentView } from "@/components/invoices/InvoiceDocumentView";
import { InvoiceStatusBadge } from "@/components/invoices/InvoiceStatusBadge";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import { fetchClientContractSummaries } from "@/data/documentsRepository";
import {
  canPayInvoiceOnline,
  formatInvoiceDate,
  latestActivePayment,
  paymentMethodLabel,
  paymentStatusLabel,
} from "@/data/invoices";
import { fetchInvoiceDetail, downloadInvoicePdf, markInvoiceViewed, type InvoiceDetail } from "@/data/invoicesRepository";
import { formatMoneyFromCents } from "@/data/money";
import { createCheckoutSession } from "@/data/stripePaymentsRepository";
import { AgencyDbError } from "@/lib/dbErrors";

export function ClientInvoiceDetails() {
  const { id } = useParams();
  const { clients, projects, notify } = useLeads();
  const [detail, setDetail] = useState<InvoiceDetail | null>(null);
  const [contractNumber, setContractNumber] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payBusy, setPayBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  async function load() {
    if (!id) return;
    const next = await fetchInvoiceDetail(id);
    setDetail(next);
    if (!next) {
      setContractNumber(null);
      return;
    }
    if (next.invoice.contract_id) {
      const contracts = await fetchClientContractSummaries().catch(() => []);
      setContractNumber(contracts.find((row) => row.id === next.invoice.contract_id)?.number ?? null);
    } else {
      setContractNumber(null);
    }
    try {
      await markInvoiceViewed(next.invoice.id);
    } catch {
      /* first-view tracking is best-effort and must not block reading */
    }
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    void load()
      .catch((caught) => setError(caught instanceof AgencyDbError ? caught.message : "Unable to load this invoice."))
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
        <h1 className="font-heading text-2xl font-semibold">Invoice not found</h1>
        <p className="mt-2 text-sm text-[var(--client-muted)]">{error ?? "This invoice isn’t available for your account."}</p>
        <Link to="/client/invoices" className="mt-3 inline-flex text-sm font-semibold text-[var(--client-blue)]">
          Back to invoices
        </Link>
      </div>
    );
  }

  const company = clients[0]?.businessName ?? "your company";
  const project = projects.find((item) => item.id === detail.invoice.project_id);
  const items =
    detail.snapshotItems.length > 0
      ? detail.snapshotItems
      : detail.items.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unit_price_cents: item.unit_price_cents,
          total_cents: item.total_cents,
          sort_order: item.sort_order,
        }));
  const payments = [...detail.payments].sort((a, b) => b.payment_date.localeCompare(a.payment_date));
  const money = (cents: number) => formatMoneyFromCents(cents, detail.invoice.currency);
  const payable = canPayInvoiceOnline(detail.effectiveStatus, detail.invoice.amount_due_cents);
  const lastPayment = latestActivePayment(detail.payments);
  const paidAt = detail.invoice.paid_at ?? lastPayment?.payment_date ?? null;

  return (
    <div className="w-full space-y-6">
      <div className="invoice-actions">
        <Link to="/client/invoices" className="text-[12px] font-medium text-[var(--client-blue)] hover:underline">
          Invoices
        </Link>
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-heading text-[1.75rem] font-semibold tracking-tight">Invoice</h1>
              <InvoiceStatusBadge status={detail.effectiveStatus} audience="client" />
            </div>
            <p className="mt-1 font-heading text-sm font-semibold text-[var(--client-ink)]">{detail.invoice.invoice_number}</p>
            {project ? <p className="mt-1 text-sm text-[var(--client-muted)]">{project.name}</p> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pdfBusy}
              className="inline-flex h-10 items-center rounded-[var(--client-radius)] border border-[var(--client-line)] bg-white px-4 font-heading text-sm font-semibold text-[var(--client-ink)] disabled:opacity-60"
              onClick={async () => {
                setPdfBusy(true);
                try {
                  await downloadInvoicePdf(detail.invoice.id);
                } catch (caught) {
                  notify(caught instanceof AgencyDbError ? caught.message : "Unable to generate invoice PDF. Please try again.");
                } finally {
                  setPdfBusy(false);
                }
              }}
            >
              {pdfBusy ? "Generating PDF..." : "Download PDF"}
            </button>
            <button
              type="button"
              className="inline-flex h-10 items-center rounded-[var(--client-radius)] border border-[var(--client-line)] bg-white px-4 font-heading text-sm font-semibold text-[var(--client-ink)]"
              onClick={() => window.print()}
            >
              Print
            </button>
          </div>
        </div>
      </div>

      <InvoiceDocumentView
        tone="client"
        document={{
          number: detail.invoice.invoice_number,
          issueDate: detail.invoice.issue_date,
          dueDate: detail.invoice.due_date,
          currency: detail.invoice.currency,
          companyName: detail.billTo?.businessName || company,
          contactName: detail.billTo?.contactName,
          email: detail.billTo?.email,
          projectName: project?.name,
          contractNumber,
          notes: detail.invoice.notes,
          items,
          subtotalCents: detail.invoice.subtotal_cents,
          taxCents: detail.invoice.tax_cents,
          discountCents: detail.invoice.discount_cents,
          totalCents: detail.invoice.total_cents,
          amountPaidCents: detail.invoice.amount_paid_cents,
          amountDueCents: detail.invoice.amount_due_cents,
          status: detail.effectiveStatus,
          paidAt,
        }}
      />

      {payable ? (
        <section className="invoice-actions rounded-[var(--client-radius)] border border-[var(--client-line)] bg-[var(--client-card)] p-5">
          <h2 className="font-heading text-sm font-semibold">Pay Invoice</h2>
          <p className="mt-2 text-sm text-[var(--client-muted)]">
            {detail.invoice.amount_paid_cents > 0 ? (
              <>
                Paid {money(detail.invoice.amount_paid_cents)}. Remaining {money(detail.invoice.amount_due_cents)}.
              </>
            ) : (
              <>Amount due: {money(detail.invoice.amount_due_cents)}</>
            )}{" "}
            Card details are entered on Stripe’s checkout page — MotiveScripts never sees your card number.
          </p>
          <button
            type="button"
            disabled={payBusy}
            className="mt-4 inline-flex h-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--client-blue)] px-5 font-heading text-sm font-semibold text-white disabled:opacity-60"
            onClick={async () => {
              setPayBusy(true);
              try {
                const url = await createCheckoutSession(detail.invoice.id);
                window.location.assign(url);
              } catch (caught) {
                notify(caught instanceof AgencyDbError ? caught.message : "Unable to start online payment.");
                setPayBusy(false);
              }
            }}
          >
            {payBusy ? "Redirecting…" : "Pay Invoice"}
          </button>
        </section>
      ) : null}

      <section className="invoice-actions rounded-[var(--client-radius)] border border-[var(--client-line)] bg-[var(--client-card)] p-5">
        <h2 className="font-heading text-sm font-semibold">Payment history</h2>
        {payments.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--client-muted)]">No payments recorded yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-[rgb(7_17_31_/_0.08)]">
            {payments.map((payment) => (
              <li key={payment.id} className="flex flex-wrap items-start justify-between gap-2 py-3">
                <div>
                  <p className="text-sm font-medium">{formatInvoiceDate(payment.payment_date)}</p>
                  <p className="mt-1 text-[12px] text-[var(--client-muted)]">
                    {paymentMethodLabel(payment.payment_method)} · {paymentStatusLabel(payment.reversed_at)}
                  </p>
                </div>
                <p className="font-heading text-sm font-semibold">{money(payment.amount_cents)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
