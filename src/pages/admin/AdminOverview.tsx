import { useEffect, useMemo, useState } from "react";
import { ActiveProjects } from "@/components/admin/ActiveProjects";
import { AdminPageHeader } from "@/components/admin/list/AdminPageHeader";
import { AdminStatCard, AdminStatGrid } from "@/components/admin/list/AdminStatCard";
import { NeedsAttention } from "@/components/admin/NeedsAttention";
import { OverviewInvoices } from "@/components/admin/OverviewInvoices";
import { OverviewWorkflow } from "@/components/admin/OverviewWorkflow";
import { RecentActivity } from "@/components/admin/RecentActivity";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import { useAuth } from "@/auth/AuthProvider";
import { hasPermission, type StaffPermissionCode } from "@/auth/permissions";
import {
  buildOverviewAttention,
  buildOverviewInvoiceTotals,
  buildOverviewPipeline,
  overviewHrefAllowed,
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
  const { leads, clients, projects, deliverables, feedback } = useLeads();
  const { conversations, unreadMessageCount } = useMessaging();
  const [records, setRecords] = useState<OverviewRecords>(emptyRecords);
  const can = (code: StaffPermissionCode) => hasPermission(profile, code);

  useEffect(() => {
    let active = true;
    void Promise.all([
      can("proposals.view") ? fetchProposalSummaries().catch(() => []) : Promise.resolve([]),
      can("contracts.view") ? fetchContractSummaries().catch(() => []) : Promise.resolve([]),
      can("invoices.view") ? fetchInvoiceSummaries().catch(() => []) : Promise.resolve([]),
      can("clients.view") ? fetchScopeBriefs().catch(() => []) : Promise.resolve([]),
    ]).then(([proposals, contracts, invoices, briefs]) => {
      if (!active) return;
      setRecords({ proposals, contracts, invoices, briefs });
    });
    return () => {
      active = false;
    };
  }, [profile]);

  const activeProjects = projects.filter((item) => !item.archived && item.status !== "Completed");
  const newLeads = leads.filter((item) => item.status === "New").length;
  const activeClients = clients.filter((item) => item.status === "Active").length;
  const unreadConversations = conversations.filter((item) => item.unreadCount > 0).length;

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

  const invoiceTotals = useMemo(() => buildOverviewInvoiceTotals(records.invoices), [records.invoices]);

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Overview"
        description="What is happening, what needs attention, and what happened recently."
      />

      <section aria-label="What is happening">
        <AdminStatGrid columns={4}>
          {can("leads.view") ? (
            <AdminStatCard label="New leads" value={newLeads} href="/admin/leads" />
          ) : null}
          {can("clients.view") ? (
            <AdminStatCard label="Active clients" value={activeClients} href="/admin/clients" />
          ) : null}
          {can("projects.view") ? (
            <AdminStatCard label="Active projects" value={activeProjects.length} href="/admin/projects" />
          ) : null}
          {can("messages.view") ? (
            <AdminStatCard label="Unread messages" value={unreadMessageCount} href="/admin/messages" />
          ) : null}
        </AdminStatGrid>
      </section>

      <NeedsAttention items={attention} />
      <OverviewWorkflow counts={pipeline} />

      <div className={can("invoices.view") ? "grid items-start gap-5 xl:grid-cols-[minmax(16rem,0.9fr)_minmax(0,1.1fr)]" : "grid gap-5"}>
        {can("invoices.view") ? <OverviewInvoices totals={invoiceTotals} /> : null}
        <RecentActivity />
      </div>

      {can("projects.view") && activeProjects.length > 0 ? <ActiveProjects /> : null}
    </div>
  );
}
