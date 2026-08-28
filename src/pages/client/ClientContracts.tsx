import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DocumentStatusBadge } from "@/components/documents/DocumentStatusBadge";
import { fetchClientContractSummaries, type ContractSummary } from "@/data/documentsRepository";
import { formatClientDate } from "@/data/agencyClients";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import { AgencyDbError } from "@/lib/dbErrors";

export function ClientContracts() {
  const { projects, notify } = useLeads();
  const [rows, setRows] = useState<ContractSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void fetchClientContractSummaries()
      .then((data) => {
        if (active) setRows(data);
      })
      .catch((error) => {
        notify(error instanceof AgencyDbError ? error.message : "Unable to load contracts.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="w-full space-y-6">
      <header>
        <h1 className="font-heading text-[1.75rem] font-semibold tracking-tight md:text-3xl">Contracts</h1>
        <p className="mt-1 text-sm text-[var(--client-muted)]">Review and accept agreements for your project.</p>
      </header>
      {loading ? (
        <div className="h-40 animate-pulse rounded-[var(--client-radius)] border border-[var(--client-line)] bg-[var(--client-card)]" />
      ) : rows.length === 0 ? (
        <div className="rounded-[var(--client-radius)] border border-dashed border-[var(--client-line)] bg-[var(--client-card)] px-5 py-10">
          <p className="font-heading text-sm font-semibold">No contracts yet</p>
          <p className="mt-1 text-sm text-[var(--client-muted)]">Accepted proposals can be followed by an agreement here.</p>
        </div>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-[var(--client-radius)] border border-[var(--client-line)] bg-[var(--client-card)] md:block">
            <table className="w-full min-w-[44rem] text-left text-[13px]">
              <thead>
                <tr className="border-b border-[var(--client-line)] text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--client-muted)]">
                  <th className="px-5 py-3">Contract #</th>
                  <th className="px-5 py-3">Title</th>
                  <th className="px-5 py-3">Project</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Effective</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-[var(--client-line)] last:border-b-0">
                    <td className="px-5 py-3.5">
                      <Link to={`/client/contracts/${row.id}`} className="font-heading font-semibold text-[var(--client-blue)] hover:underline">
                        {row.number}
                      </Link>
                    </td>
                    <td className="px-5 py-3.5">{row.title}</td>
                    <td className="px-5 py-3.5">{projects.find((item) => item.id === row.projectId)?.name ?? "—"}</td>
                    <td className="px-5 py-3.5">
                      <DocumentStatusBadge status={row.effectiveStatus} audience="client" />
                    </td>
                    <td className="px-5 py-3.5 text-[var(--client-muted)]">
                      {row.effectiveDate ? formatClientDate(`${row.effectiveDate}T00:00:00`) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="space-y-3 md:hidden">
            {rows.map((row) => (
              <li key={row.id} className="rounded-[var(--client-radius)] border border-[var(--client-line)] bg-[var(--client-card)] p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-heading text-sm font-semibold">{row.number}</p>
                    <p className="mt-1 text-sm">{row.title}</p>
                  </div>
                  <DocumentStatusBadge status={row.effectiveStatus} audience="client" />
                </div>
                <Link to={`/client/contracts/${row.id}`} className="mt-3 inline-flex font-heading text-sm font-semibold text-[var(--client-blue)]">
                  Review
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
