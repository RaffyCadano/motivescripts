import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { adminBlueBtn, adminGhostBtn } from "@/components/admin/adminActionStyles";
import { AdminAttentionList } from "@/components/admin/list/AdminAttentionList";
import { AdminEmptyState } from "@/components/admin/list/AdminEmptyState";
import { AdminPageHeader } from "@/components/admin/list/AdminPageHeader";
import { AdminStatCard, AdminStatGrid } from "@/components/admin/list/AdminStatCard";
import { AdminStatusChips } from "@/components/admin/list/AdminStatusChips";
import { adminFilterControlState } from "@/components/admin/list/adminListStyles";
import { InvoiceStatusBadge } from "@/components/invoices/InvoiceStatusBadge";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import { useAuth } from "@/auth/AuthProvider";
import { hasPermission } from "@/auth/permissions";
import { formatClientDate } from "@/data/agencyClients";
import { buildOverviewInvoiceTotals } from "@/data/adminOverview";
import { fetchContractSummaries, type ContractSummary } from "@/data/documentsRepository";
import {
  awaitingInvoicePayment,
  formatInvoiceListDate,
  invoiceAmountCaption,
  invoiceFirstLineLabel,
  invoiceListPaymentLabel,
  invoiceWorkspaceLabel,
  type EffectiveInvoiceStatus,
} from "@/data/invoices";
import {
  fetchInvoiceFirstLines,
  fetchInvoicePaymentMethods,
  fetchInvoiceSummaries,
  type InvoicePaymentChannel,
  type InvoiceSummary,
} from "@/data/invoicesRepository";
import { formatMoneyFromCents } from "@/data/money";
import { AgencyDbError } from "@/lib/dbErrors";
import { cn } from "@/lib/cn";

const statusFilters: Array<EffectiveInvoiceStatus | "All" | "awaiting"> = [
  "All",
  "draft",
  "awaiting",
  "overdue",
  "paid",
  "cancelled",
];

type StatusFilter = (typeof statusFilters)[number];
type PrimaryCard = "draft" | "awaiting" | "overdue" | "paid";

function newInvoiceHref(clientId: string | "All", searchParams: URLSearchParams) {
  const params = new URLSearchParams();
  const client = clientId !== "All" ? clientId : searchParams.get("client");
  const project = searchParams.get("project");
  const contract = searchParams.get("contract");
  if (client) params.set("client", client);
  if (project) params.set("project", project);
  if (contract) params.set("contract", contract);
  const query = params.toString();
  return query ? `/admin/invoices/new?${query}` : "/admin/invoices/new";
}

function matchesStatus(row: InvoiceSummary, status: StatusFilter) {
  if (status === "All") return true;
  if (status === "awaiting") return awaitingInvoicePayment(row.effectiveStatus) && row.effectiveStatus !== "overdue";
  return row.effectiveStatus === status;
}

function invoiceOpenLabel(status: EffectiveInvoiceStatus) {
  return status === "draft" ? "Continue" : "View";
}

