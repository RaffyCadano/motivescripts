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
  contractSignatureCaption,
  contractWorkspaceLabel,
  formatContractCalendarDate,
  formatProposalValidUntil,
  proposalActivityAt,
  type DocumentStatus,
} from "@/data/documents";
import { fetchContractSummaries, fetchProposalSummaries, type ContractSummary, type ProposalSummary } from "@/data/documentsRepository";
import { fetchInvoiceSummaries, type InvoiceSummary } from "@/data/invoicesRepository";
import { formatUsdFromCents } from "@/data/money";
import { AgencyDbError } from "@/lib/dbErrors";

const statusFilters: Array<DocumentStatus | "All" | "awaiting"> = [
  "All",
  "draft",
  "sent",
  "awaiting",
  "accepted",
  "declined",
  "expired",
  "cancelled",
];

type StatusFilter = (typeof statusFilters)[number];
type PrimaryCard = "draft" | "sent" | "awaiting" | "accepted" | "declined";

function newContractHref(clientId: string | "All", searchParams: URLSearchParams) {
  const params = new URLSearchParams();
  const client = clientId !== "All" ? clientId : searchParams.get("client");
  const project = searchParams.get("project");
  const proposal = searchParams.get("proposal");
  if (client) params.set("client", client);
  if (project) params.set("project", project);
  if (proposal) params.set("proposal", proposal);
  const query = params.toString();
  return query ? `/admin/contracts/new?${query}` : "/admin/contracts/new";
}

function matchesStatus(row: ContractSummary, status: StatusFilter) {
  if (status === "All") return true;
  if (status === "awaiting") return awaitingResponse(row.effectiveStatus);
  return row.effectiveStatus === status;
}

function invoiceHref(row: ContractSummary) {
  const project = row.projectId ? `&project=${row.projectId}` : "";
  return `/admin/invoices/new?client=${row.clientId}&contract=${row.id}${project}`;
}

function contractOpenLabel(row: ContractSummary) {
  if (row.effectiveStatus === "draft") {
    return row.agencySigned ? "Send Contract" : "Sign Contract";
  }
  if (row.effectiveStatus === "declined") return "Review Contract";
  if (awaitingResponse(row.effectiveStatus)) return "View Contract";
  if (row.effectiveStatus === "accepted") return "View Contract";
  return "View";
}

