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
