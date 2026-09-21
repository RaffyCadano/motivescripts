/**
 * Pure selectors for the admin's per-person "Payroll & hours" card on a team member's page. Plain functions
 * over time entries, pay rates, and payroll payments already loaded by the caller, no hooks or fetching.
 * Pricing mirrors mark_time_entries_paid() (see projectPayBreakdown in payroll.ts): each project's unpaid hours
 * are priced at that project's override rate if one is set, else the person's default rate.
 *
 * Imports are relative so these functions can be unit tested in plain Node (scripts/test-staff-payroll-overview.mjs).
 */
import type { PayrollPayment } from "./payroll.ts";
import { projectPayBreakdown } from "./payroll.ts";
import type { TimeEntry } from "./timeEntries.ts";
import { sumHours, unpaidEntries, unpaidHoursByProject } from "./timeEntries.ts";

function isoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Hours logged in the calendar month containing `now`. */
export function hoursLoggedThisMonth(entries: Pick<TimeEntry, "entryDate" | "hours">[], now = new Date()): number {
  const prefix = isoDate(now).slice(0, 7);
  return Math.round(entries.filter((entry) => entry.entryDate.startsWith(prefix)).reduce((sum, entry) => sum + entry.hours, 0) * 100) / 100;
}

export type ProjectHoursRow = {
  projectId: string;
  hours: number;
  unpaidHours: number;
  /** The rate this project's unpaid hours are paid at: its override, else the default; null when neither is set. */
  rateCents: number | null;
  hasOverride: boolean;
};

/** Total and unpaid hours per project, most unpaid hours first, then most total hours. */
export function hoursByProjectRows(
  entries: TimeEntry[],
  defaultRateCents: number | null,
  overridesByProject: Map<string, number>,
): ProjectHoursRow[] {
  const totals = new Map<string, number>();
  for (const entry of entries) totals.set(entry.projectId, (totals.get(entry.projectId) ?? 0) + entry.hours);
  const unpaid = unpaidHoursByProject(entries);
  return [...totals.entries()]
    .map(([projectId, hours]) => {
      const override = overridesByProject.get(projectId);
      return {
        projectId,
        hours: Math.round(hours * 100) / 100,
        unpaidHours: Math.round((unpaid.get(projectId) ?? 0) * 100) / 100,
        rateCents: override ?? defaultRateCents,
        hasOverride: override !== undefined,
      };
    })
    .sort((a, b) => b.unpaidHours - a.unpaidHours || b.hours - a.hours);
}

export type OwedResult = { hours: number; amountCents: number | null };

/**
 * What is owed for unpaid hours right now. `amountCents` is null when some unpaid project has neither an
 * override nor a default rate, because the server refuses to pay those hours until a rate is set (NO_PAY_RATE).
 */
export function unpaidOwed(
  entries: TimeEntry[],
  defaultRateCents: number | null,
  overridesByProject: Map<string, number>,
): OwedResult {
  const hours = sumHours(unpaidEntries(entries));
  const byProject = unpaidHoursByProject(entries);
  let total = 0;
  for (const [projectId, projectHours] of byProject) {
    if (projectHours <= 0) continue;
    const rate = overridesByProject.get(projectId) ?? defaultRateCents;
    if (rate === null || rate === undefined) return { hours, amountCents: null };
    total += projectPayBreakdown(new Map([[projectId, projectHours]]), rate, new Map())[0]?.amountCents ?? 0;
  }
  return { hours, amountCents: total };
}

/** Everything paid out so far, summed from recorded payroll payments. */
export function totalPaidCents(payments: Pick<PayrollPayment, "amountCents">[]): number {
  return payments.reduce((sum, payment) => sum + payment.amountCents, 0);
}

/** The most recent time entries, newest work first (entry date, then creation time). */
export function recentEntries(entries: TimeEntry[], limit = 10): TimeEntry[] {
  return [...entries]
    .sort((a, b) => b.entryDate.localeCompare(a.entryDate) || b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

/** The most recent payroll payments, newest first. */
export function recentPayments(payments: PayrollPayment[], limit = 5): PayrollPayment[] {
  return [...payments]
    .sort((a, b) => b.paymentDate.localeCompare(a.paymentDate) || b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}
