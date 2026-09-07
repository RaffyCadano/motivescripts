/** Pure period-bucketing helpers for the agency-wide revenue report. No fetching here. */

export type RevenuePeriodGrain = "month" | "quarter" | "year";

export type PaymentReportRow = {
  amountCents: number;
  paymentDate: string;
  /** True when the paying invoice was generated from a service_plans subscription (recurring billing). */
  recurring: boolean;
};

export type RevenuePeriodTotals = {
  key: string;
  label: string;
  totalCents: number;
  recurringCents: number;
  oneTimeCents: number;
};

function quarterOf(monthIndex: number): number {
  return Math.floor(monthIndex / 3) + 1;
}

export function periodKeyForDate(iso: string, grain: RevenuePeriodGrain): string {
  const date = new Date(`${iso.slice(0, 10)}T00:00:00`);
  const year = date.getFullYear();
  const month = date.getMonth();
  if (grain === "year") return `${year}`;
  if (grain === "quarter") return `${year}-Q${quarterOf(month)}`;
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

export function periodLabel(key: string, grain: RevenuePeriodGrain): string {
  if (grain === "year") return key;
  if (grain === "quarter") {
    const [year, quarter] = key.split("-Q");
    return `${quarter}Q ${year}`;
  }
  const [year, month] = key.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export function buildRevenueReport(payments: PaymentReportRow[], grain: RevenuePeriodGrain): RevenuePeriodTotals[] {
  const buckets = new Map<string, RevenuePeriodTotals>();
  for (const payment of payments) {
    const key = periodKeyForDate(payment.paymentDate, grain);
    const bucket = buckets.get(key) ?? { key, label: periodLabel(key, grain), totalCents: 0, recurringCents: 0, oneTimeCents: 0 };
    bucket.totalCents += payment.amountCents;
    if (payment.recurring) bucket.recurringCents += payment.amountCents;
    else bucket.oneTimeCents += payment.amountCents;
    buckets.set(key, bucket);
  }
  return [...buckets.values()].sort((a, b) => b.key.localeCompare(a.key));
}

export function sumCentsInRange(payments: PaymentReportRow[], startIso: string): number {
  return payments
    .filter((payment) => payment.paymentDate.slice(0, 10) >= startIso)
    .reduce((sum, payment) => sum + payment.amountCents, 0);
}

export function startOfCurrentMonth(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

export function startOfCurrentQuarter(): string {
  const now = new Date();
  const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
  return new Date(now.getFullYear(), quarterStartMonth, 1).toISOString().slice(0, 10);
}

export function startOfCurrentYear(): string {
  const now = new Date();
  return new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
}
