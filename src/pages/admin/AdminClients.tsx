import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { adminBlueBtn, adminGhostBtn } from "@/components/admin/adminActionStyles";
import { AdminAttentionList } from "@/components/admin/list/AdminAttentionList";
import { AdminEmptyState } from "@/components/admin/list/AdminEmptyState";
import { AdminPageHeader } from "@/components/admin/list/AdminPageHeader";
import { ClientFilters } from "@/components/admin/clients/ClientFilters";
import { ClientSummary, type ClientSummarySelection } from "@/components/admin/clients/ClientSummary";
import { ClientTable } from "@/components/admin/clients/ClientTable";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import { useAuth } from "@/auth/AuthProvider";
import { hasPermission, type StaffPermissionCode } from "@/auth/permissions";
import { filterAgencyClients, type AgencyClientStatus } from "@/data/agencyClients";
import { buildClientListAttention, overviewHrefAllowed } from "@/data/adminOverview";
import type { ClientListRecords } from "@/data/clientList";
import { fetchContractSummaries, fetchProposalSummaries } from "@/data/documentsRepository";
import { fetchInvoiceSummaries } from "@/data/invoicesRepository";
import type { LeadIndustry } from "@/data/leads";
import { fetchScopeBriefs } from "@/data/scopeBriefsRepository";
import { useMessaging } from "@/providers/MessagingProvider";

const emptyRecords: ClientListRecords = { briefs: [], proposals: [], contracts: [], invoices: [] };

export function AdminClients() {
  const { clients, projects, deliverables, feedback } = useLeads();
  const { conversations } = useMessaging();
  const { profile } = useAuth();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<AgencyClientStatus | "All">("All");
  const [industry, setIndustry] = useState<LeadIndustry | "All">("All");
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [records, setRecords] = useState<ClientListRecords>(emptyRecords);

  const can = (code: StaffPermissionCode) => hasPermission(profile, code);
  const canManage = can("clients.manage");
  const canViewLeads = can("leads.view");
  const canViewProjects = can("projects.view");
  const canViewMessages = can("messages.view");

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

  const attention = useMemo(
    () =>
      buildClientListAttention({
        clients,
        projects,
        briefs: records.briefs,
        proposals: records.proposals,
        contracts: records.contracts,
        invoices: records.invoices,
        deliverables,
        feedback,
      }).filter((item) => overviewHrefAllowed(item.href, can)),
    [clients, deliverables, feedback, projects, records, profile],
  );

  const attentionClientIds = useMemo(() => {
    const ids = new Set<string>();
    for (const item of attention) {
      if (item.clientId) ids.add(item.clientId);
    }
    return ids;
  }, [attention]);

  const visible = useMemo(() => {
    const filtered = filterAgencyClients(clients, query, status, industry);
    if (!attentionOnly) return filtered;
    return filtered.filter((client) => attentionClientIds.has(client.id));
  }, [attentionClientIds, attentionOnly, clients, industry, query, status]);

  const searching = query.trim().length > 0 || status !== "All" || industry !== "All" || attentionOnly;
  const selected: ClientSummarySelection = attentionOnly
    ? "attention"
    : status === "Active" && !query && industry === "All"
      ? "active"
      : status === "Inactive" && !query && industry === "All"
        ? "inactive"
        : status === "All" && !query && industry === "All" && !attentionOnly
          ? "total"
          : null;

  function clearFilters() {
    setQuery("");
    setStatus("All");
    setIndustry("All");
    setAttentionOnly(false);
  }

  const canCreateProposal = can("proposals.manage");

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Clients"
        description="Active relationships after a lead is converted. Portal, scope, and project work start here."
        action={
          canManage ? (
            <Link to="/admin/clients/new" className={`${adminBlueBtn} justify-center`}>
              + Add Client
            </Link>
          ) : undefined
        }
      />

      <ClientSummary
        selected={selected}
        attentionCount={attentionClientIds.size}
        onSelectTotal={() => {
          setQuery("");
          setIndustry("All");
          setStatus("All");
          setAttentionOnly(false);
        }}
        onSelectActive={() => {
          setStatus("Active");
          setAttentionOnly(false);
        }}
        onSelectInactive={() => {
          setStatus("Inactive");
          setAttentionOnly(false);
        }}
        onSelectAttention={() => {
          setStatus("All");
          setIndustry("All");
          setAttentionOnly(true);
        }}
      />

      <AdminAttentionList
        items={attention.map((item) => ({
          id: item.id,
          name: item.name,
          body: item.body,
          href: item.href,
          label: item.actionLabel,
          nameHref: item.clientId ? `/admin/clients/${item.clientId}` : item.href,
        }))}
      />

      <ClientFilters
        query={query}
        status={status}
        industry={industry}
        filtering={searching}
        onQueryChange={setQuery}
        onStatusChange={(value) => {
          setStatus(value);
          setAttentionOnly(false);
        }}
        onIndustryChange={setIndustry}
        onClear={clearFilters}
      />

      {clients.length === 0 ? (
        <AdminEmptyState
          title="No clients yet"
          body="Convert a qualified lead into a client to begin the portal and project workflow."
          action={
            <>
              {canViewLeads ? (
                <Link to="/admin/leads" className={`${adminGhostBtn} justify-center`}>
                  View Leads
                </Link>
              ) : null}
              {canManage ? (
                <Link to="/admin/clients/new" className={`${adminBlueBtn} justify-center`}>
                  Add Client
                </Link>
              ) : null}
            </>
          }
        />
      ) : visible.length === 0 ? (
        <AdminEmptyState
          title="No clients match your filters."
          body="Try a different name, business, email, phone, or filter."
          action={
            searching ? (
              <button type="button" className={`${adminGhostBtn} justify-center`} onClick={clearFilters}>
                Clear filters
              </button>
            ) : undefined
          }
        />
      ) : (
        <ClientTable
          clients={visible}
          records={records}
          conversations={conversations}
          canViewProjects={canViewProjects}
          canViewMessages={canViewMessages}
          canCreateProposal={canCreateProposal}
        />
      )}
    </div>
  );
}
