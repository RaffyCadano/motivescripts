import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { adminBlueBtn, adminGhostBtn } from "@/components/admin/adminActionStyles";
import { AdminAttentionList } from "@/components/admin/list/AdminAttentionList";
import { AdminEmptyState } from "@/components/admin/list/AdminEmptyState";
import { AdminPageHeader } from "@/components/admin/list/AdminPageHeader";
import { LeadFilters } from "@/components/admin/leads/LeadFilters";
import { LeadSummary } from "@/components/admin/leads/LeadSummary";
import { LeadTable } from "@/components/admin/leads/LeadTable";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import { useAuth } from "@/auth/AuthProvider";
import { hasPermission } from "@/auth/permissions";
import { filterLeads, leadNeedsListAttention, type LeadIndustry, type LeadStatus } from "@/data/leads";

export function AdminLeads() {
  const { leads } = useLeads();
  const { profile } = useAuth();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<LeadStatus | "All">("All");
  const [industry, setIndustry] = useState<LeadIndustry | "All">("All");
  const canManage = hasPermission(profile, "leads.manage");

  const visible = useMemo(() => filterLeads(leads, query, status, industry), [industry, leads, query, status]);
  const attention = useMemo(() => leads.filter(leadNeedsListAttention), [leads]);
  const searching = query.trim().length > 0 || status !== "All" || industry !== "All";

  function clearFilters() {
    setQuery("");
    setStatus("All");
    setIndustry("All");
  }

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Leads"
        description="New inquiries and potential clients before they enter the portal workflow."
        action={
          canManage ? (
            <Link to="/admin/leads/new" className={`${adminBlueBtn} justify-center`}>
              + Add Lead
            </Link>
          ) : undefined
        }
      />

      <LeadSummary selected={status} onSelect={setStatus} />

      <AdminAttentionList
        items={attention.map((lead) => ({
          id: lead.id,
          name: lead.businessName,
          body: "New lead — review the inquiry and decide whether to contact or qualify the lead.",
          href: `/admin/leads/${lead.id}`,
          label: "Contact",
        }))}
      />

      <LeadFilters
        query={query}
        status={status}
        industry={industry}
        onQueryChange={setQuery}
        onStatusChange={setStatus}
        onIndustryChange={setIndustry}
        onClear={clearFilters}
      />

      {leads.length === 0 ? (
        <AdminEmptyState
          title="No leads yet"
          body="New inquiries from your website will appear here. Add a lead manually or wait for a new project request."
          action={
            canManage ? (
              <Link to="/admin/leads/new" className={`${adminBlueBtn} justify-center`}>
                Add Lead
              </Link>
            ) : undefined
          }
        />
      ) : visible.length === 0 ? (
        <AdminEmptyState
          title="No leads match your filters."
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
        <LeadTable leads={visible} />
      )}
    </div>
  );
}
