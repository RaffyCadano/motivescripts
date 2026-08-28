import { Link } from "react-router-dom";
import { LeadStatusBadge } from "@/components/admin/leads/LeadStatusBadge";
import { formatLeadDate, type Lead } from "@/data/leads";

type LeadTableProps = {
  leads: Lead[];
};

export function LeadTable({ leads }: LeadTableProps) {
  if (leads.length === 0) return null;

  return (
    <>
      <div className="hidden overflow-x-auto rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] md:block">
        <table className="w-full min-w-[52rem] text-left text-[13px]">
          <thead>
            <tr className="border-b border-[var(--admin-line)] text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--admin-muted)]">
              <th className="px-5 py-3 font-semibold">Business</th>
              <th className="px-5 py-3 font-semibold">Contact</th>
              <th className="px-5 py-3 font-semibold">Industry</th>
              <th className="px-5 py-3 font-semibold">Request</th>
              <th className="px-5 py-3 font-semibold">Status</th>
              <th className="px-5 py-3 font-semibold">Date</th>
              <th className="px-5 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr key={lead.id} className="border-b border-[var(--admin-line)] last:border-b-0 hover:bg-[var(--admin-bg)]">
                <td className="px-5 py-3.5 font-medium text-[var(--admin-ink)]">{lead.businessName}</td>
                <td className="px-5 py-3.5 text-[var(--admin-ink)]">{lead.name}</td>
                <td className="px-5 py-3.5">{lead.industry}</td>
                <td className="px-5 py-3.5">{lead.request}</td>
                <td className="px-5 py-3.5">
                  <LeadStatusBadge status={lead.status} />
                </td>
                <td className="px-5 py-3.5 text-[var(--admin-muted)]">{formatLeadDate(lead.createdAt)}</td>
                <td className="px-5 py-3.5">
                  <Link
                    to={`/admin/leads/${lead.id}`}
                    className="font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-3 md:hidden">
        {leads.map((lead) => (
          <li
            key={lead.id}
            className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-heading text-sm font-semibold text-[var(--admin-ink)]">{lead.businessName}</p>
                <p className="mt-1 text-[12px] text-[var(--admin-muted)]">
                  {lead.name}
                  <span aria-hidden="true"> · </span>
                  {lead.industry}
                </p>
              </div>
              <LeadStatusBadge status={lead.status} />
            </div>
            <p className="mt-3 text-sm text-[var(--admin-ink)]">{lead.request}</p>
            <p className="mt-1 text-[12px] text-[var(--admin-muted)]">{formatLeadDate(lead.createdAt)}</p>
            <Link
              to={`/admin/leads/${lead.id}`}
              className="mt-4 inline-flex h-9 items-center rounded-lg bg-[var(--admin-blue)] px-3 font-heading text-[12px] font-semibold text-white"
            >
              View Lead
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
