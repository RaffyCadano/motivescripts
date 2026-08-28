import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { InvoiceStatusBadge } from "@/components/invoices/InvoiceStatusBadge";
import { fetchInvoiceDetail } from "@/data/invoicesRepository";
import type { EffectiveInvoiceStatus } from "@/data/invoices";
import { formatMoneyFromCents } from "@/data/money";
import { AgencyDbError } from "@/lib/dbErrors";

type Phase = "processing" | "received" | "paid";

export function ClientPaymentSuccess() {
  const { id } = useParams();
  const [phase, setPhase] = useState<Phase>("processing");
  const [dueLabel, setDueLabel] = useState<string | null>(null);
  const [status, setStatus] = useState<EffectiveInvoiceStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        setDueLabel(formatMoneyFromCents(detail.invoice.amount_due_cents, detail.invoice.currency));
        setStatus(detail.effectiveStatus);
        const recentStripe = detail.payments.some(
          (payment) =>
            payment.payment_method === "stripe" &&
            payment.reversed_at == null &&
            Date.now() - new Date(payment.created_at).getTime() < 15 * 60 * 1000,
        );
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
    phase === "paid" ? "Payment received" : phase === "received" ? "Payment received" : "Payment submitted";
  const body =
    phase === "paid"
      ? "Your payment is confirmed. This invoice is paid in full."
      : phase === "received"
        ? "Your payment is confirmed. The remaining balance is shown on the invoice."
        : "Your payment is being confirmed. This page does not mark the invoice paid by itself — confirmation comes from Stripe.";

  return (
    <div className="w-full space-y-6">
      <Link to={id ? `/client/invoices/${id}` : "/client/invoices"} className="text-[12px] font-medium text-[var(--client-blue)] hover:underline">
        Back to invoice
      </Link>
      <h1 className="font-heading text-[1.75rem] font-semibold tracking-tight">{title}</h1>
      {error ? <p className="text-sm text-[var(--client-muted)]">{error}</p> : <p className="text-sm text-[var(--client-muted)]">{body}</p>}
      {phase === "processing" && !error ? (
        <p className="text-sm text-[var(--client-muted)]">Payment processing… this usually takes a few seconds.</p>
      ) : null}
      {dueLabel && phase !== "paid" ? (
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <span>Amount due {dueLabel}</span>
          {status ? <InvoiceStatusBadge status={status} audience="client" /> : null}
        </p>
      ) : status && phase === "paid" ? (
        <InvoiceStatusBadge status={status} audience="client" />
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
