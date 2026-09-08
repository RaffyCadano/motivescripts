import { useEffect, useMemo, useState } from "react";
import { AdminEmptyState } from "@/components/admin/list/AdminEmptyState";
import { AdminPageHeader } from "@/components/admin/list/AdminPageHeader";
import { AdminStatCard, AdminStatGrid } from "@/components/admin/list/AdminStatCard";
import { adminFilterControlState } from "@/components/admin/list/adminListStyles";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import {
  buildRevenueReport,
  startOfCurrentMonth,
  startOfCurrentQuarter,
  startOfCurrentYear,
  sumCentsInRange,
  type PaymentReportRow,
  type RevenuePeriodGrain,
} from "@/data/financialReports";
import { fetchAllPayments } from "@/data/financialReportsRepository";
import { formatUsdFromCents } from "@/data/money";
import { AgencyDbError } from "@/lib/dbErrors";

const grains: RevenuePeriodGrain[] = ["month", "quarter", "year"];
const grainLabels: Record<RevenuePeriodGrain, string> = { month: "Month", quarter: "Quarter", year: "Year" };

export function AdminReports() {
  const { notify } = useLeads();
  const [payments, setPayments] = useState<PaymentReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [grain, setGrain] = useState<RevenuePeriodGrain>("month");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let active = true;
    void fetchAllPayments()
      .then((rows) => {
        if (active) setPayments(rows);
      })
      .catch((error) => {
        notify(error instanceof AgencyDbError ? error.message : "Unable to load payments.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const periods = useMemo(() => buildRevenueReport(payments, grain), [payments, grain]);

  const visiblePeriods = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return periods;
    return periods.filter((period) => period.label.toLowerCase().includes(needle));
  }, [periods, query]);

  const summary = useMemo(
    () => ({
      month: sumCentsInRange(payments, startOfCurrentMonth()),
      quarter: sumCentsInRange(payments, startOfCurrentQuarter()),
      year: sumCentsInRange(payments, startOfCurrentYear()),
      recurringYear: payments
        .filter((payment) => payment.recurring && payment.paymentDate.slice(0, 10) >= startOfCurrentYear())
        .reduce((sum, payment) => sum + payment.amountCents, 0),
    }),
    [payments],
  );

  return (
    <div className="space-y-5">
      <AdminPageHeader title="Reports" description="Revenue by period, split between recurring and one-time billing." />

      <section aria-label="Revenue summary">
        <AdminStatGrid columns={4}>
          <AdminStatCard label="This month" value={formatUsdFromCents(summary.month)} />
          <AdminStatCard label="This quarter" value={formatUsdFromCents(summary.quarter)} />
          <AdminStatCard label="This year" value={formatUsdFromCents(summary.year)} />
          <AdminStatCard label="Recurring this year" value={formatUsdFromCents(summary.recurringYear)} />
        </AdminStatGrid>
      </section>

      <div className="flex flex-col gap-3 lg:flex-row">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Search periods</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search period (e.g. Jan 2026, Q1, 2026)"
            className={adminFilterControlState(Boolean(query.trim()))}
          />
        </label>
        <label className="lg:w-44">
          <span className="sr-only">Group by</span>
          <select
            value={grain}
            onChange={(event) => setGrain(event.target.value as RevenuePeriodGrain)}
            className={adminFilterControlState(false)}
          >
            {grains.map((item) => (
              <option key={item} value={item}>
                {grainLabels[item]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loading ? (
        <div className="h-36 animate-pulse rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)]" />
      ) : periods.length === 0 ? (
        <AdminEmptyState title="No payments recorded yet" body="Revenue totals appear here once invoices have been paid." />
      ) : visiblePeriods.length === 0 ? (
        <AdminEmptyState title="No periods match this search" body="Try a different period, like a month, quarter, or year." />
      ) : (
        <div className="overflow-x-auto rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)]">
          <table className="w-full min-w-[40rem] text-left text-[13px]">
            <thead>
              <tr className="border-b border-[var(--admin-line)] text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--admin-muted)]">
                <th className="px-5 py-3 font-semibold">Period</th>
                <th className="px-5 py-3 font-semibold">Total</th>
                <th className="px-5 py-3 font-semibold">Recurring</th>
                <th className="px-5 py-3 font-semibold">One-time</th>
              </tr>
            </thead>
            <tbody>
              {visiblePeriods.map((period) => (
                <tr key={period.key} className="border-b border-[var(--admin-line)] last:border-b-0">
                  <td className="px-5 py-3.5 font-heading font-semibold text-[var(--admin-ink)]">{period.label}</td>
                  <td className="px-5 py-3.5 text-[var(--admin-ink)]">{formatUsdFromCents(period.totalCents)}</td>
                  <td className="px-5 py-3.5 text-[var(--admin-muted)]">{formatUsdFromCents(period.recurringCents)}</td>
                  <td className="px-5 py-3.5 text-[var(--admin-muted)]">{formatUsdFromCents(period.oneTimeCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