export function AdminContracts() {
  const { clients, projects, notify } = useLeads();
  const { profile } = useAuth();
  const [searchParams] = useSearchParams();
  const [rows, setRows] = useState<ContractSummary[]>([]);
  const [proposals, setProposals] = useState<ProposalSummary[]>([]);
  const [invoices, setInvoices] = useState<InvoiceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("All");
  const [clientId, setClientId] = useState<string | "All">(searchParams.get("client") || "All");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");

  const canCreateInvoice = hasPermission(profile, "invoices.manage");
  const canViewInvoice = hasPermission(profile, "invoices.view");
  const canViewProposal = hasPermission(profile, "proposals.view");
  const createHref = newContractHref(clientId, searchParams);

  useEffect(() => {
    let active = true;
    void Promise.all([
      fetchContractSummaries(),
      fetchProposalSummaries().catch(() => [] as ProposalSummary[]),
      fetchInvoiceSummaries().catch(() => [] as InvoiceSummary[]),
    ])
      .then(([contracts, proposalRows, invoiceRows]) => {
        if (!active) return;
        setRows(contracts);
        setProposals(proposalRows);
        setInvoices(invoiceRows);
      })
      .catch((error) => notify(error instanceof AgencyDbError ? error.message : "Unable to load contracts."))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const proposalById = useMemo(() => {
    const map = new Map<string, ProposalSummary>();
    for (const item of proposals) map.set(item.id, item);
    return map;
  }, [proposals]);

  const invoiceByContract = useMemo(() => {
    const map = new Map<string, InvoiceSummary>();
    for (const item of invoices) {
      if (item.contractId && !map.has(item.contractId)) map.set(item.contractId, item);
    }
    return map;
  }, [invoices]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = rows.filter((row) => {
      if (!matchesStatus(row, status)) return false;
      if (clientId !== "All" && row.clientId !== clientId) return false;
      if (!needle) return true;
      const clientName = clients.find((item) => item.id === row.clientId)?.businessName ?? "";
      const projectName = projects.find((item) => item.id === row.projectId)?.name ?? "";
      const proposalNumber = row.proposalId ? (proposalById.get(row.proposalId)?.number ?? "") : "";
      return `${row.number} ${row.title} ${clientName} ${projectName} ${proposalNumber}`.toLowerCase().includes(needle);
    });
    return [...filtered].sort((a, b) =>
      sort === "newest" ? b.createdAt.localeCompare(a.createdAt) : a.createdAt.localeCompare(b.createdAt),
    );
  }, [clientId, clients, proposalById, projects, query, rows, sort, status]);

  const counts = {
    draft: rows.filter((row) => row.effectiveStatus === "draft").length,
    sent: rows.filter((row) => row.effectiveStatus === "sent").length,
    awaiting: rows.filter((row) => awaitingResponse(row.effectiveStatus)).length,
    accepted: rows.filter((row) => row.effectiveStatus === "accepted").length,
    declined: rows.filter((row) => row.effectiveStatus === "declined").length,
    expired: rows.filter((row) => row.effectiveStatus === "expired").length,
    cancelled: rows.filter((row) => row.effectiveStatus === "cancelled").length,
  };
  const acceptedProposals = proposals.filter((row) => row.effectiveStatus === "accepted").length;

  const attention = useMemo(() => {
    const items: { id: string; name: string; body: string; href: string; label: string }[] = [];
    for (const row of rows) {
      if (row.effectiveStatus === "draft" && !row.agencySigned) {
        items.push({
          id: row.id,
          name: row.number,
          body: "Draft — agency signature required before sending.",
          href: `/admin/contracts/${row.id}`,
          label: "Sign Contract",
        });
      } else if (row.effectiveStatus === "draft" && row.agencySigned) {
        items.push({
          id: row.id,
          name: row.number,
          body: "Agency Signed ✓ — ready to send to the client.",
          href: `/admin/contracts/${row.id}`,
          label: "Send Contract",
        });
      } else if (row.effectiveStatus === "declined") {
        items.push({
          id: row.id,
          name: row.number,
          body: "Declined — review the client response.",
          href: `/admin/contracts/${row.id}`,
          label: "Review Contract",
        });
      } else if (row.effectiveStatus === "accepted" && !invoiceByContract.get(row.id)) {
        items.push({
          id: row.id,
          name: row.number,
          body: "Contract accepted — invoice is the next step.",
          href: canCreateInvoice ? invoiceHref(row) : `/admin/contracts/${row.id}`,
          label: canCreateInvoice ? "Create Invoice" : "View Contract",
        });
      }
    }
    return items;
  }, [canCreateInvoice, invoiceByContract, rows]);

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
        title="Contracts"
        description="Agreements after a proposal is accepted. Sign, send, then wait for the client."
        action={
          <Link to={createHref} className={`${adminBlueBtn} justify-center`}>
            + New Contract
          </Link>
        }
      />

      <section aria-label="Contract status counts">
        <AdminStatGrid columns={5}>
          <AdminStatCard label="Draft" value={counts.draft} active={status === "draft"} onClick={() => selectPrimary("draft")} />
          <AdminStatCard label="Sent" value={counts.sent} active={status === "sent"} onClick={() => selectPrimary("sent")} />
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
          nameHref: `/admin/contracts/${item.id}`,
        }))}
      />

      <div className="space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row">
          <label className="min-w-0 flex-1">
            <span className="sr-only">Search contracts</span>
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
          label="Contract status"
          format={(item) =>
            item === "All" ? "All" : item === "awaiting" ? "Awaiting Response" : contractWorkspaceLabel(item)
          }
        />
      </div>

      {loading ? (
        <div className="h-36 animate-pulse rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)]" />
      ) : rows.length === 0 ? (
        <AdminEmptyState
          title="No contracts yet"
          body={
            acceptedProposals === 0
              ? "Contracts become available after a proposal is accepted. No accepted proposals yet."
              : "Contracts become available after a proposal is accepted."
          }
          action={
            <>
              {canViewProposal ? (
                <Link to="/admin/proposals" className={`${adminGhostBtn} justify-center`}>
                  View Proposals
                </Link>
              ) : null}
              {acceptedProposals > 0 ? (
                <Link to={createHref} className={`${adminBlueBtn} justify-center`}>
                  New Contract
                </Link>
              ) : null}
            </>
          }
        />
      ) : visible.length === 0 ? (
        <AdminEmptyState
          title="No contracts match your filters."
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
        <ContractList
          rows={visible}
          clients={clients}
          projects={projects}
          proposalById={proposalById}
          invoiceByContract={invoiceByContract}
          canCreateInvoice={canCreateInvoice}
          canViewInvoice={canViewInvoice}
          canViewProposal={canViewProposal}
        />
      )}

      <p className="text-[12px] leading-relaxed text-[var(--admin-muted)]">
        This is a workflow agreement in the MotiveScripts portal. It is not legal advice and is not a qualified digital
        signature.
      </p>
    </div>
  );
}

