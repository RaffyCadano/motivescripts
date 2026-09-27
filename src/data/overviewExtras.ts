/**
 * Calculations behind the admin Overview's money tiles, "Waiting on clients" list and "Websites" card, plus the label
 * on the tiles' change badges. Plain functions over records the page has already loaded, no fetching, so they can be
 * tested on their own.
 */

// ---- change badge -----------------------------------------------------------------------------------------------

export type TrendChange = { direction: "up" | "down" | "flat"; label: string };

/**
 * How a tile's count changed over its trend window. When the count started small, a percentage is misleading (one
 * more staff member is "+100%", six more is "+600%"), so those show the plain change ("+6") instead.
 */
export function trendChange(trend: number[]): TrendChange | null {
  if (trend.length < 2) return null;
  const previous = trend[0];
  const current = trend[trend.length - 1];
  if (current === previous) return { direction: "flat", label: "0" };
  const direction = current > previous ? "up" : "down";
  const diff = current - previous;
  if (previous < 5) return { direction, label: `${diff > 0 ? "+" : "−"}${Math.abs(diff)}` };
  const percent = Math.round((diff / previous) * 100);
  return { direction, label: `${percent > 0 ? "+" : "−"}${Math.abs(percent)}%` };
}

// ---- dates ------------------------------------------------------------------------------------------------------

function isoDay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** A date-only value ("2026-10-03") is a calendar day, not a moment: read at noon so no time zone moves it. */
export function parseCalendarDay(value: string): Date {
  return new Date(value.includes("T") ? value : `${value}T12:00:00`);
}

/** Whole days between an ISO timestamp or date and now; never negative. */
export function daysSince(value: string | null | undefined, now: Date = new Date()): number {
  if (!value) return 0;
  const then = parseCalendarDay(value);
  if (Number.isNaN(then.getTime())) return 0;
  return Math.max(0, Math.floor((now.getTime() - then.getTime()) / 86_400_000));
}

// ---- money ------------------------------------------------------------------------------------------------------

/** Payments received in the calendar month containing `now`, in the viewer's own time zone. */
export function revenueForMonth(payments: { amountCents: number; paymentDate: string }[], now: Date = new Date()): number {
  const prefix = isoDay(now).slice(0, 7);
  return payments.filter((payment) => payment.paymentDate.slice(0, 7) === prefix).reduce((sum, payment) => sum + payment.amountCents, 0);
}

// ---- waiting on clients -----------------------------------------------------------------------------------------

export type WaitingKind = "proposal" | "contract" | "invoice" | "scope";

export type WaitingItem = {
  id: string;
  kind: WaitingKind;
  /** "Proposal P-0004", "Invoice INV-0012", "Scope form". */
  label: string;
  clientName: string;
  days: number;
  href: string;
};

type WaitingInput = {
  clients: { id: string; businessName: string; status: string; createdAt: string }[];
  projects: { clientId: string; archived?: boolean }[];
  briefs: { clientId: string; submittedAt: string | null; updatedAt: string }[];
  proposals: { id: string; clientId: string; number: string; effectiveStatus: string; sentAt: string | null; createdAt: string }[];
  contracts: { id: string; clientId: string; number: string; effectiveStatus: string; sentAt: string | null; createdAt: string }[];
  invoices: { id: string; clientId: string; number: string; effectiveStatus: string; issueDate: string; createdAt: string }[];
};

const AWAITING_DOCUMENT = new Set(["sent", "viewed"]);
const AWAITING_PAYMENT = new Set(["sent", "viewed", "overdue", "partially_paid"]);

/**
 * Everything that is stuck until a client does something: an unanswered proposal or contract, an unpaid invoice, a
 * scope form nobody has finished. Longest wait first, so the oldest ones are on top. `counts` covers all of them;
 * `items` is only the first few.
 */
