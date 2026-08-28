import { Link } from "react-router-dom";
import { ClientStatusBadge } from "@/components/admin/clients/ClientStatusBadge";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import { formatClientDate, projectCountLabel, type AgencyClient } from "@/data/agencyClients";

type ClientTableProps = {
  clients: AgencyClient[];
};

export function ClientTable({ clients }: ClientTableProps) {
  const { projects } = useLeads();
  if (clients.length === 0) return null;

  function countFor(clientId: string) {
    return projects.filter((project) => project.clientId === clientId && !project.archived).length;
  }

  return (
    <>
      <div className="hidden overflow-x-auto rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] md:block">
        <table className="w-full min-w-[52rem] text-left text-[13px]">
          <thead>
            <tr className="border-b border-[var(--admin-line)] text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--admin-muted)]">
              <th className="px-5 py-3 font-semibold">Business</th>
              <th className="px-5 py-3 font-semibold">Contact</th>
              <th className="px-5 py-3 font-semibold">Industry</th>
              <th className="px-5 py-3 font-semibold">Projects</th>
              <th className="px-5 py-3 font-semibold">Status</th>
              <th className="px-5 py-3 font-semibold">Last Activity</th>
              <th className="px-5 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((client) => (
              <tr key={client.id} className="border-b border-[var(--admin-line)] last:border-b-0 hover:bg-[var(--admin-bg)]">
                <td className="px-5 py-3.5 font-medium text-[var(--admin-ink)]">{client.businessName}</td>
                <td className="px-5 py-3.5">{client.contactName}</td>
                <td className="px-5 py-3.5">{client.industry}</td>
                <td className="px-5 py-3.5">{projectCountLabel(countFor(client.id))}</td>
                <td className="px-5 py-3.5">
                  <ClientStatusBadge status={client.status} />
                </td>
                <td className="px-5 py-3.5 text-[var(--admin-muted)]">{formatClientDate(client.lastActivityAt)}</td>
                <td className="px-5 py-3.5">
                  <Link
                    to={`/admin/clients/${client.id}`}
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
        {clients.map((client) => (
          <li
            key={client.id}
            className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-heading text-sm font-semibold text-[var(--admin-ink)]">{client.businessName}</p>
                <p className="mt-1 text-[12px] text-[var(--admin-muted)]">{client.contactName}</p>
                <p className="text-[12px] text-[var(--admin-muted)]">{client.email}</p>
              </div>
              <ClientStatusBadge status={client.status} />
            </div>
            <p className="mt-3 text-sm text-[var(--admin-ink)]">{client.industry}</p>
            <p className="mt-1 text-[12px] text-[var(--admin-muted)]">{projectCountLabel(countFor(client.id))}</p>
            <p className="mt-1 text-[12px] text-[var(--admin-muted)]">
              Last activity: {formatClientDate(client.lastActivityAt)}
            </p>
            <Link
              to={`/admin/clients/${client.id}`}
              className="mt-4 inline-flex h-9 items-center rounded-lg bg-[var(--admin-blue)] px-3 font-heading text-[12px] font-semibold text-white"
            >
              View Client
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