function ContractList({
  rows,
  clients,
  projects,
  proposalById,
  invoiceByContract,
  canCreateInvoice,
  canViewInvoice,
  canViewProposal,
}: {
  rows: ContractSummary[];
  clients: { id: string; businessName: string }[];
  projects: { id: string; name: string }[];
  proposalById: Map<string, ProposalSummary>;
  invoiceByContract: Map<string, InvoiceSummary>;
  canCreateInvoice: boolean;
  canViewInvoice: boolean;
  canViewProposal: boolean;
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
        <table className="w-full min-w-[76rem] text-left text-[13px]">
          <thead>
            <tr className="border-b border-[var(--admin-line)] text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--admin-muted)]">
              <th className="px-5 py-3 font-semibold">Contract</th>
              <th className="px-5 py-3 font-semibold">Client</th>
              <th className="px-5 py-3 font-semibold">Project</th>
              <th className="px-5 py-3 font-semibold">Status</th>
              <th className="px-5 py-3 font-semibold">Signature</th>
              <th className="px-5 py-3 font-semibold">Investment</th>
              <th className="px-5 py-3 font-semibold">Revision</th>
              <th className="px-5 py-3 font-semibold">Dates</th>
              <th className="px-5 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const proposal = row.proposalId ? proposalById.get(row.proposalId) : undefined;
              const invoice = invoiceByContract.get(row.id);
              return (
                <tr key={row.id} className="border-b border-[var(--admin-line)] last:border-b-0 hover:bg-[var(--admin-bg)]">
                  <td className="px-5 py-3.5">
                    <Link
                      to={`/admin/contracts/${row.id}`}
                      className="font-heading font-semibold text-[var(--admin-ink)] hover:text-[var(--admin-blue)]"
                    >
                      {row.number}
                    </Link>
                    <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">{row.title || "Agreement"}</p>
                    {proposal ? (
                      <p className="mt-1 text-[12px] text-[var(--admin-muted)]">
                        {canViewProposal ? (
                          <Link to={`/admin/proposals/${proposal.id}`} className="hover:text-[var(--admin-blue)] hover:underline">
                            Proposal: {proposal.number}
                          </Link>
                        ) : (
                          <>Proposal: {proposal.number}</>
                        )}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-5 py-3.5">{clientName(row.clientId)}</td>
                  <td className="px-5 py-3.5">{projectName(row.projectId)}</td>
                  <td className="px-5 py-3.5">
                    <DocumentStatusBadge status={row.effectiveStatus} label={contractWorkspaceLabel(row.effectiveStatus)} />
                  </td>
                  <td className="px-5 py-3.5 text-[12px] text-[var(--admin-ink)]">
                    {contractSignatureCaption({ status: row.effectiveStatus, agencySigned: row.agencySigned })}
                  </td>
                  <td className="px-5 py-3.5">
                    {proposal ? formatUsdFromCents(proposal.investmentCents) : "—"}
                  </td>
                  <td className="px-5 py-3.5">Revision {row.revisionNumber}</td>
                  <td className="px-5 py-3.5 text-[12px] text-[var(--admin-muted)]">
                    <p>Effective {formatContractCalendarDate(row.effectiveDate)}</p>
                    <p>{formatProposalValidUntil(row.expiresAt)}</p>
                    <p>Updated {formatClientDate(proposalActivityAt(row))}</p>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <Link
                        to={`/admin/contracts/${row.id}`}
                        className="font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline"
                      >
                        {contractOpenLabel(row)}
                      </Link>
                      {row.effectiveStatus === "accepted" && !invoice && canCreateInvoice ? (
                        <Link
                          to={invoiceHref(row)}
                          className="font-heading text-[12px] font-semibold text-[var(--admin-ink)] hover:underline"
                        >
                          Create Invoice
                        </Link>
                      ) : null}
                      {row.effectiveStatus === "accepted" && invoice && canViewInvoice ? (
                        <Link
                          to={`/admin/invoices/${invoice.id}`}
                          className="font-heading text-[12px] font-semibold text-[var(--admin-ink)] hover:underline"
                        >
                          View Invoice
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
          const proposal = row.proposalId ? proposalById.get(row.proposalId) : undefined;
          const invoice = invoiceByContract.get(row.id);
          return (
            <li
              key={row.id}
              className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Link
                    to={`/admin/contracts/${row.id}`}
                    className="font-heading text-sm font-semibold text-[var(--admin-ink)] hover:text-[var(--admin-blue)]"
                  >
                    {row.number}
                  </Link>
                  <p className="mt-1 text-sm text-[var(--admin-ink)]">{row.title || "Agreement"}</p>
                  <p className="mt-1 text-[12px] text-[var(--admin-muted)]">{clientName(row.clientId)}</p>
                  <p className="text-[12px] text-[var(--admin-muted)]">{projectName(row.projectId)}</p>
                </div>
                <DocumentStatusBadge status={row.effectiveStatus} label={contractWorkspaceLabel(row.effectiveStatus)} />
              </div>
              <p className="mt-3 text-[12px] text-[var(--admin-ink)]">
                {contractSignatureCaption({ status: row.effectiveStatus, agencySigned: row.agencySigned })}
              </p>
              {proposal ? (
                <p className="mt-1 text-[12px] text-[var(--admin-muted)]">
                  Proposal: {proposal.number} · {formatUsdFromCents(proposal.investmentCents)}
                </p>
              ) : null}
              <p className="mt-1 text-[12px] text-[var(--admin-muted)]">Revision {row.revisionNumber}</p>
              <p className="text-[12px] text-[var(--admin-muted)]">{formatProposalValidUntil(row.expiresAt)}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  to={`/admin/contracts/${row.id}`}
                  className="inline-flex h-9 items-center rounded-lg bg-[var(--admin-blue)] px-3 font-heading text-[12px] font-semibold text-white"
                >
                  {contractOpenLabel(row)}
                </Link>
                {row.effectiveStatus === "accepted" && !invoice && canCreateInvoice ? (
                  <Link
                    to={invoiceHref(row)}
                    className="inline-flex h-9 items-center rounded-lg border border-[var(--admin-line)] px-3 font-heading text-[12px] font-semibold text-[var(--admin-ink)]"
                  >
                    Create Invoice
                  </Link>
                ) : null}
                {row.effectiveStatus === "accepted" && invoice && canViewInvoice ? (
                  <Link
                    to={`/admin/invoices/${invoice.id}`}
                    className="inline-flex h-9 items-center rounded-lg border border-[var(--admin-line)] px-3 font-heading text-[12px] font-semibold text-[var(--admin-ink)]"
                  >
                    View Invoice
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
