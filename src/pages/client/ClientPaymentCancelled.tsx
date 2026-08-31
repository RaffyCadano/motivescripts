import { Link, useParams } from "react-router-dom";

export function ClientPaymentCancelled() {
  const { id } = useParams();
  return (
    <div className="w-full space-y-6">
      <Link to={id ? `/client/invoices/${id}` : "/client/invoices"} className="text-[12px] font-medium text-[var(--client-blue)] hover:underline">
        Back to invoice
      </Link>
      <h1 className="font-heading text-[1.75rem] font-semibold tracking-tight">Payment cancelled</h1>
      <p className="text-sm text-[var(--client-muted)]">Payment was cancelled. Your invoice has not been paid.</p>
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
