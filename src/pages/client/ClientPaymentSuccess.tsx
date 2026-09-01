import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { InvoiceStatusBadge } from "@/components/invoices/InvoiceStatusBadge";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import { formatInvoiceListDate, latestActivePayment, type EffectiveInvoiceStatus } from "@/data/invoices";
import { fetchInvoiceDetail } from "@/data/invoicesRepository";
import { formatMoneyFromCents } from "@/data/money";
import { AgencyDbError } from "@/lib/dbErrors";

type Phase = "processing" | "received" | "paid";

export function ClientPaymentSuccess() {
  const { id } = useParams();
  const { projects } = useLeads();
  const [phase, setPhase] = useState<Phase>("processing");
  const [number, setNumber] = useState<string | null>(null);
  const [currency, setCurrency] = useState("USD");
  const [paidCents, setPaidCents] = useState(0);
  const [dueCents, setDueCents] = useState(0);
  const [paidDate, setPaidDate] = useState<string | null>(null);
  const [status, setStatus] = useState<EffectiveInvoiceStatus | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
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
        setProjectId(detail.invoice.project_id);
        setCurrency(detail.invoice.currency);
        setPaidCents(detail.invoice.amount_paid_cents);
        setDueCents(detail.invoice.amount_due_cents);
        setStatus(detail.effectiveStatus);
        const recentStripe = latestActivePayment(
          detail.payments.filter((payment) => payment.payment_method === "stripe"),
        );
        const recentEnough =
          recentStripe && Date.now() - new Date(recentStripe.created_at).getTime() < 15 * 60 * 1000
            ? recentStripe
            : null;
        const dateSource = recentEnough?.payment_date ?? detail.invoice.paid_at;
        if (dateSource) setPaidDate(dateSource);
        if (detail.invoice.status === "paid") {
          setPhase("paid");
          return;
        }
        if (recentEnough) {
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

  const project = projectId ? projects.find((item) => item.id === projectId) : undefined;
  const projectHref = project ? `/client/project/${project.id}` : null;
  const success = phase === "paid" || phase === "received";
  const title = success ? "Payment successful ✓" : "Confirming your payment";
  const money = (cents: number) => formatMoneyFromCents(cents, currency);

  return (
    <div className="mx-auto w-full max-w-lg space-y-6">
      <Link
        to={id ? `/client/invoices/${id}` : "/client/invoices"}
        className="text-[12px] font-medium text-[var(--client-blue)] hover:underline"
      >
        Invoice
      </Link>

      <header>
        <h1 className="font-heading text-[1.75rem] font-semibold tracking-tight">{title}</h1>
        {error ? (
          <p className="mt-3 text-sm text-[var(--client-muted)]">{error}</p>
        ) : (
          <SuccessCopy phase={phase} number={number} timedOut={timedOut} dueLabel={dueCents > 0 ? money(dueCents) : null} />
        )}
      </header>

      {number ? (
        <dl className="divide-y divide-[var(--client-line)] rounded-[var(--client-radius)] border border-[var(--client-line)] bg-[var(--client-card)] px-5 py-1">
          <SummaryRow label="Invoice" value={number} />
          {paidCents > 0 ? <SummaryRow label="Amount paid" value={money(paidCents)} /> : null}
          {paidDate ? <SummaryRow label="Payment date" value={formatInvoiceListDate(paidDate)} /> : null}
          {phase !== "paid" && dueCents > 0 ? <SummaryRow label="Balance due" value={money(dueCents)} /> : null}
          {status ? (
            <div className="flex items-center justify-between gap-4 py-3.5">
              <dt className="text-sm text-[var(--client-muted)]">Status</dt>
              <dd>
                <InvoiceStatusBadge status={status} audience="client" />
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        {id ? (
          <Link
            to={`/client/invoices/${id}`}
            className="inline-flex h-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--client-blue)] px-5 font-heading text-sm font-semibold text-white"
          >
            View Invoice
          </Link>
        ) : null}
        {projectHref ? (
          <Link
            to={projectHref}
            className="inline-flex h-11 items-center justify-center rounded-[var(--client-radius)] border border-[var(--client-line)] bg-white px-5 font-heading text-sm font-semibold text-[var(--client-ink)]"
          >
            Back to Project
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function SuccessCopy({
  phase,
  number,
  timedOut,
  dueLabel,
}: {
  phase: Phase;
  number: string | null;
  timedOut: boolean;
  dueLabel: string | null;
}) {
  if (phase === "paid") {
    return (
      <div className="mt-3 space-y-1 text-sm leading-relaxed text-[var(--client-muted)]">
        <p className="font-medium text-[var(--client-ink)]">Your payment has been received.</p>
        {number ? (
          <p>
            Invoice <span className="font-heading font-semibold text-[var(--client-ink)]">{number}</span> has been paid
            in full.
          </p>
        ) : (
          <p>Your invoice has been paid in full.</p>
        )}
      </div>
    );
  }
  if (phase === "received") {
    return (
      <div className="mt-3 space-y-1 text-sm leading-relaxed text-[var(--client-muted)]">
        <p className="font-medium text-[var(--client-ink)]">Your payment has been received.</p>
        {dueLabel ? (
          <p>
            {number ? (
              <>
                Invoice <span className="font-heading font-semibold text-[var(--client-ink)]">{number}</span> still has a
                balance of {dueLabel}.
              </>
            ) : (
              <>A balance of {dueLabel} remains on this invoice.</>
            )}
          </p>
        ) : (
          <p>This invoice will show as paid once confirmation finishes.</p>
        )}
      </div>
    );
  }
  return (
    <p className="mt-3 text-sm leading-relaxed text-[var(--client-muted)]">
      {timedOut
        ? "This payment is still being confirmed. Open the invoice in a moment — it is not marked paid until Stripe confirms it."
        : "This usually takes a few seconds. The invoice is not marked paid until Stripe confirms the payment."}
    </p>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-3.5">
      <dt className="text-sm text-[var(--client-muted)]">{label}</dt>
      <dd className="text-right font-heading text-sm font-semibold text-[var(--client-ink)]">{value}</dd>
    </div>
  );
}
