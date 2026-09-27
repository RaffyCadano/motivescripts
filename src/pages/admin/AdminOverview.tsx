import { FolderKanban, Gauge, Inbox, LineChart, MessageCircle, UserCog, Users } from "lucide-react";
import { BackgroundHealthAlert } from "@/components/admin/BackgroundHealthAlert";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActiveProjects } from "@/components/admin/ActiveProjects";
import { LiveClock } from "@/components/admin/LiveClock";
import { NeedsAttention } from "@/components/admin/NeedsAttention";
import { OverviewInvoices } from "@/components/admin/OverviewInvoices";
import { OverviewDiscoveryAttention } from "@/components/admin/OverviewDiscoveryAttention";
import { OverviewWorkflow } from "@/components/admin/OverviewWorkflow";
import { LeadPipelineChart } from "@/components/admin/overview/LeadPipelineChart";
import { MetricTile, OverviewCard, OverviewEmpty, SectionLabel } from "@/components/admin/overview/kit";
import { OverviewMoney } from "@/components/admin/overview/OverviewMoney";
import { OverviewWaiting } from "@/components/admin/overview/OverviewWaiting";
import { OverviewWebsites } from "@/components/admin/overview/OverviewWebsites";
import { OverviewRevenueTrendChart } from "@/components/admin/overview/OverviewRevenueTrendChart";
import { ProjectStatusChart } from "@/components/admin/overview/ProjectStatusChart";
import { StaffWorkloadChart } from "@/components/admin/overview/StaffWorkloadChart";
import { RecentActivity } from "@/components/admin/RecentActivity";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import { useTeamDirectory } from "@/components/admin/team/useTeamDirectory";
import { useAuth } from "@/auth/AuthProvider";
import { firstNameFrom } from "@/auth/userDisplay";
import { hasPermission, isActiveAdmin, type StaffPermissionCode } from "@/auth/permissions";
import {
  buildCumulativeTrend,
  buildOverviewAttention,
  buildOverviewInvoiceTotals,
  buildOverviewPipeline,
  filterInvoicesByPeriod,
  overviewHrefAllowed,
  type InvoicePeriod,
  type OverviewAttentionItem,
} from "@/data/adminOverview";
import { fetchContractSummaries, fetchProposalSummaries, type ContractSummary, type ProposalSummary } from "@/data/documentsRepository";
import { buildRevenueReport, type PaymentReportRow } from "@/data/financialReports";
import { fetchAllPayments } from "@/data/financialReportsRepository";
import { fetchInvoiceSummaries, type InvoiceSummary } from "@/data/invoicesRepository";
import { buildWaitingOnClients } from "@/data/overviewExtras";
import { greetingFor } from "@/data/teamWorkspace";
import { fetchScopeBriefs } from "@/data/scopeBriefsRepository";
import type { ClientScopeBrief } from "@/data/scopeBriefs";
import { useMessaging } from "@/providers/MessagingProvider";

type OverviewRecords = {
  proposals: ProposalSummary[];
  contracts: ContractSummary[];
  invoices: InvoiceSummary[];
  briefs: ClientScopeBrief[];
  payments: PaymentReportRow[];
};

const emptyRecords: OverviewRecords = { proposals: [], contracts: [], invoices: [], briefs: [], payments: [] };

