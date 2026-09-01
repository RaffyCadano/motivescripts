import { Link } from "react-router-dom";
import type { OverviewInvoiceTotals } from "@/data/adminOverview";
import { formatMoneyFromCents } from "@/data/money";

export function OverviewInvoices({ totals }: { totals: OverviewInvoiceTotals }) {
  return (
    <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-heading text-sm font-semibold tracking-tight">Invoices</h2>
        <Link to="/admin/invoices" className="font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline">
          View invoices
        </Link>
      </div>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-[12px] text-[var(--admin-muted)]">Outstanding</dt>
          <dd className="mt-1 font-heading text-xl font-semibold">{formatMoneyFromCents(totals.outstanding)}</dd>
        </div>
        <div>
          <dt className="text-[12px] text-[var(--admin-muted)]">Due soon</dt>
          <dd className="mt-1 font-heading text-xl font-semibold">{formatMoneyFromCents(totals.dueSoon)}</dd>
        </div>
        <div>
          <dt className="text-[12px] text-[var(--admin-muted)]">Overdue</dt>
          <dd className="mt-1 font-heading text-xl font-semibold">{formatMoneyFromCents(totals.overdue)}</dd>
        </div>
        <div>
          <dt className="text-[12px] text-[var(--admin-muted)]">Paid</dt>
          <dd className="mt-1 font-heading text-xl font-semibold">{formatMoneyFromCents(totals.paid)}</dd>
        </div>
      </dl>
    </section>
  );
}
