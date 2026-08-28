/** Integer-cent helpers. Do not use floating-point for money math. */

export function formatUsdFromCents(cents: number): string {
  const negative = cents < 0;
  const abs = cents < 0 ? -cents : cents;
  const dollars = Math.floor(abs / 100);
  const remainder = abs % 100;
  const formatted = `${dollars.toLocaleString("en-US")}.${String(remainder).padStart(2, "0")}`;
  return negative ? `-$${formatted}` : `$${formatted}`;
}

/** Display helper. USD uses `$`; other ISO codes prefix the same integer-cent amount. */
export function formatMoneyFromCents(cents: number, currency = "USD"): string {
  const code = currency.trim().toUpperCase() || "USD";
  if (code === "USD") return formatUsdFromCents(cents);
  const negative = cents < 0;
  const abs = cents < 0 ? -cents : cents;
  const dollars = Math.floor(abs / 100);
  const remainder = abs % 100;
  const formatted = `${dollars.toLocaleString("en-US")}.${String(remainder).padStart(2, "0")}`;
  return `${code} ${negative ? `-${formatted}` : formatted}`;
}

export function parseDollarsToCents(input: string): number | null {
  const trimmed = input.trim().replace(/[$,\s]/g, "");
  if (!trimmed) return 0;
  if (!/^\d+(\.\d{0,2})?$/.test(trimmed)) return null;
  const [dollars, fraction = ""] = trimmed.split(".");
  const centsPart = (fraction + "00").slice(0, 2);
  return Number(dollars) * 100 + Number(centsPart);
}

export function centsInputValue(cents: number): string {
  const abs = cents < 0 ? -cents : cents;
  const dollars = Math.floor(abs / 100);
  const remainder = abs % 100;
  return `${dollars}.${String(remainder).padStart(2, "0")}`;
}
