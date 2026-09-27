import { useMemo } from "react";
import { AlarmClock, CalendarClock, TrendingUp, Wallet } from "lucide-react";
import { MetricTile, SectionLabel } from "@/components/admin/overview/kit";
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
    const now = new Date();
    return {
      revenue: revenueForMonth(payments, now),
      lastMonth: revenueForMonth(payments, new Date(now.getFullYear(), now.getMonth() - 1, 15)),
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
      <SectionLabel>Money</SectionLabel>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricTile
          icon={TrendingUp}
          tone="good"
          label="Revenue this month"
          value={formatMoneyFromCents(figures.revenue)}
          href="/admin/reports"
          caption={figures.lastMonth > 0 ? `${formatMoneyFromCents(figures.lastMonth)} last month` : "Payments received"}
        />
        <MetricTile
          icon={Wallet}
          label="Money owed to you"
          value={formatMoneyFromCents(figures.outstanding)}
          href="/admin/invoices"
          caption={figures.outstandingCount === 0 ? "Nothing unpaid" : count(figures.outstandingCount)}
        />
        <MetricTile
          icon={AlarmClock}
          tone={figures.overdue > 0 ? "danger" : "neutral"}
          valueTone={figures.overdue > 0 ? "danger" : undefined}
          label="Overdue"
          value={formatMoneyFromCents(figures.overdue)}
          href="/admin/invoices"
          caption={figures.overdueCount === 0 ? "Nothing late" : `${count(figures.overdueCount)} past due`}
        />
        <MetricTile
          icon={CalendarClock}
          tone={figures.dueSoon > 0 ? "warn" : "neutral"}
          label="Due in 7 days"
          value={formatMoneyFromCents(figures.dueSoon)}
          href="/admin/invoices"
          caption="Not yet late"
        />
      </div>
    </section>
  );
}
