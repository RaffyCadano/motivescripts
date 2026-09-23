export type RecurringRevenueSummary = {
  mrrCents: number;
  activeCount: number;
  pastDueCount: number;
  pausedCount: number;
  clientsWithPlan: number;
  clientsWithoutPlan: number;
  canceledThisMonth: number;
  upcomingRenewals30d: number;
  includedHoursThisMonth: number;
  billableOveragesThisMonth: number;
  billableOveragesCentsThisMonth: number;
};

export type RecurringRevenueMonth = {
  monthStart: string;
  mrrCents: number;
  activeCount: number;
  newCount: number;
  canceledCount: number;
};

export function formatMonthLabel(monthStart: string, opts?: { withYear?: boolean }): string {
  const date = new Date(`${monthStart}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "short", year: opts?.withYear ? "numeric" : undefined, timeZone: "UTC" });
}
