/** Integer-cent display. Do not use this for authoritative totals — those come from Postgres. */

export function asCents(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Math.trunc(parsed);
  }
  return 0;
}

export function formatMoneyFromCents(cents: number, currency = "USD"): string {
  const code = (currency || "USD").trim().toUpperCase() || "USD";
  const negative = cents < 0;
  const abs = cents < 0 ? -cents : cents;
  const dollars = Math.floor(abs / 100);
  const remainder = abs % 100;
  const formatted = `${dollars.toLocaleString("en-US")}.${String(remainder).padStart(2, "0")}`;
  if (code === "USD") return negative ? `-$${formatted}` : `$${formatted}`;
  return `${code} ${negative ? `-${formatted}` : formatted}`;
}

export function formatInvoiceDate(value: string | null | undefined): string {
  if (!value) return "—";
  const day = value.slice(0, 10);
  const parsed = new Date(`${day}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export function formatTimestamp(value: string | null | undefined): string {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return formatInvoiceDate(value);
  return parsed.toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  });
}
