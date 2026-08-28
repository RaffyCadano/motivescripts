import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { InvoiceStatusBadge } from "@/components/invoices/InvoiceStatusBadge";
import { fetchInvoiceSummaries, type InvoiceSummary } from "@/data/invoicesRepository";
import { formatMoneyFromCents } from "@/data/money";
import type { AgencyClient } from "@/data/agencyClients";

export function ClientInvoicesSection({ client }: { client: AgencyClient }) {
  const [rows, setRows] = useState<InvoiceSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void fetchInvoiceSummaries(client.id)
      .then((data) => {
        if (active) setRows(data);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [client.id]);

  const visible = rows.filter((row) => row.effectiveStatus !== "cancelled");
  const outstanding = visible.reduce((sum, row) => sum + row.amountDueCents, 0);
  const paid = visible.reduce((sum, row) => sum + row.amountPaidCents, 0);
  const recent = visible.slice(0, 5);

  return (
    <section
      id="invoices"
      className="scroll-mt-4 rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Invoices</h2>
        <div className="flex flex-wrap gap-2">
          <Link
            to={`/admin/invoices?client=${client.id}`}
            className="inline-flex h-9 items-center rounded-lg border border-[var(--admin-line)] px-3 font-heading text-[12px] font-semibold text-[var(--admin-ink)] hover:bg-[var(--admin-bg)]"
          >
            View Invoices
          </Link>
          <Link
            to={`/admin/invoices/new?client=${client.id}`}
            className="inline-flex h-9 items-center rounded-lg bg-[var(--admin-navy)] px-3 font-heading text-[12px] font-semibold text-white"
          >
            Create Invoice
          </Link>
        </div>
      </div>
      {loading ? (
        <div className="mt-4 h-24 animate-pulse rounded-lg bg-[var(--admin-bg)]" />
      ) : (
        <>
          <dl className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-[12px] text-[var(--admin-muted)]">Invoices</dt>
              <dd className="mt-1 font-heading text-2xl font-semibold tracking-tight">{visible.length}</dd>
            </div>
            <div>
              <dt className="text-[12px] text-[var(--admin-muted)]">Outstanding</dt>
              <dd className="mt-1 font-heading text-2xl font-semibold tracking-tight">{formatMoneyFromCents(outstanding)}</dd>
            </div>
            <div>
              <dt className="text-[12px] text-[var(--admin-muted)]">Paid</dt>
              <dd className="mt-1 font-heading text-2xl font-semibold tracking-tight">{formatMoneyFromCents(paid)}</dd>
            </div>
          </dl>
          {recent.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--admin-muted)]">No invoices for this client yet.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {recent.map((invoice) => (
                <li key={invoice.id} className="flex items-start justify-between gap-3">
                  <div>
                    <Link
                      to={`/admin/invoices/${invoice.id}`}
                      className="text-sm font-medium text-[var(--admin-blue)] hover:underline"
                    >
                      {invoice.number}
                    </Link>
                    <div className="mt-1">
                      <InvoiceStatusBadge status={invoice.effectiveStatus} />
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-[var(--admin-ink)]">{formatMoneyFromCents(invoice.totalCents, invoice.currency)}</p>
                    <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">
                      {formatMoneyFromCents(invoice.amountDueCents, invoice.currency)} due
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
