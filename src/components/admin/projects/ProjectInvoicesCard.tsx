import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { InvoiceStatusBadge } from "@/components/invoices/InvoiceStatusBadge";
import { fetchInvoiceSummaries, type InvoiceSummary } from "@/data/invoicesRepository";
import { formatMoneyFromCents } from "@/data/money";

export function ProjectInvoicesCard({ projectId, clientId }: { projectId: string; clientId: string }) {
  const [rows, setRows] = useState<InvoiceSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void fetchInvoiceSummaries(clientId)
      .then((data) => {
        if (!active) return;
        setRows(data.filter((row) => row.projectId === projectId));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [clientId, projectId]);

  if (loading) {
    return <div className="h-28 animate-pulse rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)]" />;
  }
  if (rows.length === 0) return null;

  return (
    <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
      <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Invoices</h2>
      <ul className="mt-4 space-y-3">
        {rows.map((invoice) => (
          <li key={invoice.id} className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <Link className="text-sm font-medium text-[var(--admin-blue)] hover:underline" to={`/admin/invoices/${invoice.id}`}>
                {invoice.number}
              </Link>
              <div className="mt-1">
                <InvoiceStatusBadge status={invoice.effectiveStatus} />
              </div>
            </div>
            <div className="text-right text-sm">
              <p className="font-medium">{formatMoneyFromCents(invoice.totalCents, invoice.currency)}</p>
              <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">
                Paid {formatMoneyFromCents(invoice.amountPaidCents, invoice.currency)} · Due{" "}
                {formatMoneyFromCents(invoice.amountDueCents, invoice.currency)}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
