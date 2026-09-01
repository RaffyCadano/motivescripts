import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { adminBlueBtn, adminGhostBtn } from "@/components/admin/adminActionStyles";
import { AdminAttentionList } from "@/components/admin/list/AdminAttentionList";
import { AdminEmptyState } from "@/components/admin/list/AdminEmptyState";
import { AdminPageHeader } from "@/components/admin/list/AdminPageHeader";
import { AdminStatCard, AdminStatGrid } from "@/components/admin/list/AdminStatCard";
import { AdminStatusChips } from "@/components/admin/list/AdminStatusChips";
import { adminFilterControlState } from "@/components/admin/list/adminListStyles";
import { DocumentStatusBadge } from "@/components/documents/DocumentStatusBadge";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import { useAuth } from "@/auth/AuthProvider";
import { hasPermission } from "@/auth/permissions";
import { formatClientDate } from "@/data/agencyClients";
import {
  awaitingResponse,
  formatProposalValidUntil,
  proposalActivityAt,
  proposalWorkspaceLabel,
  type DocumentStatus,
} from "@/data/documents";
import {
  fetchContractSummaries,
  fetchProposalSummaries,
  type ContractSummary,
  type ProposalSummary,
} from "@/data/documentsRepository";
import { formatUsdFromCents } from "@/data/money";
import { AgencyDbError } from "@/lib/dbErrors";

const statusFilters: Array<DocumentStatus | "All" | "awaiting"> = [
  "All",
  "draft",
  "awaiting",
  "accepted",
  "declined",
  "expired",
  "cancelled",
];

type StatusFilter = (typeof statusFilters)[number];
type PrimaryCard = "draft" | "awaiting" | "accepted" | "declined";

function newProposalHref(clientId: string | "All", searchParams: URLSearchParams) {
  const params = new URLSearchParams();
  const client = clientId !== "All" ? clientId : searchParams.get("client");
  const project = searchParams.get("project");
  if (client) params.set("client", client);
  if (project) params.set("project", project);
  const query = params.toString();
  return query ? `/admin/proposals/new?${query}` : "/admin/proposals/new";
}

function matchesStatus(row: ProposalSummary, status: StatusFilter) {
  if (status === "All") return true;
  if (status === "awaiting") return awaitingResponse(row.effectiveStatus);
  return row.effectiveStatus === status;
}

function proposalOpenLabel(status: DocumentStatus) {
  if (status === "draft") return "Continue";
  if (status === "declined") return "Review";
  if (status === "accepted") return "Open Proposal";
  if (awaitingResponse(status)) return "View";
  return "Open";
}

function contractHref(row: ProposalSummary) {
  const project = row.projectId ? `&project=${row.projectId}` : "";
  return `/admin/contracts/new?client=${row.clientId}&proposal=${row.id}${project}`;
}

