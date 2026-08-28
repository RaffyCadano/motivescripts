import { Link } from "react-router-dom";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { adminLeads } from "@/data/adminMockData";

export function RecentLeads() {
  return (
    <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)]">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--admin-line)] px-5 py-4">
        <h2 className="font-heading text-sm font-semibold tracking-tight">Recent Leads</h2>
        <Link
          className="text-[12px] font-medium text-[var(--admin-blue)] hover:underline"
          to="/admin/leads"
        >
          View all
        </Link>
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[36rem] text-left text-[13px]">
          <thead>
            <tr className="border-b border-[var(--admin-line)] text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--admin-muted)]">
              <th className="px-5 py-3 font-semibold">Business</th>
              <th className="px-5 py-3 font-semibold">Industry</th>
              <th className="px-5 py-3 font-semibold">Request</th>
              <th className="px-5 py-3 font-semibold">Status</th>
              <th className="px-5 py-3 font-semibold">Date</th>
            </tr>
          </thead>
          <tbody>
            {adminLeads.map((lead) => (
              <tr
                key={lead.id}
                className="border-b border-[var(--admin-line)] last:border-b-0 transition-colors hover:bg-[var(--admin-bg)]"
              >
                <td className="px-5 py-3.5 font-medium text-[var(--admin-ink)]">{lead.business}</td>
                <td className="px-5 py-3.5">{lead.industry}</td>
                <td className="px-5 py-3.5">{lead.request}</td>
                <td className="px-5 py-3.5">
                  <StatusBadge status={lead.status} />
                </td>
                <td className="px-5 py-3.5 text-[var(--admin-muted)]">{lead.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="divide-y divide-[var(--admin-line)] md:hidden">
        {adminLeads.map((lead) => (
          <li key={lead.id} className="px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-heading text-sm font-semibold text-[var(--admin-ink)]">{lead.business}</p>
                <p className="mt-1 text-[12px] text-[var(--admin-muted)]">
                  {lead.industry} · {lead.request}
                </p>
              </div>
              <StatusBadge status={lead.status} />
            </div>
            <p className="mt-2 text-[12px] text-[var(--admin-muted)]">{lead.date}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
