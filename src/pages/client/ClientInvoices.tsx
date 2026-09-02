import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { InvoiceStatusBadge } from "@/components/invoices/InvoiceStatusBadge";
import { fetchClientInvoiceSummaries, type InvoiceSummary } from "@/data/invoicesRepository";
import { canPayInvoiceOnline } from "@/data/invoices";
import { formatMoneyFromCents } from "@/data/money";
import { formatClientDate } from "@/data/agencyClients";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import { AgencyDbError } from "@/lib/dbErrors";

export function ClientInvoices() {
  const { projects, notify } = useLeads();
  const [rows, setRows] = useState<InvoiceSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void fetchClientInvoiceSummaries()
      .then((data) => {
        if (active) setRows(data);
      })
      .catch((error) => {
        notify(error instanceof AgencyDbError ? error.message : "Unable to load invoices.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="w-full space-y-6">
      <header>
        <h1 className="font-heading text-[1.75rem] font-semibold tracking-tight md:text-3xl">Invoices</h1>
        <p className="mt-1 text-sm text-[var(--client-muted)]">Review amounts due and payment history for your account.</p>
      </header>
      {loading ? (
        <div className="h-40 animate-pulse rounded-[var(--client-radius)] border border-[var(--client-line)] bg-[var(--client-card)]" />
      ) : rows.length === 0 ? (
        <div className="rounded-[var(--client-radius)] border border-dashed border-[var(--client-line)] bg-[var(--client-card)] px-5 py-10">
          <p className="font-heading text-sm font-semibold">No invoices yet</p>
          <p className="mt-1 text-sm text-[var(--client-muted)]">When MotiveScripts sends an invoice, it will appear here.</p>
        </div>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-[var(--client-radius)] border border-[var(--client-line)] bg-[var(--client-card)] md:block">
            <table className="w-full min-w-[48rem] text-left text-[13px]">
              <thead>
                <tr className="border-b border-[var(--client-line)] text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--client-muted)]">
                  <th className="px-5 py-3">Invoice #</th>
                  <th className="px-5 py-3">Project</th>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Due date</th>
                  <th className="px-5 py-3">Amount</th>
                  <th className="px-5 py-3">Amount due</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-[var(--client-line)] last:border-b-0">
                    <td className="px-5 py-3.5">
                      <Link to={`/client/invoices/${row.id}`} className="font-heading font-semibold text-[var(--client-blue)] hover:underline">
                        {row.number}
                      </Link>
                    </td>
                    <td className="px-5 py-3.5">{projects.find((item) => item.id === row.projectId)?.name ?? "—"}</td>
                    <td className="px-5 py-3.5 text-[var(--client-muted)]">{formatClientDate(`${row.issueDate}T00:00:00`)}</td>
                    <td className="px-5 py-3.5 text-[var(--client-muted)]">{formatClientDate(`${row.dueDate}T00:00:00`)}</td>
                    <td className="px-5 py-3.5">{formatMoneyFromCents(row.totalCents, row.currency)}</td>
                    <td className="px-5 py-3.5">{formatMoneyFromCents(row.amountDueCents, row.currency)}</td>
                    <td className="px-5 py-3.5">
                      <InvoiceStatusBadge status={row.effectiveStatus} audience="client" />
                    </td>
                    <td className="px-5 py-3.5">
                      {canPayInvoiceOnline(row.effectiveStatus, row.amountDueCents) ? (
                        <Link
                          to={`/client/invoices/${row.id}`}
                          className="font-heading text-[12px] font-semibold text-[var(--client-blue)] hover:underline"
                        >
                          Pay Invoice
                        </Link>
                      ) : (
                        <Link
                          to={`/client/invoices/${row.id}`}
                          className="font-heading text-[12px] font-semibold text-[var(--client-blue)] hover:underline"
                        >
                          View
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="space-y-3 md:hidden">
            {rows.map((row) => (
              <li key={row.id} className="rounded-[var(--client-radius)] border border-[var(--client-line)] bg-[var(--client-card)] p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-heading text-sm font-semibold">{row.number}</p>
                    <p className="mt-1 text-sm">{projects.find((item) => item.id === row.projectId)?.name ?? "—"}</p>
                    <p className="mt-2 font-heading text-sm">{formatMoneyFromCents(row.amountDueCents, row.currency)} due</p>
                  </div>
                  <InvoiceStatusBadge status={row.effectiveStatus} audience="client" />
                </div>
                <div className="mt-3 flex flex-wrap gap-3">
                  <Link to={`/client/invoices/${row.id}`} className="inline-flex font-heading text-sm font-semibold text-[var(--client-blue)]">
                    View
                  </Link>
                  {canPayInvoiceOnline(row.effectiveStatus, row.amountDueCents) ? (
                    <Link to={`/client/invoices/${row.id}`} className="inline-flex font-heading text-sm font-semibold text-[var(--client-blue)]">
                      Pay Invoice
                    </Link>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
