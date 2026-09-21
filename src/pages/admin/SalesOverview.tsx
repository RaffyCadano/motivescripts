import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { RecentActivity } from "@/components/admin/RecentActivity";
import { AdminStatCard, AdminStatGrid } from "@/components/admin/list/AdminStatCard";
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

const cardClass = "min-w-0 rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5";
const cardTitleClass = "font-heading text-sm font-semibold tracking-tight";
const linkClass = "font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline";
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
  const canMessages = can("messages.view");
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

  const quickActions = [
    { to: "/admin/leads/new", label: "New Lead", show: can("leads.manage") },
    { to: "/admin/proposals/new", label: "New Proposal", show: can("proposals.manage") },
    { to: "/admin/clients", label: "Clients", show: can("clients.view") },
    { to: "/admin/messages", label: "Messages", show: canMessages },
  ].filter((item) => item.show);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-[1.65rem] font-semibold tracking-tight md:text-3xl">
          {greetingFor()}, {firstName}
        </h1>
        <p className="mt-1 text-sm text-[var(--admin-muted)]">Here&apos;s where your pipeline needs you today.</p>
      </div>

      <section aria-label="Key metrics">
        <AdminStatGrid columns={5}>
          {canLeads ? <AdminStatCard label="New leads" value={newLeads.length} href="/admin/leads" trend={newLeadsTrend} /> : null}
          {canProposals ? (
            <AdminStatCard label="Awaiting response" value={awaiting.length} href="/admin/proposals" trend={awaitingTrend} />
          ) : null}
          {canProposals ? <AdminStatCard label="Open proposal value" value={formatUsdWhole(openValue)} href="/admin/proposals" /> : null}
          {canProposals ? <AdminStatCard label="Accepted this month" value={accepted.count} href="/admin/proposals" /> : null}
          {canContracts ? (
            <AdminStatCard label="Contracts needing action" value={contractActions.length} href="/admin/contracts" higherIsBetter={false} />
          ) : null}
        </AdminStatGrid>
      </section>

      {canLeads ? (
        <section aria-label="Charts" className="grid items-start gap-3 lg:grid-cols-[1.65fr_1fr]">
          <div className={cardClass}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className={cardTitleClass}>New leads</h2>
                <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">
                  {plural(leadsLast30, "lead")} in the last 30 days
                </p>
              </div>
              <Link to="/admin/leads" className={linkClass}>
                View leads
              </Link>
            </div>
            <div className="mt-3">
              {leadsLast30 === 0 ? (
                <p className="py-12 text-center text-sm text-[var(--admin-muted)]">No new leads in the last 30 days.</p>
              ) : (
                <ValueLineChart
                  data={dailyLeads}
                  ariaLabel="New leads per day over the last 30 days"
                  caption="New leads per day"
                  valueHeader="Leads"
                  formatValue={(value) => plural(value, "lead")}
                />
              )}
            </div>
          </div>

          <div className={cardClass}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className={cardTitleClass}>Lead pipeline</h2>
                <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">{plural(leads.length, "lead")} in total</p>
              </div>
              <Link to="/admin/leads" className={linkClass}>
                View leads
              </Link>
            </div>
            <div className="mt-3">
              {leads.length === 0 ? (
                <p className="py-12 text-center text-sm text-[var(--admin-muted)]">No leads yet.</p>
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
            </div>
          </div>
        </section>
      ) : null}

      <section aria-label="Follow-ups" className="grid items-start gap-3 lg:grid-cols-2">
        {canLeads ? (
          <div className={cardClass}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className={cardTitleClass}>Leads to follow up</h2>
                <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">New leads nobody has responded to yet</p>
              </div>
              <Link to="/admin/leads" className={linkClass}>
                View leads
              </Link>
            </div>
            {followUps.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--admin-muted)]">Every new lead has been picked up.</p>
            ) : (
              <ul className="mt-3 divide-y divide-[var(--admin-line)]">
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
                        "shrink-0 text-[12px]",
                        ageDays >= 3 ? "font-semibold text-[#b45309]" : "text-[var(--admin-muted)]",
                      )}
                    >
                      {waitingLabel(ageDays)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        {canProposals ? (
          <div className={cardClass}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className={cardTitleClass}>Proposals awaiting response</h2>
                <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">
                  {plural(awaiting.length, "proposal")} · {formatUsdWhole(openValue)} open
                </p>
              </div>
              <Link to="/admin/proposals" className={linkClass}>
                View proposals
              </Link>
            </div>
            {awaiting.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--admin-muted)]">No proposals are waiting on a client.</p>
            ) : (
              <ul className="mt-3 divide-y divide-[var(--admin-line)]">
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
                    <span className="shrink-0 text-[13px] font-semibold text-[var(--admin-ink)]">
                      {formatUsdWhole(proposal.investmentCents)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </section>

      <section aria-label="Contracts and wins" className="grid items-start gap-3 lg:grid-cols-2">
        {canContracts ? (
          <div className={cardClass}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className={cardTitleClass}>Contracts needing action</h2>
                <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">
                  {needsOurSignature > 0 ? `${plural(needsOurSignature, "contract")} ${needsOurSignature === 1 ? "needs" : "need"} your signature` : "Nothing waiting on your signature"}
                </p>
              </div>
              <Link to="/admin/contracts" className={linkClass}>
                View contracts
              </Link>
            </div>
            {contractActions.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--admin-muted)]">No contracts are waiting on anyone.</p>
            ) : (
              <ul className="mt-3 divide-y divide-[var(--admin-line)]">
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
                        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 font-heading text-[11px] font-semibold tracking-tight",
                        action === "needs_signature"
                          ? "bg-[rgb(245_158_11_/_0.12)] text-[#92610a]"
                          : "bg-[var(--admin-bg)] text-[var(--admin-muted)]",
                      )}
                    >
                      {action === "needs_signature" ? "Needs your signature" : "Awaiting client"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        {canProposals ? (
          <div className={cardClass}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className={cardTitleClass}>Recently accepted</h2>
                <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">
                  {plural(accepted.count, "proposal")} · {formatUsdWhole(accepted.valueCents)} this month
                </p>
              </div>
              <Link to="/admin/proposals" className={linkClass}>
                View proposals
              </Link>
            </div>
            {acceptedProposals.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--admin-muted)]">No proposals accepted yet.</p>
            ) : (
              <ul className="mt-3 divide-y divide-[var(--admin-line)]">
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
                    <span className="shrink-0 text-[13px] font-semibold text-[var(--admin-ink)]" title={formatUsdFromCents(proposal.investmentCents)}>
                      {formatUsdWhole(proposal.investmentCents)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </section>

      {canLeads || can("clients.view") ? <RecentActivity /> : null}

      {quickActions.length > 0 ? (
        <section className={cardClass}>
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
        </section>
      ) : null}
    </div>
  );
}
