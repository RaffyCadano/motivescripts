import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BadgeCheck, BellRing, CircleCheck, CircleDollarSign, FileSignature, Hourglass, Inbox, TrendingUp, Users } from "lucide-react";
import { adminBlueBtn, adminGhostBtn } from "@/components/admin/adminActionStyles";
import { MetricTile, OverviewCard, OverviewEmpty, SectionLabel } from "@/components/admin/overview/kit";
import { RecentActivity } from "@/components/admin/RecentActivity";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import { CategoryBarChart, ValueLineChart } from "@/components/team/DashboardCharts";
import { useAuth } from "@/auth/AuthProvider";
import { hasPermission, type StaffPermissionCode } from "@/auth/permissions";
import { firstNameFrom } from "@/auth/userDisplay";
import { buildCumulativeTrend } from "@/data/adminOverview";
import {
  fetchContractSummaries,
  fetchProposalSummaries,
  type ContractSummary,
  type ProposalSummary,
} from "@/data/documentsRepository";
import { formatLeadDate } from "@/data/leads";
import { formatUsdFromCents, formatUsdWhole } from "@/data/money";
import {
  acceptedThisMonth,
  contractsNeedingAction,
  leadStatusCounts,
  leadsPerDay,
  leadsToFollowUp,
  openProposalValueCents,
  proposalsAwaitingResponse,
} from "@/data/salesOverview";
import { greetingFor } from "@/data/teamWorkspace";
import { cn } from "@/lib/cn";

// Pipeline stage colors. Every bar also has a count and a text label, so a stage is never conveyed by color alone.
const leadStageColor = {
  New: "#0050f0",
  Contacted: "#6366f1",
  Qualified: "#f59e0b",
  Proposal: "#8b5cf6",
  Won: "#10b981",
  Lost: "#94a3b8",
} as const;

const listLinkClass =
  "block truncate text-sm font-medium text-[var(--admin-ink)] hover:text-[var(--admin-blue)] hover:underline";

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function waitingLabel(days: number): string {
  if (days <= 0) return "Today";
  return `Waiting ${plural(days, "day")}`;
}

