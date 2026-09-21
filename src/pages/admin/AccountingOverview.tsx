import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AdminStatCard, AdminStatGrid } from "@/components/admin/list/AdminStatCard";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import { CategoryBarChart, ValueLineChart } from "@/components/team/DashboardCharts";
import { useAuth } from "@/auth/AuthProvider";
import { hasPermission, type StaffPermissionCode } from "@/auth/permissions";
import { firstNameFrom } from "@/auth/userDisplay";
import {
  collectedPerDay,
  collectedThisMonth,
  draftInvoices,
  invoiceStatusCounts,
  invoicesDueSoon,
  outstandingByClient,
  overdueInvoices,
  recentPayments,
  type CountedInvoiceStatus,
  type PaymentRecord,
} from "@/data/accountingOverview";
import { buildCumulativeTrend, buildOverviewInvoiceTotals } from "@/data/adminOverview";
import { formatLeadDate } from "@/data/leads";
import { fetchInvoiceSummaries, fetchRecentPayments, type InvoiceSummary } from "@/data/invoicesRepository";
import { formatMoneyFromCents, formatUsdFromCents, formatUsdWhole } from "@/data/money";
import { greetingFor } from "@/data/teamWorkspace";
import { cn } from "@/lib/cn";

// Invoice status colors, matching the status badges used elsewhere. Every bar also has a count and a text
// label, so a status is never conveyed by color alone.
const invoiceStatusColor: Record<CountedInvoiceStatus, string> = {
  draft: "#94a3b8",
  sent: "#0050f0",
  viewed: "#6366f1",
  partially_paid: "#f59e0b",
  overdue: "#dc2626",
  paid: "#10b981",
};

const paymentMethodLabel: Record<string, string> = {
  stripe: "Card (Stripe)",
  bank_transfer: "Bank transfer",
  cash: "Cash",
  check: "Check",
  other: "Other",
};

const cardClass = "min-w-0 rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5";
const cardTitleClass = "font-heading text-sm font-semibold tracking-tight";
const linkClass = "font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline";
const listLinkClass =
  "block truncate text-sm font-medium text-[var(--admin-ink)] hover:text-[var(--admin-blue)] hover:underline";

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/** Compact axis label for a whole-dollar amount: $500, $1.5k, $12k. */
function compactDollars(dollars: number): string {
  if (dollars >= 1000) return `$${Number((dollars / 1000).toFixed(1))}k`;
  return `$${dollars}`;
}

