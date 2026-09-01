import { Link, useParams } from "react-router-dom";

export function ClientPaymentCancelled() {
  const { id } = useParams();
  const invoiceHref = id ? `/client/invoices/${id}` : "/client/invoices";

  return (
    <div className="mx-auto w-full max-w-lg space-y-6">
      <Link to={invoiceHref} className="text-[12px] font-medium text-[var(--client-blue)] hover:underline">
        Invoice
      </Link>
      <header>
        <h1 className="font-heading text-[1.75rem] font-semibold tracking-tight">Payment could not be completed</h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--client-muted)]">
          No payment was recorded. Your invoice is unchanged.
        </p>
      </header>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          to={invoiceHref}
          className="inline-flex h-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--client-blue)] px-5 font-heading text-sm font-semibold text-white"
        >
          Return to Invoice
        </Link>
        <Link
          to="/client/invoices"
          className="inline-flex h-11 items-center justify-center rounded-[var(--client-radius)] border border-[var(--client-line)] bg-white px-5 font-heading text-sm font-semibold text-[var(--client-ink)]"
        >
          All invoices
        </Link>
      </div>
    </div>
  );
}
