import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { InvoiceStatusBadge } from "@/components/invoices/InvoiceStatusBadge";
import { fetchInvoiceDetail } from "@/data/invoicesRepository";
import { formatInvoiceDate, type EffectiveInvoiceStatus } from "@/data/invoices";
import { formatMoneyFromCents } from "@/data/money";
import { AgencyDbError } from "@/lib/dbErrors";

type Phase = "processing" | "received" | "paid";

export function ClientPaymentSuccess() {
  const { id } = useParams();
  const [phase, setPhase] = useState<Phase>("processing");
  const [number, setNumber] = useState<string | null>(null);
  const [paidLabel, setPaidLabel] = useState<string | null>(null);
  const [paidDate, setPaidDate] = useState<string | null>(null);
  const [dueLabel, setDueLabel] = useState<string | null>(null);
  const [status, setStatus] = useState<EffectiveInvoiceStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!id) return;
    let active = true;
    let attempts = 0;
    const maxAttempts = 8;

    async function check() {
      try {
        const detail = await fetchInvoiceDetail(id!);
        if (!active) return;
        if (!detail) {
          setError("This invoice isn’t available for your account.");
          return;
        }
        setNumber(detail.invoice.invoice_number);
        setDueLabel(formatMoneyFromCents(detail.invoice.amount_due_cents, detail.invoice.currency));
        setPaidLabel(
          detail.invoice.amount_paid_cents > 0
            ? formatMoneyFromCents(detail.invoice.amount_paid_cents, detail.invoice.currency)
            : null,
        );
        setStatus(detail.effectiveStatus);
        const stripePayments = [...detail.payments]
          .filter((payment) => payment.payment_method === "stripe" && payment.reversed_at == null)
          .sort((a, b) => b.created_at.localeCompare(a.created_at));
        const recentStripe = stripePayments.find(
          (payment) => Date.now() - new Date(payment.created_at).getTime() < 15 * 60 * 1000,
        );
        if (recentStripe) {
          setPaidDate(formatInvoiceDate(recentStripe.payment_date));
        }
        if (detail.invoice.status === "paid") {
          setPhase("paid");
          return;
        }
        if (recentStripe) {
          setPhase("received");
          return;
        }
        attempts += 1;
        if (attempts < maxAttempts) {
          window.setTimeout(() => {
            void check();
          }, 2000);
        } else {
          setTimedOut(true);
        }
      } catch (caught) {
        if (!active) return;
        setError(caught instanceof AgencyDbError ? caught.message : "Unable to refresh this invoice.");
      }
    }

    void check();
    return () => {
      active = false;
    };
  }, [id]);

  const title =
    phase === "paid" || phase === "received" ? "Payment successful ✓" : "Confirming your payment";
  const body =
    phase === "paid"
      ? "Your payment was received. Your invoice has been updated."
      : phase === "received"
        ? "Your payment was received. Your invoice has been updated."
        : "Stripe is confirming this payment. This page does not mark the invoice paid by itself.";

  return (
    <div className="w-full space-y-6">
      <Link to={id ? `/client/invoices/${id}` : "/client/invoices"} className="text-[12px] font-medium text-[var(--client-blue)] hover:underline">
        Back to invoice
      </Link>
      <h1 className="font-heading text-[1.75rem] font-semibold tracking-tight">{title}</h1>
      {error ? <p className="text-sm text-[var(--client-muted)]">{error}</p> : <p className="text-sm text-[var(--client-muted)]">{body}</p>}
      {phase === "processing" && !error ? (
        <p className="text-sm text-[var(--client-muted)]">
          {timedOut
            ? "Stripe is still confirming this payment. Refresh this page in a moment. The invoice is not marked paid until Stripe confirms it."
            : "Payment processing… this usually takes a few seconds. This page does not mark the invoice paid by itself."}
        </p>
      ) : null}
      {number ? (
        <dl className="max-w-md space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-[var(--client-muted)]">Invoice</dt>
            <dd className="font-heading font-semibold">{number}</dd>
          </div>
          {paidLabel ? (
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--client-muted)]">Amount paid</dt>
              <dd className="font-heading font-semibold">{paidLabel}</dd>
            </div>
          ) : null}
          {paidDate ? (
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--client-muted)]">Date</dt>
              <dd>{paidDate}</dd>
            </div>
          ) : null}
          {dueLabel && phase !== "paid" ? (
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--client-muted)]">Amount due</dt>
              <dd>{dueLabel}</dd>
            </div>
          ) : null}
          {status ? (
            <div className="flex items-center justify-between gap-4">
              <dt className="text-[var(--client-muted)]">Payment status</dt>
              <dd>
                <InvoiceStatusBadge status={status} audience="client" />
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}
      {id ? (
        <Link
          to={`/client/invoices/${id}`}
          className="inline-flex h-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--client-blue)] px-5 font-heading text-sm font-semibold text-white"
        >
          View invoice
        </Link>
      ) : null}
    </div>
  );
}
