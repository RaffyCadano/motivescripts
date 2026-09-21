import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import { formatProjectDay } from "@/data/agencyProjects";
import { hoursLoggedThisWeek, hoursLoggedToday } from "@/data/developerOverview";
import { formatUsdFromCents } from "@/data/money";
import { payrollMethodLabel, type PayrollPayment, type StaffPayRate, type StaffProjectPayRate } from "@/data/payroll";
import { listPayrollPayments, listStaffPayRates, listStaffProjectPayRates } from "@/data/payrollRepository";
import {
  hoursByProjectRows,
  hoursLoggedThisMonth,
  recentEntries,
  recentPayments,
  totalPaidCents,
  unpaidOwed,
} from "@/data/staffPayrollOverview";
import { sumHours, type TimeEntry } from "@/data/timeEntries";
import { listMyTimeEntries } from "@/data/timeEntriesRepository";
import { AgencyDbError } from "@/lib/dbErrors";
import { cn } from "@/lib/cn";

function plainHours(hours: number): string {
  return `${Number(hours.toFixed(2))}h`;
}

function Tile({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "warn" }) {
  return (
    <div className="min-w-0 rounded-lg border border-[var(--admin-line)] px-3.5 py-3">
      <p className="text-[12px] text-[var(--admin-muted)]">{label}</p>
      <p className={cn("mt-0.5 truncate font-heading text-xl font-semibold tracking-tight", tone === "warn" && "text-[#b45309]")}>{value}</p>
      {hint ? <p className="mt-0.5 truncate text-[12px] text-[var(--admin-muted)]">{hint}</p> : null}
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[12px] text-[var(--admin-muted)]">{label}</p>
      <p className="mt-1 flex h-9 items-center truncate rounded-lg border border-[var(--admin-line)] bg-[var(--admin-bg)] px-3 text-sm text-[var(--admin-ink)]">
        {value}
      </p>
    </div>
  );
}

/**
 * Admin-only, read-only view of one person's pay rate, payout details, logged hours, and payroll payments.
 * Changing a rate or marking hours paid stays on the Payroll page (linked from here).
 */