export function AccountingOverview() {
  const { profile } = useAuth();
  const { clients } = useLeads();
  const [invoices, setInvoices] = useState<InvoiceSummary[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const can = (code: StaffPermissionCode) => hasPermission(profile, code);
  const canInvoices = can("invoices.view");
  const canManage = can("invoices.manage");
  const firstName = firstNameFrom(profile?.fullName || "there");

  useEffect(() => {
    let cancelled = false;
    if (!canInvoices) {
      setLoading(false);
      return;
    }
    void Promise.all([fetchInvoiceSummaries().catch(() => []), fetchRecentPayments().catch(() => [])]).then(
      ([invoiceRows, paymentRows]) => {
        if (cancelled) return;
        setInvoices(invoiceRows);
        setPayments(paymentRows);
        setLoading(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [canInvoices]);

  const clientName = useMemo(() => {
    const byId = new Map(clients.map((client) => [client.id, client.businessName]));
    return (clientId: string) => byId.get(clientId) ?? "Client";
  }, [clients]);
  const invoiceNumber = useMemo(() => {
    const byId = new Map(invoices.map((invoice) => [invoice.id, invoice.number]));
    return (invoiceId: string) => byId.get(invoiceId) ?? "Invoice";
  }, [invoices]);

  const totals = useMemo(() => buildOverviewInvoiceTotals(invoices), [invoices]);
  const overdue = useMemo(() => overdueInvoices(invoices), [invoices]);
  const dueSoon = useMemo(() => invoicesDueSoon(invoices, 7), [invoices]);
  const drafts = useMemo(() => draftInvoices(invoices), [invoices]);
  const balances = useMemo(() => outstandingByClient(invoices, 5), [invoices]);
  const recent = useMemo(() => recentPayments(payments, 5), [payments]);
  const statusCounts = useMemo(() => invoiceStatusCounts(invoices), [invoices]);
  const totalInvoices = statusCounts.reduce((sum, item) => sum + item.count, 0);
  const collectedMonth = useMemo(() => collectedThisMonth(payments), [payments]);
  const daily = useMemo(() => collectedPerDay(payments, 30), [payments]);
  const collected30 = daily.reduce((sum, day) => sum + day.value, 0);
  const dailyDollars = useMemo(() => daily.map((day) => ({ ...day, value: day.value / 100 })), [daily]);

  // Trends are real cumulative histories of the same cohort as the amount shown (see buildCumulativeTrend).
  const outstandingTrend = useMemo(
    () =>
      buildCumulativeTrend(
        invoices
          .filter((invoice) => invoice.effectiveStatus !== "cancelled" && invoice.effectiveStatus !== "draft" && invoice.amountDueCents > 0)
          .map((invoice) => ({ at: invoice.createdAt, weight: invoice.amountDueCents })),
      ),
    [invoices],
  );
  const overdueTrend = useMemo(
    () =>
      buildCumulativeTrend(
        overdue.map(({ invoice }) => ({ at: `${invoice.dueDate.slice(0, 10)}T12:00:00`, weight: invoice.amountDueCents })),
      ),
    [overdue],
  );

  const quickActions = [
    { to: "/admin/invoices/new", label: "New Invoice", show: canManage },
    { to: "/admin/invoices", label: "All Invoices", show: canInvoices },
    { to: "/admin/reports", label: "Reports", show: canInvoices },
    { to: "/admin/clients", label: "Clients", show: can("clients.view") },
  ].filter((item) => item.show);

  if (!canInvoices) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="font-heading text-[1.65rem] font-semibold tracking-tight md:text-3xl">
            {greetingFor()}, {firstName}
          </h1>
          <p className="mt-1 text-sm text-[var(--admin-muted)]">You don&apos;t have access to invoices yet. Ask an admin to grant it.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-[1.65rem] font-semibold tracking-tight md:text-3xl">
          {greetingFor()}, {firstName}
        </h1>
        <p className="mt-1 text-sm text-[var(--admin-muted)]">Here&apos;s where your invoices and payments stand today.</p>
      </div>

      <section aria-label="Key metrics">
        <AdminStatGrid columns={5}>
          <AdminStatCard label="Outstanding" value={formatUsdWhole(totals.outstanding)} href="/admin/invoices" trend={outstandingTrend} higherIsBetter={false} />
          <AdminStatCard label="Overdue" value={formatUsdWhole(totals.overdue)} href="/admin/invoices" trend={overdueTrend} higherIsBetter={false} />
          <AdminStatCard label="Due in 7 days" value={formatUsdWhole(totals.dueSoon)} href="/admin/invoices" />
          <AdminStatCard label="Collected this month" value={formatUsdWhole(collectedMonth)} href="/admin/invoices" />
          <AdminStatCard label="Drafts to send" value={drafts.length} href="/admin/invoices" higherIsBetter={false} />
        </AdminStatGrid>
      </section>

      <section aria-label="Charts" className="grid items-start gap-3 lg:grid-cols-[1.65fr_1fr]">
        <div className={cardClass}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className={cardTitleClass}>Cash collected</h2>
              <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">
                {loading ? "Loading…" : `${formatUsdWhole(collected30)} received in the last 30 days`}
              </p>
            </div>
            <Link to="/admin/reports" className={linkClass}>
              View reports
            </Link>
          </div>
          <div className="mt-3">
            {loading ? (
              <div className="h-44 animate-pulse rounded-[var(--admin-radius)] bg-[var(--admin-bg)]" />
            ) : collected30 === 0 ? (
              <p className="py-12 text-center text-sm text-[var(--admin-muted)]">No payments received in the last 30 days.</p>
            ) : (
              <ValueLineChart
                data={dailyDollars}
                ariaLabel="Cash received per day over the last 30 days"
                caption="Cash received per day"
                valueHeader="Received"
                niceScale
                formatTick={compactDollars}
                formatValue={(dollars) => formatUsdFromCents(Math.round(dollars * 100))}
              />
            )}
          </div>
        </div>

        <div className={cardClass}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className={cardTitleClass}>Invoices by status</h2>
              <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">{plural(totalInvoices, "invoice")} in total</p>
            </div>
            <Link to="/admin/invoices" className={linkClass}>
              View invoices
            </Link>
          </div>
          <div className="mt-3">
            {loading ? (
              <div className="h-44 animate-pulse rounded-[var(--admin-radius)] bg-[var(--admin-bg)]" />
            ) : totalInvoices === 0 ? (
              <p className="py-12 text-center text-sm text-[var(--admin-muted)]">No invoices yet.</p>
            ) : (
              <CategoryBarChart
                ariaLabel="Invoices by status"
                unit="invoice"
                data={statusCounts.map((item) => ({
                  key: item.status,
                  label: item.label,
                  count: item.count,
                  color: invoiceStatusColor[item.status],
                }))}
              />
            )}
          </div>
        </div>
      </section>

      <section aria-label="Collections" className="grid items-start gap-3 lg:grid-cols-2">
        <div className={cardClass}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className={cardTitleClass}>Overdue invoices</h2>
              <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">
                {plural(overdue.length, "invoice")} · {formatUsdWhole(totals.overdue)} past due
              </p>
            </div>
            <Link to="/admin/invoices" className={linkClass}>
              View invoices
            </Link>
          </div>
          {overdue.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--admin-muted)]">Nothing is overdue.</p>
          ) : (
            <ul className="mt-3 divide-y divide-[var(--admin-line)]">
              {overdue.slice(0, 5).map(({ invoice, daysOverdue }) => (
                <li key={invoice.id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <Link to={`/admin/invoices/${invoice.id}`} className={listLinkClass}>
                      {invoice.number}
                    </Link>
                    <p className="truncate text-[12px] text-[var(--admin-muted)]">
                      {clientName(invoice.clientId)} ·{" "}
                      <span className="font-semibold text-[#b42318]">{plural(daysOverdue, "day")} overdue</span>
                    </p>
                  </div>
                  <span className="shrink-0 text-[13px] font-semibold text-[var(--admin-ink)]">
                    {formatMoneyFromCents(invoice.amountDueCents, invoice.currency)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={cardClass}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className={cardTitleClass}>Due in the next 7 days</h2>
              <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">
                {plural(dueSoon.length, "invoice")} · {formatUsdWhole(totals.dueSoon)}
              </p>
            </div>
            <Link to="/admin/invoices" className={linkClass}>
              View invoices
            </Link>
          </div>
          {dueSoon.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--admin-muted)]">No invoices fall due this week.</p>
          ) : (
            <ul className="mt-3 divide-y divide-[var(--admin-line)]">
              {dueSoon.slice(0, 5).map(({ invoice, daysUntilDue }) => (
                <li key={invoice.id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <Link to={`/admin/invoices/${invoice.id}`} className={listLinkClass}>
                      {invoice.number}
                    </Link>
                    <p className="truncate text-[12px] text-[var(--admin-muted)]">
                      {clientName(invoice.clientId)} · Due {daysUntilDue === 0 ? "today" : `in ${plural(daysUntilDue, "day")}`}
                    </p>
                  </div>
                  <span className="shrink-0 text-[13px] font-semibold text-[var(--admin-ink)]">
                    {formatMoneyFromCents(invoice.amountDueCents, invoice.currency)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section aria-label="Balances and payments" className="grid items-start gap-3 lg:grid-cols-2">
        <div className={cardClass}>
          <h2 className={cardTitleClass}>Outstanding by client</h2>
          {balances.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--admin-muted)]">No client owes anything right now.</p>
          ) : (
            <ul className="mt-3 divide-y divide-[var(--admin-line)]">
              {balances.map((balance) => (
                <li key={balance.clientId} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <Link to={`/admin/clients/${balance.clientId}`} className={listLinkClass}>
                      {clientName(balance.clientId)}
                    </Link>
                    <p className="truncate text-[12px] text-[var(--admin-muted)]">{plural(balance.invoiceCount, "open invoice")}</p>
                  </div>
                  <span className="shrink-0 text-[13px] font-semibold text-[var(--admin-ink)]">
                    {formatUsdWhole(balance.amountDueCents)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={cardClass}>
          <h2 className={cardTitleClass}>Recent payments</h2>
          {recent.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--admin-muted)]">No payments recorded yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-[var(--admin-line)]">
              {recent.map((payment) => (
                <li key={payment.id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <Link to={`/admin/invoices/${payment.invoiceId}`} className={listLinkClass}>
                      {invoiceNumber(payment.invoiceId)}
                    </Link>
                    <p className="truncate text-[12px] text-[var(--admin-muted)]">
                      {formatLeadDate(payment.paymentDate.includes("T") ? payment.paymentDate : `${payment.paymentDate}T12:00:00`)} ·{" "}
                      {paymentMethodLabel[payment.method] ?? "Other"}
                    </p>
                  </div>
                  <span className="shrink-0 text-[13px] font-semibold text-[#0f7a56]">{formatUsdFromCents(payment.amountCents)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section aria-label="Drafts" className="grid items-start gap-3 lg:grid-cols-2">
        <div className={cardClass}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className={cardTitleClass}>Drafts to send</h2>
              <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">Invoices created but not sent to the client yet</p>
            </div>
            {canManage ? (
              <Link to="/admin/invoices/new" className={linkClass}>
                New invoice
              </Link>
            ) : null}
          </div>
          {drafts.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--admin-muted)]">No draft invoices.</p>
          ) : (
            <ul className="mt-3 divide-y divide-[var(--admin-line)]">
              {drafts.slice(0, 5).map((invoice) => (
                <li key={invoice.id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <Link to={`/admin/invoices/${invoice.id}`} className={listLinkClass}>
                      {invoice.number}
                    </Link>
                    <p className="truncate text-[12px] text-[var(--admin-muted)]">
                      {clientName(invoice.clientId)}
                      {invoice.firstLine ? ` · ${invoice.firstLine}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-[13px] font-semibold text-[var(--admin-ink)]">
                    {formatMoneyFromCents(invoice.totalCents, invoice.currency)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={cn(cardClass)}>
          <h2 className={cardTitleClass}>Quick Actions</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {quickActions.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="inline-flex h-9 items-center justify-center rounded-[var(--admin-radius)] border border-[var(--admin-line)] px-3.5 font-heading text-[12px] font-semibold text-[var(--admin-ink)] hover:bg-[var(--admin-bg)]"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
