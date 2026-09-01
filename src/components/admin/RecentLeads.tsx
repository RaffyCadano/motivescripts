import { Link } from "react-router-dom";
import { LeadStatusBadge } from "@/components/admin/leads/LeadStatusBadge";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import { formatLeadDate } from "@/data/leads";

export function RecentLeads() {
  const { leads } = useLeads();
  const rows = leads.slice(0, 4);

  return (
    <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)]">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--admin-line)] px-5 py-4">
        <h2 className="font-heading text-sm font-semibold tracking-tight">Recent Leads</h2>
        <Link className="text-[12px] font-medium text-[var(--admin-blue)] hover:underline" to="/admin/leads">
          View all
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="px-5 py-8 text-sm text-[var(--admin-muted)]">No leads yet.</p>
      ) : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[40rem] text-left text-[13px]">
              <thead>
                <tr className="border-b border-[var(--admin-line)] text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--admin-muted)]">
                  <th className="px-5 py-3 font-semibold">Business</th>
                  <th className="px-5 py-3 font-semibold">Contact</th>
                  <th className="px-5 py-3 font-semibold">Industry</th>
                  <th className="px-5 py-3 font-semibold">Request</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold">Date</th>
                  <th className="px-5 py-3 font-semibold">
                    <span className="sr-only">Action</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((lead) => (
                  <tr
                    key={lead.id}
                    className="border-b border-[var(--admin-line)] last:border-b-0 transition-colors hover:bg-[var(--admin-bg)]"
                  >
                    <td className="px-5 py-3.5 font-medium text-[var(--admin-ink)]">
                      <Link className="hover:text-[var(--admin-blue)]" to={`/admin/leads/${lead.id}`}>
                        {lead.businessName}
                      </Link>
                    </td>
                    <td className="px-5 py-3.5">{lead.name}</td>
                    <td className="px-5 py-3.5">{lead.industry}</td>
                    <td className="px-5 py-3.5">{lead.request}</td>
                    <td className="px-5 py-3.5">
                      <LeadStatusBadge status={lead.status} />
                    </td>
                    <td className="px-5 py-3.5 text-[var(--admin-muted)]">{formatLeadDate(lead.createdAt)}</td>
                    <td className="px-5 py-3.5 text-right">
                      <Link
                        to={`/admin/leads/${lead.id}`}
                        className="font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline"
                      >
                        View Lead
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="divide-y divide-[var(--admin-line)] md:hidden">
            {rows.map((lead) => (
              <li key={lead.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link
                      className="font-heading text-sm font-semibold text-[var(--admin-ink)] hover:text-[var(--admin-blue)]"
                      to={`/admin/leads/${lead.id}`}
                    >
                      {lead.businessName}
                    </Link>
                    <p className="mt-1 text-[12px] text-[var(--admin-muted)]">
                      {lead.name} · {lead.industry} · {lead.request}
                    </p>
                  </div>
                  <LeadStatusBadge status={lead.status} />
                </div>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <p className="text-[12px] text-[var(--admin-muted)]">{formatLeadDate(lead.createdAt)}</p>
                  <Link
                    to={`/admin/leads/${lead.id}`}
                    className="font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline"
                  >
                    View Lead
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