export function StaffPayrollCard({ staffId }: { staffId: string }) {
  const { projects } = useLeads();
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [rate, setRate] = useState<StaffPayRate | null>(null);
  const [overrides, setOverrides] = useState<StaffProjectPayRate[]>([]);
  const [payments, setPayments] = useState<PayrollPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([listMyTimeEntries(staffId), listStaffPayRates(), listStaffProjectPayRates(), listPayrollPayments(staffId)])
      .then(([timeRows, rateRows, overrideRows, paymentRows]) => {
        if (cancelled) return;
        setEntries(timeRows);
        setRate(rateRows.find((row) => row.userId === staffId) ?? null);
        setOverrides(overrideRows.filter((row) => row.staffId === staffId));
        setPayments(paymentRows);
      })
      .catch((caught) => {
        if (!cancelled) setError(caught instanceof AgencyDbError ? caught.message : "Unable to load payroll and hours.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [staffId]);

  const projectName = useMemo(() => {
    const byId = new Map(projects.map((project) => [project.id, project.name]));
    return (projectId: string) => byId.get(projectId) ?? "Project";
  }, [projects]);

  const defaultRate = rate?.payRateCents ?? null;
  const overrideMap = useMemo(() => new Map(overrides.map((row) => [row.projectId, row.payRateCents])), [overrides]);
  const owed = useMemo(() => unpaidOwed(entries, defaultRate, overrideMap), [entries, defaultRate, overrideMap]);
  const perProject = useMemo(() => hoursByProjectRows(entries, defaultRate, overrideMap), [entries, defaultRate, overrideMap]);
  const latestEntries = useMemo(() => recentEntries(entries, 10), [entries]);
  const latestPayments = useMemo(() => recentPayments(payments, 5), [payments]);
  const paidTotal = totalPaidCents(payments);
  const totalHours = sumHours(entries);

  return (
    <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Payroll &amp; hours</h2>
          <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">Read-only. Set rates and mark hours paid on the Payroll page.</p>
        </div>
        <Link to="/admin/payroll" className="font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline">
          Open Payroll
        </Link>
      </div>

      {error ? <p className="mt-3 text-sm text-[#b45309]">{error}</p> : null}

      {loading ? (
        <div className="mt-4 h-32 animate-pulse rounded-[var(--admin-radius)] bg-[var(--admin-bg)]" />
      ) : error ? null : (
        <div className="mt-4 space-y-6">
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-3">
            <Tile label="Pay rate" value={defaultRate !== null ? `${formatUsdFromCents(defaultRate)}/hr` : "Not set"} hint={overrides.length > 0 ? `${overrides.length} project rate${overrides.length === 1 ? "" : "s"}` : undefined} />
            <Tile label="Hours this week" value={plainHours(hoursLoggedThisWeek(entries))} hint={`${plainHours(hoursLoggedToday(entries))} today`} />
            <Tile label="Hours this month" value={plainHours(hoursLoggedThisMonth(entries))} hint={`${plainHours(totalHours)} all time`} />
            <Tile
              label="Unpaid hours"
              value={plainHours(owed.hours)}
              hint={
                owed.hours === 0
                  ? "All paid up"
                  : owed.amountCents === null
                    ? "Set a pay rate to price these"
                    : `${formatUsdFromCents(owed.amountCents)} owed`
              }
              tone={owed.hours > 0 && owed.amountCents === null ? "warn" : undefined}
            />
            <Tile label="Total paid" value={formatUsdFromCents(paidTotal)} hint={`${payments.length} payment${payments.length === 1 ? "" : "s"}`} />
            <div className="hidden lg:block" aria-hidden="true" />
          </div>

          <div>
            <h3 className="font-heading text-[13px] font-semibold text-[var(--admin-ink)]">Payout details</h3>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <ReadOnlyField label="Zelle" value={rate?.zelleContact || "Not set"} />
              <ReadOnlyField label="PayPal" value={rate?.paypalEmail || "Not set"} />
            </div>
          </div>

          <div>
            <h3 className="font-heading text-[13px] font-semibold text-[var(--admin-ink)]">Hours by project</h3>
            {perProject.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--admin-muted)]">No hours logged yet.</p>
            ) : (
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[26rem] text-left text-sm">
                  <thead>
                    <tr className="text-[12px] text-[var(--admin-muted)]">
                      <th className="pb-1.5 pr-3 font-medium">Project</th>
                      <th className="pb-1.5 pr-3 text-right font-medium">Hours</th>
                      <th className="pb-1.5 pr-3 text-right font-medium">Unpaid</th>
                      <th className="pb-1.5 text-right font-medium">Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--admin-line)]">
                    {perProject.map((row) => (
                      <tr key={row.projectId}>
                        <td className="max-w-[14rem] truncate py-2 pr-3">
                          <Link to={`/admin/projects/${row.projectId}`} className="font-medium text-[var(--admin-blue)] hover:underline">
                            {projectName(row.projectId)}
                          </Link>
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums">{plainHours(row.hours)}</td>
                        <td className={cn("py-2 pr-3 text-right tabular-nums", row.unpaidHours > 0 && "font-semibold text-[#b45309]")}>
                          {plainHours(row.unpaidHours)}
                        </td>
                        <td className="py-2 text-right tabular-nums">
                          {row.rateCents !== null ? `${formatUsdFromCents(row.rateCents)}/hr` : "—"}
                          {row.hasOverride ? <span className="ml-1 text-xs text-[var(--admin-muted)]">project rate</span> : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div>
            <h3 className="font-heading text-[13px] font-semibold text-[var(--admin-ink)]">Recent time entries</h3>
            {latestEntries.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--admin-muted)]">No time entries yet.</p>
            ) : (
              <ul className="mt-2 divide-y divide-[var(--admin-line)]">
                {latestEntries.map((item) => (
                  <li key={item.id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-[var(--admin-ink)]">
                        {projectName(item.projectId)} · {formatProjectDay(item.entryDate)}
                      </p>
                      {item.note.trim() ? <p className="mt-0.5 line-clamp-2 text-[12px] text-[var(--admin-muted)]">{item.note}</p> : null}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold tabular-nums">{plainHours(item.hours)}</p>
                      <p className={cn("text-xs", item.payrollPaidAt ? "text-[#0f7a56]" : "text-[#b45309]")}>
                        {item.payrollPaidAt ? "Paid" : "Unpaid"}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h3 className="font-heading text-[13px] font-semibold text-[var(--admin-ink)]">Payment history</h3>
            {latestPayments.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--admin-muted)]">No payroll payments recorded yet.</p>
            ) : (
              <ul className="mt-2 divide-y divide-[var(--admin-line)]">
                {latestPayments.map((payment) => (
                  <li key={payment.id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-[var(--admin-ink)]">
                        {formatProjectDay(payment.paymentDate)} · {payrollMethodLabel(payment.method)}
                        {payment.projectId ? ` · ${projectName(payment.projectId)}` : ""}
                      </p>
                      <p className="mt-0.5 truncate text-[12px] text-[var(--admin-muted)]">
                        {plainHours(payment.hours)} at {formatUsdFromCents(payment.payRateCents)}/hr through {formatProjectDay(payment.throughDate)}
                        {payment.reference ? ` · Ref ${payment.reference}` : ""}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold tabular-nums">{formatUsdFromCents(payment.amountCents)}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
