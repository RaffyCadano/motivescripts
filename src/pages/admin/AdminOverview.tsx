import { useCallback, useEffect, useMemo, useState } from "react";
import { ActiveProjects } from "@/components/admin/ActiveProjects";
import { LiveClock } from "@/components/admin/LiveClock";
import { AdminPageHeader } from "@/components/admin/list/AdminPageHeader";
import { AdminStatCard, AdminStatGrid } from "@/components/admin/list/AdminStatCard";
import { NeedsAttention } from "@/components/admin/NeedsAttention";
import { OverviewInvoices } from "@/components/admin/OverviewInvoices";
import { OverviewDiscoveryAttention } from "@/components/admin/OverviewDiscoveryAttention";
import { OverviewWorkflow } from "@/components/admin/OverviewWorkflow";
import { RecentActivity } from "@/components/admin/RecentActivity";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import { useTeamDirectory } from "@/components/admin/team/useTeamDirectory";
import { useAuth } from "@/auth/AuthProvider";
import { hasPermission, type StaffPermissionCode } from "@/auth/permissions";
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
import { fetchInvoiceSummaries, type InvoiceSummary } from "@/data/invoicesRepository";
import { fetchScopeBriefs } from "@/data/scopeBriefsRepository";
import type { ClientScopeBrief } from "@/data/scopeBriefs";
import { useMessaging } from "@/providers/MessagingProvider";

type OverviewRecords = {
  proposals: ProposalSummary[];
  contracts: ContractSummary[];
  invoices: InvoiceSummary[];
  briefs: ClientScopeBrief[];
};

const emptyRecords: OverviewRecords = { proposals: [], contracts: [], invoices: [], briefs: [] };

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
    const [proposals, contracts, invoices, briefs] = await Promise.all([
      can("proposals.view") ? fetchProposalSummaries().catch(() => []) : Promise.resolve([]),
      can("contracts.view") ? fetchContractSummaries().catch(() => []) : Promise.resolve([]),
      can("invoices.view") ? fetchInvoiceSummaries().catch(() => []) : Promise.resolve([]),
      can("clients.view") ? fetchScopeBriefs().catch(() => []) : Promise.resolve([]),
    ]);
    setRecords({ proposals, contracts, invoices, briefs });
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

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Overview"
        description="What is happening, what needs attention, and what happened recently."
        action={<LiveClock onRefresh={handleRefresh} refreshing={refreshing} />}
      />

      <section aria-label="What is happening">
        <AdminStatGrid columns={5}>
          {can("leads.view") ? (
            <AdminStatCard label="New leads" value={newLeads} href="/admin/leads" trend={newLeadsTrend} />
          ) : null}
          {can("clients.view") ? (
            <AdminStatCard label="Active clients" value={activeClients} href="/admin/clients" trend={activeClientsTrend} />
          ) : null}
          {can("projects.view") ? (
            <AdminStatCard
              label="Active projects"
              value={activeProjects.length}
              href="/admin/projects"
              trend={activeProjectsTrend}
            />
          ) : null}
          {can("messages.view") ? (
            <AdminStatCard
              label="Unread messages"
              value={unreadMessageCount}
              href="/admin/messages"
              trend={unreadMessagesTrend}
              higherIsBetter={false}
            />
          ) : null}
          {can("team.view") ? (
            <AdminStatCard label="Active staff" value={activeStaffCount} href="/admin/team" trend={activeStaffTrend} />
          ) : null}
        </AdminStatGrid>
      </section>

      {can("projects.view") ? <OverviewDiscoveryAttention /> : null}

      <div className="grid items-start gap-5 xl:grid-cols-[1.65fr_1fr]">
        <div className="space-y-5">
          {can("invoices.view") ? (
            <OverviewInvoices totals={invoiceTotals} period={invoicePeriod} onPeriodChange={setInvoicePeriod} />
          ) : null}
          {can("projects.view") && activeProjects.length > 0 ? <ActiveProjects /> : null}
        </div>
        <div className="space-y-5">
          <NeedsAttention items={attention} />
          <OverviewWorkflow counts={pipeline} />
          <RecentActivity />
        </div>
      </div>
    </div>
  );
}