export function SalesOverview() {
  const { profile } = useAuth();
  const { leads, clients } = useLeads();
  const [proposals, setProposals] = useState<ProposalSummary[]>([]);
  const [contracts, setContracts] = useState<ContractSummary[]>([]);
  const can = (code: StaffPermissionCode) => hasPermission(profile, code);
  const canLeads = can("leads.view");
  const canProposals = can("proposals.view");
  const canContracts = can("contracts.view");
  const firstName = firstNameFrom(profile?.fullName || "there");

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      canProposals ? fetchProposalSummaries().catch(() => []) : Promise.resolve([]),
      canContracts ? fetchContractSummaries().catch(() => []) : Promise.resolve([]),
    ]).then(([proposalRows, contractRows]) => {
      if (cancelled) return;
      setProposals(proposalRows);
      setContracts(contractRows);
    });
    return () => {
      cancelled = true;
    };
  }, [canProposals, canContracts]);

  const clientName = useMemo(() => {
    const byId = new Map(clients.map((client) => [client.id, client.businessName]));
    return (clientId: string) => byId.get(clientId) ?? "Client";
  }, [clients]);

  const newLeads = useMemo(() => leads.filter((lead) => lead.status === "New"), [leads]);
  const followUps = useMemo(() => leadsToFollowUp(leads), [leads]);
  const awaiting = useMemo(() => proposalsAwaitingResponse(proposals), [proposals]);
  const openValue = useMemo(() => openProposalValueCents(proposals), [proposals]);
  const accepted = useMemo(() => acceptedThisMonth(proposals), [proposals]);
  const contractActions = useMemo(() => contractsNeedingAction(contracts), [contracts]);
  const needsOurSignature = contractActions.filter((row) => row.action === "needs_signature").length;
  const stageCounts = useMemo(() => leadStatusCounts(leads), [leads]);
  const dailyLeads = useMemo(() => leadsPerDay(leads, 30), [leads]);
  const leadsLast30 = dailyLeads.reduce((sum, day) => sum + day.value, 0);

  // Trends are real cumulative-by-day histories of the same cohort as the number shown (see buildCumulativeTrend).
  const newLeadsTrend = useMemo(() => buildCumulativeTrend(newLeads.map((lead) => ({ at: lead.createdAt }))), [newLeads]);
  const awaitingTrend = useMemo(
    () => buildCumulativeTrend(awaiting.map(({ proposal }) => ({ at: proposal.sentAt ?? proposal.createdAt }))),
    [awaiting],
  );
  const acceptedProposals = useMemo(
    () =>
      proposals
        .filter((proposal) => proposal.effectiveStatus === "accepted" && proposal.acceptedAt)
        .sort((a, b) => (b.acceptedAt ?? "").localeCompare(a.acceptedAt ?? ""))
        .slice(0, 5),
    [proposals],
  );

  type NextUp = { id: string; kind: "Contract" | "Proposal" | "Lead"; label: string; body: string; href: string };
  // The things a salesperson can act on right now: sign, chase an expiring proposal, reply to a new lead.
  const nextUp = useMemo<NextUp[]>(() => {
    const items: NextUp[] = [];
    for (const { contract, action, ageDays } of contractActions) {
      if (action !== "needs_signature") continue;
      items.push({
        id: `contract-${contract.id}`,
        kind: "Contract",
        label: contract.title || contract.number,
        body: `${clientName(contract.clientId)} accepted it. It needs your signature${ageDays > 0 ? ` · ${plural(ageDays, "day")} ago` : ""}.`,
        href: `/admin/contracts/${contract.id}`,
      });
    }
    for (const { proposal, daysUntilExpiry } of awaiting) {
      if (daysUntilExpiry === null || daysUntilExpiry > 3) continue;
      items.push({
        id: `proposal-${proposal.id}`,
        kind: "Proposal",
        label: proposal.title || proposal.number,
        body: `${clientName(proposal.clientId)} · ${daysUntilExpiry < 0 ? "expired" : daysUntilExpiry === 0 ? "expires today" : `expires in ${plural(daysUntilExpiry, "day")}`}.`,
        href: `/admin/proposals/${proposal.id}`,
      });
    }
    for (const { lead, ageDays } of followUps) {
      items.push({
        id: `lead-${lead.id}`,
        kind: "Lead",
        label: lead.businessName || lead.name,
        body: `${lead.name}${lead.industry ? ` · ${lead.industry}` : ""} · ${ageDays <= 0 ? "came in today" : `waiting ${plural(ageDays, "day")}`}.`,
        href: `/admin/leads/${lead.id}`,
      });
    }
    return items;
  }, [awaiting, clientName, contractActions, followUps]);

  const [showAllNext, setShowAllNext] = useState(false);
  const nextVisible = showAllNext ? nextUp : nextUp.slice(0, 5);
  const todayLabel = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const summary =
    nextUp.length === 0
      ? "You’re all caught up. Nothing in your pipeline needs you right now."
      : `${nextUp.length} ${nextUp.length === 1 ? "thing needs" : "things need"} you today.`;
  const headerActions = [
    { to: "/admin/leads/new", label: "New lead", show: can("leads.manage"), primary: true },
    { to: "/admin/proposals/new", label: "New proposal", show: can("proposals.manage"), primary: false },
  ].filter((item) => item.show);

  const kindTone: Record<NextUp["kind"], string> = {
    Contract: "bg-[rgb(245_158_11_/_0.14)] text-[#92610a]",
    Proposal: "bg-[rgb(0_80_240_/_0.08)] text-[var(--admin-blue)]",
    Lead: "bg-[rgb(16_185_129_/_0.1)] text-[#0f7a56]",
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-[12px] font-medium text-[var(--admin-muted)]">{todayLabel}</p>
          <h1 className="mt-1 font-heading text-[1.65rem] font-semibold tracking-tight md:text-3xl">
            {greetingFor()}, {firstName}
          </h1>
          <p className="mt-1 text-sm text-[var(--admin-muted)]">{summary}</p>
        </div>
        {headerActions.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {headerActions.map((item) => (
              <Link key={item.to} to={item.to} className={item.primary ? adminBlueBtn : adminGhostBtn}>
                {item.label}
              </Link>
            ))}
          </div>
        ) : null}
      </header>

      {nextUp.length > 0 ? (
        <section
          aria-label="Needs you today"
          className="rounded-[var(--admin-radius)] border border-[rgb(245_158_11_/_0.35)] bg-[var(--admin-card)] p-5 shadow-[0_1px_2px_rgb(7_17_31_/_0.04)]"
        >
          <div className="flex items-start gap-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[rgb(245_158_11_/_0.14)] text-[#b45309]">
              <BellRing size={16} strokeWidth={2} aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-heading text-[15px] font-semibold tracking-tight">Needs you today</h2>
              <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">Contracts to sign, proposals about to lapse and leads waiting for a reply.</p>
            </div>
            <span className="ml-auto rounded-full bg-[rgb(245_158_11_/_0.14)] px-2 py-0.5 text-xs font-semibold text-[#b45309]">{nextUp.length}</span>
          </div>
          <ul className="mt-4 divide-y divide-[var(--admin-line)]">
            {nextVisible.map((item) => (
              <li key={item.id} className="py-3 first:pt-0 last:pb-0">
                <Link to={item.href} className="group flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-[0.08em]", kindTone[item.kind])}>{item.kind}</span>
                      <span className="font-heading text-sm font-semibold text-[var(--admin-ink)] group-hover:text-[var(--admin-blue)]">{item.label}</span>
                    </div>
                    <p className="mt-1 text-[12px] text-[var(--admin-muted)]">{item.body}</p>
                  </div>
                  <span className="shrink-0 font-heading text-[12px] font-semibold text-[var(--admin-blue)] opacity-0 transition-opacity group-hover:opacity-100 max-sm:opacity-100">Open</span>
                </Link>
              </li>
            ))}
          </ul>
          {nextUp.length > 5 ? (
            <button
              type="button"
              onClick={() => setShowAllNext((current) => !current)}
              className="mt-3 w-full rounded-lg border border-[var(--admin-line)] py-2 text-center font-heading text-xs font-semibold text-[var(--admin-blue)] hover:bg-[var(--admin-bg)]"
            >
              {showAllNext ? "Show less" : `View all (${nextUp.length})`}
            </button>
          ) : null}
        </section>
      ) : null}

      <section aria-label="Key metrics">
        <SectionLabel>Pipeline</SectionLabel>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {canLeads ? (
            <MetricTile icon={Inbox} label="New leads" value={newLeads.length} href="/admin/leads" caption="Not contacted yet" trend={newLeadsTrend} />
          ) : null}
          {canProposals ? (
            <MetricTile icon={Hourglass} label="Awaiting response" value={awaiting.length} href="/admin/proposals" caption="Proposals with a client" trend={awaitingTrend} />
          ) : null}
          {canProposals ? (
            <MetricTile icon={CircleDollarSign} tone="good" label="Open proposal value" value={formatUsdWhole(openValue)} href="/admin/proposals" caption="If they all say yes" />
          ) : null}
          {canProposals ? (
            <MetricTile
              icon={BadgeCheck}
              tone="good"
              label="Accepted this month"
              value={accepted.count}
              href="/admin/proposals"
              caption={accepted.count > 0 ? `${formatUsdWhole(accepted.valueCents)} won` : "No wins yet this month"}
            />
          ) : null}
          {canContracts ? (
            <MetricTile
              icon={FileSignature}
              tone={contractActions.length > 0 ? "warn" : "neutral"}
              label="Contracts needing action"
              value={contractActions.length}
              href="/admin/contracts"
              caption={needsOurSignature > 0 ? `${needsOurSignature} to sign` : "Nothing to sign"}
            />
          ) : null}
        </div>
      </section>

      {canLeads ? (
        <section aria-label="Charts" className="grid gap-4 lg:grid-cols-[1.65fr_1fr]">
          <OverviewCard
            icon={TrendingUp}
            title="New leads"
            description={`${plural(leadsLast30, "lead")} in the last 30 days`}
            action={{ label: "View leads", to: "/admin/leads" }}
            className="min-w-0"
          >
            {leadsLast30 === 0 ? (
              <OverviewEmpty
                icon={Inbox}
                title="No new leads in the last 30 days"
                body="Inquiries from your Start a Project form show up here."
                action={can("leads.manage") ? { label: "Add a lead", to: "/admin/leads/new" } : undefined}
              />
            ) : (
              <ValueLineChart
                data={dailyLeads}
                ariaLabel="New leads per day over the last 30 days"
                caption="New leads per day"
                valueHeader="Leads"
                formatValue={(value) => plural(value, "lead")}
              />
            )}
          </OverviewCard>

          <OverviewCard icon={Users} title="Lead pipeline" description={`${plural(leads.length, "lead")} in total`} action={{ label: "View leads", to: "/admin/leads" }} className="min-w-0">
            {leads.length === 0 ? (
              <OverviewEmpty icon={Users} title="No leads yet" body="Every lead you get will be tracked from New to Won here." />
            ) : (
              <CategoryBarChart
                ariaLabel="Leads by pipeline stage"
                unit="lead"
                data={stageCounts.map((item) => ({
                  key: item.status,
                  label: item.status,
                  count: item.count,
                  color: leadStageColor[item.status],
                }))}
              />
            )}
          </OverviewCard>
        </section>
      ) : null}

      <section aria-label="Follow-ups" className="grid gap-4 lg:grid-cols-2">
        {canLeads ? (
          <OverviewCard icon={Inbox} title="Leads to follow up" count={followUps.length} description="New leads nobody has responded to yet" action={{ label: "View leads", to: "/admin/leads" }} className="min-w-0">
            {followUps.length === 0 ? (
              <OverviewEmpty compact icon={CircleCheck} title="Every lead is picked up" body="No new lead is waiting for a reply." />
            ) : (
              <ul className="divide-y divide-[var(--admin-line)]">
                {followUps.slice(0, 5).map(({ lead, ageDays }) => (
                  <li key={lead.id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <Link to={`/admin/leads/${lead.id}`} className={listLinkClass}>
                        {lead.businessName || lead.name}
                      </Link>
                      <p className="truncate text-[12px] text-[var(--admin-muted)]">
                        {lead.name}
                        {lead.industry ? ` · ${lead.industry}` : ""}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold",
                        ageDays >= 3 ? "bg-[rgb(245_158_11_/_0.14)] text-[#92610a]" : "bg-[var(--admin-bg)] text-[var(--admin-muted)]",
                      )}
                    >
                      {waitingLabel(ageDays)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </OverviewCard>
        ) : null}

        {canProposals ? (
          <OverviewCard
            icon={Hourglass}
            title="Proposals awaiting response"
            count={awaiting.length}
            description={`${plural(awaiting.length, "proposal")} · ${formatUsdWhole(openValue)} open`}
            action={{ label: "View proposals", to: "/admin/proposals" }}
            className="min-w-0"
          >
            {awaiting.length === 0 ? (
              <OverviewEmpty compact icon={CircleCheck} title="Nothing waiting on a client" body="No proposal is out for a decision." action={can("proposals.manage") ? { label: "New proposal", to: "/admin/proposals/new" } : undefined} />
            ) : (
              <ul className="divide-y divide-[var(--admin-line)]">
                {awaiting.slice(0, 5).map(({ proposal, daysSinceSent, daysUntilExpiry }) => (
                  <li key={proposal.id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <Link to={`/admin/proposals/${proposal.id}`} className={listLinkClass}>
                        {proposal.title || proposal.number}
                      </Link>
                      <p className="truncate text-[12px] text-[var(--admin-muted)]">
                        {clientName(proposal.clientId)}
                        {daysSinceSent !== null ? ` · Sent ${daysSinceSent === 0 ? "today" : `${plural(daysSinceSent, "day")} ago`}` : ""}
                        {daysUntilExpiry !== null && daysUntilExpiry >= 0 && daysUntilExpiry <= 7
                          ? ` · Expires ${daysUntilExpiry === 0 ? "today" : `in ${plural(daysUntilExpiry, "day")}`}`
                          : ""}
                      </p>
                    </div>
                    <span className="shrink-0 text-[13px] font-semibold text-[var(--admin-ink)]">{formatUsdWhole(proposal.investmentCents)}</span>
                  </li>
                ))}
              </ul>
            )}
          </OverviewCard>
        ) : null}
      </section>

      <section aria-label="Contracts and wins" className="grid gap-4 lg:grid-cols-2">
        {canContracts ? (
          <OverviewCard
            icon={FileSignature}
            title="Contracts needing action"
            count={contractActions.length}
            description={needsOurSignature > 0 ? `${plural(needsOurSignature, "contract")} ${needsOurSignature === 1 ? "needs" : "need"} your signature` : "Nothing waiting on your signature"}
            action={{ label: "View contracts", to: "/admin/contracts" }}
            className="min-w-0"
          >
            {contractActions.length === 0 ? (
              <OverviewEmpty compact icon={CircleCheck} title="No contracts waiting" body="No contract is waiting on anyone." />
            ) : (
              <ul className="divide-y divide-[var(--admin-line)]">
                {contractActions.slice(0, 5).map(({ contract, action, ageDays }) => (
                  <li key={contract.id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <Link to={`/admin/contracts/${contract.id}`} className={listLinkClass}>
                        {contract.title || contract.number}
                      </Link>
                      <p className="truncate text-[12px] text-[var(--admin-muted)]">
                        {clientName(contract.clientId)} · {ageDays === 0 ? "Today" : `${plural(ageDays, "day")} ago`}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 font-heading text-xs font-semibold tracking-tight",
                        action === "needs_signature" ? "bg-[rgb(245_158_11_/_0.14)] text-[#92610a]" : "bg-[var(--admin-bg)] text-[var(--admin-muted)]",
                      )}
                    >
                      {action === "needs_signature" ? "Needs your signature" : "Awaiting client"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </OverviewCard>
        ) : null}

        {canProposals ? (
          <OverviewCard
            icon={BadgeCheck}
            title="Recently accepted"
            description={`${plural(accepted.count, "proposal")} · ${formatUsdWhole(accepted.valueCents)} this month`}
            action={{ label: "View proposals", to: "/admin/proposals" }}
            className="min-w-0"
          >
            {acceptedProposals.length === 0 ? (
              <OverviewEmpty compact icon={BadgeCheck} title="No wins yet" body="Accepted proposals show up here with their value." />
            ) : (
              <ul className="divide-y divide-[var(--admin-line)]">
                {acceptedProposals.map((proposal) => (
                  <li key={proposal.id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <Link to={`/admin/proposals/${proposal.id}`} className={listLinkClass}>
                        {proposal.title || proposal.number}
                      </Link>
                      <p className="truncate text-[12px] text-[var(--admin-muted)]">
                        {clientName(proposal.clientId)} · {formatLeadDate(proposal.acceptedAt ?? proposal.createdAt)}
                      </p>
                    </div>
                    <span className="shrink-0 text-[13px] font-semibold text-[#0f7a56]" title={formatUsdFromCents(proposal.investmentCents)}>
                      {formatUsdWhole(proposal.investmentCents)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </OverviewCard>
        ) : null}
      </section>

      {canLeads || can("clients.view") ? <RecentActivity /> : null}
    </div>
  );
}