export function AdminProposals() {
  const { clients, projects, notify } = useLeads();
  const { profile } = useAuth();
  const [searchParams] = useSearchParams();
  const [rows, setRows] = useState<ProposalSummary[]>([]);
  const [contracts, setContracts] = useState<ContractSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("All");
  const [clientId, setClientId] = useState<string | "All">(searchParams.get("client") || "All");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");

  const canCreateContract = hasPermission(profile, "contracts.manage");
  const canViewContract = hasPermission(profile, "contracts.view");
  const createHref = newProposalHref(clientId, searchParams);

  useEffect(() => {
    let active = true;
    void Promise.all([
      fetchProposalSummaries(),
      fetchContractSummaries().catch(() => [] as ContractSummary[]),
    ])
      .then(([proposals, contractRows]) => {
        if (!active) return;
        setRows(proposals);
        setContracts(contractRows);
      })
      .catch((error) => {
        notify(error instanceof AgencyDbError ? error.message : "Unable to load proposals.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const contractByProposal = useMemo(() => {
    const map = new Map<string, ContractSummary>();
    for (const item of contracts) {
      if (item.proposalId && !map.has(item.proposalId)) map.set(item.proposalId, item);
    }
    return map;
  }, [contracts]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = rows.filter((row) => {
      if (!matchesStatus(row, status)) return false;
      if (clientId !== "All" && row.clientId !== clientId) return false;
      if (!needle) return true;
      const clientName = clients.find((item) => item.id === row.clientId)?.businessName ?? "";
      const projectName = projects.find((item) => item.id === row.projectId)?.name ?? "";
      return `${row.number} ${row.title} ${clientName} ${projectName}`.toLowerCase().includes(needle);
    });
    return [...filtered].sort((a, b) =>
      sort === "newest" ? b.createdAt.localeCompare(a.createdAt) : a.createdAt.localeCompare(b.createdAt),
    );
  }, [clientId, clients, projects, query, rows, sort, status]);

  const counts = {
    draft: rows.filter((row) => row.effectiveStatus === "draft").length,
    awaiting: rows.filter((row) => awaitingResponse(row.effectiveStatus)).length,
    accepted: rows.filter((row) => row.effectiveStatus === "accepted").length,
    declined: rows.filter((row) => row.effectiveStatus === "declined").length,
    expired: rows.filter((row) => row.effectiveStatus === "expired").length,
    cancelled: rows.filter((row) => row.effectiveStatus === "cancelled").length,
  };

  const attention = useMemo(() => {
    const items: { id: string; name: string; body: string; href: string; label: string }[] = [];
    for (const row of rows) {
      if (row.effectiveStatus === "draft") {
        items.push({
          id: row.id,
          name: row.number,
          body: "Draft — finish and send the proposal.",
          href: `/admin/proposals/${row.id}`,
          label: "Continue",
        });
      } else if (row.effectiveStatus === "declined") {
        items.push({
          id: row.id,
          name: row.number,
          body: "Declined — review the client response.",
          href: `/admin/proposals/${row.id}`,
          label: "Review",
        });
      } else if (row.effectiveStatus === "accepted" && !contractByProposal.get(row.id)) {
        items.push({
          id: row.id,
          name: row.number,
          body: "Accepted — contract is the next step.",
          href: canCreateContract ? contractHref(row) : `/admin/proposals/${row.id}`,
          label: canCreateContract ? "Create Contract" : "Open Proposal",
        });
      }
    }
    return items;
  }, [canCreateContract, contractByProposal, rows]);

  const filtering = query.trim().length > 0 || status !== "All" || clientId !== "All" || sort !== "newest";

  function clearFilters() {
    setQuery("");
    setStatus("All");
    setClientId("All");
    setSort("newest");
  }

  function selectPrimary(id: PrimaryCard) {
    setStatus(status === id ? "All" : id);
  }

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Proposals"
        description="Scope, investment, and terms for client review after a project is ready."
        action={
          <Link to={createHref} className={`${adminBlueBtn} justify-center`}>
            + New Proposal
          </Link>
        }
      />

      <section aria-label="Proposal status counts">
        <AdminStatGrid columns={4}>
          <AdminStatCard label="Draft" value={counts.draft} active={status === "draft"} onClick={() => selectPrimary("draft")} />
          <AdminStatCard
            label="Awaiting Response"
            value={counts.awaiting}
            active={status === "awaiting"}
            onClick={() => selectPrimary("awaiting")}
          />
          <AdminStatCard
            label="Accepted"
            value={counts.accepted}
            active={status === "accepted"}
            onClick={() => selectPrimary("accepted")}
          />
          <AdminStatCard
            label="Declined"
            value={counts.declined}
            active={status === "declined"}
            onClick={() => selectPrimary("declined")}
          />
        </AdminStatGrid>
        <div className="mt-2.5 grid grid-cols-2 gap-2.5">
          <AdminStatCard
            label="Expired"
            value={counts.expired}
            active={status === "expired"}
            secondary
            onClick={() => setStatus(status === "expired" ? "All" : "expired")}
          />
          <AdminStatCard
            label="Cancelled"
            value={counts.cancelled}
            active={status === "cancelled"}
            secondary
            onClick={() => setStatus(status === "cancelled" ? "All" : "cancelled")}
          />
        </div>
      </section>

      <AdminAttentionList
        items={attention.map((item) => ({
          ...item,
          nameHref: `/admin/proposals/${item.id}`,
        }))}
      />

      <div className="space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row">
          <label className="min-w-0 flex-1">
            <span className="sr-only">Search proposals</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search number, title, client, or project"
              className={adminFilterControlState(Boolean(query.trim()))}
            />
          </label>
          <label className="lg:w-56">
            <span className="sr-only">Client</span>
            <select
              value={clientId}
              onChange={(event) => setClientId(event.target.value)}
              className={adminFilterControlState(clientId !== "All")}
            >
              <option value="All">All clients</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.businessName}
                </option>
              ))}
            </select>
          </label>
          <label className="lg:w-44">
            <span className="sr-only">Sort</span>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value === "oldest" ? "oldest" : "newest")}
              className={adminFilterControlState(sort !== "newest")}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </label>
          {filtering ? (
            <button type="button" className={`${adminGhostBtn} shrink-0 justify-center`} onClick={clearFilters}>
              Clear filters
            </button>
          ) : null}
        </div>
        <AdminStatusChips
          items={statusFilters}
          value={status}
          onChange={setStatus}
          label="Proposal status"
          format={(item) => (item === "All" ? "All" : item === "awaiting" ? "Awaiting Response" : proposalWorkspaceLabel(item))}
        />
      </div>

      {loading ? (
        <div className="h-36 animate-pulse rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)]" />
      ) : rows.length === 0 ? (
        <AdminEmptyState
          title="No proposals yet"
          body="Create a proposal after a client and project are ready for pricing and scope review."
          action={
            <Link to={createHref} className={`${adminBlueBtn} justify-center`}>
              New Proposal
            </Link>
          }
        />
      ) : visible.length === 0 ? (
        <AdminEmptyState
          title="No proposals match your filters."
          body="Try a different number, title, client, or status."
          action={
            filtering ? (
              <button type="button" className={`${adminGhostBtn} justify-center`} onClick={clearFilters}>
                Clear filters
              </button>
            ) : undefined
          }
        />
      ) : (
        <ProposalList
          rows={visible}
          clients={clients}
          projects={projects}
          contractByProposal={contractByProposal}
          canCreateContract={canCreateContract}
          canViewContract={canViewContract}
        />
      )}
    </div>
  );
}

