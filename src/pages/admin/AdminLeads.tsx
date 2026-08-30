import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { LeadFilters } from "@/components/admin/leads/LeadFilters";
import { LeadSummary } from "@/components/admin/leads/LeadSummary";
import { LeadTable } from "@/components/admin/leads/LeadTable";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import { useAuth } from "@/auth/AuthProvider";
import { hasPermission } from "@/auth/permissions";
import { filterLeads, type LeadIndustry, type LeadStatus } from "@/data/leads";

export function AdminLeads() {
  const { leads } = useLeads();
  const { profile } = useAuth();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<LeadStatus | "All">("All");
  const [industry, setIndustry] = useState<LeadIndustry | "All">("All");

  const visible = useMemo(() => filterLeads(leads, query, status, industry), [industry, leads, query, status]);
  const searching = query.trim().length > 0 || status !== "All" || industry !== "All";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-heading text-[1.65rem] font-semibold tracking-tight md:text-3xl">Leads</h1>
          <p className="mt-1 text-sm text-[var(--admin-muted)]">Manage project inquiries and potential clients.</p>
        </div>
        {hasPermission(profile, "leads.manage") ? (
          <Link
            to="/admin/leads/new"
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-[var(--admin-radius)] bg-[var(--admin-blue)] px-4 font-heading text-sm font-semibold text-white hover:bg-[var(--admin-bright)]"
          >
            + Add Lead
          </Link>
        ) : null}
      </div>

      <LeadSummary />
      <LeadFilters
        query={query}
        status={status}
        industry={industry}
        onQueryChange={setQuery}
        onStatusChange={setStatus}
        onIndustryChange={setIndustry}
      />

      {leads.length === 0 ? (
        <Empty title="No leads yet" body="Project inquiries from your website will appear here." />
      ) : visible.length === 0 ? (
        <Empty
          title="No leads match your search."
          body={searching ? "Try a different name, business, email, or filter." : "No leads to show."}
        />
      ) : (
        <LeadTable leads={visible} />
      )}
    </div>
  );
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[var(--admin-radius)] border border-dashed border-[var(--admin-line)] bg-[var(--admin-card)] px-5 py-10">
      <p className="font-heading text-sm font-semibold text-[var(--admin-ink)]">{title}</p>
      <p className="mt-1 text-sm text-[var(--admin-muted)]">{body}</p>
    </div>
  );
}
