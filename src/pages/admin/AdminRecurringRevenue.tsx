import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AdminPageHeader } from "@/components/admin/list/AdminPageHeader";
import { AdminStatCard, AdminStatGrid } from "@/components/admin/list/AdminStatCard";
import { fetchRecurringRevenueSummary } from "@/data/recurringRevenueRepository";
import type { RecurringRevenueSummary } from "@/data/recurringRevenue";
import { formatUsdFromCents } from "@/data/money";
import { AgencyDbError } from "@/lib/dbErrors";

export function AdminRecurringRevenue() {
  const [summary, setSummary] = useState<RecurringRevenueSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void fetchRecurringRevenueSummary()
      .then((row) => {
        if (active) setSummary(row);
      })
      .catch((caught) => {
        if (active) setError(caught instanceof AgencyDbError ? caught.message : "Unable to load recurring revenue.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Recurring revenue"
        description="Website Care, hosting, and other subscription plans -- kept separate from one-time project revenue (see Reports)."
      />

      {loading ? (
        <div className="h-40 animate-pulse rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)]" />
      ) : error ? (
        <p className="text-sm text-[#b45309]">{error}</p>
      ) : summary ? (
        <>
          <section aria-label="Recurring revenue summary">
            <AdminStatGrid columns={4}>
              <AdminStatCard label="MRR" value={formatUsdFromCents(summary.mrrCents)} />
              <AdminStatCard label="Active subscriptions" value={summary.activeCount} />
              <AdminStatCard label="Clients with a plan" value={summary.clientsWithPlan} />
              <AdminStatCard label="Clients without a plan" value={summary.clientsWithoutPlan} higherIsBetter={false} />
            </AdminStatGrid>
          </section>

          <section aria-label="Subscription health">
            <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Subscription health</h2>
            <div className="mt-3">
              <AdminStatGrid columns={4}>
                <AdminStatCard label="Past due" value={summary.pastDueCount} higherIsBetter={false} />
                <AdminStatCard label="Paused" value={summary.pausedCount} higherIsBetter={false} />
                <AdminStatCard label="Canceled this month" value={summary.canceledThisMonth} higherIsBetter={false} />
                <AdminStatCard
                  label="Renewing in 30 days"
                  value={summary.upcomingRenewals30d}
                  href="/admin/maintenance-plans"
                />
              </AdminStatGrid>
            </div>
          </section>

          <section aria-label="Website Care usage and overages">
            <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">
              Website Care this month
            </h2>
            <div className="mt-3">
              <AdminStatGrid columns={2}>
                <AdminStatCard label="Included hours logged" value={summary.includedHoursThisMonth} />
                <AdminStatCard
                  label="Billable overages"
                  value={`${summary.billableOveragesThisMonth} · ${formatUsdFromCents(summary.billableOveragesCentsThisMonth)}`}
                  href="/admin/care-requests"
                />
              </AdminStatGrid>
            </div>
            <p className="mt-3 text-[12px] text-[var(--admin-muted)]">
              Billable overage work is never charged automatically -- each one becomes its own invoice or project
              through{" "}
              <Link to="/admin/care-requests" className="font-medium text-[var(--admin-blue)] hover:underline">
                Care requests
              </Link>
              , tracked here once created.
            </p>
          </section>

          <p className="text-[12px] text-[var(--admin-muted)]">
            This page reads only the subscriptions and payments already recorded in MotiveScripts -- it never
            contacts Stripe directly. See{" "}
            <Link to="/admin/reports" className="font-medium text-[var(--admin-blue)] hover:underline">
              Reports
            </Link>{" "}
            for one-time project revenue, and{" "}
            <Link to="/admin/maintenance-plans" className="font-medium text-[var(--admin-blue)] hover:underline">
              Website Care plans
            </Link>{" "}
            to manage plan tiers.
          </p>
        </>
      ) : null}
    </div>
  );
}