function ProposalList({
  rows,
  clients,
  projects,
  contractByProposal,
  canCreateContract,
  canViewContract,
}: {
  rows: ProposalSummary[];
  clients: { id: string; businessName: string }[];
  projects: { id: string; name: string }[];
  contractByProposal: Map<string, ContractSummary>;
  canCreateContract: boolean;
  canViewContract: boolean;
}) {
  function clientName(id: string) {
    return clients.find((item) => item.id === id)?.businessName ?? "—";
  }
  function projectName(id: string | null) {
    return id ? (projects.find((item) => item.id === id)?.name ?? "—") : "—";
  }

  return (
    <>
      <div className="hidden overflow-x-auto rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] md:block">
        <table className="w-full min-w-[72rem] text-left text-[13px]">
          <thead>
            <tr className="border-b border-[var(--admin-line)] text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--admin-muted)]">
              <th className="px-5 py-3 font-semibold">Proposal</th>
              <th className="px-5 py-3 font-semibold">Client</th>
              <th className="px-5 py-3 font-semibold">Project</th>
              <th className="px-5 py-3 font-semibold">Status</th>
              <th className="px-5 py-3 font-semibold">Investment</th>
              <th className="px-5 py-3 font-semibold">Revision</th>
              <th className="px-5 py-3 font-semibold">Updated</th>
              <th className="px-5 py-3 font-semibold">Valid until</th>
              <th className="px-5 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const contract = contractByProposal.get(row.id);
              return (
                <tr key={row.id} className="border-b border-[var(--admin-line)] last:border-b-0 hover:bg-[var(--admin-bg)]">
                  <td className="px-5 py-3.5">
                    <Link
                      to={`/admin/proposals/${row.id}`}
                      className="font-heading font-semibold text-[var(--admin-ink)] hover:text-[var(--admin-blue)]"
                    >
                      {row.number}
                    </Link>
                    <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">{row.title || "Untitled"}</p>
                  </td>
                  <td className="px-5 py-3.5">{clientName(row.clientId)}</td>
                  <td className="px-5 py-3.5">{projectName(row.projectId)}</td>
                  <td className="px-5 py-3.5">
                    <DocumentStatusBadge status={row.effectiveStatus} label={proposalWorkspaceLabel(row.effectiveStatus)} />
                  </td>
                  <td className="px-5 py-3.5">{formatUsdFromCents(row.investmentCents)}</td>
                  <td className="px-5 py-3.5">Revision {row.revisionNumber}</td>
                  <td className="px-5 py-3.5 text-[var(--admin-muted)]">{formatClientDate(proposalActivityAt(row))}</td>
                  <td className="px-5 py-3.5 text-[var(--admin-muted)]">{formatProposalValidUntil(row.validUntil)}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <Link
                        to={`/admin/proposals/${row.id}`}
                        className="font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline"
                      >
                        {proposalOpenLabel(row.effectiveStatus)}
                      </Link>
                      {row.effectiveStatus === "accepted" && !contract && canCreateContract ? (
                        <Link
                          to={contractHref(row)}
                          className="font-heading text-[12px] font-semibold text-[var(--admin-ink)] hover:underline"
                        >
                          Create Contract
                        </Link>
                      ) : null}
                      {row.effectiveStatus === "accepted" && contract && canViewContract ? (
                        <Link
                          to={`/admin/contracts/${contract.id}`}
                          className="font-heading text-[12px] font-semibold text-[var(--admin-ink)] hover:underline"
                        >
                          View Contract
                        </Link>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ul className="space-y-3 md:hidden">
        {rows.map((row) => {
          const contract = contractByProposal.get(row.id);
          return (
            <li
              key={row.id}
              className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Link
                    to={`/admin/proposals/${row.id}`}
                    className="font-heading text-sm font-semibold text-[var(--admin-ink)] hover:text-[var(--admin-blue)]"
                  >
                    {row.number}
                  </Link>
                  <p className="mt-1 text-sm text-[var(--admin-ink)]">{row.title || "Untitled"}</p>
                  <p className="mt-1 text-[12px] text-[var(--admin-muted)]">{clientName(row.clientId)}</p>
                  <p className="text-[12px] text-[var(--admin-muted)]">{projectName(row.projectId)}</p>
                </div>
                <DocumentStatusBadge status={row.effectiveStatus} label={proposalWorkspaceLabel(row.effectiveStatus)} />
              </div>
              <p className="mt-3 font-heading text-sm font-semibold">{formatUsdFromCents(row.investmentCents)}</p>
              <p className="mt-1 text-[12px] text-[var(--admin-muted)]">Revision {row.revisionNumber}</p>
              <p className="text-[12px] text-[var(--admin-muted)]">{formatProposalValidUntil(row.validUntil)}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  to={`/admin/proposals/${row.id}`}
                  className="inline-flex h-9 items-center rounded-lg bg-[var(--admin-blue)] px-3 font-heading text-[12px] font-semibold text-white"
                >
                  {proposalOpenLabel(row.effectiveStatus)}
                </Link>
                {row.effectiveStatus === "accepted" && !contract && canCreateContract ? (
                  <Link
                    to={contractHref(row)}
                    className="inline-flex h-9 items-center rounded-lg border border-[var(--admin-line)] px-3 font-heading text-[12px] font-semibold text-[var(--admin-ink)]"
                  >
                    Create Contract
                  </Link>
                ) : null}
                {row.effectiveStatus === "accepted" && contract && canViewContract ? (
                  <Link
                    to={`/admin/contracts/${contract.id}`}
                    className="inline-flex h-9 items-center rounded-lg border border-[var(--admin-line)] px-3 font-heading text-[12px] font-semibold text-[var(--admin-ink)]"
                  >
                    View Contract
                  </Link>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
