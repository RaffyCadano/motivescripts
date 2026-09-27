import { useMemo } from "react";
import { AdminStatCard, AdminStatGrid } from "@/components/admin/list/AdminStatCard";
import { buildOverviewInvoiceTotals } from "@/data/adminOverview";
import type { PaymentReportRow } from "@/data/financialReports";
import type { InvoiceSummary } from "@/data/invoicesRepository";
import { formatMoneyFromCents } from "@/data/money";
import { revenueForMonth } from "@/data/overviewExtras";

/** The four money numbers an owner checks first: what came in this month, what is owed, what is late, what is due soon. */
export function OverviewMoney({ invoices, payments }: { invoices: InvoiceSummary[]; payments: PaymentReportRow[] }) {
  const figures = useMemo(() => {
    const totals = buildOverviewInvoiceTotals(invoices);
    const open = invoices.filter((invoice) => invoice.effectiveStatus !== "cancelled" && invoice.effectiveStatus !== "draft" && invoice.amountDueCents > 0);
    return {
      revenue: revenueForMonth(payments),
      outstanding: totals.outstanding,
      overdue: totals.overdue,
      dueSoon: totals.dueSoon,
      overdueCount: open.filter((invoice) => invoice.effectiveStatus === "overdue").length,
      outstandingCount: open.length,
    };
  }, [invoices, payments]);

  const count = (value: number) => `${value} ${value === 1 ? "invoice" : "invoices"}`;

  return (
    <section aria-label="Money">
      <AdminStatGrid columns={4}>
        <AdminStatCard label="Revenue this month" value={formatMoneyFromCents(figures.revenue)} href="/admin/reports" caption="Payments received" />
        <AdminStatCard
          label="Money owed to you"
          value={formatMoneyFromCents(figures.outstanding)}
          href="/admin/invoices"
          caption={figures.outstandingCount === 0 ? "Nothing unpaid" : count(figures.outstandingCount)}
        />
        <AdminStatCard
          label="Overdue"
          value={formatMoneyFromCents(figures.overdue)}
          href="/admin/invoices"
          tone={figures.overdue > 0 ? "danger" : undefined}
          caption={figures.overdueCount === 0 ? "Nothing late" : `${count(figures.overdueCount)} past due`}
        />
        <AdminStatCard label="Due in 7 days" value={formatMoneyFromCents(figures.dueSoon)} href="/admin/invoices" caption="Not yet late" />
      </AdminStatGrid>
    </section>
  );
}