export function buildWaitingOnClients(
  input: WaitingInput,
  now: Date = new Date(),
  limit = 6,
): { items: WaitingItem[]; counts: Record<WaitingKind, number> } {
  const names = new Map(input.clients.map((client) => [client.id, client.businessName]));
  const nameOf = (clientId: string) => names.get(clientId) ?? "Client";
  const all: WaitingItem[] = [];

  for (const proposal of input.proposals) {
    if (!AWAITING_DOCUMENT.has(proposal.effectiveStatus)) continue;
    all.push({
      id: `proposal-${proposal.id}`,
      kind: "proposal",
      label: `Proposal ${proposal.number}`,
      clientName: nameOf(proposal.clientId),
      days: daysSince(proposal.sentAt ?? proposal.createdAt, now),
      href: `/admin/proposals/${proposal.id}`,
    });
  }
  for (const contract of input.contracts) {
    if (!AWAITING_DOCUMENT.has(contract.effectiveStatus)) continue;
    all.push({
      id: `contract-${contract.id}`,
      kind: "contract",
      label: `Contract ${contract.number}`,
      clientName: nameOf(contract.clientId),
      days: daysSince(contract.sentAt ?? contract.createdAt, now),
      href: `/admin/contracts/${contract.id}`,
    });
  }
  for (const invoice of input.invoices) {
    if (!AWAITING_PAYMENT.has(invoice.effectiveStatus)) continue;
    all.push({
      id: `invoice-${invoice.id}`,
      kind: "invoice",
      label: `Invoice ${invoice.number}`,
      clientName: nameOf(invoice.clientId),
      days: daysSince(invoice.issueDate || invoice.createdAt, now),
      href: `/admin/invoices/${invoice.id}`,
    });
  }

  // A scope form is only holding things up while the client has no project yet.
  const briefsByClient = new Map(input.briefs.map((brief) => [brief.clientId, brief]));
  const clientsWithProject = new Set(input.projects.filter((project) => !project.archived).map((project) => project.clientId));
  for (const client of input.clients) {
    if (client.status !== "Active" || clientsWithProject.has(client.id)) continue;
    const brief = briefsByClient.get(client.id);
    if (brief?.submittedAt) continue;
    all.push({
      id: `scope-${client.id}`,
      kind: "scope",
      label: brief ? "Scope form started, not finished" : "Scope form not started",
      clientName: client.businessName,
      days: daysSince(brief?.updatedAt ?? client.createdAt, now),
      href: `/admin/clients/${client.id}/scope`,
    });
  }

  all.sort((a, b) => b.days - a.days || a.clientName.localeCompare(b.clientName));
  const counts: Record<WaitingKind, number> = { proposal: 0, contract: 0, invoice: 0, scope: 0 };
  for (const item of all) counts[item.kind] += 1;
  return { items: all.slice(0, limit), counts };
}

// ---- websites ---------------------------------------------------------------------------------------------------

export type SiteHealthState = "healthy" | "degraded" | "down" | "unknown";

export type SiteRow = { id: string; name: string; clientName: string; paused: boolean; state: SiteHealthState };

/** Counts of live sites by health, and the ones that need a look (down first, then degraded). Paused sites are counted apart. */
export function websiteOverview(sites: SiteRow[]): {
  total: number;
  healthy: number;
  degraded: number;
  down: number;
  unknown: number;
  paused: number;
  issues: SiteRow[];
} {
  const live = sites.filter((site) => !site.paused);
  const rank: Record<SiteHealthState, number> = { down: 0, degraded: 1, unknown: 2, healthy: 3 };
  return {
    total: sites.length,
    healthy: live.filter((site) => site.state === "healthy").length,
    degraded: live.filter((site) => site.state === "degraded").length,
    down: live.filter((site) => site.state === "down").length,
    unknown: live.filter((site) => site.state === "unknown").length,
    paused: sites.length - live.length,
    issues: live.filter((site) => site.state === "down" || site.state === "degraded").sort((a, b) => rank[a.state] - rank[b.state] || a.name.localeCompare(b.name)),
  };
}

export type RenewalRow = { id: string; domain: string; kind: "Domain" | "SSL"; date: string; daysLeft: number };

/** Domain and SSL expiries within the next `days` days (and any already past), soonest first. Canceled plans are skipped. */
export function upcomingRenewals(
  plans: { id: string; domain: string | null; status: string; domainExpiresAt: string | null; sslExpiresAt: string | null }[],
  now: Date = new Date(),
  days = 30,
): RenewalRow[] {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12).getTime();
  const rows: RenewalRow[] = [];
  for (const plan of plans) {
    if (plan.status === "canceled") continue;
    for (const [kind, value] of [["Domain", plan.domainExpiresAt], ["SSL", plan.sslExpiresAt]] as const) {
      if (!value) continue;
      const when = parseCalendarDay(value);
      if (Number.isNaN(when.getTime())) continue;
      const daysLeft = Math.round((when.getTime() - today) / 86_400_000);
      if (daysLeft <= days) rows.push({ id: `${plan.id}-${kind}`, domain: plan.domain || "Website", kind, date: value.slice(0, 10), daysLeft });
    }
  }
  return rows.sort((a, b) => a.daysLeft - b.daysLeft || a.domain.localeCompare(b.domain));
}
