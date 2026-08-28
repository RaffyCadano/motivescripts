import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { InvoiceStatusBadge } from "@/components/invoices/InvoiceStatusBadge";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import {
  adminInvoiceStatusLabel,
  awaitingInvoicePayment,
  type EffectiveInvoiceStatus,
} from "@/data/invoices";
import { fetchInvoiceSummaries, type InvoiceSummary } from "@/data/invoicesRepository";
import { formatMoneyFromCents } from "@/data/money";
import { formatClientDate } from "@/data/agencyClients";
import { AgencyDbError } from "@/lib/dbErrors";

const statusFilters: Array<EffectiveInvoiceStatus | "All" | "awaiting"> = [
  "All",
  "draft",
  "awaiting",
  "overdue",
  "paid",
  "cancelled",
];

export function AdminInvoices() {
  const { clients, projects, notify } = useLeads();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [rows, setRows] = useState<InvoiceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<(typeof statusFilters)[number]>("All");
  const [clientId, setClientId] = useState<string | "All">(searchParams.get("client") || "All");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");

  useEffect(() => {
    let active = true;
    void fetchInvoiceSummaries()
      .then((data) => {
        if (active) setRows(data);
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

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = rows.filter((row) => {
      if (status === "awaiting" && (!awaitingInvoicePayment(row.effectiveStatus) || row.effectiveStatus === "overdue")) {
        return false;
      }
      if (status !== "All" && status !== "awaiting" && row.effectiveStatus !== status) return false;
      if (clientId !== "All" && row.clientId !== clientId) return false;
      if (!needle) return true;
      const clientName = clients.find((item) => item.id === row.clientId)?.businessName ?? "";
      const projectName = projects.find((item) => item.id === row.projectId)?.name ?? "";
      return `${row.number} ${clientName} ${projectName}`.toLowerCase().includes(needle);
    });
    return [...filtered].sort((a, b) =>
      sort === "newest" ? b.createdAt.localeCompare(a.createdAt) : a.createdAt.localeCompare(b.createdAt),
    );
  }, [clientId, clients, projects, query, rows, sort, status]);

  const counts = {
    draft: rows.filter((row) => row.effectiveStatus === "draft").length,
    awaiting: rows.filter((row) => awaitingInvoicePayment(row.effectiveStatus) && row.effectiveStatus !== "overdue").length,
    overdue: rows.filter((row) => row.effectiveStatus === "overdue").length,
    paid: rows.filter((row) => row.effectiveStatus === "paid").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-heading text-[1.65rem] font-semibold tracking-tight md:text-3xl">Invoices</h1>
          <p className="mt-1 text-sm text-[var(--admin-muted)]">
            Create invoices, send them to clients, and record payments by hand.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex h-10 shrink-0 items-center justify-center rounded-[var(--admin-radius)] bg-[var(--admin-blue)] px-4 font-heading text-sm font-semibold text-white hover:bg-[var(--admin-bright)]"
          onClick={() => navigate("/admin/invoices/new")}
        >
          + New Invoice
        </button>
      </div>

      <section aria-label="Invoice snapshot" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Draft", counts.draft],
          ["Awaiting Payment", counts.awaiting],
          ["Overdue", counts.overdue],
          ["Paid", counts.paid],
        ].map(([label, value]) => (
          <article key={label} className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] px-4 py-3">
            <p className="text-[12px] text-[var(--admin-muted)]">{label}</p>
            <p className="mt-1 font-heading text-2xl font-semibold tracking-tight">{value}</p>
          </article>
        ))}
      </section>

      <div className="flex flex-col gap-3 lg:flex-row">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search number or client"
          className="h-10 min-w-0 flex-1 rounded-lg border border-[var(--admin-line)] bg-white px-3 text-sm outline-none focus:border-[rgb(0_80_240_/_0.45)]"
        />
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as (typeof statusFilters)[number])}
          className="h-10 rounded-lg border border-[var(--admin-line)] bg-white px-3 text-sm"
        >
          {statusFilters.map((item) => (
            <option key={item} value={item}>
              {item === "All" ? "All statuses" : item === "awaiting" ? "Awaiting payment" : adminInvoiceStatusLabel(item)}
            </option>
          ))}
        </select>
        <select
          value={clientId}
          onChange={(event) => setClientId(event.target.value)}
          className="h-10 rounded-lg border border-[var(--admin-line)] bg-white px-3 text-sm"
        >
          <option value="All">All clients</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.businessName}
            </option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(event) => setSort(event.target.value === "oldest" ? "oldest" : "newest")}
          className="h-10 rounded-lg border border-[var(--admin-line)] bg-white px-3 text-sm"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>
      </div>

      {loading ? (
        <div className="h-40 animate-pulse rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)]" />
      ) : visible.length === 0 ? (
        <div className="rounded-[var(--admin-radius)] border border-dashed border-[var(--admin-line)] bg-[var(--admin-card)] px-5 py-10">
          <p className="font-heading text-sm font-semibold">No invoices yet</p>
          <p className="mt-1 text-sm text-[var(--admin-muted)]">Create an invoice after the client record exists.</p>
        </div>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] md:block">
            <table className="w-full min-w-[64rem] text-left text-[13px]">
              <thead>
                <tr className="border-b border-[var(--admin-line)] text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--admin-muted)]">
                  <th className="px-5 py-3">Invoice #</th>
                  <th className="px-5 py-3">Client</th>
                  <th className="px-5 py-3">Project</th>
                  <th className="px-5 py-3">Issue Date</th>
                  <th className="px-5 py-3">Due Date</th>
                  <th className="px-5 py-3">Amount</th>
                  <th className="px-5 py-3">Paid</th>
                  <th className="px-5 py-3">Due</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">View</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr key={row.id} className="border-b border-[var(--admin-line)] last:border-b-0 hover:bg-[var(--admin-bg)]">
                    <td className="px-5 py-3.5 font-medium">{row.number}</td>
                    <td className="px-5 py-3.5">{clients.find((item) => item.id === row.clientId)?.businessName ?? "—"}</td>
                    <td className="px-5 py-3.5">{projects.find((item) => item.id === row.projectId)?.name ?? "—"}</td>
                    <td className="px-5 py-3.5 text-[var(--admin-muted)]">{formatClientDate(`${row.issueDate}T00:00:00`)}</td>
                    <td className="px-5 py-3.5 text-[var(--admin-muted)]">{formatClientDate(`${row.dueDate}T00:00:00`)}</td>
                    <td className="px-5 py-3.5">{formatMoneyFromCents(row.totalCents, row.currency)}</td>
                    <td className="px-5 py-3.5">{formatMoneyFromCents(row.amountPaidCents, row.currency)}</td>
                    <td className="px-5 py-3.5">{formatMoneyFromCents(row.amountDueCents, row.currency)}</td>
                    <td className="px-5 py-3.5">
                      <InvoiceStatusBadge status={row.effectiveStatus} />
                    </td>
                    <td className="px-5 py-3.5">
                      <Link to={`/admin/invoices/${row.id}`} className="font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline">
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="space-y-3 md:hidden">
            {visible.map((row) => (
              <li key={row.id} className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-heading text-sm font-semibold">{row.number}</p>
                    <p className="mt-1 text-sm">{clients.find((item) => item.id === row.clientId)?.businessName ?? "—"}</p>
                    <p className="mt-1 text-[12px] text-[var(--admin-muted)]">
                      Due {formatClientDate(`${row.dueDate}T00:00:00`)}
                    </p>
                  </div>
                  <InvoiceStatusBadge status={row.effectiveStatus} />
                </div>
                <p className="mt-3 font-heading text-sm font-semibold">
                  {formatMoneyFromCents(row.amountDueCents, row.currency)} due
                </p>
                <Link to={`/admin/invoices/${row.id}`} className="mt-3 inline-flex font-heading text-[12px] font-semibold text-[var(--admin-blue)]">
                  View
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
