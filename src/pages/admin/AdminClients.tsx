import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ClientFilters } from "@/components/admin/clients/ClientFilters";
import { ClientSummary } from "@/components/admin/clients/ClientSummary";
import { ClientTable } from "@/components/admin/clients/ClientTable";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import { useAuth } from "@/auth/AuthProvider";
import { hasPermission } from "@/auth/permissions";
import { filterAgencyClients, type AgencyClientStatus } from "@/data/agencyClients";
import type { LeadIndustry } from "@/data/leads";

export function AdminClients() {
  const { clients } = useLeads();
  const { profile } = useAuth();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<AgencyClientStatus | "All">("All");
  const [industry, setIndustry] = useState<LeadIndustry | "All">("All");

  const visible = useMemo(
    () => filterAgencyClients(clients, query, status, industry),
    [clients, industry, query, status],
  );
  const searching = query.trim().length > 0 || status !== "All" || industry !== "All";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-heading text-[1.65rem] font-semibold tracking-tight md:text-3xl">Clients</h1>
          <p className="mt-1 text-sm text-[var(--admin-muted)]">Manage your clients and their ongoing projects.</p>
        </div>
        {hasPermission(profile, "clients.manage") ? (
          <Link
            to="/admin/clients/new"
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-[var(--admin-radius)] bg-[var(--admin-blue)] px-4 font-heading text-sm font-semibold text-white hover:bg-[var(--admin-bright)]"
          >
            + Add Client
          </Link>
        ) : null}
      </div>

      <ClientSummary />
      <ClientFilters
        query={query}
        status={status}
        industry={industry}
        onQueryChange={setQuery}
        onStatusChange={setStatus}
        onIndustryChange={setIndustry}
      />

      {clients.length === 0 ? (
        <Empty title="No clients yet" body="Convert a lead or add your first client." />
      ) : visible.length === 0 ? (
        <Empty
          title="No clients match your search."
          body={searching ? "Try a different name, business, email, or filter." : "No clients to show."}
        />
      ) : (
        <ClientTable clients={visible} />
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