export function AdminInvoices() {
  const { clients, projects, notify } = useLeads();
  const { profile } = useAuth();
  const [searchParams] = useSearchParams();
  const [rows, setRows] = useState<InvoiceSummary[]>([]);
  const [contracts, setContracts] = useState<ContractSummary[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<Map<string, InvoicePaymentChannel[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("All");
  const [clientId, setClientId] = useState<string | "All">(searchParams.get("client") || "All");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");

  const canViewContracts = hasPermission(profile, "contracts.view");
  const canManage = hasPermission(profile, "invoices.manage");
  const createHref = newInvoiceHref(clientId, searchParams);

  useEffect(() => {
    let active = true;
    void Promise.all([
      fetchInvoiceSummaries(),
      fetchContractSummaries().catch(() => [] as ContractSummary[]),
    ])
      .then(async ([invoices, contractRows]) => {
        const ids = invoices.map((item) => item.id);
        const missingLines = invoices.filter((item) => !item.firstLine).map((item) => item.id);
        const [methods, lines] = await Promise.all([
          fetchInvoicePaymentMethods(ids).catch(() => new Map<string, InvoicePaymentChannel[]>()),
          fetchInvoiceFirstLines(missingLines).catch(() => new Map<string, string>()),
        ]);
        if (!active) return;
        setRows(
          invoices.map((item) => ({
            ...item,
            firstLine: item.firstLine ?? lines.get(item.id) ?? null,
          })),
        );
        setContracts(contractRows);
        setPaymentMethods(methods);
      })
      .catch((error) => {
        notify(error instanceof AgencyDbError ? error.message : "Unable to load invoices.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const contractById = useMemo(() => {
    const map = new Map<string, ContractSummary>();
    for (const item of contracts) map.set(item.id, item);
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
      const contractNumber = row.contractId ? (contractById.get(row.contractId)?.number ?? "") : "";
      const line = invoiceFirstLineLabel(row.firstLine) ?? "";
      return `${row.number} ${clientName} ${projectName} ${contractNumber} ${line}`.toLowerCase().includes(needle);
    });
    return [...filtered].sort((a, b) =>
      sort === "newest" ? b.createdAt.localeCompare(a.createdAt) : a.createdAt.localeCompare(b.createdAt),
    );
  }, [clientId, clients, contractById, projects, query, rows, sort, status]);

  const counts = {
    draft: rows.filter((row) => row.effectiveStatus === "draft").length,
    awaiting: rows.filter((row) => awaitingInvoicePayment(row.effectiveStatus) && row.effectiveStatus !== "overdue").length,
    overdue: rows.filter((row) => row.effectiveStatus === "overdue").length,
    paid: rows.filter((row) => row.effectiveStatus === "paid").length,
  };
  const totals = useMemo(() => buildOverviewInvoiceTotals(rows), [rows]);

  const attention = useMemo(() => {
    const items: { id: string; name: string; body: string; href: string; label: string; rank: number }[] = [];
    for (const row of rows) {
      if (row.effectiveStatus === "overdue") {
        items.push({
          id: row.id,
          name: row.number,
          body: `Overdue — ${formatMoneyFromCents(row.amountDueCents, row.currency)} outstanding. Due ${formatInvoiceListDate(row.dueDate)}.`,
          href: `/admin/invoices/${row.id}`,
          label: "View",
          rank: 0,
        });
      } else if (row.effectiveStatus === "draft") {
        items.push({
          id: row.id,
          name: row.number,
          body: "Draft — review the invoice before sending it to the client.",
          href: `/admin/invoices/${row.id}`,
          label: "Continue",
          rank: 1,
        });
      }
    }
    return items.sort((a, b) => a.rank - b.rank);
  }, [rows]);

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
        title="Invoices"
        description="Bill the client after a contract is accepted. Send the invoice, then collect payment online or record it by hand."
        action={
          canManage ? (
            <Link to={createHref} className={`${adminBlueBtn} justify-center`}>
              + New Invoice
            </Link>
          ) : undefined
        }
      />

      <section aria-label="Invoice status counts">
        <AdminStatGrid columns={4}>
          <AdminStatCard label="Draft" value={counts.draft} active={status === "draft"} onClick={() => selectPrimary("draft")} />
          <AdminStatCard
            label="Awaiting Payment"
            value={counts.awaiting}
            active={status === "awaiting"}
            onClick={() => selectPrimary("awaiting")}
          />
          <AdminStatCard
            label="Overdue"
            value={counts.overdue}
            active={status === "overdue"}
            onClick={() => selectPrimary("overdue")}
          />
          <AdminStatCard label="Paid" value={counts.paid} active={status === "paid"} onClick={() => selectPrimary("paid")} />
        </AdminStatGrid>
      </section>

      <section
        aria-label="Invoice totals"
        className="grid grid-cols-1 gap-3 rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] px-5 py-4 sm:grid-cols-3"
      >
        <MoneyStat label="Outstanding" value={formatMoneyFromCents(totals.outstanding)} />
        <MoneyStat label="Overdue" value={formatMoneyFromCents(totals.overdue)} emphasis={totals.overdue > 0} />
        <MoneyStat label="Paid" value={formatMoneyFromCents(totals.paid)} />
      </section>

      <AdminAttentionList items={attention} />

      <div className="space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row">
          <label className="min-w-0 flex-1">
            <span className="sr-only">Search invoices</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search number, client, project, or contract"
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
          label="Invoice status"
          format={(item) =>
            item === "All" ? "All" : item === "awaiting" ? "Awaiting Payment" : invoiceWorkspaceLabel(item)
          }
        />
      </div>

      {loading ? (
        <div className="h-36 animate-pulse rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)]" />
      ) : rows.length === 0 ? (
        <AdminEmptyState
          title="No invoices yet"
          body="Create an invoice after the commercial terms are ready and link it to the appropriate project or accepted contract. Creating an invoice does not send it."
          action={
            <>
              {canViewContracts ? (
                <Link to="/admin/contracts" className={`${adminGhostBtn} justify-center`}>
                  View Contracts
                </Link>
              ) : null}
              {canManage ? (
                <Link to={createHref} className={`${adminBlueBtn} justify-center`}>
                  New Invoice
                </Link>
              ) : null}
            </>
          }
        />
      ) : visible.length === 0 ? (
        <AdminEmptyState
          title="No invoices match your filters."
          body="Try a different number, client, project, or status."
          action={
            filtering ? (
              <button type="button" className={`${adminGhostBtn} justify-center`} onClick={clearFilters}>
                Clear filters
              </button>
            ) : undefined
          }
        />
      ) : (
        <InvoiceList
          rows={visible}
          clients={clients}
          projects={projects}
          contractById={contractById}
          paymentMethods={paymentMethods}
          canViewContracts={canViewContracts}
        />
      )}
    </div>
  );
}

function MoneyStat({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div>
      <p className="text-[12px] text-[var(--admin-muted)]">{label}</p>
      <p className={cn("mt-1 font-heading text-xl font-semibold", emphasis ? "text-[#b42318]" : "text-[var(--admin-ink)]")}>
        {value}
      </p>
    </div>
  );
}

function InvoiceList({
  rows,
  clients,
  projects,
  contractById,
  paymentMethods,
  canViewContracts,
}: {
  rows: InvoiceSummary[];
  clients: { id: string; businessName: string }[];
  projects: { id: string; name: string }[];
  contractById: Map<string, ContractSummary>;
  paymentMethods: Map<string, InvoicePaymentChannel[]>;
  canViewContracts: boolean;
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
        <table className="w-full min-w-[80rem] text-left text-[13px]">
          <thead>
            <tr className="border-b border-[var(--admin-line)] text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--admin-muted)]">
              <th className="px-5 py-3 font-semibold">Invoice</th>
              <th className="px-5 py-3 font-semibold">Client</th>
              <th className="px-5 py-3 font-semibold">Project</th>
              <th className="px-5 py-3 font-semibold">Contract</th>
              <th className="px-5 py-3 font-semibold">Amount</th>
              <th className="px-5 py-3 font-semibold">Status</th>
              <th className="px-5 py-3 font-semibold">Due</th>
              <th className="px-5 py-3 font-semibold">Updated</th>
              <th className="px-5 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const contract = row.contractId ? contractById.get(row.contractId) : undefined;
              const line = invoiceFirstLineLabel(row.firstLine);
              const paidHow = invoiceListPaymentLabel(paymentMethods.get(row.id) ?? []);
              const overdue = row.effectiveStatus === "overdue";
              return (
                <tr key={row.id} className="border-b border-[var(--admin-line)] last:border-b-0 hover:bg-[var(--admin-bg)]">
                  <td className="px-5 py-3.5">
                    <Link
                      to={`/admin/invoices/${row.id}`}
                      className="font-heading font-semibold text-[var(--admin-ink)] hover:text-[var(--admin-blue)]"
                    >
                      {row.number}
                    </Link>
                    {line ? <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">{line}</p> : null}
                  </td>
                  <td className="px-5 py-3.5">{clientName(row.clientId)}</td>
                  <td className="px-5 py-3.5">{projectName(row.projectId)}</td>
                  <td className="px-5 py-3.5">
                    {contract ? (
                      canViewContracts ? (
                        <Link
                          to={`/admin/contracts/${contract.id}`}
                          className="hover:text-[var(--admin-blue)] hover:underline"
                        >
                          {contract.number}
                        </Link>
                      ) : (
                        contract.number
                      )
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <p className="text-[var(--admin-ink)]">{formatMoneyFromCents(row.totalCents, row.currency)}</p>
                    <p className={cn("mt-0.5 font-heading text-[13px] font-semibold", overdue ? "text-[#b42318]" : "text-[var(--admin-ink)]")}>
                      {invoiceAmountCaption(row)}
                    </p>
                    {paidHow ? <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">{paidHow}</p> : null}
                  </td>
                  <td className="px-5 py-3.5">
                    <InvoiceStatusBadge status={row.effectiveStatus} label={invoiceWorkspaceLabel(row.effectiveStatus)} />
                  </td>
                  <td className={cn("px-5 py-3.5", overdue ? "font-semibold text-[#b42318]" : "text-[var(--admin-muted)]")}>
                    {overdue ? (
                      <>
                        <p>Overdue</p>
                        <p className="mt-0.5 font-normal">Due {formatInvoiceListDate(row.dueDate)}</p>
                        <p className="mt-0.5 font-normal">
                          {formatMoneyFromCents(row.amountDueCents, row.currency)} outstanding
                        </p>
                      </>
                    ) : (
                      formatInvoiceListDate(row.dueDate)
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-[var(--admin-muted)]">{formatClientDate(row.updatedAt || row.createdAt)}</td>
                  <td className="px-5 py-3.5">
                    <Link
                      to={`/admin/invoices/${row.id}`}
                      className="font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline"
                    >
                      {invoiceOpenLabel(row.effectiveStatus)}
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ul className="space-y-3 md:hidden">
        {rows.map((row) => {
          const contract = row.contractId ? contractById.get(row.contractId) : undefined;
          const line = invoiceFirstLineLabel(row.firstLine);
          const paidHow = invoiceListPaymentLabel(paymentMethods.get(row.id) ?? []);
          const overdue = row.effectiveStatus === "overdue";
          return (
            <li
              key={row.id}
              className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Link
                    to={`/admin/invoices/${row.id}`}
                    className="font-heading text-sm font-semibold text-[var(--admin-ink)] hover:text-[var(--admin-blue)]"
                  >
                    {row.number}
                  </Link>
                  <p className="mt-1 text-sm text-[var(--admin-ink)]">{clientName(row.clientId)}</p>
                  <p className="text-[12px] text-[var(--admin-muted)]">{projectName(row.projectId)}</p>
                  {line ? <p className="mt-1 text-[12px] text-[var(--admin-muted)]">{line}</p> : null}
                  {contract ? <p className="text-[12px] text-[var(--admin-muted)]">Contract: {contract.number}</p> : null}
                </div>
                <InvoiceStatusBadge status={row.effectiveStatus} label={invoiceWorkspaceLabel(row.effectiveStatus)} />
              </div>
              <p className={cn("mt-3 font-heading text-sm font-semibold", overdue ? "text-[#b42318]" : "text-[var(--admin-ink)]")}>
                {invoiceAmountCaption(row)}
              </p>
              <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">{formatMoneyFromCents(row.totalCents, row.currency)}</p>
              {paidHow ? <p className="text-[12px] text-[var(--admin-muted)]">{paidHow}</p> : null}
              <p className={cn("mt-1 text-[12px]", overdue ? "font-semibold text-[#b42318]" : "text-[var(--admin-muted)]")}>
                {overdue
                  ? `Overdue · Due ${formatInvoiceListDate(row.dueDate)} · ${formatMoneyFromCents(row.amountDueCents, row.currency)} outstanding`
                  : `Due ${formatInvoiceListDate(row.dueDate)}`}
              </p>
              <Link
                to={`/admin/invoices/${row.id}`}
                className="mt-4 inline-flex h-9 items-center rounded-lg bg-[var(--admin-blue)] px-3 font-heading text-[12px] font-semibold text-white"
              >
                {invoiceOpenLabel(row.effectiveStatus)}
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