export function AdminOverview() {
  const { profile } = useAuth();
  const { leads, clients, projects, deliverables, feedback, reload: reloadLeads } = useLeads();
  const { conversations, unreadMessageCount, reload: reloadMessages } = useMessaging();
  const team = useTeamDirectory();
  const [records, setRecords] = useState<OverviewRecords>(emptyRecords);
  const [refreshing, setRefreshing] = useState(false);
  const [invoicePeriod, setInvoicePeriod] = useState<InvoicePeriod>("all");
  const can = (code: StaffPermissionCode) => hasPermission(profile, code);

  const loadRecords = useCallback(async () => {
    const [proposals, contracts, invoices, briefs, payments] = await Promise.all([
      can("proposals.view") ? fetchProposalSummaries().catch(() => []) : Promise.resolve([]),
      can("contracts.view") ? fetchContractSummaries().catch(() => []) : Promise.resolve([]),
      can("invoices.view") ? fetchInvoiceSummaries().catch(() => []) : Promise.resolve([]),
      can("clients.view") ? fetchScopeBriefs().catch(() => []) : Promise.resolve([]),
      can("invoices.view") ? fetchAllPayments().catch(() => []) : Promise.resolve([]),
    ]);
    setRecords({ proposals, contracts, invoices, briefs, payments });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  async function handleRefresh() {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await Promise.all([reloadLeads(), reloadMessages(), team.reload(), loadRecords()]);
    } finally {
      setRefreshing(false);
    }
  }

  const activeProjects = projects.filter((item) => !item.archived && item.status !== "Completed");
  const newLeads = leads.filter((item) => item.status === "New").length;
  const activeClients = clients.filter((item) => item.status === "Active").length;
  const unreadConversations = conversations.filter((item) => item.unreadCount > 0).length;
  const activeStaffCount = team.data?.members.filter((member) => member.isActive).length ?? 0;

  // Each trend is a real cumulative-by-day history of the same cohort as its
  // stat, built from actual record timestamps -- it always ends at the count
  // shown above it, never an invented series.
  const newLeadsTrend = useMemo(
    () => buildCumulativeTrend(leads.filter((item) => item.status === "New").map((item) => ({ at: item.createdAt }))),
    [leads],
  );
  const activeClientsTrend = useMemo(
    () => buildCumulativeTrend(clients.filter((item) => item.status === "Active").map((item) => ({ at: item.createdAt }))),
    [clients],
  );
  const activeProjectsTrend = useMemo(
    () => buildCumulativeTrend(activeProjects.map((item) => ({ at: item.createdAt }))),
    [activeProjects],
  );
  const unreadMessagesTrend = useMemo(
    () =>
      buildCumulativeTrend(
        conversations
          .filter((item) => item.unreadCount > 0)
          .map((item) => ({ at: item.lastMessageAt, weight: item.unreadCount })),
      ),
    [conversations],
  );
  const activeStaffTrend = useMemo(
    () =>
      buildCumulativeTrend(
        (team.data?.members ?? []).filter((member) => member.isActive).map((member) => ({ at: member.createdAt })),
      ),
    [team.data],
  );

  const attention = useMemo(() => {
    const items = buildOverviewAttention({
      leads,
      clients,
      projects,
      briefs: records.briefs,
      proposals: records.proposals,
      contracts: records.contracts,
      invoices: records.invoices,
      deliverables,
      feedback,
    }).filter((item) => overviewHrefAllowed(item.href, can));

    if (unreadConversations > 0 && can("messages.view")) {
      const messageItem: OverviewAttentionItem = {
        id: "messages-unread",
        name: "Unread messages",
        body:
          unreadConversations === 1
            ? "1 conversation has unread messages."
            : `${unreadConversations} conversations have unread messages.`,
        stage: "Messages",
        actionLabel: "Open Inbox",
        href: "/admin/messages",
        sort: 12,
        clientId: null,
      };
      return [messageItem, ...items].sort((a, b) => a.sort - b.sort).slice(0, 8);
    }

    return items;
  }, [clients, deliverables, feedback, leads, projects, records, profile, unreadConversations]);

  const pipeline = useMemo(
    () =>
      buildOverviewPipeline({
        leads,
        clients,
        projects,
        briefs: records.briefs,
        proposals: records.proposals,
        contracts: records.contracts,
        invoices: records.invoices,
      }),
    [clients, leads, projects, records],
  );

  const invoiceTotals = useMemo(
    () => buildOverviewInvoiceTotals(filterInvoicesByPeriod(records.invoices, invoicePeriod)),
    [records.invoices, invoicePeriod],
  );

  const revenueTrend = useMemo(() => buildRevenueReport(records.payments, "month"), [records.payments]);

  const waiting = useMemo(
    () =>
      buildWaitingOnClients({
        clients,
        projects,
        briefs: records.briefs,
        proposals: records.proposals,
        contracts: records.contracts,
        invoices: records.invoices,
      }),
    [clients, projects, records],
  );
  const showWaiting = can("proposals.view") || can("contracts.view") || can("invoices.view") || can("clients.view");

  const firstName = firstNameFrom(profile?.fullName || "there");
  const todayLabel = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const attentionCount = attention.length;
  const openProjects = projects.filter((item) => !item.archived);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-[12px] font-medium text-[var(--admin-muted)]">{todayLabel}</p>
          <h1 className="mt-1 font-heading text-[1.65rem] font-semibold tracking-tight md:text-3xl">
            {greetingFor()}, {firstName}
          </h1>
          <p className="mt-1 text-sm text-[var(--admin-muted)]">
            {attentionCount === 0
              ? "You’re all caught up. Nothing needs you right now."
              : `${attentionCount} ${attentionCount === 1 ? "thing needs" : "things need"} your attention.`}
          </p>
        </div>
        <LiveClock onRefresh={handleRefresh} refreshing={refreshing} />
      </header>

      {isActiveAdmin(profile) ? <BackgroundHealthAlert /> : null}

      <NeedsAttention items={attention} />

      {can("invoices.view") ? <OverviewMoney invoices={records.invoices} payments={records.payments} /> : null}

      <section aria-label="What is happening">
        <SectionLabel>Activity</SectionLabel>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {can("leads.view") ? (
            <MetricTile icon={Inbox} label="New leads" value={newLeads} href="/admin/leads" caption="Waiting for a reply" trend={newLeadsTrend} />
          ) : null}
          {can("clients.view") ? (
            <MetricTile icon={Users} label="Active clients" value={activeClients} href="/admin/clients" caption="Currently working with you" trend={activeClientsTrend} />
          ) : null}
          {can("projects.view") ? (
            <MetricTile icon={FolderKanban} label="Active projects" value={activeProjects.length} href="/admin/projects" caption="In progress" trend={activeProjectsTrend} />
          ) : null}
          {can("messages.view") ? (
            <MetricTile
              icon={MessageCircle}
              label="Unread messages"
              value={unreadMessageCount}
              href="/admin/messages"
              caption={unreadMessageCount === 0 ? "Inbox is clear" : "Waiting for you"}
              trend={unreadMessagesTrend}
              higherIsBetter={false}
              tone={unreadMessageCount > 0 ? "warn" : "neutral"}
            />
          ) : null}
          {can("team.view") ? (
            <MetricTile icon={UserCog} label="Active staff" value={activeStaffCount} href="/admin/team" caption="On your team" trend={activeStaffTrend} />
          ) : null}
        </div>
      </section>

      {showWaiting || can("projects.view") ? (
        <section aria-label="Waiting on clients and websites" className="grid gap-4 lg:grid-cols-2">
          {showWaiting ? <OverviewWaiting items={waiting.items} counts={waiting.counts} /> : null}
          {can("projects.view") ? <OverviewWebsites /> : null}
        </section>
      ) : null}

      {can("projects.view") ? <OverviewDiscoveryAttention /> : null}

      {can("leads.view") || can("projects.view") ? (
        <section aria-label="Pipeline breakdown" className="grid gap-4 lg:grid-cols-2">
          {can("leads.view") ? (
            <OverviewCard icon={Inbox} title="Leads by status" description="Where your inquiries stand" action={{ label: "View leads", to: "/admin/leads" }}>
              {leads.length === 0 ? (
                <OverviewEmpty
                  icon={Inbox}
                  title="No leads yet"
                  body="New inquiries from your Start a Project form appear here."
                  action={can("leads.manage") ? { label: "Add a lead", to: "/admin/leads/new" } : undefined}
                />
              ) : (
                <LeadPipelineChart leads={leads} />
              )}
            </OverviewCard>
          ) : null}
          {can("projects.view") ? (
            <OverviewCard icon={FolderKanban} title="Projects by status" description="Everything that isn’t archived" action={{ label: "View projects", to: "/admin/projects" }}>
              {openProjects.length === 0 ? (
                <OverviewEmpty icon={FolderKanban} title="No projects yet" body="Create a project once a client’s scope is in." />
              ) : (
                <ProjectStatusChart projects={projects} />
              )}
            </OverviewCard>
          ) : null}
        </section>
      ) : null}

      {can("invoices.view") ? (
        <section aria-label="Invoices and revenue" className="grid gap-4 lg:grid-cols-2">
          <OverviewInvoices totals={invoiceTotals} period={invoicePeriod} onPeriodChange={setInvoicePeriod} />
          <OverviewCard icon={LineChart} title="Revenue, last 12 months" description="Payments received each month" action={{ label: "Reports", to: "/admin/reports" }}>
            {records.payments.length === 0 ? (
              <OverviewEmpty icon={LineChart} title="No payments yet" body="Money you receive shows up here as a 12-month trend." />
            ) : (
              <OverviewRevenueTrendChart periods={revenueTrend} />
            )}
          </OverviewCard>
        </section>
      ) : null}

      {can("projects.view") && activeProjects.length > 0 ? <ActiveProjects /> : null}

      <section aria-label="Workflow and team" className="grid gap-4 lg:grid-cols-2">
        <OverviewWorkflow counts={pipeline} />
        {can("team.view") ? (
          <OverviewCard icon={Gauge} title="Staff workload" description="Open tasks per person">
            <StaffWorkloadChart members={team.data?.members ?? []} />
          </OverviewCard>
        ) : null}
      </section>

      <RecentActivity />
    </div>
  );
}
